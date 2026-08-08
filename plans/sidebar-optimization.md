# Sidebar Optimization

## Goal

Prevent sidebar rendering performance degradation with 500+ conversations by reducing DOM node count, eliminating unnecessary SQL round-trips, and loading only the data needed for what is visible.

## What was done

### 1. Per-month grouping for older conversations

`groupConversations` previously had a single "Earlier" bucket for all conversations older than 7 days.
It now creates per-month groups using `Intl.DateTimeFormat` (e.g. "August 2025", "July 2025") instead of one giant flat list.

**How**: After the "Today", "Yesterday", and "Previous 7 days" groups are filled, remaining conversations are bucketed by `formatMonthLabel(conversation.updatedAt)`.
The function returns `[label, items[]][]` where month labels sit alongside the static time labels.

**Note**: This client-side grouping is an intermediate step.
Once per-group SQL queries (Phase 2) are implemented, `groupConversations` will be removed and the sidebar will consume pre-grouped data directly from the store.

### 2. Month groups wrapped in Collapsible, collapsed by default

Each month group (anything not "Today"/"Yesterday"/"Previous 7 days") is wrapped in a `Collapsible` component from shadcn/ui.
New months start collapsed, so their DOM subtree is not rendered.

**How**: The render loop checks `isMonthGroup` by excluding the three fixed labels.
Month groups render `CollapsibleTrigger` as the group header and `CollapsibleContent` wrapping the `SidebarMenu`.
Non-month groups render the same `SidebarGroupLabel` and `SidebarMenu` without the collapsible wrapper.

### 3. expandedMonths Set for tracking open months

A `useState<Set<string>>` tracks which month labels the user has expanded.
Expanding one month does not affect others.

**How**: `toggleMonth(label)` adds or removes the label from the Set immutably.
Each `Collapsible` receives `open={isOpen}` and `onOpenChange` calls `toggleMonth`.

### 4. renderConversationItem extracted

The rendering logic for a single conversation item (edit mode with inline input, or display mode with menu button + hover action buttons for rename/delete) is extracted into `renderConversationItem(conversation)`.

**How**: Called in `items.map((conversation) => renderConversationItem(conversation))` inside both month and non-month group `SidebarMenu` blocks.
Eliminates the inline JSX duplication that existed before.

### 5. Month headers show count badge and chevron

Each month group header displays the conversation count and a `ChevronDownIcon` that rotates 180 degrees when expanded, matching the Tags section pattern.

## Remaining work

### Phase 1: Titles-only search

**File**: `src/lib/search.ts`

`searchConversations` currently scans `conversation.messages.some(...)` for content matching.
After Phase 2, only the currently selected conversation will have messages in memory, so message-body search would silently return no results for most conversations.

**Change**: Remove the `conversation.messages.some(...)` call.
Search matches conversation titles only.

This is intentionally scoped: full-text search across message bodies is a separate feature (likely server-side FTS) and out of scope for sidebar optimization.

### Phase 2: Per-group SQL queries + lazy message loading

**Files**: `src/lib/turso-repository.ts`, `src/store/chat.ts`, `src/components/app-sidebar.tsx`

Replace the current `loadConversations()` (one query for all conversations, then N individual queries for messages) with per-group sidebar queries and lazy message loading.

#### 2a. Repository: new query functions

**`loadConversationSummaries()`** - Returns structured sidebar data, no messages.
Runs these queries in parallel (4 queries, all lightweight):

```sql
-- Pinned (any time period)
SELECT id, title, pinned, tags, created_at, updated_at
FROM conversations WHERE pinned = 1
ORDER BY updated_at DESC

-- Today
SELECT id, title, pinned, tags, created_at, updated_at
FROM conversations WHERE date(updated_at) = date('now') AND pinned = 0
ORDER BY updated_at DESC

-- Yesterday
SELECT id, title, pinned, tags, created_at, updated_at
FROM conversations WHERE date(updated_at) = date('now', '-1 day') AND pinned = 0
ORDER BY updated_at DESC

-- Previous 7 days (days 2-7)
SELECT id, title, pinned, tags, created_at, updated_at
FROM conversations WHERE updated_at >= date('now', '-7 days')
  AND updated_at < date('now', '-1 day') AND pinned = 0
ORDER BY updated_at DESC

-- Month metadata (counts only, for rendering collapsed headers)
SELECT strftime('%Y-%m', updated_at) as month, COUNT(*) as count
FROM conversations WHERE updated_at < date('now', '-7 days') AND pinned = 0
GROUP BY month ORDER BY month DESC
```

Return type:
```ts
{
  pinned: ConversationSummary[]
  today: ConversationSummary[]
  yesterday: ConversationSummary[]
  previous7Days: ConversationSummary[]
  monthGroups: { month: string; label: string; count: number }[]
}
```

Where `ConversationSummary` is `Omit<Conversation, 'messages'>`.

**`loadConversationsForMonth(month: string, limit: number)`** - Loads conversations for a specific month when the user expands it.

