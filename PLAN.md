# Personal Agent - Plan (UI-first, multi-provider)

## Goal

A desktop ChatGPT replacement built with Tauri v2, React 19, Tailwind v4, shadcn, Zustand, and the Vercel AI SDK.
It supports any number of OpenAI-compatible providers (opencode-go is just one preset example), each configured with a label, base URL, and API key, with models fetched per provider.
Conversations and messages persist in Turso (remote-only).
The full-featured UI ships first as a navigable, non-functional prototype for look-and-feel approval; real functionality is then added one feature at a time.

## Assumptions and decisions

- The repo contains pre-existing agent-harness artifacts (`ai/extensions/`, `.pi/`, `.opencode/`, `pi-lsp-setup.md`) that are left untouched by the scaffold.
  The Tauri project is bootstrapped alongside them without colliding or removing them.
  Patterns are referenced from the sibling app `personal-os` (Tauri v2, React 19, Tailwind v4, shadcn, Zustand, hash router).
- UI-first overrides the usual "one working flow at a time" rule.
  This is an explicit, user-mandated deviation: Phase 1 builds all screens and components with mock data and no-op handlers, and nothing real is wired until the user approves the look and feel.
  The normal incremental rule resumes after Phase 1.
- Phase 1 live-vs-noop line: purely visual interactions that need no persistence, network, or AI are live (theme toggle, copy-to-clipboard, sidebar navigation, dropdown/tab selection, collapse/expand, in-memory filtering of mock conversations, dialog open/close, entering edit mode).
  Everything that needs data or AI (send, stop, regenerate, edit save, rename, delete, search over real history, model fetch) is a no-op that shows a "Coming soon" toast.
  This line is a decision; the user can adjust it at the Phase 1 review.
- Providers are a first-class data model, not a special case.
  opencode-go is one seeded preset that pre-fills a base URL; the code treats every provider identically.
- Credentials live in localStorage (confirmed).
  OS keychain storage is a deferred hardening option, not a Phase 1 concern.
  LocalStorage credential loss is a complete-loss state; the hardening milestone includes a settings export of provider labels and base URLs (without keys) as a recovery aid.
- AI calls: webview-direct fetch first, Rust proxy (`reqwest`) as CORS fallback (confirmed).
  The working mode is remembered per provider.
- AI SDK usage: `ai` v5 with `@ai-sdk/openai-compatible`.
  A custom hook consumes `streamText` output and drives a Zustand store (single source of truth), instead of `useChat`, because base URL and key vary per provider and we need abort, reasoning capture, and store integration.
  Risk: if `streamText` proves unreliable in the webview, fall back to manual SSE parsing behind the same hook interface.
  This is verified early in Phase 3.
- Turso remote-only: no local SQLite, no `tauri-plugin-sql`.
  Persistence goes through the libSQL HTTP pipeline API (same pattern as `personal-os/src/lib/turso.ts`).
  Offline means history is unavailable, shown as an error state.
- History search is client-side over loaded conversations and messages, adequate for a personal app.
- Persistence lands in Phase 6 (after send/stream/stop, regenerate/edit, and conversation management).
  If the user prefers saved history sooner, Phase 6 can move earlier without structural change.
- App identity: productName "Personal Agent", identifier `com.hadi.personal-agent`, window ~1200x800, maximized optional.

## Proposed structure

Mirrors personal-os conventions: package.json `imports` aliases (`#components/*`, `#lib/*`, `#lib/types/*`, `#hooks/*`, `#pages/*`, `#store/*`), hash router (`createHashRouter`), Zustand stores, localStorage keys prefixed `personal-agent:`, Tauri commands via `invoke`, `src-tauri/capabilities/default.json` for permissions.

