---
name: checkpoint
description: Create a ticket-aware commit when the user says "checkpoint".
disable-model-invocation: true
---

# Checkpoint

## Purpose

Turn the current working tree changes into a concise git checkpoint commit.

## When to Use

Use this skill when the user says exactly or effectively: "checkpoint".

## Process

1. Inspect the repo state:
   - `git status --short`
   - `git diff --stat`
   - `git diff`
   - include staged changes with `git diff --cached` if present
2. If there are no staged, unstaged, or untracked changes, report that there is nothing to commit and stop.
3. Summarize the change in a short imperative phrase, based on the actual diff.
4. Determine the ticket number:
   - Read the current branch with `git branch --show-current`.
   - Extract the first ticket-like token matching `[A-Z][A-Z0-9]+-[0-9]+`, such as `KM-1234` from `feature/KM-1234` or `bugfix/KM-1234`.
   - If no ticket is found, omit the ticket prefix.
5. Build the commit message:
   - With ticket: `<ticket> - <summary>`
   - Without ticket: `<summary>`
6. Stage all current changes with `git add -A`.
7. Create the commit with `git commit -m "<message>"`.
8. Report the commit hash and message.

## Guardrails

- Do not commit if the diff includes secrets, credentials, or obviously accidental large/generated files; warn the user instead.
- Do not amend, rebase, push, or create tags.
- Do not invent a ticket number if the branch does not contain one.
- Keep the summary specific enough to identify the checkpoint, but short enough for a one-line commit subject.
