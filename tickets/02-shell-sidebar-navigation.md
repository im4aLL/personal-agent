# 2 - personal-agent | Frontend - App shell, sidebar, and navigation

**What to build:** The full app shell is visible: sidebar with search input, new-chat button, date-grouped mock conversation list with hover rename/delete affordances, footer with settings and theme toggle links. Hash-routed navigation between Chat page and Settings page works. Theme toggle (light/dark/system) is fully functional and persists in localStorage. No-op buttons (rename, delete, new chat) show a "Coming soon" toast.

**Blocked by:** #1 - Bootstrap scaffold and tooling

**Status:** Done

- [x] Build layout component: sidebar + main area shell
- [x] Build app-sidebar with conversation list, search input, new-chat button, date grouping, hover actions (rename/delete), footer (settings, theme)
- [x] Create theme-provider (React context, light/dark/system, mirrors personal-os pattern) and theme-toggle component
- [x] Wire hash router: `/` -> chat page, `/settings` -> settings page
- [x] Navigation between pages works
- [x] Theme toggle switches and persists in localStorage
- [x] No-op handlers for rename, delete, new chat show sonner "Coming soon" toast
- [x] Verify: sidebar renders with mock data placeholders, navigation works, theme toggles