```
personal-agent/
  package.json                  # deps: ai, @ai-sdk/openai-compatible, react-router,
                                # zustand, react-markdown, remark-gfm, rehype-highlight,
                                # lucide-react, sonner, tailwind v4, shadcn deps
  vite.config.ts                # port 1420 pattern from personal-os
  tsconfig.json
  index.html
  src/
    main.tsx
    App.tsx                     # hash router: "/" -> chat page, "/settings" -> settings
    App.css
    components/
      layout.tsx                # shell: sidebar + main area
      app-sidebar.tsx           # conversation list, search, new chat, grouped by date,
                                # hover actions (rename/delete), footer (settings, theme)
      chat/
        chat-area.tsx           # header (title, model selector), message list, input
        chat-header.tsx
        message-list.tsx
        message-bubble.tsx      # role styling, thinking block, actions, edited marker
        thinking-block.tsx      # collapsible reasoning section
        message-input.tsx       # auto-grow textarea, send/stop button states
        markdown.tsx            # react-markdown + rehype-highlight + copy-code button
        empty-state.tsx         # welcome screen, suggestion chips, no-provider state
      settings/
        providers-list.tsx      # provider cards, default badge, edit/delete
        provider-form.tsx       # add/edit dialog: label, base URL, key, test connection
        settings-page.tsx       # tabs: Providers, Appearance, Data
      theme-provider.tsx        # React context for theme (light/dark/system); single source of truth, mirrors personal-os pattern
      theme-toggle.tsx
      ui/                       # shadcn components (sidebar, dialog, dropdown, etc.)
    pages/
      chat.tsx
      settings.tsx
    store/
      chat.ts                   # conversations, messages, streaming state, search query
      providers.ts              # providers, selected provider/model
      settings.ts               # turso config only (theme is React context, see theme-provider.tsx)
    lib/
      types/
        provider.ts             # Provider, ModelInfo
        chat.ts                 # Conversation, Message, MessageRole, MessageStatus
      mock-data.ts              # seed providers, conversations, messages for Phase 1
      config.ts                 # localStorage get/set for providers, turso, theme
      providers.ts              # real CRUD + models fetch (Phase 2)
      ai.ts                     # AI SDK client factory per provider (Phase 3)
      turso.ts                  # libSQL HTTP pipeline, migrations (Phase 6)
      search.ts                 # client-side history filter (Phase 6)
    hooks/
      use-chat.ts               # streamText wrapper driving the chat store (Phase 3)
  src-tauri/
    src/
      main.rs
      lib.rs                    # registers proxy command
      proxy.rs                  # reqwest passthrough: models/chat, streaming over IPC
    capabilities/default.json
    Cargo.toml                  # tauri 2, reqwest rustls-tls, serde, serde_json
    tauri.conf.json
```

## Milestone 0: Bootstrap (prerequisite, not a phase)

### Outcome

`npm run tauri dev` opens a Tauri window running an empty shell (sidebar placeholder + main area) with theme applied.

### Implementation

- Scaffold the project manually (matching personal-os layout), alongside the pre-existing `ai/extensions/`, `.pi/`, `.opencode/`, and `pi-lsp-setup.md` artifacts (leave them untouched; do not collide or remove them).
  Add React 19, TypeScript, Vite, Tailwind v4 via `@tailwindcss/vite`, react-router (hash), Zustand, lucide-react, sonner.
- Path aliases: use `package.json` `imports` (`#components/*`, `#lib/*`, `#lib/types/*`, `#hooks/*`, `#pages/*`, `#store/*`) with `tsconfig.json` `resolvePackageJsonImports: true`.
  Do NOT use `tsconfig` `paths` for `#` aliases; let the package.json resolver handle them.
- shadcn init (new-york style): `components.json`, `src/lib/utils.ts` with `cn` helper, Tailwind v4 shadcn token wiring (CSS variables for theming).
  Install only the shadcn components needed for Phase 1 (button, input, dialog, dropdown-menu, sidebar, tooltip, textarea, collapsible, tabs, card, separator, scroll-area, sonner).
- ESLint + Prettier: configure matching personal-os conventions.
  Treat lint failures as defects per AGENTS.md.
- Vitest + jsdom + @testing-library/react setup: `vitest.config.ts` with jsdom environment, test file pattern `src/**/*.test.{ts,tsx}`.
  Optionally add msw if mock-service-worker proves useful for Phase 2+ API tests.
