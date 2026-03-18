import type { ChangeSet, ReviewResult } from '../types';
import {
	DEFAULT_BRIDGE_URL,
	type ClaimedSessionResponse,
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

export async function claimNextBridgeSession(baseUrl = DEFAULT_BRIDGE_URL) {
	const response = await request<ClaimedSessionResponse | undefined>(`${baseUrl}/sessions/claim-next`, {
		method: 'POST',
	});

	return response?.session;
}

export async function requeueBridgeSession(sessionId: string, baseUrl = DEFAULT_BRIDGE_URL) {
	await request(`${baseUrl}/sessions/${sessionId}/requeue`, {
		method: 'POST',
	});
}

export async function submitBridgeReviewResult(
	sessionId: string,
	result: ReviewResult,
	savedResultPath: string,
	baseUrl = DEFAULT_BRIDGE_URL,
) {
	await request(`${baseUrl}/sessions/${sessionId}/result`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ result, savedResultPath }),
	});
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
