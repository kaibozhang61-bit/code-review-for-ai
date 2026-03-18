export interface ChangeSet {
	id: string;
	changes: FileChange[];
}

export interface FileChange {
	filePath: string;
	originalContent: string;
	proposedContent: string;
	description?: string;
}

export type HunkStatus = 'pending' | 'accepted' | 'rejected' | 'human-modified';

export interface InlineComment {
	filePath: string;
	lineNumber: number;
	side: 'original' | 'proposed';
	text: string;
}

export interface HunkReview {
	hunkIndex: number;
	status: 'accepted' | 'rejected' | 'human-modified';
	originalProposedLines?: string[];
	humanModifiedLines?: string[];
	rejectionComment?: string;
}

export interface FileReview {
	filePath: string;
	hunkReviews: HunkReview[];
}

export interface ReviewResult {
	reviewId: string;
	changeSetId: string;
	fileReviews: FileReview[];
	inlineComments: InlineComment[];
	submittedAt: string;
}

export interface ShowReviewOptions {
	onSubmit?: (result: ReviewResult, savedResultPath: string) => void | PromiseLike<void>;
	onClose?: () => void | PromiseLike<void>;
}

export type DiffLineType = 'context' | 'add' | 'remove' | 'meta';

export interface DiffLine {
	lineId: string;
	type: DiffLineType;
	content: string;
	oldLineNumber: number | null;
	newLineNumber: number | null;
	originalProposedContent?: string;
	currentContent?: string;
}

export interface DiffHunk {
	index: number;
	header: string;
	oldStart: number;
	oldLines: number;
	newStart: number;
	newLines: number;
	lines: DiffLine[];
	status: HunkStatus;
	rejectionComment?: string;
}

export interface ReviewFile {
	filePath: string;
	description?: string;
	hunks: DiffHunk[];
}

export interface ReviewPanelState {
	changeSetId: string;
	files: ReviewFile[];
	inlineComments: InlineComment[];
}

export interface ReviewSubmissionMessage {
	type: 'submit-review';
	payload: ReviewPanelState;
}

export interface InitializeMessage {
	type: 'initialize';
	payload: ReviewPanelState;
}

export type PanelMessage = ReviewSubmissionMessage | InitializeMessage;
