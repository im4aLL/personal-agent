# 14 - personal-agent | Frontend - Pin conversation

**What to build:** The user can pin conversations from the sidebar, keeping them at the top of the conversation list above the date-grouped unpinned conversations.
A pinned conversation shows a pin icon indicator and stays anchored at the top regardless of its `updatedAt` value.
Unpinning returns the conversation to its normal position in the date-grouped list.
Pin state persists in the conversation record (and in Turso once Phase 6 lands).

**Blocked by:** #8 - Conversation management and auto-titles (for the conversation CRUD actions and sidebar hover affordances)

**Status:** Done

## Tasks

### Pin/unpin actions
- [x] Add a pin/unpin action to the sidebar conversation item hover menu (between rename and delete).
- [x] Chat store: `togglePin(conversationId)` action that flips the `pinned` boolean on the conversation.
- [x] Pin state persists in the conversation record (`pinned: boolean`, default `false`).

### Sidebar ordering
- [x] Pinned conversations render first in the sidebar, in their own section above date groups.
- [x] Pinned section has a subtle visual separator from unpinned conversations.
- [x] Within the pinned section, conversations are ordered by most recently updated first.
- [x] Unpinned conversations continue to group by date as before.

### Persistence
- [x] Pin state persists in Turso (add `pinned` column to `conversations` table migration).
- [x] Pin toggle writes through to Turso immediately.

### Edge cases
- [x] Pinning a conversation that is already pinned unpins it (toggle behavior).
- [x] Deleting a pinned conversation removes it from both the pinned section and the store.
- [x] Renaming a pinned conversation keeps it pinned and updates the pinned section.
- [x] Auto-title for a pinned conversation does not affect its pinned status.