- Configure `tauri.conf.json`, capabilities, and a minimal `App.tsx` router with two empty routes.
  Verify Rust toolchain and Tauri prerequisites are present.

### Verification

`npm run tauri dev` shows a window with the shell; `npm run build` typechecks; `npm run lint` passes; `npm run test` runs (0 tests, no failures).
No provider, chat, or network code exists yet.

### Deliberately deferred

Every UI component, mock data, stores, Rust proxy, Turso, and AI SDK code.

## Phase 1: Complete UI prototype (approval gate)

### Outcome

The full app UI is visible and navigable with seeded mock data: sidebar with search, new-chat button, date-grouped conversation list and per-item rename/delete affordances; chat area with title header, model selector (mock providers/models), empty state, message bubbles with markdown and syntax-highlighted code blocks with copy buttons, collapsible thinking blocks, per-message actions (edit, copy, regenerate), and an auto-grow input with send and stop states; a Settings page with Providers (list, add/edit dialog with label/base URL/key fields and a test-connection button), Appearance (theme), and Data (Turso URL/token).
Theme toggle, copy, navigation, dropdowns, tabs, collapse/expand, and in-memory filtering of mock conversations work.
Send, stop, regenerate, edit-save, rename, delete, model fetch, and Turso actions are no-op handlers with a "Coming soon" toast.
The user reviews and approves the look and feel; Phase 2+ starts only after sign-off.

### Implementation

- Build the full component tree from the proposed structure (sidebar, chat area, message bubbles, input, model selector, settings, provider management, search, empty states).
- Create `lib/types` and `lib/mock-data.ts` with two seeded providers (including an "opencode-go" preset) and 2-3 conversations with realistic messages, including one with a thinking block and one with code blocks.
- Create the Zustand stores with real shape but mock/no-op actions; a dev-only flag can show the no-provider empty state for review.
- Wire theme switching (light/dark/system) via a theme store; wire copy-to-clipboard and markdown rendering directly.
- Every no-op action shows a sonner toast "Coming soon".

### Verification

Run `npm run tauri dev` and walk the review path: search filters the mock list; select a conversation and inspect bubbles, code highlighting, copy, thinking collapse; switch theme and re-inspect; open Settings, add a provider in the dialog (fields validate visually, nothing persists), switch tabs; trigger send/regenerate/edit/rename/delete and observe toasts; delete nothing in mock data survives a reload.
Capture screenshots for approval.
Explicit user sign-off ends this phase.

### Deliberately deferred

All persistence, network calls, AI SDK wiring, Rust commands beyond the scaffold, Turso, real search, and tests (Phase 1 is purely visual; tests land after behavior stabilizes).

## Phase 2: Real provider management and model discovery

### Outcome

Settings > Providers is real: add, edit, delete, and set-default providers, each with label, base URL, and API key, persisted in localStorage.
The model selector fetches real models per provider from `GET {baseUrl}/models`, direct-first with Rust proxy fallback.
opencode-go is just a quick-add preset among several (OpenAI, Ollama, LM Studio, DeepSeek).
Connection mode (direct vs proxy) is remembered per provider and shown in the UI.

### CSP decision (moved here from hardening)

User-supplied base URLs + streamed markdown content create XSS and resource-loading risk.
Define a `Content-Security-Policy` in `tauri.conf.json`:
- `connect-src`: allow the app's configured provider base URLs (dynamically built from the provider list at startup).
- `script-src` and `style-src`: restrict to the webview origin plus any hash/nonce needed for shadcn and highlight.js.
- Explicitly document and accept the risk that API keys live in localStorage.

### Implementation

- `lib/config.ts`: localStorage CRUD for providers (`personal-agent:providers`) and selected provider/model.
- `lib/providers.ts`: fetch models and a test-connection call, direct fetch first, falling back to the Rust `proxy` command on CORS/network failure.
- Rust: `proxy` command in `proxy.rs` forwarding method, URL, headers, and body via `reqwest` and returning the JSON response over IPC; register it in `lib.rs`; add any needed capability permission.
- Providers store: real actions replacing no-ops; model selector reads real models with a loading state and error retry.
- Provider form validation: URL scheme, non-empty key, duplicate label detection.
- Unit tests: provider CRUD, validation logic, localStorage round-trip, duplicate detection.

