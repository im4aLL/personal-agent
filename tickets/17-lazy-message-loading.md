# 17 - personal-agent | Backend - Lazy message loading with per-group queries

**What to build:** Conversations load as lightweight summaries (title, pinned, tags, timestamps) via 4 small parallel SQL queries with no message bodies.
Messages for a conversation are loaded on demand only when the user selects it.
Safety guards prevent data loss from operations on conversations whose messages are not yet loaded.

**Blocked by:** #16 - Titles-only search.

**Status:** Done

## Tasks

### Repository: new query functions

- [x] Add `loadConversationSummaries()` that runs 4 parallel queries (pinned, today, yesterday, previous 7 days) plus a month-metadata query, returning structured sidebar data with no messages
- [x] Add `loadConversationsForMonth(month, limit)` that loads conversation summaries for a single month when expanded
- [x] Add `loadMessages(conversationId)` that queries messages for a single conversation

### Store: lazy message loading

- [x] Change `loadHistory` to call `loadConversationSummaries()` instead of `loadConversations()`
- [x] Add `loadMessagesForConversation(conversationId)` action that fetches and merges messages into the conversations array
- [x] Wire `selectConversation` to trigger `loadMessagesForConversation` when the selected conversation has no messages loaded
- [x] Add per-conversation loading state (a `Set<string>` of IDs) so the chat pane can show a spinner

### Safety guards

- [x] Guard `persistConversation` (and `saveConversation`): skip or throw if `conversation.messages` is undefined, never persist an empty array that would wipe the database
- [x] Add assertions or early returns in `applyMessageEdit` and `regenerateMessages` paths to ensure messages are loaded before mutation

### Chat pane loading state

- [x] Show a spinner in the chat pane when the selected conversation's messages are still loading
