import * as vscode from 'vscode';
import { ReviewBridgePoller } from './bridge/ReviewBridgePoller';
import { createDemoChangeSet } from './demoChangeSet';
import { ReviewPanel } from './ReviewPanel';
import type { ChangeSet, ShowReviewOptions } from './types';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'aiReview.showReview',
			async (changeSet: ChangeSet, options?: ShowReviewOptions) => {
				if (!isValidChangeSet(changeSet)) {
					vscode.window.showErrorMessage('AI Review expected a valid change set input.');
					return;
				}

				await ReviewPanel.show(context, changeSet, options);
			},
		),
		vscode.commands.registerCommand('aiReview.openDemoReview', async () => {
			await ReviewPanel.show(context, createDemoChangeSet());
		}),
	);

	context.subscriptions.push(new ReviewBridgePoller(context));
}

export function deactivate() {}

function isValidChangeSet(value: ChangeSet | undefined): value is ChangeSet {
	return Boolean(
		value &&
			typeof value.id === 'string' &&
			Array.isArray(value.changes) &&
			value.changes.every(
				(change) =>
					typeof change.filePath === 'string' &&
					typeof change.originalContent === 'string' &&
					typeof change.proposedContent === 'string',
			),
	);
}
