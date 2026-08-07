---
name: create-skill
description: Create or refine a local repository skill and sync generated agent assets.
disable-model-invocation: true
---

# Create Skill

## Purpose

Create a focused, high-signal skill in `.agents/skills/<skill-name>/SKILL.md` and synchronize generated agent assets.

## Process

1. Read a few existing skills in `.agents/skills` before writing. Match their tone: practical, direct, and minimal.
2. Clarify only if the request is ambiguous about the skill's trigger or behavior. Otherwise proceed.
3. Choose a short kebab-case skill name. Create exactly one directory under `.agents/skills` unless supporting files are clearly needed.
4. Write `SKILL.md` with frontmatter:
   - `name`: the directory name.
   - `description`: one sentence that states when to use the skill.
5. Keep the body lean. Prefer sections like Purpose, When to Use, Process, Output, and Guardrails only when they add value.
6. Make instructions executable by an agent: concrete steps, trigger conditions, expected output, and what not to do.
7. Avoid padding, generic advice, or long philosophy. A good skill is usually 10-60 lines unless the workflow is complex.
8. Run `bun ai/scripts/sync-agents.ts` after edits.
9. Report the created or changed files and the sync result.

## Quality Bar

- The description is specific enough that an agent knows when to invoke it.
- The skill has one job and does not duplicate another skill.
- Every instruction changes behavior; remove anything obvious or decorative.
- Paths and commands are explicit.
- The synced copy under `.claude/skills` is produced by the sync script, not edited by hand.
