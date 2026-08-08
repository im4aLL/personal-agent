# 18 - personal-agent | Frontend - Sidebar consumes pre-grouped data

**What to build:** The sidebar reads structured data directly from the store (`today`, `yesterday`, `previous7Days`, `monthGroups`) instead of running `groupConversations` client-side.
The `groupConversations` function is removed.
Month groups show their conversation count from the metadata query, and expanding a month triggers `loadConversationsForMonth` with LIMIT 50.
If 50 items are returned, a "View more" button doubles the limit and reloads.

**Blocked by:** #17 - Lazy message loading with per-group queries.

**Status:** Done

## Tasks

- [x] Remove `groupConversations` function from `app-sidebar.tsx`
- [x] Read structured data from the store: `today`, `yesterday`, `previous7Days`, `monthGroups`
- [x] Render month group headers from the metadata query (count already known from `monthGroups`)
- [x] Wire month expand to call `loadConversationsForMonth(month, 50)` in the store
- [x] Add "View more" button when the returned count equals the limit, doubling the limit on each click