### Verification

Configure a real endpoint (e.g., opencode-go, Ollama, or any OpenAI-compatible service), see real models populate the selector, restart the app and confirm providers persist, and force the direct path to fail (or use a CORS-restricted endpoint) to observe the proxy fallback and the remembered mode.
Run unit tests passing.

### Deliberately deferred

Chat, streaming, reasoning, OS keychain, provider import/export, and any conversation persistence.

## Phase 3: First real chat flow (send, stream, stop)

### De-risking spike (first task of Phase 3)

Tauri v2 commands are request/response; streaming needs a channel + custom `fetch` shim.
This is likely the *common* path (CORS), not optional.
Implement and verify before building any chat UX on top:
- Implement `proxyFetch(provider, url, init)` in `lib/ai.ts` that returns a webview `Response` by sending the request through a Tauri channel and reading streamed chunks from the Rust side.
- Rust side: `proxy_stream` command that uses `reqwest` streaming + a Tauri channel to push chunks back to the webview.
- Verify it streams a real `streamText` call against a CORS-restricted OpenAI-compatible endpoint end-to-end, including `AbortController`/`stop` (aborting the webview consumer must also cancel the Rust `reqwest` request).
- Only after this spike passes does the send/stream/stop UX get built on top.

### Outcome

Typing a message and pressing send produces a real streamed assistant response rendered into the message bubble; a stop button halts generation mid-stream (cancelling both the webview consumer and the Rust `reqwest` request on the proxy path); failures show an error bubble with retry.
Conversations live in memory only (lost on restart until Phase 6).

### Reasoning delta handling

During this phase, reasoning deltas (both `delta.reasoning_content` in manual SSE and `fullStream` reasoning parts in the SDK) MUST be dropped, not concatenated into the message content.
Write a passing unit test that verifies reasoning chunks are discarded while text deltas are accumulated.

### Implementation

- `lib/ai.ts`: `proxyFetch` shim (from the spike) + per-request `createOpenAICompatible({ baseURL, apiKey, name })`, then `streamText` using `proxyFetch` as the fetch implementation when the provider is in proxy mode.
- `hooks/use-chat.ts`: drives the chat store; sends via the conversation's provider, creates the user message and assistant placeholder, pipes `textStream` deltas into the store (dropping reasoning deltas), exposes `stop` via the abort controller, and handles completion and error statuses.
- Rust proxy extended with a `proxy_stream` command: `reqwest` streaming response body pushed over a Tauri channel; frontend consumes channel messages and constructs a streaming `Response`.
- `AbortController` wired end-to-end: webview abort -> Tauri channel drop -> Rust `reqwest` request cancelled.
- Input states: generating disables send and shows stop; streaming indicator on the active bubble; error toast plus an error message state with retry.
- Unit tests: chat store reducers (send, stop, stream append, abort), reasoning-drop logic, SSE parse helpers.

### Verification

Chat with a real provider end to end; confirm characters stream in; stop mid-generation and confirm truncation and proper abort on the Rust side; kill the provider and confirm the error path; switch providers and models and chat with each; verify the proxy streaming path by using a CORS-restricted endpoint.
Unit tests pass.

### Deliberately deferred

Persistence, regenerate, edit, auto-titles, reasoning rendering, search.

## Phase 4: Regenerate and edit messages

### Outcome

Regenerate replaces the last assistant message with a fresh streamed response; editing a user message opens an inline textarea and, on save, replaces the text, truncates following messages, marks the message as edited, and re-streams from that point.

### Implementation

- Chat store: `regenerate` (remove last assistant message, re-stream with unchanged context) and `editMessage` (patch content, set `editedAt`, truncate descendants, re-stream).
- Wire the message action buttons that were toasts in Phase 1 to these real handlers.
- Unit tests: regenerate truncation logic, editMessage descendant removal, editedAt marker.

