import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import { buildReviewResultWithId, createReviewPanelState } from './reviewState';
import type {
	ChangeSet,
	PanelMessage,
	ReviewSubmissionMessage,
	ReviewResult,
	ShowReviewOptions,
} from './types';

export class ReviewPanel {
	private static currentPanel: ReviewPanel | undefined;

	public static async show(
		context: vscode.ExtensionContext,
		changeSet: ChangeSet,
		options?: ShowReviewOptions,
	) {
		if (ReviewPanel.currentPanel) {
			ReviewPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
			await ReviewPanel.currentPanel.initialize(changeSet, options);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'aiReview.reviewPanel',
			`AI Review: ${changeSet.id}`,
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')],
			},
		);

		ReviewPanel.currentPanel = new ReviewPanel(panel, context);
		await ReviewPanel.currentPanel.initialize(changeSet, options);
	}

	public static isOpen() {
		return Boolean(ReviewPanel.currentPanel);
	}

	private readonly disposables: vscode.Disposable[] = [];
	private currentOptions?: ShowReviewOptions;
	private wasSubmitted = false;

	private constructor(
		private readonly panel: vscode.WebviewPanel,
		private readonly context: vscode.ExtensionContext,
	) {
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.webview.onDidReceiveMessage(
			(message: PanelMessage) => this.handleMessage(message),
			null,
			this.disposables,
		);
	}

	private async initialize(changeSet: ChangeSet, options?: ShowReviewOptions) {
		this.currentOptions = options;
		this.wasSubmitted = false;
		this.panel.title = `AI Review: ${changeSet.id}`;
		this.panel.webview.html = this.getHtml();
		await this.panel.webview.postMessage({
			type: 'initialize',
			payload: createReviewPanelState(changeSet),
		});
	}

	private async handleMessage(message: PanelMessage) {
		if (message.type !== 'submit-review') {
			return;
		}

		await this.handleSubmit(message);
	}

	private async handleSubmit(message: ReviewSubmissionMessage) {
		try {
			const reviewId = randomUUID();
			const result = buildReviewResultWithId(message.payload, reviewId);
			const savedResultPath = await this.saveReviewResult(result);
			await this.copyAgentHandoff(savedResultPath, result);

			await this.emitReviewSubmitted(result);

			await this.currentOptions?.onSubmit?.(result, savedResultPath);
			this.wasSubmitted = true;
			void vscode.window.showInformationMessage(
				`AI review submitted. Handoff command copied to clipboard. Review saved to ${savedResultPath}.`,
			);
			this.panel.dispose();
		} catch (error) {
			const messageText =
				error instanceof Error ? error.message : 'An unknown error occurred while submitting.';
			void vscode.window.showErrorMessage(`Failed to submit AI review: ${messageText}`);
		}
	}

	private async emitReviewSubmitted(result: ReviewResult) {
		try {
			await vscode.commands.executeCommand('aiReview.onReviewSubmitted', result);
		} catch (error) {
			if (isMissingCommandError(error)) {
				return;
			}

			throw error;
		}
	}

	private async saveReviewResult(result: ReviewResult) {
		const storageDir = await this.getReviewStorageDir();
		await fs.promises.mkdir(storageDir, { recursive: true });

		const filePath = path.join(storageDir, `${result.reviewId}.json`);
		await fs.promises.writeFile(filePath, JSON.stringify(result, null, 2), 'utf8');
		return filePath;
	}

	private async getReviewStorageDir() {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (workspaceFolder) {
			return path.join(workspaceFolder.uri.fsPath, '.ai-review', 'reviews');
		}

		const globalStoragePath = this.context.globalStorageUri.fsPath;
		return path.join(globalStoragePath, 'reviews');
	}

	private async copyAgentHandoff(savedResultPath: string, result: ReviewResult) {
		const handoffCommand =
			`Read the AI review result from "${savedResultPath}" ` +
			`(reviewId: "${result.reviewId}", changeSetId: "${result.changeSetId}") and continue with the next steps.`;

		await vscode.env.clipboard.writeText(handoffCommand);
	}

	private getHtml() {
		const webview = this.panel.webview;
		const templatePath = path.join(this.context.extensionPath, 'dist', 'webview', 'index.html');
		const template = fs.readFileSync(templatePath, 'utf8');
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'main.js'),
		);
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'styles.css'),
		);
		const nonce = getNonce();

		return template
			.replace(/{{cspSource}}/g, webview.cspSource)
			.replace(/{{scriptUri}}/g, scriptUri.toString())
			.replace(/{{styleUri}}/g, styleUri.toString())
			.replace(/{{nonce}}/g, nonce);
	}

	private dispose() {
		ReviewPanel.currentPanel = undefined;
		if (!this.wasSubmitted) {
			void this.currentOptions?.onClose?.();
		}

		while (this.disposables.length > 0) {
			this.disposables.pop()?.dispose();
		}
	}
}

function getNonce() {
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let nonce = '';

	for (let index = 0; index < 32; index += 1) {
		nonce += characters.charAt(Math.floor(Math.random() * characters.length));
	}

	return nonce;
}

function isMissingCommandError(error: unknown) {
	return error instanceof Error && error.message.includes("command 'aiReview.onReviewSubmitted' not found");
}
