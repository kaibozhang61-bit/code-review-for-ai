import * as fs from 'fs';
import * as process from 'process';
import { createDemoChangeSet } from '../demoChangeSet';
import { createBridgeSession, getBridgeSession } from './client';
import { DEFAULT_BRIDGE_URL } from './protocol';
import type { ChangeSet } from '../types';

async function main() {
	const [command, ...args] = process.argv.slice(2);

	switch (command) {
		case 'open':
			await openFromFile(args[0]);
			return;
		case 'demo':
			await openChangeSet(createDemoChangeSet());
			return;
		case 'status':
			await printStatus(args[0]);
			return;
		case 'wait':
			await waitForResult(args[0]);
			return;
		default:
			printUsage();
	}
}

async function openFromFile(filePath: string | undefined) {
	if (!filePath) {
		throw new Error('Missing path to a change set JSON file.');
	}

	const raw = await fs.promises.readFile(filePath, 'utf8');
	await openChangeSet(JSON.parse(raw) as ChangeSet);
}

async function openChangeSet(changeSet: ChangeSet) {
	const session = await createBridgeSession(changeSet);
	if (!session) {
		throw new Error(
			`Could not reach the AI Review bridge at ${DEFAULT_BRIDGE_URL}. ` +
				'Make sure the AI Review extension is installed and VS Code is running.',
		);
	}

	console.log(`Queued review session ${session.sessionId} for change set "${changeSet.id}".`);
	console.log(`Next step: review it in VS Code, then run: npm run bridge:wait -- ${session.sessionId}`);
}

async function printStatus(sessionId: string | undefined) {
	if (!sessionId) {
		throw new Error('Missing session id.');
	}

	const session = await getBridgeSession(sessionId);
	if (!session) {
		throw new Error(`Session ${sessionId} was not found.`);
	}

	console.log(JSON.stringify(session, null, 2));
}

async function waitForResult(sessionId: string | undefined) {
	if (!sessionId) {
		throw new Error('Missing session id.');
	}

	const timeoutMs = readNumberFlag('--timeout') ?? 10 * 60 * 1000;
	const intervalMs = readNumberFlag('--interval') ?? 1500;
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeoutMs) {
		const session = await getBridgeSession(sessionId);
		if (!session) {
			throw new Error(`Session ${sessionId} was not found.`);
		}

		if (session.status === 'submitted' && session.result) {
			console.log(JSON.stringify(session.result, null, 2));
			return;
		}

		await sleep(intervalMs);
	}

	throw new Error(`Timed out waiting for review session ${sessionId}.`);
}

function printUsage() {
	console.log('AI Review bridge CLI');
	console.log('  node dist/bridge/cli.js open <changeset.json>');
	console.log('  node dist/bridge/cli.js demo');
	console.log('  node dist/bridge/cli.js status <session-id>');
	console.log('  node dist/bridge/cli.js wait <session-id> [--timeout <ms>] [--interval <ms>]');
}

function readNumberFlag(flag: string) {
	const index = process.argv.indexOf(flag);
	if (index < 0) {
		return undefined;
	}

	return Number.parseInt(process.argv[index + 1] ?? '', 10);
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

void main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
