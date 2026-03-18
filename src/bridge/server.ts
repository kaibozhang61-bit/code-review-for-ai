import * as fs from 'fs';
import * as path from 'path';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import { ReviewPanel } from '../ReviewPanel';
import { DEFAULT_BRIDGE_PORT, type BridgeSession, type CreateSessionResponse } from './protocol';
import type { ChangeSet, ReviewResult } from '../types';

interface BridgeState {
	sessions: BridgeSession[];
}

export class ReviewBridgeServer implements vscode.Disposable {
	private readonly statePath: string;
	private readonly state: BridgeState = { sessions: [] };
	private server?: ReturnType<typeof createServer>;
	private activeSessionId?: string;
	private startupPromise?: Promise<void>;

	public constructor(private readonly context: vscode.ExtensionContext) {
		this.statePath = path.join(context.globalStorageUri.fsPath, 'bridge-state.json');
	}

	public start() {
		if (!this.startupPromise) {
			this.startupPromise = this.startInternal();
		}

		return this.startupPromise;
	}

	public dispose() {
		this.server?.close();
	}

	private async startInternal() {
		await fs.promises.mkdir(this.context.globalStorageUri.fsPath, { recursive: true });
		const loadedState = await loadState(this.statePath);
		this.state.sessions = loadedState.sessions.map((session) =>
			session.status === 'claimed'
				? {
						...session,
						status: 'queued',
						claimedAt: undefined,
				  }
				: session,
		);

		this.server = createServer(async (request, response) => {
			try {
				await this.routeRequest(request, response);
			} catch (error) {
				response.writeHead(500, { 'Content-Type': 'application/json' });
				response.end(
					JSON.stringify({
						error: error instanceof Error ? error.message : 'Unknown bridge server error',
					}),
				);
			}
		});

		this.server.on('error', (error) => {
			const message =
				error instanceof Error ? error.message : 'Unknown error while starting the review bridge.';
			void vscode.window.showWarningMessage(`AI Review bridge failed to start: ${message}`);
		});

		await new Promise<void>((resolve, reject) => {
			this.server?.listen(DEFAULT_BRIDGE_PORT, '127.0.0.1', () => resolve());
			this.server?.once('error', reject);
		});

		await saveState(this.statePath, this.state);
		void this.openNextQueuedSession();
	}

	private async routeRequest(request: IncomingMessage, response: ServerResponse) {
		const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
		const method = request.method ?? 'GET';

		if (method === 'GET' && requestUrl.pathname === '/health') {
			return sendJson(response, 200, { ok: true });
		}

		if (method === 'POST' && requestUrl.pathname === '/sessions') {
			const body = await readJsonBody<{ changeSet: ChangeSet }>(request);
			const session: BridgeSession = {
				sessionId: randomUUID(),
				changeSet: body.changeSet,
				status: 'queued',
				createdAt: new Date().toISOString(),
			};

			this.state.sessions.push(session);
			await saveState(this.statePath, this.state);
			void this.openNextQueuedSession();

			const payload: CreateSessionResponse = {
				sessionId: session.sessionId,
				status: session.status,
			};
			return sendJson(response, 201, payload);
		}

		const sessionMatch = requestUrl.pathname.match(/^\/sessions\/([^/]+)$/);
		if (!sessionMatch) {
			return sendJson(response, 404, { error: 'Not found' });
		}

		const [, sessionId] = sessionMatch;
		const session = this.state.sessions.find((entry) => entry.sessionId === sessionId);
		if (!session) {
			return sendJson(response, 404, { error: `Unknown session ${sessionId}` });
		}

		if (method === 'GET') {
			return sendJson(response, 200, { session });
		}

		return sendJson(response, 405, { error: 'Method not allowed' });
	}

	private async openNextQueuedSession() {
		if (this.activeSessionId || ReviewPanel.isOpen()) {
			return;
		}

		const nextSession = this.state.sessions.find((session) => session.status === 'queued');
		if (!nextSession) {
			return;
		}

		this.activeSessionId = nextSession.sessionId;
		nextSession.status = 'claimed';
		nextSession.claimedAt = new Date().toISOString();
		await saveState(this.statePath, this.state);

		try {
			await ReviewPanel.show(this.context, nextSession.changeSet, {
				onSubmit: async (result, savedResultPath) => {
					await this.handleSubmit(nextSession.sessionId, result, savedResultPath);
				},
				onClose: async () => {
					await this.handleClose(nextSession.sessionId);
				},
			});
		} catch (error) {
			this.activeSessionId = undefined;
			nextSession.status = 'queued';
			nextSession.claimedAt = undefined;
			await saveState(this.statePath, this.state);
			throw error;
		}
	}

	private async handleSubmit(sessionId: string, result: ReviewResult, savedResultPath: string) {
		const session = this.state.sessions.find((entry) => entry.sessionId === sessionId);
		if (!session) {
			this.activeSessionId = undefined;
			return;
		}

		session.status = 'submitted';
		session.submittedAt = new Date().toISOString();
		session.result = result;
		session.savedResultPath = savedResultPath;
		this.activeSessionId = undefined;
		await saveState(this.statePath, this.state);
		void this.openNextQueuedSession();
	}

	private async handleClose(sessionId: string) {
		const session = this.state.sessions.find((entry) => entry.sessionId === sessionId);
		if (!session) {
			this.activeSessionId = undefined;
			return;
		}

		session.status = 'queued';
		session.claimedAt = undefined;
		this.activeSessionId = undefined;
		await saveState(this.statePath, this.state);
	}
}

async function loadState(statePath: string): Promise<BridgeState> {
	try {
		const content = await fs.promises.readFile(statePath, 'utf8');
		return JSON.parse(content) as BridgeState;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return { sessions: [] };
		}

		throw error;
	}
}

async function saveState(statePath: string, state: BridgeState) {
	await fs.promises.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
}

async function readJsonBody<T>(request: IncomingMessage) {
	const chunks: Uint8Array[] = [];

	for await (const chunk of request) {
		chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
	}

	const raw = Buffer.concat(chunks).toString('utf8');
	return JSON.parse(raw) as T;
}

function sendJson(
	response: ServerResponse,
	statusCode: number,
	payload: unknown,
) {
	response.writeHead(statusCode, { 'Content-Type': 'application/json' });
	response.end(JSON.stringify(payload));
}
