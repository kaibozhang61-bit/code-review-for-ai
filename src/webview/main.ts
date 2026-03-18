import { renderDiffView } from './DiffView';
import { renderFileList } from './FileList';
import type {
	DiffLine,
	HunkStatus,
	InlineComment,
	ReviewPanelState,
} from '../types';

declare function acquireVsCodeApi(): {
	getState(): StoredState | undefined;
	setState(data: StoredState): void;
	postMessage(message: unknown): void;
};

interface StoredState {
	panelState?: ReviewPanelState;
	uiState?: UiState;
}

interface UiState {
	selectedFileIndex: number;
	activeCommentKey?: string;
	activeEditKey?: string;
	commentDraft: string;
	editDraft: string;
}

const vscode = acquireVsCodeApi();
const root = document.getElementById('root');

let panelState: ReviewPanelState | undefined;
let uiState: UiState = {
	selectedFileIndex: 0,
	commentDraft: '',
	editDraft: '',
};

const storedState = vscode.getState();
if (storedState?.panelState) {
	panelState = storedState.panelState;
	uiState = { ...uiState, ...storedState.uiState };
}

window.addEventListener('message', (event: MessageEvent<{ type: string; payload: ReviewPanelState }>) => {
	if (event.data.type !== 'initialize') {
		return;
	}

	panelState = event.data.payload;
	uiState = {
		selectedFileIndex: 0,
		commentDraft: '',
		editDraft: '',
	};
	saveState();
	render();
});

root?.addEventListener('click', (event) => {
	const target = event.target;
	if (!(target instanceof HTMLElement)) {
		return;
	}

	const actionElement = target.closest<HTMLElement>('[data-action]');
	if (!actionElement) {
		return;
	}

	const action = actionElement.dataset.action;
	if (!action || !panelState) {
		return;
	}

	switch (action) {
		case 'select-file':
			uiState.selectedFileIndex = readIndex(actionElement.dataset.fileIndex);
			uiState.activeCommentKey = undefined;
			uiState.activeEditKey = undefined;
			uiState.commentDraft = '';
			uiState.editDraft = '';
			render();
			return;
		case 'toggle-file-accept':
			event.stopPropagation();
			applyStatusToFile(readIndex(actionElement.dataset.fileIndex), target instanceof HTMLInputElement && target.checked ? 'accepted' : 'pending');
			return;
		case 'accept-file':
			event.stopPropagation();
			applyStatusToFile(readIndex(actionElement.dataset.fileIndex), 'accepted');
			return;
		case 'reject-file':
			event.stopPropagation();
			applyStatusToFile(readIndex(actionElement.dataset.fileIndex), 'rejected');
			return;
		case 'accept-hunk':
			applyStatusToHunk(uiState.selectedFileIndex, readIndex(actionElement.dataset.hunkIndex), 'accepted');
			return;
		case 'reject-hunk':
			applyStatusToHunk(uiState.selectedFileIndex, readIndex(actionElement.dataset.hunkIndex), 'rejected');
			return;
		case 'open-comment':
			openComment(readIndex(actionElement.dataset.hunkIndex), readIndex(actionElement.dataset.lineIndex));
			return;
		case 'cancel-comment':
			uiState.activeCommentKey = undefined;
			uiState.commentDraft = '';
			saveState();
			render();
			return;
		case 'save-comment':
			saveComment(readIndex(actionElement.dataset.hunkIndex), readIndex(actionElement.dataset.lineIndex));
			return;
		case 'start-edit':
			startEdit(readIndex(actionElement.dataset.hunkIndex), readIndex(actionElement.dataset.lineIndex));
			return;
		case 'cancel-edit':
			uiState.activeEditKey = undefined;
			uiState.editDraft = '';
			saveState();
			render();
			return;
		case 'save-edit':
			saveEdit(readIndex(actionElement.dataset.hunkIndex), readIndex(actionElement.dataset.lineIndex));
			return;
		case 'accept-all':
			applyStatusToAll('accepted');
			return;
		case 'reject-all':
			applyStatusToAll('rejected');
			return;
		case 'submit-review':
			vscode.postMessage({ type: 'submit-review', payload: panelState });
			return;
		default:
			return;
	}
});

root?.addEventListener('input', (event) => {
	const target = event.target;
	if (!(target instanceof HTMLInputElement) || !panelState) {
		return;
	}

	const role = target.dataset.role;
	if (role === 'comment-input') {
		uiState.commentDraft = target.value;
		saveState();
		return;
	}

	if (role === 'edit-input') {
		uiState.editDraft = target.value;
		saveState();
		return;
	}

	if (role === 'rejection-input') {
		const hunkIndex = readIndex(target.dataset.hunkIndex);
		const hunk = panelState.files[uiState.selectedFileIndex]?.hunks[hunkIndex];
		if (!hunk) {
			return;
		}

		hunk.rejectionComment = target.value;
		saveState();
	}
});

