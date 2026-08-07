---
name: to-doc
description: Save reusable findings from the current session as Markdown in docs/.
disable-model-invocation: true
---

# To Doc

## Purpose

Turn something interesting from the current session into a reusable knowledge file in `docs/`.

## Process

1. Read the current conversation to understand what the user wants to capture. If it is not obvious, ask one question: "What should this doc cover — the full session, or a specific finding?"
2. **Sensitivity check** — before writing anything, scan the findings for secrets, credentials, tokens, PII, or sensitive session data. Redact or omit any such content. If redaction would make the document meaningless, stop and ask the user how to proceed.
3. **Validate findings** — do not treat agent output or conversational conclusions as authoritative. Where practical, verify claims against code, tests, config, or commands. Label anything that could not be verified as a hypothesis: prefix it with `> Hypothesis:` so future readers know it is unconfirmed.
4. Determine the right filename:
   - Use `kebab-case`, descriptive, specific enough to find later — e.g. `docs/null-pointer-in-user-service.md`, `docs/rate-limit-edge-cases.md`, `docs/why-we-chose-redis-for-sessions.md`
   - Check `docs/` for existing files with `ls docs/` and avoid duplicating or overwriting one unless the user asks
5. Summarize the findings into a clean markdown file:
   - **Title** — plain `# Title`, matches the filename intent
   - **Context** — one short paragraph: what problem, feature, or question this came from
   - **Findings** — the substance: root cause, decision, edge cases, patterns, or whatever is worth keeping; use headers, bullets, and code blocks as needed
   - **Why it matters** — one or two sentences on when this knowledge is useful or what it prevents
   - **Follow-ups** (optional) — open questions or deferred work, if any
6. Write the file to `docs/<filename>.md`.
7. **Post-write validation** — re-read the written file and diff it against the source findings. Confirm content is accurate, no sensitive data was included, and the file is self-contained before reporting completion.
8. Confirm the path to the user.

## Guardrails

- Summarize — do not paste raw agent output verbatim. Condense to what a future reader needs.
- Do not create subdirectories. All files go directly in `docs/`.
- Do not overwrite an existing file without confirming with the user first.
- Keep the file self-contained — a future agent should be able to read it cold and understand the context without needing the original session.
- Never include secrets, tokens, credentials, or PII — redact before writing.
