import type { ChangeSet, ReviewResult } from '../types';
import {
	DEFAULT_BRIDGE_URL,
	type CreateSessionResponse,
	type SessionStatusResponse,
} from './protocol';

export async function createBridgeSession(changeSet: ChangeSet, baseUrl = DEFAULT_BRIDGE_URL) {
	const response = await request<CreateSessionResponse>(`${baseUrl}/sessions`, {
		method: 'POST',
		body: JSON.stringify({ changeSet }),
		headers: {
			'Content-Type': 'application/json',
		},
	});

	return response;
}

export async function getBridgeSession(sessionId: string, baseUrl = DEFAULT_BRIDGE_URL) {
	const response = await request<SessionStatusResponse>(`${baseUrl}/sessions/${sessionId}`, {
		method: 'GET',
	});
	return response.session;
}

async function request<T = undefined>(input: string, init?: RequestInit) {
	try {
		const response = await fetch(input, init);
		if (response.status === 204) {
			return undefined as T;
		}

		if (!response.ok) {
			throw new Error(`Bridge request failed: ${response.status} ${response.statusText}`);
		}

		if (response.status === 202) {
			return undefined as T;
		}

		return (await response.json()) as T;
	} catch (error) {
		if (isConnectionRefused(error)) {
			return undefined as T;
		}

		throw error;
	}
}

function isConnectionRefused(error: unknown) {
	return error instanceof TypeError;
}
