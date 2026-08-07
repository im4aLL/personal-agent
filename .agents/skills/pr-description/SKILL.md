---
name: pr-description
description: Turn a finished diff into a PR description and, when applicable, a changelog entry.
disable-model-invocation: true
---

# PR Description

## Purpose

Summarize a set of code changes for reviewers and, where applicable, end users — without re-explaining the diff line by line.

## Process

1. Determine the diff scope: uncommitted changes, or `git diff <base>...HEAD` / a commit range if the user specifies one. Read the full diff, not just the file names.
2. Read recent PR descriptions or commit messages in the repo (`git log`, `gh pr list --state merged` if available) to match the existing tone and structure.
3. Write the PR description:
   - **Summary** — 1-3 bullets on *why*, not *what* (the diff already shows what).
   - **Test plan** — a checklist of what was verified (tests run, manual checks) and what still needs manual verification.
   - Omit sections that don't apply; don't pad.
4. If the repo maintains a changelog file (e.g. `CHANGELOG.md`), check its existing format and, only if asked or the change is user-facing, propose an entry in that format. Do not create a changelog file if none exists.
5. Present the description for the user to review before creating or updating any PR — do not push, open, or edit a PR without confirmation.

## Output

Present the PR title and body as markdown ready to paste, plus (if applicable) the proposed changelog entry, clearly separated.
