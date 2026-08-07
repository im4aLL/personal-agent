# 4 — personal-agent | Frontend - Message input, empty states, and settings page

**What to build:** Auto-grow textarea with send button (idle state) and stop button (mock generating state). Empty state screens: welcome screen with suggestion chips when no conversation is selected, and a no-provider state. Settings page with three tabs: Providers (list with cards, add/edit dialog with label/base URL/key fields and test-connection button), Appearance (theme selector), and Data (Turso URL/token fields). All settings actions show "Coming soon" toasts. In-memory filtering of mock conversations via the sidebar search works.

**Blocked by:** #2 — App shell, sidebar, and navigation

**Status:** Done

- [x] Build message-input component: auto-grow textarea, send button (idle), stop button (mock generating state)
- [x] Build empty-state component: welcome screen, suggestion chips, no-provider state
- [x] Build settings-page with tabs: Providers, Appearance, Data
- [x] Build providers-list: provider cards, default badge, edit/delete affordances
- [x] Build provider-form: add/edit dialog with label, base URL, key fields, test-connection button, form validation
- [x] Build Appearance tab with theme selector
- [x] Build Data tab with Turso URL/token fields
- [x] Wire in-memory filtering of mock conversations via sidebar search
- [x] All settings actions (add/edit/delete provider, test connection, save Turso config) show "Coming soon" toast
- [x] Verify: search filters the mock list, send/stop states toggle visually, all settings tabs render, provider form validates visually
- [x] Verify: trigger send/regenerate/edit/rename/delete and observe toasts; mock data survives reload
