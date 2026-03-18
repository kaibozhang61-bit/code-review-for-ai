import * as assert from 'assert';
import * as vscode from 'vscode';
import { createReviewPanelState, buildReviewResult } from '../reviewState';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('builds diff hunks and submission payloads', () => {
		const state = createReviewPanelState({
			id: 'change-set-1',
			changes: [
				{
					filePath: 'src/example.ts',
					originalContent: 'const value = 1;\n',
					proposedContent: 'const value = 2;\nconst next = value + 1;\n',
				},
			],
		});

		assert.strictEqual(state.files.length, 1);
		assert.strictEqual(state.files[0].hunks.length, 1);
		assert.ok(state.files[0].hunks[0].lines.some((line) => line.type === 'add'));

		state.files[0].hunks[0].status = 'human-modified';
		const addedLine = state.files[0].hunks[0].lines.find((line) => line.type === 'add');
		assert.ok(addedLine);
		if (addedLine) {
			addedLine.currentContent = 'const value = 3;';
		}

		state.inlineComments.push({
			filePath: 'src/example.ts',
			lineNumber: 1,
			side: 'proposed',
			text: 'Please double-check this update.',
		});

		const result = buildReviewResult(state);
		assert.strictEqual(result.reviewId, '');
		assert.strictEqual(result.changeSetId, 'change-set-1');
		assert.strictEqual(result.fileReviews[0].hunkReviews[0].status, 'human-modified');
		assert.deepStrictEqual(result.inlineComments[0].text, 'Please double-check this update.');
	});
});