```sql
SELECT id, title, pinned, tags, created_at, updated_at
FROM conversations
WHERE updated_at >= '<month>-01' AND updated_at < '<next-month>-01' AND pinned = 0
ORDER BY updated_at DESC
LIMIT ?
```

The `month` parameter is in `YYYY-MM` format.
The date range is computed in JavaScript (no SQL date arithmetic needed for month boundaries).

**`loadMessages(conversationId: string): Promise<Message[]>`** - Extracted from the current inner loop of `loadConversations`.
Queries messages for a single conversation. Called when a conversation is selected.

#### 2b. Store: lazy message loading

**`conversations` array change**: Initially populated with summaries (no messages). Messages are `undefined` until loaded.

**`loadHistory` action**: Calls `loadConversationSummaries()` instead of `loadConversations()`.
Sets `isHistoryLoaded` when done. Much faster since no messages are fetched.

**New action `loadMessagesForConversation(conversationId: string)`**: Calls `loadMessages()`, then merges the messages into the conversation in the `conversations` array.

**`selectConversation` wiring**: When the user selects a conversation that has no messages loaded, `selectConversation` triggers `loadMessagesForConversation`.
If messages are already loaded (returning to a previously visited conversation), no fetch occurs.

**Per-conversation loading state**: A `Set<string>` of conversation IDs currently loading messages.
The chat pane uses this to show a spinner instead of an empty message list.

**`loadConversationsForMonth` store integration**: When the sidebar triggers a month expand or "View more", the store calls `loadConversationsForMonth` and merges the new summaries into `conversations` and the month data.

#### 2c. Sidebar: consume pre-grouped data

- Remove `groupConversations` function entirely.
- Sidebar reads structured data from the store: `today`, `yesterday`, `previous7Days`, `monthGroups`.
- Month groups render collapsed headers from the metadata query (count already known).
- Expanding a month triggers `loadConversationsForMonth` with `LIMIT 50`.
- If the returned count equals the limit, show a "View more" button that doubles the limit (50 -> 100 -> 200) and reloads.
- Pinned section renders from the `pinned` array as before.

#### 2d. Safety guards

**saveConversation**: The `persistConversation` action must check that messages are loaded before writing.
If `conversation.messages` is undefined, skip the write or throw - never persist an empty array that would wipe the database.

**applyMessageEdit / regenerateMessages**: These helpers in `store/chat-helpers.ts` operate on `messages[]`.
The store must ensure messages are loaded before these actions run.
Since the user must be viewing the conversation to edit or regenerate, and `selectConversation` already triggers loading, this is naturally guaranteed. Add an assertion or early return as a safety net.

**UX note**: Currently `isHistoryLoading` shows a spinner, then the full list (with messages) snaps in.
After lazy loading, the sidebar renders almost instantly (summaries only, 4 small queries), and the chat pane shows a per-conversation spinner on first select.
This is a net improvement for sidebar responsiveness but a noticeable behavioral change for the transition between conversations.

### Phase 3: Unify pinned section rendering

**File**: `src/components/app-sidebar.tsx`

The pinned section has its own copy of the editing and display JSX.
The only difference is the icon: `PinIcon` vs `MessageSquareIcon`.

Extend `renderConversationItem` to accept an optional `icon` prop (defaulting to `MessageSquareIcon`), then use it in the pinned section as `renderConversationItem(conversation, { icon: PinIcon })`.

### Phase 4: Virtualize large month groups (if needed)

Only if profiling shows a measurable issue after Phase 2.
With LIMIT 50 per month, the DOM count per expanded month is bounded.
If 50 is still too many, consider a virtual list inside `CollapsibleContent`.

## Implementation order

| Phase | Description | Effort | Depends on |
|-------|-------------|--------|------------|
| 1 | Titles-only search | Small | Nothing |
| 2a | Repository: new query functions | Medium | Phase 1 |
| 2b | Store: lazy message loading | Medium | Phase 2a |
| 2c | Sidebar: consume pre-grouped data | Medium | Phase 2b |
| 2d | Safety guards | Small | Phase 2b |
| 3 | Unify pinned section rendering | Small | Nothing (independent) |
| 4 | Virtualize large month groups | Medium | Only if needed |

Phase 1 must come before Phase 2a because the search function will break once messages are no longer in memory for all conversations.
Phase 3 is independent and can be done at any time.

## Completion criteria

### DOM optimization (done)

- Sidebar renders without noticeable lag with 500+ conversations in the database.
- Only visible conversations contribute to DOM node count (collapsed months contribute zero DOM).
- Pinned and unpinned conversation items share rendering logic without duplication.

### Network optimization (not done)

- Initial load fetches only sidebar-relevant columns (no message bodies).
- Sidebar load is 4 small parallel queries instead of 501 sequential round-trips.
- Month conversations are loaded on expand with LIMIT 50 and a "View more" affordance.
- Message bodies are loaded lazily when a conversation is selected.
- Search is titles-only (correct and fast without messages in memory).
- `saveConversation` never persists an empty messages array.
