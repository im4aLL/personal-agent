# Context Usage Display + Compaction

Goal: use tokens effectively by (1) showing the current context usage vs the model's context window in the message box (e.g. "12.4k / 250k"), (2) auto-compacting long conversations near the threshold, and (3) allowing a manual compact trigger.

## Core design decisions

- The model is stateless. Every request must re-send the context the model needs. Caching (where the provider offers it) only discounts re-sending the same prefix; it never removes the need to send.
- Never branch behavior on "does the model support caching". It is provider-side, mostly automatic, best-effort, and unverifiable from the app. Instead:
  - Below threshold: send full history (caching providers discount it automatically).
  - Above threshold: send `[persisted summary] + [last N raw messages] + new message`.
- After one compaction the sent context stays bounded forever (summary + last N messages), so auto-compact fires only when (a) a conversation crosses the threshold for the first time, or (b) the summary was invalidated by an edit in the summarized region.
- Auto-compact threshold: 60-70% of the context window, not the edge. The summarization call and the answer both need room. A compact at 70% lands the compacted context around 20-30%.
- The summary is persisted and never regenerated per message. Regenerating it costs tokens and changes the prefix, which breaks provider-side cache hits.
- Persist the summary in a dedicated field on the conversation record, not as a `system`-role message. `buildCoreMessages` filters `system` messages out before sending.

## New module: `src/lib/context.ts`

Single home for all the logic:

- `getContextWindow(providerId, modelId)`: static table keyed by provider + model, fallback 128k for unknown. `/v1/models` never returns context size, so a curated table is the only reliable source.
- `estimateTokens(messages)`: characters / 4 heuristic, memoized per message id so it does not recount on every keystroke. Exact tokenizer (e.g. `gpt-tokenizer` dependency) is a decision point, not needed for v1.
- `buildOutgoingContext(messages, { summary, summarizedUpToId })`: returns `[summary-as-system-message] + last N raw` when a summary exists, else full history.
- `shouldCompact(tokens, window)`: `tokens > 0.7 * window`.
- `estimateTokens` must not run the char/4 heuristic over `attachment.data`. Image attachments are embedded as base64 in `buildUserContent` (`use-chat.ts`); counting that blob as text would wildly overcount. Use `message.content.length / 4` plus a flat ~1000-token estimate per image attachment.
- The memo cache for `estimateTokens` must key on `(id, content.length)`, not just `id`. The streaming assistant message keeps a stable id while `appendMessageContent` grows its `content` in place; an id-only key freezes its token count at the first (near-empty) value for the rest of the stream.

`sendMessage`, `regenerate`, and `editMessage` in `use-chat.ts` do not build outgoing context themselves - they all funnel through `streamAssistantResponse`, which is the one place that currently calls `buildCoreMessages(contextMessages)` before `streamText`. That is the single choke point: `buildOutgoingContext` gets called inside `streamAssistantResponse`, not at each call site. (`retry` doesn't need separate handling either - it just calls `sendMessage`.) `streamAssistantResponse` receives a raw `contextMessages` array, not the `Conversation` object, so it will need to read `summary`/`summarizedUpToId` off the current conversation via `useChatStore.getState()`, the same pattern already used elsewhere in that function.

## Phase 1: Context window + token estimation (pure logic, no UI)

- `context-window.ts` table: OpenAI, DeepSeek, Gemini, Opencode Go, Ollama / LM Studio defaults, fallback 128k.
- `estimateTokens` with per-message-id memo cache.
- Verify: log `estimateTokens(conversation.messages)` in DEV, sanity-check against a provider's actual `usage` once usage logging is added (separate small task).

## Phase 2: Usage indicator in the message box

- New `ContextUsageIndicator` in `message-input.tsx`. It currently destructures only `sendMessage, stop, isGenerating, canSend, isOffline` from `useChat()`; add `messages` to that destructure.
- Shows `12.4k / 250k` in the footer row of the input, right-aligned near the disclaimer.
- "Current" = system prompt + summary (if any) + all messages + pending input text. This is exactly what the next request would send.
- Color states: default / amber >= 70% / red >= 90%. Optionally a thin progress bar.
- Verify: open a long conversation, watch the number; type in the box, watch it climb.

## Phase 3: Persisted summary

- `Conversation` type (`src/lib/types/chat.ts`): add `summary: string | null` and `summarizedUpToId: string | null` (id of the last message covered by the summary; used to know when the summary is stale).
- Migration v6 in `turso-repository.ts` (follows the existing `version < N` pattern): `ALTER TABLE conversations ADD COLUMN summary TEXT` and `summarized_up_to_id TEXT`.
- Include both fields in `TursoConversationRow` load / save (the full-conversation path used when a conversation is opened and sent to the model).
- Do NOT add these columns to the sidebar list-view paths (`mapRowToSummary`, `loadConversationsForMonth`). Those only render conversation summaries in the sidebar and never build outgoing model context, so they don't need `summary` / `summarizedUpToId`.

## Phase 4: Compaction (auto + manual)

- Auto: in `streamAssistantResponse` (`use-chat.ts`), before calling `buildCoreMessages`/`streamText`: if `shouldCompact` and no valid summary, generate a summary (one LLM call, small token budget, reusing the `generateConversationTitle` pattern from `src/lib/title.ts`), persist it, then send the compacted context. Placing it here (rather than in `sendMessage`) means `regenerate` and `editMessage` get auto-compaction too, since they call `streamAssistantResponse` directly. Show a brief "Compacting context..." toast so the extra call is not a surprise.
- Manual: a compact icon button next to the usage indicator, runs the same compaction immediately regardless of threshold.
- Summary prompt: "Summarize this conversation preserving names, decisions, unresolved questions". Summarize only messages up to a cutoff; keep the last 15-20 messages raw.
- Verify: long conversation -> send -> observe one summarization call then a compacted request (DEV log shows message count drop), usage indicator drops from ~70% to ~25%.

## Phase 5: Staleness handling

- `editMessage` / `regenerate` touching a message at or before `summarizedUpToId` clears the summary. Next send re-compacts. Edits in the raw tail do not invalidate anything, because the tail is always sent raw.

## Costs and risks

- One-time summarization LLM call: ~2-4k tokens once per conversation, pays for itself by ~15-20 messages past the threshold.
- Quality: summarized region loses detail. Mitigated by keeping the tail raw. Low risk for a chat app.
- Cache interaction: a stable persisted summary keeps the prefix byte-identical, preserving provider cache hits. Never regenerate the summary per message.
- Unknown models: fallback 128k window. The indicator may be off for odd models until the table is updated.
- Images: estimate ~1000 tokens each in v1 (provider-dependent, note in code).

## Rollout order (observable-first)

1. `context.ts` + table + estimator (log it, sanity-check).
2. Usage indicator UI (see real numbers).
3. Migration + persisted summary.
4. Auto-compact in `sendMessage`.
5. Manual compact button.
6. Staleness + polish.
