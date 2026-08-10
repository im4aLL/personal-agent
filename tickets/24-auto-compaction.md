# 24 - personal-agent | Backend - Auto-compaction above the context threshold

**What to build:** When a conversation crosses ~70% of its context window with no valid summary, generate one, persist it, and send `[summary] + [last N raw messages]` instead of full history - for every path that can trigger a model call, not just the primary send.

**Blocked by:** #23 - Persisted conversation summary field.

**Status:** Not started

## Tasks

### `src/lib/context.ts`

- [ ] `buildOutgoingContext(messages, { summary, summarizedUpToId })`: returns `[summary-as-system-message] + last N raw` when a summary exists, else full history

### `use-chat.ts`

- [ ] Integrate inside `streamAssistantResponse`, immediately before `buildCoreMessages`/`streamText` - not separately inside `sendMessage`, `regenerate`, and `editMessage`. `streamAssistantResponse` is the one function all three funnel through, so this is the single choke point
- [ ] Read `summary` / `summarizedUpToId` off the current conversation via `useChatStore.getState()` (this function receives a raw message array, not the `Conversation` object)
- [ ] If `shouldCompact` and no valid summary: generate a summary (one LLM call, small token budget, reusing the `generateConversationTitle` pattern from `src/lib/title.ts`), persist `summary` and `summarizedUpToId`, then send the compacted context
- [ ] Summary prompt: "Summarize this conversation preserving names, decisions, unresolved questions"; summarize everything up to a cutoff, keep the last 15-20 messages raw
- [ ] Show a "Compacting context..." toast when this fires, so the extra call isn't a surprise

### Verify

- [ ] Long conversation -> send -> DEV log shows one summarization call, then a compacted request with a visibly smaller message count
- [ ] Usage indicator drops from ~70% to ~25% after compaction
- [ ] Trigger compaction via `regenerate` and via `editMessage` (not just the normal send), confirm both compact correctly
