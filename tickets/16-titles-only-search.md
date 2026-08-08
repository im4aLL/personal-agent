# 16 - personal-agent | Backend - Titles-only search

**What to build:** The sidebar search box matches conversation titles and tags via server-side (Turso) SQL query.
Message-body search is removed from `searchConversations` so that search does not silently fail once conversations no longer have messages loaded in memory.

**Blocked by:** None - can start immediately.

**Status:** Done

## Tasks

- [x] Remove the `conversation.messages.some(...)` call from `searchConversations` in `src/lib/search.ts`
- [x] Verify sidebar search still filters correctly by title
