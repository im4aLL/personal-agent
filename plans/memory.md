# Memory Feature Plan

## Goal

Add opt-in, agent-driven short-term and long-term memory without injecting stored memories into every request. The model should have `remember` and `recall` tools, and memory retrieval should happen only when the model decides it is relevant. Memory is disabled by default and is controlled from a new `Preferences` settings section beside the existing `Tool` section.

## Product Decisions

- The master memory switch defaults to off.
- When memory is off, neither memory tool is registered and no memory database query or write is performed.
- When memory is on, the model receives the `remember` and `recall` tool definitions plus a short system-prompt instruction explaining when to use them. Stored memory content is never added to the prompt automatically.
- Short-term memory is scoped to the current conversation. It is useful for facts the agent should retain across compaction or later turns in that conversation and is removed when the conversation is deleted.
- Long-term memory is global to the configured Turso database and can be recalled from any conversation.
- Both memory types are stored in one `memories` table with a `memory_type` field.
- The first version uses bounded SQLite text matching (`LIKE`) and recency ordering. It does not add embeddings, vector search, or another model call for indexing.
- The user can enable or disable short-term and long-term writes independently while the master switch controls all memory behavior.
- The user can clear all stored memories from Preferences. The clear action requires confirmation.
- Disabling memory stops new reads and writes but does not delete existing rows. Re-enabling memory makes existing rows available again if their type is enabled.
- The hard cap applies to the estimated tokens in the `recall` tool result, including labels and separators. It is enforced before the result is returned to the model.
- Memory failures are bounded tool errors and must not prevent the assistant from completing a normal response.

The tool schemas themselves add a small fixed amount of request overhead whenever memory is enabled. The feature avoids the much larger and recurring cost of injecting all stored memories into every request.

## Relevant Existing Code

- `src/pages/settings.tsx` owns the section navigation and should add the `Preferences` section.
- `src/components/settings/web-search-tab.tsx` is the pattern for opt-in tool switches, local persistence, and toast feedback.
- `src/lib/config.ts` owns local-storage-backed settings and should add memory flags and the validated token cap.
- `src/lib/turso-repository.ts` owns serialized schema migrations. The current schema version is 7, so memory requires the next migration.
- `src/lib/turso.ts` provides parameterized Turso queries through `tursoSelect`, `tursoExecute`, and `tursoExecuteMany`.
- `src/hooks/use-chat.ts` builds enabled tools, constructs system prompts, runs the AI SDK tool loop, and already applies `stepCountIs(8)`.
- `src/lib/tools/*.ts` contains the existing AI SDK tool factory pattern with Zod input schemas.
- `src/lib/context.ts` provides the existing `estimateTextTokens()` heuristic used for context budgeting.
- `src/App.tsx` runs Turso migrations before the application loaders.

## Data Model

Add a versioned migration in `src/lib/turso-repository.ts` that creates:

```sql
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  scope_key TEXT NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('short_term', 'long_term')),
  normalized_content TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
)
```

Add a unique index on `(memory_type, scope_key, normalized_content)` for deterministic deduplication, plus retrieval indexes for `memory_type`, `conversation_id`, and recent ordering as appropriate for the actual query. `scope_key` is the conversation ID for short-term memories and a fixed global value for long-term memories. `normalized_content` is the trimmed, case-normalized content used only for deduplication. The database CHECK and application types both enforce `short_term` and `long_term`.

Short-term rows contain `conversation_id`. Long-term rows use `NULL` for `conversation_id`. This keeps both types in one table while making scope filtering explicit. Do not rely on `ON DELETE CASCADE`: the current Turso request path does not enable SQLite foreign keys and uses fresh pipeline requests. Update `deleteConversation()` in `src/lib/turso-repository.ts` to explicitly delete `memories WHERE conversation_id = ?` before deleting messages and the conversation.

There is no update path in the first version, so do not add `updated_at` until memory editing or replacement semantics are required. `created_at` is sufficient for recency ordering.

Add `src/lib/types/memory.ts` for the shared memory type and the constrained memory-type values. Add `src/lib/memory-repository.ts` for:

- Creating a memory with a generated ID and timestamps.
- Searching by normalized query, memory type, and optional conversation ID.
- Deleting one memory if needed by future UI work.
- Clearing all memories, and optionally clearing only one type.
- Mapping Turso rows to the shared type.

Keep repository functions parameterized and return an empty result when Turso is not configured. Do not load all memories at application startup.

## Settings And Configuration

Add to `src/lib/config.ts`:

- `MEMORY_ENABLED_KEY`, default `false`.
- `SHORT_TERM_MEMORY_ENABLED_KEY`, default `true` when memory is enabled unless the user explicitly disabled it.
- `LONG_TERM_MEMORY_ENABLED_KEY`, default `true` when memory is enabled unless the user explicitly disabled it.
- `MEMORY_TOKEN_CAP_KEY`, with a conservative default such as 500 estimated tokens.

