# 15 - personal-agent | User-defined Instructions, Skills, and Custom Agents

**What to build:** Users can create and manage their own AGENTS.md instruction files, skills, and custom agents, all stored in Turso (remote-only, requires Turso configured).
All three are read-only system prompt injectors -- they shape how the AI responds by prepending content as system messages in the chat flow.

**Core concepts:**

- **User Instructions (AGENTS.md)**: Markdown files with `{id, name, content}`. When active, content is prepended as a system message to every chat. Persists across turns until deactivated.
- **Skills**: Named prompts with `{id, name, description, content}`. One-shot trigger via `/skillname`, explicit mention, or manual selection. Content injected as system message for that turn only.
- **Custom Agents**: Structured like skills with `{id, name, description, content}` where content is the agent's system prompt. Triggered the same way. Optional planner-agent routing for auto selection.

**Trigger detection (priority order):**
1. Slash command parsing: message starts with `/skillname` or `/agentname` -> activate matching item, strip command from content
2. Explicit mention: "use the X skill", "run skill X" -> match against names
3. Manual selection: dropdown/chip in message input to pick active skill/agent/instruction

**Status:** Done

- [x] DB migration v5: add `user_instructions`, `skills`, `custom_agents` tables to `runMigrations()`
- [x] `lib/agent-repository.ts`: CRUD functions for all three tables (follow `turso-repository.ts` patterns)
- [x] `store/agents.ts`: Zustand store with CRUD actions, active selections, and Turso load
- [x] Settings > Agents tab with sub-tabs: Instructions, Skills, Custom Agents
- [x] Instructions tab: list markdown files, create/edit/delete, "Set Active" toggle, content editor
- [x] Skills tab: list skills (name + description + content), create/edit/delete
- [x] Custom Agents tab: list agents (name + description + system prompt), create/edit/delete
- [x] Slash command parser in `message-input.tsx` with autocomplete dropdown
- [x] Active indicator chips in message input (show active instruction/skill/agent, allow clearing)
- [x] Modify `useChat.sendMessage()` and `streamAssistantResponse()` to inject system messages from active instruction/skill/agent
- [x] Skills are one-shot: auto-deactivate after the assistant response completes
- [x] Instructions persist across turns until manually deactivated
- [x] Turso guard: all CRUD and load operations are no-ops when Turso is not configured
- [ ] Verify: create instruction, skill, agent with Turso configured; they persist across restart
- [ ] Verify: skill triggers via `/skillname`, injects content, deactivates after response
- [ ] Verify: instruction stays active across multiple messages until cleared
- [ ] Verify: without Turso configured, Agents tab shows "Configure Turso first" empty state
