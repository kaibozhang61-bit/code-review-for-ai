import type { DiffHunk, DiffLine, InlineComment, ReviewFile } from '../types';

interface DiffViewOptions {
	activeCommentKey?: string;
	activeEditKey?: string;
	commentDraft: string;
	editDraft: string;
	inlineComments: InlineComment[];
}

export function renderDiffView(file: ReviewFile | undefined, options: DiffViewOptions) {
	if (!file) {
		return `
			<section class="empty-state">
				<h2>No file selected</h2>
				<p>Select a file from the sidebar to review its proposed changes.</p>
			</section>
		`;
	}

	return `
		<section class="diff-header">
			<div>
				<h2>${escapeHtml(file.filePath)}</h2>
				${file.description ? `<p>${escapeHtml(file.description)}</p>` : ''}
			</div>
		</section>
		<section class="hunks">
			${file.hunks
				.map((hunk, hunkIndex) => renderHunk(file.filePath, hunk, hunkIndex, options))
				.join('')}
		</section>
	`;
}

function renderHunk(
	filePath: string,
	hunk: DiffHunk,
	hunkIndex: number,
	options: DiffViewOptions,
) {
	return `
		<article class="hunk status-${hunk.status}">
			<header class="hunk-header">
				<div>
					<strong>${escapeHtml(hunk.header)}</strong>
				</div>
				<div class="hunk-actions">
					<button class="mini-button" type="button" data-action="accept-hunk" data-hunk-index="${hunkIndex}">Accept</button>
					<button class="mini-button" type="button" data-action="reject-hunk" data-hunk-index="${hunkIndex}">Reject</button>
				</div>
			</header>
			<table class="diff-table">
				<tbody>
					${hunk.lines
						.map((line, lineIndex) =>
							renderLine(filePath, hunk, hunkIndex, line, lineIndex, options),
						)
						.join('')}
				</tbody>
			</table>
			${
				hunk.status === 'rejected'
					? `
						<div class="rejection-box">
							<label>
								<span>Rejection reason</span>
								<input
									type="text"
									value="${escapeHtml(hunk.rejectionComment ?? '')}"
									placeholder="Optional feedback for the AI"
									data-role="rejection-input"
									data-hunk-index="${hunkIndex}"
								/>
							</label>
						</div>
					`
					: ''
			}
		</article>
	`;
}

function renderLine(
	filePath: string,
	hunk: DiffHunk,
	hunkIndex: number,
	line: DiffLine,
	lineIndex: number,
	options: DiffViewOptions,
) {
	const commentKey = `${hunkIndex}:${lineIndex}`;
	const editKey = `${hunkIndex}:${lineIndex}`;
	const side = line.type === 'remove' ? 'original' : 'proposed';
	const lineNumber = line.type === 'remove' ? line.oldLineNumber : line.newLineNumber;
	const savedComments = lineNumber ? hunkCommentsForLine(filePath, side, lineNumber, options) : [];

	const lineContent =
		line.type === 'add' && options.activeEditKey === editKey
			? `
				<div class="line-edit">
					<input
						type="text"
						value="${escapeHtml(options.editDraft)}"
						data-role="edit-input"
						data-hunk-index="${hunkIndex}"
						data-line-index="${lineIndex}"
					/>
					<button class="mini-button" type="button" data-action="save-edit" data-hunk-index="${hunkIndex}" data-line-index="${lineIndex}">Save</button>
					<button class="mini-button" type="button" data-action="cancel-edit">Cancel</button>
				</div>
			`
			: `<button class="line-text" type="button" ${
					line.type === 'add'
						? `data-action="start-edit" data-hunk-index="${hunkIndex}" data-line-index="${lineIndex}"`
						: 'disabled'
				}>${escapeHtml(line.type === 'add' ? line.currentContent ?? line.content : line.content)}</button>`;

	return `
		<tr class="diff-line type-${line.type}">
			<td class="line-number">${line.oldLineNumber ?? ''}</td>
			<td class="line-number">${line.newLineNumber ?? ''}</td>
			<td class="line-marker">${line.type === 'meta' ? '' : escapeHtml(prefixForType(line.type))}</td>
			<td class="line-content">${lineContent}</td>
			<td class="line-actions">
				${
					line.type !== 'meta'
						? `<button class="icon-button" type="button" aria-label="Add comment" data-action="open-comment" data-hunk-index="${hunkIndex}" data-line-index="${lineIndex}">Comment</button>`
						: ''
				}
			</td>
		</tr>
		${savedComments
			.map(
				(comment) => `
					<tr class="comment-row">
						<td colspan="5">
							<div class="saved-comment">${escapeHtml(comment.text)}</div>
						</td>
					</tr>
				`,
			)
			.join('')}
		${
			options.activeCommentKey === commentKey
				? `
					<tr class="comment-row is-draft">
						<td colspan="5">
							<div class="comment-editor">
								<input
									type="text"
									value="${escapeHtml(options.commentDraft)}"
									placeholder="Leave inline feedback for the AI"
									data-role="comment-input"
									data-hunk-index="${hunkIndex}"
									data-line-index="${lineIndex}"
								/>
								<button class="mini-button" type="button" data-action="save-comment" data-hunk-index="${hunkIndex}" data-line-index="${lineIndex}">Add</button>
								<button class="mini-button" type="button" data-action="cancel-comment">Cancel</button>
							</div>
						</td>
					</tr>
				`
				: ''
		}
	`;
}

function hunkCommentsForLine(
	filePath: string,
	side: 'original' | 'proposed',
	lineNumber: number,
	options: DiffViewOptions,
) {
	return options.inlineComments.filter(
		(comment) =>
			comment.filePath === filePath &&
			comment.side === side &&
			comment.lineNumber === lineNumber,
	);
}

function prefixForType(type: DiffLine['type']) {
	switch (type) {
		case 'add':
			return '+';
		case 'remove':
			return '-';
		case 'meta':
			return '';
		default:
			return ' ';
	}
}

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
