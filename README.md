# AI Review

AI Review is a VS Code extension for reviewing AI-proposed code changes as a diff before accepting them. It presents file-by-file hunks in a webview, lets a human reviewer accept or reject changes, edit proposed lines inline, and leave comments for the AI to use in the next revision.

## What It Does

- Opens an AI change set in a review panel with a file list and unified diff view
- Splits changes into hunks and tracks each hunk as `pending`, `accepted`, `rejected`, or `human-modified`
- Supports inline comments anchored to original or proposed lines
- Lets reviewers edit added lines directly in the review UI
- Produces a structured `ReviewResult` payload on submit
- Saves submitted reviews to disk with a UUID-based review ID
- Copies a paste-ready handoff message to the clipboard after submission

## Commands

- `AI Review: Show Pending Changes`
  Expects a `ChangeSet` payload from another caller or integration.

- `AI Review: Open Demo Review`
  Opens a built-in sample review for local testing.

## ChangeSet Shape

```ts
interface ChangeSet {
  id: string;
  changes: FileChange[];
}

interface FileChange {
  filePath: string;
  originalContent: string;
  proposedContent: string;
  description?: string;
}
```

## ReviewResult Shape

```ts
interface ReviewResult {
  reviewId: string;
  changeSetId: string;
  fileReviews: FileReview[];
  inlineComments: InlineComment[];
  submittedAt: string;
}
```

## Project Structure

```text
.
├── src/
│   ├── extension.ts
│   ├── ReviewPanel.ts
│   ├── diffUtils.ts
│   ├── reviewState.ts
│   ├── bridge/
│   │   ├── ReviewBridgePoller.ts
│   │   ├── cli.ts
│   │   ├── client.ts
│   │   ├── protocol.ts
│   │   └── server.ts
│   └── webview/
│       ├── DiffView.ts
│       ├── FileList.ts
│       ├── index.html
│       ├── main.ts
│       └── styles.css
├── esbuild.js
└── package.json
```

## Development

Requirements:

- Node.js 20+ is recommended
- VS Code

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run compile
```

Type-check only:

```bash
npm run check-types
```

## Run In VS Code

1. Open this folder in VS Code:
   `/Users/kaibozhang/Desktop/code-review-for-ai/code-review-for-ai`
2. Open **Run and Debug**
3. Start `Run Extension`
4. A new Extension Development Host window will open

In the Extension Development Host, run `AI Review: Open Demo Review` to verify the extension UI works.

## Manual UI Test

Use this when you only want to verify the extension itself:

1. Build the project with `npm run compile`
2. Start `Run Extension`
3. In the Extension Development Host, run `AI Review: Open Demo Review`
4. Try:
   accepting a hunk
   rejecting a hunk
   editing a proposed `+` line
   adding an inline comment
   clicking `Submit Review`

On submit, the extension:

- generates a UUID review ID
- writes the review result JSON to disk
- copies a handoff instruction to the clipboard

## Local Bridge For E2E Testing

This repo also includes a lightweight local bridge so a CLI can queue a review and the extension can pick it up automatically.

### Start The Bridge

From the project root:

```bash
npm run compile
npm run bridge:start
```

### Start The Extension Host

In VS Code, run `Run Extension` so the Extension Development Host is open. The extension activates on startup and polls the bridge for queued reviews.

### Queue A Demo Review

In another terminal:

```bash
npm run bridge:demo
```

This prints a bridge `sessionId`.

If the bridge and extension host are both running, the review panel should open automatically in the Extension Development Host window.

### Fetch The Submitted Result

After the reviewer clicks `Submit Review`, fetch the result with:

```bash
npm run bridge:wait -- <sessionId>
```

You can inspect bridge session state at any time with:

```bash
npm run bridge:status -- <sessionId>
```

You can also queue a custom change set JSON file with:

```bash
npm run bridge:open -- /absolute/path/to/changeset.json
```

## Where Review Results Are Saved

Submitted reviews are saved as JSON files:

- If a workspace is open:
  `.ai-review/reviews/<reviewId>.json` under the workspace root
- Otherwise:
  the extension global storage folder

## Clipboard Handoff

After submission, the extension copies a message like this to the clipboard:

```text
Read the AI review result from "/absolute/path/to/.ai-review/reviews/<uuid>.json" (reviewId: "<uuid>", changeSetId: "<changeSetId>") and continue with the next steps.
```

This is intended as a simple MVP handoff for an AI agent.

## Packaging

Create a production build:

```bash
npm run package
```

To publish to the VS Code Marketplace later, you will also need:

- a `publisher` field in `package.json`
- Marketplace publisher setup
- a `.vsix` packaging step, typically with `vsce`

## Current Limitations

- `AI Review: Show Pending Changes` needs another caller to provide a `ChangeSet`
- The bridge is a local development bridge, not a full production integration
- The current clipboard handoff is designed as an MVP and does not automatically push the result back into an agent session

## Useful Scripts

```bash
npm run check-types
npm run compile
npm run package
npm run bridge:start
npm run bridge:demo
npm run bridge:status -- <sessionId>
npm run bridge:wait -- <sessionId>
```