Use explicit load/save functions. Validate the token cap as a finite integer within a safe range, for example 1 through 2000; a value of 0 is invalid and falls back to the default. Invalid or missing values fall back to the default. Keep the setting local to the device, matching the existing tool settings; memory records themselves remain in Turso.

Add `src/components/settings/preferences-tab.tsx` and register it in `src/pages/settings.tsx` with a `Preferences` label and suitable icon. The page should include:

- Master `Memory` switch, off by default.
- `Short-term memory` switch.
- `Long-term memory` switch.
- Numeric input for the maximum recall result token cap.
- Explanatory copy that memory is model-controlled, is not included in every prompt, and requires configured Turso storage.
- `Clear memories` action with confirmation and success/error toasts.

Disable the type switches and cap input when the master switch is off, but preserve their saved values. If Turso is not configured, add a small reusable `DatabaseRequirement` settings component, or refactor the existing `AgentsSectionsGuard` copy into it, so Preferences can link the user to the Data tab without duplicating the guard's loading/error behavior. Prevent memory writes/recalls rather than failing chat.

## Agent Tools

Add `src/lib/tools/remember.ts`:

- Input: `content` and `memoryType` (`short_term` or `long_term`).
- Require non-empty content and enforce a maximum content length before writing.
- Use a concrete maximum content length of 2,000 characters and reject longer content with a bounded validation result.
- Reject short-term writes without a current conversation ID.
- Check the relevant settings again at execution time, not only when the tools are constructed.
- Write through `memory-repository.ts`.
- Return a compact success object containing only a bounded status and memory ID, not the full stored text.
- Treat duplicate tool calls safely with `INSERT OR IGNORE` using the unique `(memory_type, scope_key, normalized_content)` index. Normalize by trimming and case-folding content before computing `scope_key` and `normalized_content`. The AI SDK v7 exposes `toolCallId`, but it is per-stream and unstable across retries; it is not a stable idempotency key, so do not use it for deduplication.

Add `src/lib/tools/recall.ts`:

- Input: `query` and an optional memory type filter. Do not expose arbitrary SQL or unrestricted scope input.
- Require a non-empty query with a concrete maximum length of 200 characters.
- Search only enabled memory types, always including current-conversation short-term rows when short-term memory is enabled and global long-term rows when long-term memory is enabled.
- Escape `%`, `_`, and the escape character in the query before using SQLite `LIKE`, and use an explicit `ESCAPE` clause. This prevents wildcard expansion and is required hardening for the first implementation.
- Apply the configured token cap while accumulating results, using `estimateTextTokens()` plus the output labels/separators.
- Truncate or omit an individual oversized memory so a single row cannot exceed the cap.
- Return a compact no-results object when nothing matches.
- Return only selected memory content and minimal metadata such as type; do not return unbounded timestamps or database fields.
- Add a `truncated: boolean` field so the model can distinguish a complete result from one stopped by the cap.

Put the final model-facing recall result formatter in one place, preferably `memory-repository.ts`, because it knows the labels, separators, and token overhead. The repository should return the already bounded result object, including `memories`, `truncated`, and estimated token information if useful; `recall.ts` should return that object without adding more text. This keeps cap enforcement and formatting ownership together below the model-facing tool.

## Chat Integration

Update `src/hooks/use-chat.ts`:

1. Add memory tool loading to `buildEnabledTools()` only when the master flag is enabled and Turso is configured.
2. Pass the current `conversationId` to the remember and recall tool factories so short-term scope is enforced by the application, not chosen by the model.
3. Register `remember` and `recall` alongside existing tools. Preserve the existing Gemini tool exclusion until the current SDK/provider limitation is resolved.
4. Add a short memory instruction to `systemPromptFromState()` only while memory is enabled, for example: memory is available through the tools; call `recall` when the user refers to prior conversations or stored preferences; call `remember` only for durable, useful facts explicitly stated or clearly requested by the user. Do not include any memory rows in this prompt.
5. Include the current memory-enabled flag in the system-prompt state and in the `useMemo` dependency list. Ensure send, regenerate, and edit paths all build/use the current prompt rather than a stale memoized prompt after Preferences changes.
6. Read the memory setting at send/tool-construction time so changing Preferences affects the next request without requiring a full reload.
7. Keep the existing `stepCountIs(8)` safety limit unless manual testing demonstrates that memory calls need a separate limit. Do not increase the global step limit speculatively.
8. Ensure memory tool failures are returned as tool results and logged in development without aborting the full response.
9. Account for stream retries. A retry reruns `streamText()` from scratch and the SDK has no stable idempotency key; deterministic repository deduplication must prevent duplicate long-term memories.
10. Include memory result text in the existing development context-usage logging only when a recall call actually returns content. Normal turns with no recall should have no memory content added to their token estimate.