root?.addEventListener('keydown', (event) => {
	const target = event.target;
	if (!(target instanceof HTMLInputElement) || !panelState) {
		return;
	}

	if (target.dataset.role === 'comment-input' && event.key === 'Enter' && !event.shiftKey) {
		event.preventDefault();
		saveComment(readIndex(target.dataset.hunkIndex), readIndex(target.dataset.lineIndex));
	}

	if (target.dataset.role === 'edit-input' && event.key === 'Enter' && !event.shiftKey) {
		event.preventDefault();
		saveEdit(readIndex(target.dataset.hunkIndex), readIndex(target.dataset.lineIndex));
	}

	if (event.key === 'Escape' && target.dataset.role === 'comment-input') {
		uiState.activeCommentKey = undefined;
		uiState.commentDraft = '';
		saveState();
		render();
	}

	if (event.key === 'Escape' && target.dataset.role === 'edit-input') {
		uiState.activeEditKey = undefined;
		uiState.editDraft = '';
		saveState();
		render();
	}
});

render();

function render() {
	if (!root) {
		return;
	}

	if (!panelState) {
		root.innerHTML = '<main class="shell"><section class="empty-state"><h2>Waiting for review data</h2><p>Open the panel from <code>aiReview.showReview</code> with a change set payload.</p></section></main>';
		return;
	}

	const selectedFile = panelState.files[uiState.selectedFileIndex];
	root.innerHTML = `
		<main class="shell">
			<aside class="sidebar">
				${renderFileList(panelState, uiState.selectedFileIndex)}
			</aside>
			<section class="content">
				${renderDiffView(selectedFile, {
					activeCommentKey: uiState.activeCommentKey,
					activeEditKey: uiState.activeEditKey,
					commentDraft: uiState.commentDraft,
					editDraft: uiState.editDraft,
					inlineComments: panelState.inlineComments,
				})}
			</section>
			<footer class="footer">
				<button class="footer-button" type="button" data-action="reject-all">Reject All</button>
				<button class="footer-button" type="button" data-action="accept-all">Accept All</button>
				<button class="footer-button primary" type="button" data-action="submit-review">Submit Review</button>
			</footer>
		</main>
	`;

	saveState();
	focusActiveInput();
}

function applyStatusToAll(status: HunkStatus) {
	panelState?.files.forEach((file, fileIndex) => applyStatusToFile(fileIndex, status, false));
	saveState();
	render();
}

function applyStatusToFile(fileIndex: number, status: HunkStatus, shouldRender = true) {
	const file = panelState?.files[fileIndex];
	if (!file) {
		return;
	}

	file.hunks.forEach((hunk) => {
		hunk.status = status;
		if (status !== 'rejected') {
			hunk.rejectionComment = undefined;
		}
	});

	saveState();
	if (shouldRender) {
		render();
	}
}

function applyStatusToHunk(fileIndex: number, hunkIndex: number, status: HunkStatus) {
	const hunk = panelState?.files[fileIndex]?.hunks[hunkIndex];
	if (!hunk) {
		return;
	}

	hunk.status = status;
	if (status !== 'rejected') {
		hunk.rejectionComment = undefined;
	}

	saveState();
	render();
}

function openComment(hunkIndex: number, lineIndex: number) {
	uiState.activeCommentKey = `${hunkIndex}:${lineIndex}`;
	uiState.commentDraft = '';
	saveState();
	render();
}

function saveComment(hunkIndex: number, lineIndex: number) {
	if (!panelState) {
		return;
	}

	const file = panelState.files[uiState.selectedFileIndex];
	const line = file?.hunks[hunkIndex]?.lines[lineIndex];
	const text = uiState.commentDraft.trim();
	if (!file || !line || !text) {
		return;
	}

	const comment = createInlineComment(file.filePath, line, text);
	if (!comment) {
		return;
	}

	panelState.inlineComments.push(comment);
	uiState.activeCommentKey = undefined;
	uiState.commentDraft = '';
	saveState();
	render();
}

function startEdit(hunkIndex: number, lineIndex: number) {
	const line = panelState?.files[uiState.selectedFileIndex]?.hunks[hunkIndex]?.lines[lineIndex];
	if (!line || line.type !== 'add') {
		return;
	}

	uiState.activeEditKey = `${hunkIndex}:${lineIndex}`;
	uiState.editDraft = line.currentContent ?? line.content;
	saveState();
	render();
}

function saveEdit(hunkIndex: number, lineIndex: number) {
	const hunk = panelState?.files[uiState.selectedFileIndex]?.hunks[hunkIndex];
	const line = hunk?.lines[lineIndex];
	if (!hunk || !line || line.type !== 'add') {
		return;
	}

	line.currentContent = uiState.editDraft;
	hunk.status = 'human-modified';
	uiState.activeEditKey = undefined;
	uiState.editDraft = '';
	saveState();
	render();
}

function createInlineComment(filePath: string, line: DiffLine, text: string): InlineComment | undefined {
	const side = line.type === 'remove' ? 'original' : 'proposed';
	const lineNumber = side === 'original' ? line.oldLineNumber : line.newLineNumber;
	if (!lineNumber) {
		return undefined;
	}

	return {
		filePath,
		lineNumber,
		side,
		text,
	};
}

function focusActiveInput() {
	if (uiState.activeCommentKey) {
		const input = root?.querySelector<HTMLInputElement>('[data-role="comment-input"]');
		input?.focus();
		return;
	}

	if (uiState.activeEditKey) {
		const input = root?.querySelector<HTMLInputElement>('[data-role="edit-input"]');
		input?.focus();
		input?.select();
	}
}

function readIndex(value: string | undefined) {
	return Number.parseInt(value ?? '0', 10);
}

function saveState() {
	vscode.setState({
		panelState,
		uiState,
	});
}
