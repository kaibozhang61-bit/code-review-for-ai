import { structuredPatch } from 'diff';
import type { DiffHunk, DiffLine, FileChange } from './types';

export function buildDiffHunks(change: FileChange): DiffHunk[] {
	const patch = structuredPatch(
		change.filePath,
		change.filePath,
		change.originalContent,
		change.proposedContent,
		'',
		'',
	);

	return patch.hunks.map((hunk, index) => {
		let oldLineNumber = hunk.oldStart;
		let newLineNumber = hunk.newStart;

		const lines = hunk.lines.map((line, lineIndex) => {
			const marker = line[0];
			const content = line.slice(1);
			const lineId = `${index}:${lineIndex}`;

			if (marker === '-') {
				return createLine(lineId, 'remove', content, oldLineNumber++, null);
			}

			if (marker === '+') {
				return createLine(lineId, 'add', content, null, newLineNumber++, content);
			}

			if (marker === '\\') {
				return createLine(lineId, 'meta', line, null, null);
			}

			return createLine(lineId, 'context', content, oldLineNumber++, newLineNumber++);
		});

		return {
			index,
			header: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
			oldStart: hunk.oldStart,
			oldLines: hunk.oldLines,
			newStart: hunk.newStart,
			newLines: hunk.newLines,
			lines,
			status: 'pending',
		};
	});
}

function createLine(
	lineId: string,
	type: DiffLine['type'],
	content: string,
	oldLineNumber: number | null,
	newLineNumber: number | null,
	proposedContent?: string,
): DiffLine {
	return {
		lineId,
		type,
		content,
		oldLineNumber,
		newLineNumber,
		originalProposedContent: proposedContent,
		currentContent: proposedContent,
	};
}