The existing conversation history remains the source for ordinary short-term conversational context. Memory is an explicit, bounded tool lookup and is not a second copy of the whole chat history.

## Incremental Implementation Milestones

### 1. Add configuration and Preferences UI

Observable outcome: Settings contains a Preferences section where memory is visibly off by default, can be toggled, and persists across reloads.

Implementation: add config helpers, the new tab, section navigation, switch dependencies, and cap validation.

Manual verification: open Settings, reload, confirm defaults and persistence, enter invalid and boundary cap values, and confirm the UI explains the Turso requirement.

Defer: memory CRUD, database migrations, and any automatic prompt injection.

### 2. Add the memories migration and repository

Observable outcome: after Turso is configured, the app migrates successfully and a manually invoked repository path can create, query, and clear scoped rows.

Implementation: add the schema version, indexes, shared type, repository methods, clear operation, and migration-safe handling of existing databases.

Manual verification: inspect the Turso schema, create short-term and long-term rows, confirm conversation scope filtering, delete a conversation and confirm the explicit memory delete removes its short-term rows, and confirm the migration does not depend on SQLite foreign-key enforcement.

Defer: exposing the repository to the model.

### 3. Add bounded `remember` and `recall` tools

Observable outcome: a temporary `import.meta.env.DEV`-guarded diagnostic block in Preferences invokes the repository/tool execute functions with fixed fixture content and query values, showing that remember writes a row and recall returns only matching rows within the configured cap. Remove the diagnostic block after chat integration is verified.

Implementation: add both tool factories, input validation, settings gates, Turso failure handling, scoped queries, deduplication, and cap-aware formatting.

Manual verification: test empty inputs, 2,001-character content, 201-character queries, disabled type settings, missing Turso, duplicate remember calls, wildcard characters in queries, no matches, one oversized result, and multiple results over the cap. Confirm `truncated` is true only when the cap omits or truncates results.

Defer: UI for browsing individual memories.

### 4. Connect tools and prompt guidance to chat

Observable outcome: with memory enabled, the agent can remember a distinctive fact and recall it in a later turn or conversation; with memory disabled, no memory tools are sent and no database rows are touched.

Implementation: register tools in `use-chat.ts`, add the minimal tool-use instruction, pass scope and settings, preserve the existing tool loop/retry behavior, and add bounded development logging.

Manual verification: ask the agent to remember a fact, start a new conversation and ask a related question, confirm it must call recall to access the fact, inspect request behavior for a normal unrelated turn, disable memory and confirm recall no longer occurs, verify regenerate/edit paths use the current memory setting, and verify other tools still work.

Defer: automatic memory extraction, embeddings, semantic ranking, and changing the global tool step limit.

### 5. Harden lifecycle and documentation

Observable outcome: disabling, clearing, deleting conversations, and Turso failures have predictable user-visible behavior without breaking normal chat.

Implementation: finish clear-memory UI wiring, confirm explicit conversation-memory deletion, add bounded error toasts/logs, update `ARCHITECTURE.md` and relevant setup documentation, and correct the documented schema version.

Manual verification: run the complete regression checklist below after `npm run build` and `npm run lint`.

Defer: automated tests, per-memory editing UI, and cross-device synchronization of local Preferences.

## Manual Regression Checklist

- Memory is off on a fresh install.
- Memory settings survive app reload.
- Memory tools are absent when memory is disabled.
- Enabling memory without Turso does not break chat and does not attempt writes.
- Short-term memories are limited to the current conversation and are removed by the explicit memory delete when that conversation is deleted.
- Long-term memories can be recalled from a different conversation.
- Disabled memory types are neither written nor recalled.
- Recall is never performed automatically by the application on every turn.
- An unrelated turn has no memory rows in its prompt or request context.
- A recall result never exceeds the configured token cap.
- Empty, malformed, oversized, duplicate, and failed memory operations remain bounded and non-fatal.
- Clearing memories removes both types and reports success or failure.
- Existing conversations, compaction, provider selection, agent prompts, web tools, and Gemini behavior remain unchanged.
- `npm run build` passes.
- `npm run lint` passes.

## Explicit Non-Goals

- Automatically sending all memories with every user message.
- Automatically extracting memories from every conversation turn.
- Embeddings, vector databases, semantic search, or a separate memory model.
- A second conversation-history system.
- Syncing local Preferences settings through Turso.
- Automated unit or E2E tests for this feature, per project instructions; validation is manual plus build/lint checks.
