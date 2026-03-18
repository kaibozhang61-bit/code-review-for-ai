---
name: ai-review-loop
description: Use when coding in a repo that has the AI Review VS Code extension and local bridge scripts, and the user wants work delivered in small reviewable increments. This skill checks that the extension bridge is reachable, reads and updates knowledge.md, splits work into commit-sized batches, opens a review after each batch, waits for the review result, interprets comments carefully, and only continues once the review is addressed or clarified.
---

# AI Review Loop

Use this skill when the user wants coding work to go through the AI Review extension instead of one large unreviewed patch.

## Before coding

1. Check for a repo-local `knowledge.md`. If it exists, read it before making any plan or code changes.
2. Check that the repo has the review bridge scripts in `package.json`:
   `bridge:open`, `bridge:wait`, and usually `bridge:status`.
3. Check that the local bridge is reachable before relying on the review loop.
   Preferred check:

```bash
node -e "fetch('http://127.0.0.1:47831/health').then(r=>r.text()).then(console.log).catch(()=>process.exit(1))"
```

4. If the bridge is not reachable, pause and ask the user to make sure the AI Review extension is installed and that VS Code or the Extension Development Host is running.

Do not start a large implementation if the workflow depends on review and the bridge is unavailable.

## Planning rule

Split the task into commit-sized batches. A batch should be small enough that a human can review it comfortably in one pass.

Good batch boundaries:
- one bug fix
- one component or module slice
- one schema plus one matching caller update
- one refactor step with a narrow behavioral surface

Avoid:
- one giant patch spanning many files and behaviors
- mixing unrelated cleanup with functional changes
- hiding risky changes inside a broad refactor

When useful, tell the user the next batch you are implementing before you start it.

## Per-batch workflow

For each batch:

1. Implement only that batch.
2. Run the smallest relevant validation for that batch.
3. Prepare a review change set from the current diff.
4. Open the review through the bridge.
5. Wait for the review result before continuing.
6. Interpret the result carefully.
7. Either:
   proceed to the next batch if the review is effectively approved, or
   revise the code and create a new review for the revised batch.

Do not silently barrel through multiple large batches without review.

## Opening a review

Create a `ChangeSet` JSON file from the current batch diff and queue it with:

```bash
npm run bridge:open -- /absolute/path/to/changeset.json
```

Capture the `sessionId` from the CLI output, then wait with:

```bash
npm run bridge:wait -- <sessionId>
```

If the wait times out, check:

```bash
npm run bridge:status -- <sessionId>
```

If the session is still queued, ask the user to confirm the extension is open and connected.

## Review interpretation

Treat a review as approved only when all of these are true:
- there are no inline comments that still require action
- there are no rejected hunks that still require action
- any human-modified hunks are understood and incorporated into the next step

If there are comments or rejected hunks:
- slow down and infer the reviewer intent
- explain the likely reason to yourself before editing code
- if the reason is ambiguous, ask the user a direct clarification question
- revise the batch and open a fresh review instead of assuming

Pay special attention to repeated themes such as naming, structure, safety, tests, or UX expectations.

## Knowledge file

Use repo-local `knowledge.md` as a persistent learning file.

At the start of a task:
- read `knowledge.md` if present
- treat it as project-specific review guidance

After every review cycle with meaningful feedback:
- append a short dated note to `knowledge.md`
- summarize what the reviewer wanted
- capture the pattern, not just the literal comment
- keep entries concise and actionable

Good knowledge entries:
- Prefer explicit error handling around fetch responses.
- Keep diffs small and isolate schema changes from UI cleanup.
- When renaming a field, update the type first and call sites second.

Avoid noisy entries:
- Fixed typo in button label.
- Reviewer commented on line 18.

## Clarification rule

If you do not understand why the user commented on something, ask before making a second-pass change. Do not rationalize unclear feedback into a confident code change.

## ChangeSet guidance

When generating the review input:
- include only files in the current batch
- use full file contents for `originalContent` and `proposedContent`
- provide a short `description` for each file when it helps the reviewer

If there is already a repo helper for generating `ChangeSet` payloads, use it. Otherwise build the JSON directly.

## Final behavior

This skill optimizes for:
- small, reviewable increments
- explicit human approval points
- careful interpretation of feedback
- persistent learning in `knowledge.md`

If the review tooling is unavailable, say so clearly and switch to a normal coding flow only with the user's approval.