### Verification

Regenerate produces a different response; edit changes the question and the conversation re-answers from that point; the edited marker shows; truncation removes downstream messages.
Unit tests pass.

### Deliberately deferred

Persistence, titles, search, Turso.

## Phase 5: Conversation management and auto-titles

### Outcome

New chat, rename (inline or context menu), delete with confirmation, and auto-title from the first user message (best-effort, falling back to "New chat").
Date grouping in the sidebar reflects real `updatedAt` values.

### Implementation

- Chat store conversation actions wired for real, replacing Phase 1 toasts.
- Auto-title via a short non-streaming `generateText` call using the conversation's provider/model, run after the first exchange.
- Unit tests: date grouping logic, title fallback, conversation CRUD reducers.

### Verification

Create, rename, and delete conversations; observe generated titles; confirm grouping and ordering update after edits.
Unit tests pass.

### Deliberately deferred

Persistence (still in-memory), real history search, Turso.

## Phase 6: Turso remote-only persistence and history search

### Outcome

Conversations and messages persist in Turso (remote-only) through the libSQL HTTP pipeline.
Restarting the app reloads history; sidebar search filters real conversations and message content; deleting a conversation removes it from Turso.
Turso URL/token are configured in Settings > Data, stored in localStorage, with a connection status indicator.

### Schema migration strategy

- Add a `schema_meta(version INTEGER)` row in the Turso database.
  On startup, check the stored version; if it is below the current expected version, run the required migrations in order.
- v1 schema: `schema_meta` at version 1, `conversations` table, `messages` table.
  Future versions append migration steps without breaking v1.
- Explicitly defer full migration tooling beyond v1, but the version check ensures a clean upgrade path exists from day one.

### Multi-statement transactions

Operations that touch multiple rows atomically (`editMessage` truncating following messages, `deleteConversation` removing the conversation and all its messages) must use a single Turso pipeline call.
Add `tursoExecuteMany(requests[])` to `lib/turso.ts` that sends multiple statements in one `/v2/pipeline` request.
Require `editMessage`/`regenerate` truncation and conversation deletion to use it.

### Implementation

- `lib/turso.ts` modeled on `personal-os/src/lib/turso.ts` with `CREATE TABLE IF NOT EXISTS` migrations for `schema_meta`, `conversations`, and `messages`, plus the version-check migration flow, run at startup.
- `tursoExecuteMany(requests[])`: multi-statement pipeline helper. Solves the single-pipeline transaction story for truncation and deletion.
- Repositories for conversations and messages; chat store loads history on startup and saves on message completion and conversation mutations (last-write-wins, single writer).
  Edit-message truncation and conversation deletion use `tursoExecuteMany`.
- `lib/search.ts`: client-side filter over loaded data; wire the Phase 1 search box.
- Loading, empty-history, and offline/error states with toasts.
- Unit tests: Turso arg encoding, value parsing, schema idempotency, `tursoExecuteMany` pipeline assembly, search filter logic.

### Verification

Chat, restart, and confirm history returns; search filters conversations by title and message text; delete persists across restarts; disconnect or use an invalid token and confirm a clear error state.
Unit tests pass.

### Deliberately deferred

Multi-device conflict resolution, incremental sync, message-level search indexes, export/import.

## Phase 7: Thinking and reasoning content (real)

### Outcome

Reasoning text from capable models streams into the collapsible thinking block and is excluded from the main message content.

### Implementation

- Capture reasoning from the stream: consume `fullStream` reasoning parts via the AI SDK where the provider surfaces them (this is the primary path).
  The manual SSE fallback only needs `delta.reasoning_content` parsing for endpoints the SDK does not already normalize.
- Store into `message.reasoning` during streaming and render via the existing thinking block.
- Unit tests: reasoning extraction from both `fullStream` and manual SSE paths.

### Verification

Chat with a reasoning-capable model through a compatible endpoint and confirm thinking streams live into the collapsible section, appears only there, and persists with the message.
Unit tests pass.

### Deliberately deferred

