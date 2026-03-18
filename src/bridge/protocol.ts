import type { ChangeSet, ReviewResult } from '../types';

export const DEFAULT_BRIDGE_PORT = 47831;
export const DEFAULT_BRIDGE_URL = `http://127.0.0.1:${DEFAULT_BRIDGE_PORT}`;

export type BridgeSessionStatus = 'queued' | 'claimed' | 'submitted';

export interface BridgeSession {
	sessionId: string;
	changeSet: ChangeSet;
	status: BridgeSessionStatus;
	createdAt: string;
	claimedAt?: string;
	submittedAt?: string;
	result?: ReviewResult;
	savedResultPath?: string;
}

export interface CreateSessionResponse {
	sessionId: string;
	status: BridgeSessionStatus;
}

export interface SessionStatusResponse {
	session: BridgeSession;
}
