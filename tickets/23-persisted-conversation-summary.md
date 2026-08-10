# 23 - personal-agent | Backend - Persisted conversation summary field

**What to build:** `Conversation` gains a persisted `summary` and `summarizedUpToId`, stored via a new Turso migration, so a generated summary survives reload and is never regenerated per message.

**Blocked by:** #22 - Context usage indicator.

**Status:** Not started

## Tasks

### Types and migration

- [ ] `Conversation` type (`src/lib/types/chat.ts`): add `summary: string | null` and `summarizedUpToId: string | null` (id of the last message covered by the summary, used to detect staleness)
- [ ] Migration v6 in `turso-repository.ts` (follow the existing `version < N` pattern): `ALTER TABLE conversations ADD COLUMN summary TEXT` and `ADD COLUMN summarized_up_to_id TEXT`
- [ ] Include both fields in `TursoConversationRow` load / save - the full-conversation path used when a conversation is opened and sent to the model
- [ ] Do NOT add these columns to the sidebar list-view paths (`mapRowToSummary`, `loadConversationsForMonth`) - they never build outgoing model context and don't need them

### Verify

- [ ] Existing conversations still load correctly after migration, with `summary: null`
- [ ] Manually set a summary via the store, reload the app, confirm it round-trips through Turso
