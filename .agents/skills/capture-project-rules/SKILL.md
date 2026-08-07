---
name: capture-project-rules
description: Save confirmed reusable guidance in AGENTS.md or personal preferences in memory.
disable-model-invocation: true
---

# Capture Project Rules

## Purpose

Turn repeated corrections or convention statements into durable instructions so users and developers do not need to say them again.

## When to Use

Use this skill when the user says something that sounds reusable beyond the current turn, especially phrases like:

- "always...", "never...", "don't do that again..."
- "in this repo/project...", "our convention is..."
- "agents should...", "next time remember..."
- corrections about tools, commands, tests, style, architecture, review process, or generated files

Do not use it for ordinary task requirements, temporary constraints, or one-off preferences unless the user asks to save them.

## Process

1. Restate the possible rule in one short actionable sentence.
2. Ask for confirmation before saving anything, and ask where it belongs:

   ```markdown
   This sounds like a reusable instruction:
   "<proposed instruction>"

   Should I save it as:
   1. a project rule in `AGENTS.md`,
   2. a personal preference in memory, or
   3. not save it?
   ```

3. If the user chooses project rule:
   - Find the repo instruction file, preferring `AGENTS.md`, then `agents.md`, then `.agents/AGENTS.md` if present.
   - If none exists, ask before creating `AGENTS.md` at the repo root.
   - Add the rule to the most relevant existing section; otherwise create a concise `## Project Rules` section.
   - Keep the wording short, general, and imperative.
4. If the user chooses personal preference, save it with memory using a clear dotted key and project-independent wording.
5. If the user says not to save it, continue without persisting anything.

## Guardrails

- Never update `AGENTS.md` or memory without explicit confirmation.
- Do not store secrets, credentials, private customer data, or temporary task context.
- Do not save rules that apply only to the current file, branch, bug, or experiment unless the user explicitly says they are general.
- Prefer one durable rule over multiple overlapping bullets.
- If the instruction could be either a project rule or personal preference, ask instead of guessing.