Reasoning polish (token counts, per-message toggle persistence), reasoning-only UI refinements.

## Hardening milestone

- Validation: provider form (URL scheme, non-empty key, duplicate labels), Turso URL/token checks, message length limits.
- Errors: unified error toasts, per-message retry, proxy failure messaging, offline detection for Turso and providers.
- Security: masked API keys in all UI, no key logging, optional OS keychain integration as a decision point.
  CSP was already defined in Phase 2; this phase reviews and tightens it.
- Credential-loss recovery: localStorage loss is a complete-loss state.
  Add a settings export feature that exports provider labels and base URLs (without API keys) as a JSON file, so the user can reconstruct their provider configuration after a reset.
- Performance: cached model lists, virtualized message list for long conversations, debounced search.
- Accessibility: Enter to send / Shift+Enter newline / Esc to stop, focus management in dialogs and edit mode, aria labels on icon-only buttons, theme contrast checks.
- Resilience: stream-drop retry with backoff, behavior on restart mid-stream.
- Logging and docs: dev logging of provider calls without keys; README plus a provider setup guide (opencode-go, OpenAI, Ollama, LM Studio, DeepSeek).

## Testing milestone

Unit tests are written per-phase (not deferred to a single milestone).
Vitest + jsdom + @testing-library/react are set up in Milestone 0.
Use `vi.spyOn` on injected dependencies per the validated Metrix3UI approach.

### Per-phase unit test targets (summary)

| Phase | Test targets |
|---|---|
| Phase 2 | Provider CRUD, validation, localStorage round-trip, duplicate detection |
| Phase 3 | Chat store reducers (send, stop, stream append, abort), reasoning-drop logic, SSE parse helpers |
| Phase 4 | Regenerate truncation, editMessage descendant removal, editedAt marker |
| Phase 5 | Date grouping, title fallback, conversation CRUD reducers |
| Phase 6 | Turso arg encoding, value parsing, schema idempotency, `tursoExecuteMany` pipeline assembly, search filter |
| Phase 7 | Reasoning extraction from `fullStream` and manual SSE paths |

### Integration (post-Phase 6, pre-delivery)

- Provider registry and model fetch with mocked fetch (direct and proxy paths).
- AI client with mocked `streamText`.
- Turso repositories with a mocked pipeline.

### E2E

- Primary chat lifecycle (send, stream, stop, regenerate, edit, persist, reload) via a manual verification checklist, since Tauri webview E2E is heavy.
  Add Playwright against the Vite frontend only if it proves cheap.

### Regression

Add tests for every defect discovered during phases.

## Completion criteria

- The Phase 1 UI prototype was reviewed and approved by the user before any backend wiring.
- Multiple providers can be added, edited, deleted, and defaulted; models are fetched per provider; opencode-go works as one preset among many.
- Send, stream, stop, regenerate, edit, rename, delete, auto-title, and history search all work with real data.
- Conversations and messages persist in Turso remote-only and survive restarts.
- Thinking/reasoning content renders in its own collapsible block; markdown and code render with syntax highlighting and working copy buttons; light and dark themes work.
- Hardening items and tests are complete per the milestones above.
- `npm run tauri dev` and `npm run tauri build` both succeed.

## Quality check

- Observable early result: yes, the Phase 1 prototype is the earliest deliverable and is entirely reviewable by running the app.
- Phase 1 runs independently: yes, scaffold (Milestone 0) makes it runnable; no backend is required.
- Each milestone builds on a working flow and leaves the app runnable: yes, every phase is independently verifiable.
- Architecture sufficient but not speculative: yes, structure mirrors proven personal-os patterns; AI SDK and Turso details are deferred to the phases that need them.
- UI before frontend infrastructure and backend layers: yes, by explicit user mandate.
- Deferred work is explicit: yes, every phase lists its deferrals; the Phase 1 live-vs-noop line is called out as a decision.
- Tests come after behavior stabilizes and before delivery: yes, per the testing milestone.
- Milestones are small enough to implement and verify separately: yes, one real capability per phase, with user approval gating the transition out of Phase 1.
