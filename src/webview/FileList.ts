import type { ReviewPanelState } from '../types';

export function renderFileList(state: ReviewPanelState, selectedFileIndex: number) {
	return `
		<div class="sidebar-header">
			<h2>Files</h2>
			<span>${state.files.length}</span>
		</div>
		<div class="file-list">
			${state.files
				.map((file, fileIndex) => {
					const acceptedCount = file.hunks.filter((hunk) => hunk.status === 'accepted').length;
					const rejectedCount = file.hunks.filter((hunk) => hunk.status === 'rejected').length;
					const modifiedCount = file.hunks.filter(
						(hunk) => hunk.status === 'human-modified',
					).length;
					const checked = acceptedCount === file.hunks.length && file.hunks.length > 0;

					return `
						<div class="file-row${selectedFileIndex === fileIndex ? ' is-selected' : ''}">
							<div class="file-row-main" data-action="select-file" data-file-index="${fileIndex}" role="button" tabindex="0">
								<input
									type="checkbox"
									${checked ? 'checked' : ''}
									data-action="toggle-file-accept"
									data-file-index="${fileIndex}"
									aria-label="Accept ${escapeHtml(file.filePath)}"
								/>
								<span class="file-meta">
									<span class="file-path">${escapeHtml(file.filePath)}</span>
									<span class="file-summary">${file.hunks.length} hunk${file.hunks.length === 1 ? '' : 's'}</span>
								</span>
							</div>
							<span class="file-statuses">
								${acceptedCount > 0 ? `<span class="status-pill accepted">${acceptedCount} accepted</span>` : ''}
								${rejectedCount > 0 ? `<span class="status-pill rejected">${rejectedCount} rejected</span>` : ''}
								${modifiedCount > 0 ? `<span class="status-pill modified">${modifiedCount} edited</span>` : ''}
								<button class="mini-button" data-action="accept-file" data-file-index="${fileIndex}" type="button">Accept</button>
								<button class="mini-button" data-action="reject-file" data-file-index="${fileIndex}" type="button">Reject</button>
							</span>
						</div>
					`;
				})
				.join('')}
		</div>
	`;
}

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
