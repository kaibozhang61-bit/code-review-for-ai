import * as fs from 'fs';
import * as path from 'path';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import { DEFAULT_BRIDGE_PORT, type BridgeSession, type CreateSessionResponse } from './protocol';
import type { ChangeSet, ReviewResult } from '../types';

interface BridgeState {
	sessions: BridgeSession[];
}

interface SubmitBody {
	result: ReviewResult;
	savedResultPath: string;
}

const port = readNumberFlag('--port') ?? DEFAULT_BRIDGE_PORT;
const dataDir = readStringFlag('--data-dir') ?? path.join(process.cwd(), '.ai-review', 'bridge');
const statePath = path.join(dataDir, 'state.json');

async function main() {
	await fs.promises.mkdir(dataDir, { recursive: true });
	const state = await loadState();

	const server = createServer(async (request, response) => {
		try {
			await routeRequest(request, response, state);
		} catch (error) {
			response.writeHead(500, { 'Content-Type': 'application/json' });
			response.end(
				JSON.stringify({
					error: error instanceof Error ? error.message : 'Unknown bridge server error',
				}),
			);
		}
	});

	server.listen(port, '127.0.0.1', () => {
		console.log(`AI Review bridge listening on http://127.0.0.1:${port}`);
		console.log(`Bridge state file: ${statePath}`);
	});
}

async function routeRequest(
	request: IncomingMessage,
	response: ServerResponse,
	state: BridgeState,
) {
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

		state.sessions.push(session);
		await saveState(state);

		const payload: CreateSessionResponse = {
			sessionId: session.sessionId,
			status: session.status,
		};
		return sendJson(response, 201, payload);
	}

	if (method === 'POST' && requestUrl.pathname === '/sessions/claim-next') {
		const nextSession = state.sessions.find((session) => session.status === 'queued');
		if (!nextSession) {
			response.writeHead(204);
			response.end();
			return;
		}

		nextSession.status = 'claimed';
		nextSession.claimedAt = new Date().toISOString();
		await saveState(state);
		return sendJson(response, 200, { session: nextSession });
	}

	const sessionMatch = requestUrl.pathname.match(/^\/sessions\/([^/]+)(?:\/(requeue|result))?$/);
	if (!sessionMatch) {
		return sendJson(response, 404, { error: 'Not found' });
	}

	const [, sessionId, action] = sessionMatch;
	const session = state.sessions.find((entry) => entry.sessionId === sessionId);
	if (!session) {
		return sendJson(response, 404, { error: `Unknown session ${sessionId}` });
	}

	if (method === 'GET' && !action) {
		return sendJson(response, 200, { session });
	}

	if (method === 'POST' && action === 'requeue') {
		session.status = 'queued';
		delete session.claimedAt;
		await saveState(state);
		return sendJson(response, 200, { session });
	}

	if (method === 'POST' && action === 'result') {
		const body = await readJsonBody<SubmitBody>(request);
		session.status = 'submitted';
		session.submittedAt = new Date().toISOString();
		session.result = body.result;
		session.savedResultPath = body.savedResultPath;
		await saveState(state);
		return sendJson(response, 200, { session });
	}

	return sendJson(response, 405, { error: 'Method not allowed' });
}

async function loadState(): Promise<BridgeState> {
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

async function saveState(state: BridgeState) {
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

function readNumberFlag(flag: string) {
	const value = readStringFlag(flag);
	return value ? Number.parseInt(value, 10) : undefined;
}

function readStringFlag(flag: string) {
	const index = process.argv.indexOf(flag);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

void main();
