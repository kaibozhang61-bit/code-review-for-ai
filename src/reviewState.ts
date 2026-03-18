import { buildDiffHunks } from './diffUtils';
import type {
	ChangeSet,
	DiffHunk,
	FileReview,
	HunkReview,
	ReviewFile,
	ReviewPanelState,
	ReviewResult,
} from './types';

export function createReviewPanelState(changeSet: ChangeSet): ReviewPanelState {
	return {
		changeSetId: changeSet.id,
		files: changeSet.changes.map<ReviewFile>((change) => ({
			filePath: change.filePath,
			description: change.description,
			hunks: buildDiffHunks(change),
		})),
		inlineComments: [],
	};
}

export function buildReviewResult(state: ReviewPanelState): ReviewResult {
	return buildReviewResultWithId(state, '');
}

export function buildReviewResultWithId(
	state: ReviewPanelState,
	reviewId: string,
): ReviewResult {
	return {
		reviewId,
		changeSetId: state.changeSetId,
		fileReviews: state.files.map<FileReview>((file) => ({
			filePath: file.filePath,
			hunkReviews: file.hunks
				.map((hunk) => toHunkReview(hunk))
				.filter((review): review is HunkReview => review !== undefined),
		})),
		inlineComments: state.inlineComments,
		submittedAt: new Date().toISOString(),
	};
}

function toHunkReview(hunk: DiffHunk): HunkReview | undefined {
	if (hunk.status === 'pending') {
		return undefined;
	}

	const originalProposedLines = hunk.lines
		.filter((line) => line.type === 'add')
		.map((line) => line.originalProposedContent ?? line.content);

	const humanModifiedLines = hunk.lines
		.filter((line) => line.type === 'add')
		.map((line) => line.currentContent ?? line.content);

	return {
		hunkIndex: hunk.index,
		status: hunk.status,
		originalProposedLines: originalProposedLines.length > 0 ? originalProposedLines : undefined,
		humanModifiedLines:
			hunk.status === 'human-modified' && humanModifiedLines.length > 0
				? humanModifiedLines
				: undefined,
		rejectionComment: hunk.status === 'rejected' ? hunk.rejectionComment : undefined,
	};
}
