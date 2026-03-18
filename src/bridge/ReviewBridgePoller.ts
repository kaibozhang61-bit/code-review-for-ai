import * as vscode from 'vscode';
import { claimNextBridgeSession, requeueBridgeSession, submitBridgeReviewResult } from './client';
import { ReviewPanel } from '../ReviewPanel';
import type { ChangeSet, ReviewResult } from '../types';

const BRIDGE_POLL_INTERVAL_MS = 1500;

export class ReviewBridgePoller implements vscode.Disposable {
	private readonly timer: NodeJS.Timeout;
	private currentSessionId?: string;
	private isPolling = false;

	public constructor(private readonly context: vscode.ExtensionContext) {
		this.timer = setInterval(() => {
			void this.poll();
		}, BRIDGE_POLL_INTERVAL_MS);

		void this.poll();
	}

	public dispose() {
		clearInterval(this.timer);
	}

	private async poll() {
		if (this.isPolling || this.currentSessionId || ReviewPanel.isOpen()) {
			return;
		}

		this.isPolling = true;

		try {
			const session = await claimNextBridgeSession();
			if (!session) {
				return;
			}

			this.currentSessionId = session.sessionId;

			await ReviewPanel.show(this.context, session.changeSet as ChangeSet, {
				onSubmit: async (result, savedResultPath) => {
					await this.handleSubmit(session.sessionId, result, savedResultPath);
				},
				onClose: async () => {
					await this.handleClose(session.sessionId);
				},
			});
		} finally {
			this.isPolling = false;
		}
	}

	private async handleSubmit(sessionId: string, result: ReviewResult, savedResultPath: string) {
		try {
			await submitBridgeReviewResult(sessionId, result, savedResultPath);
		} finally {
			this.currentSessionId = undefined;
		}
	}

	private async handleClose(sessionId: string) {
		try {
			await requeueBridgeSession(sessionId);
		} finally {
			this.currentSessionId = undefined;
		}
	}
}
