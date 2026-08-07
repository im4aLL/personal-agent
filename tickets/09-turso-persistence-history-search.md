# 9 — personal-agent | Backend - Turso remote-only persistence and history search

**What to build:** Conversations and messages persist in Turso (remote-only, libSQL HTTP pipeline). Restarting the app reloads full history. Sidebar search filters real conversations by title and message content (client-side over loaded data). Deleting a conversation removes it from Turso. Turso URL/token are configured in Settings > Data, stored in localStorage, with a connection status indicator. Schema migration strategy: `schema_meta(version)` row with v1 schema (`conversations`, `messages`); version-check flow at startup. Multi-statement transactions for truncation (`editMessage`) and deletion (`deleteConversation`) via `tursoExecuteMany`. Loading, empty-history, and offline/error states with toasts. Unit tests pass for Turso arg encoding, schema idempotency, pipeline assembly, and search filter.

**Blocked by:** #8 — Conversation management and auto-titles

**Status:** Ready For Dev

- [ ] `lib/turso.ts` modeled on `personal-os/src/lib/turso.ts`: `CREATE TABLE IF NOT EXISTS` migrations for `schema_meta`, `conversations`, `messages`
- [ ] Version-check migration flow: check `schema_meta` version at startup, run required migrations in order
- [ ] v1 schema: `schema_meta` at version 1, `conversations` table, `messages` table
- [ ] `tursoExecuteMany(requests[])`: multi-statement pipeline helper for atomic truncation and deletion
- [ ] Repositories for conversations and messages (CRUD via Turso pipeline)
- [ ] Chat store: load history on startup, save on message completion and conversation mutations (last-write-wins, single writer)
- [ ] Edit-message truncation and conversation deletion use `tursoExecuteMany`
- [ ] `lib/search.ts`: client-side filter over loaded data; wire sidebar search box
- [ ] Settings > Data tab: real Turso URL/token fields with connection status indicator
- [ ] Loading, empty-history, and offline/error states with toasts
- [ ] Verify: chat, restart, confirm history returns
- [ ] Verify: search filters conversations by title and message text
- [ ] Verify: delete persists across restarts
- [ ] Verify: disconnect or invalid token shows clear error state
