# Personal Agent - Architecture

Personal Agent is a Tauri 2 desktop app (React 19 + TypeScript + Vite frontend, Rust backend) that provides a chat client for any OpenAI-compatible provider.
Conversations persist to a Turso (libsql) cloud database via HTTP, and AI streaming is proxied through Rust to avoid CORS restrictions.
The model can also call tools mid-stream (web search, URL fetch) proxied through the same Rust layer, and long conversations are automatically summarized to stay within a model's context window.

## 1. High-level overview

```mermaid
flowchart LR
    subgraph Frontend["Frontend (React + TS)"]
        UI[React UI Components]
        STORE[Zustand Stores]
        LIB[Lib layer: Turso client, providers, proxy fetch]
    end

    subgraph Tauri["Tauri Shell"]
        RUST[src-tauri: Rust commands]
    end

    subgraph External["External services"]
        TURSO[(Turso / libsql database)]
        PROVIDER[AI provider APIs]
        WEB[Web pages / search engines]
    end

    UI --> STORE
    STORE --> LIB
    LIB -->|invoke proxy_stream / proxy / proxy_bytes| RUST
    LIB -->|fetch /v2/pipeline| TURSO
    RUST -->|reqwest streaming| PROVIDER
    LIB -->|AI SDK tool calls: fetchUrl, webSearch, googleSearch, duckduckgoSearch| RUST
    RUST -->|reqwest / scripted webview window| WEB
```

Three distinct outbound paths exist from the frontend:

- **Persistence path**: `fetch` directly to the Turso HTTP API (`/v2/pipeline`) with a bearer token from localStorage.
  Rust is not involved in SQL at all.
- **AI path**: `invoke("proxy_stream")` -> Rust reqwest -> provider API, streaming back over a Tauri `Channel`.
  This bypasses browser CORS and lets the webview connect to arbitrary OpenAI-compatible endpoints.
- **Tool-call path**: the model itself decides to call a tool (`fetchUrl`, `webSearch`, `googleSearch`, `duckduckgoSearch`) mid-stream; each tool's `execute` runs in the frontend and either proxies an HTTP request through Rust (`proxy`/`proxy_bytes`) or drives a dedicated scripted webview window for search engines that require an interactive/human-driven page load. See section 9.

## 2. Component tree

```mermaid
flowchart TD
    MAIN[main.tsx] --> APP[App.tsx: HashRouter + DataLoaders]
    APP --> DL[DataLoaders]
    DL --> MR[MigrationRunner: runMigrations if Turso configured]
    DL --> HL[HistoryLoader: loadHistory + loadProviderSyncKey]
    DL --> AL[AgentsLoader: loadFromTurso]

    APP --> LAYOUT[Layout]
    LAYOUT --> TP[ThemeProvider]
    LAYOUT --> SP[SidebarProvider]
    LAYOUT --> SIDEBAR[AppSidebar]
    LAYOUT --> INSET[SidebarInset + SidebarTrigger]
    INSET --> OUTLET[Outlet]

    SIDEBAR --> DD[DeleteConversationDialog]

    OUTLET --> CHATPAGE[ChatPage: /]
    OUTLET --> SETPAGE[SettingsPage: /settings]

    CHATPAGE --> CA[ChatArea]
    CA --> EMPTY[EmptyState: no conversation / no provider]
    CA --> CH[ChatHeader]
    CA --> ML[MessageList]
    CA --> MI[MessageInput]
    CH --> TE[TagEditor]
    ML --> MB[MessageBubble]
    MB --> MK[Markdown]
    MB --> TB[ThinkingBlock]
    MI --> COMB[Combobox: model picker]
    MI --> PIPE[Popover: attachments / slash commands]
    MI --> CUI[ContextUsageIndicator + Compact button]

    LAYOUT --> CWP[ChatWidthProvider: fixed vs full chat width]

    SETPAGE --> NAV[Section nav: Data, Providers, Web Search, Appearance, Instructions, Skills, Agents]
    SETPAGE --> WST[WebSearchTab: Tavily key, Google/DuckDuckGo toggles]
    SETPAGE --> DT[DataTab: Turso config + provider sync]
    SETPAGE --> PL[ProvidersList]
    SETPAGE --> PF[ProviderForm dialog]
    SETPAGE --> PSS[ProviderSyncSetupDialog]
    SETPAGE --> PSUM[ProviderSyncSummaryDialog]
    SETPAGE --> AT[AppearanceTab]
    SETPAGE --> AGT[AgentsSectionsGuard]
    AGT --> IT[InstructionsTab]
    AGT --> ST[SkillsTab]
    AGT --> CAT[CustomAgentsTab]
    IT --> AD[AgentDialogs: InstructionDialog / ItemDialog / DeleteConfirmDialog]
    ST --> AD
    CAT --> AD
```

## 3. Zustand store architecture

```mermaid
flowchart LR
    subgraph Stores["Zustand stores (selector-based subscription)"]
        CS[useChatStore: src/store/chat.ts]
        AS[useAgentsStore: src/store/agents.ts]
    end

    subgraph ChatState["useChatStore state"]
        C1[conversations, selectedConversationId]
        C2[providers, selectedModel, disabledModels]
        C3[thinkingLevel]
        C4[history: isHistoryLoaded, isHistoryLoading, historyError]
        C5[sidebar groups: today, yesterday, previous7Days, monthGroups]
        C6[provider sync: key, status, summary, pending]
        C7[per-conversation summary + summarizedUpToId for context compaction]
    end

    subgraph AgentsState["useAgentsStore state"]
        A1[userInstructions, activeInstructionId]
        A2[skills, activeSkillId]
        A3[customAgents, activeAgentId]
    end

    CS --- C1
    CS --- C2
    CS --- C3
    CS --- C4
    CS --- C5
    CS --- C6
    CS --- C7
    AS --- A1
    AS --- A2
    AS --- A3
```

Key selectors and consumers:

- `selectSelectedConversation(state)` (chat.ts:1257) drives `ChatArea` and `useChat`.
- `getSelectedModelInfo(state)` resolves the active model for message metadata.
- Store actions wrap persistence: chat actions call `turso-repository`, agents actions call `agent-repository`, provider actions call `providerStorage` + `providerSync`.
- `useChat` (hooks/use-chat.ts) is the only orchestrator that crosses both stores to compose the system prompt.

## 4. Chat send flow (frontend -> Rust proxy -> AI provider)

```mermaid
sequenceDiagram
    participant UI as MessageInput
    participant HOOK as useChat (hooks/use-chat.ts)
    participant STORE as useChatStore
    participant AGENTS as useAgentsStore
    participant SDK as AI SDK streamText
    participant AIPROXY as lib/ai.ts proxyFetch
    participant RUST as Rust proxy_stream (proxy.rs)
    participant PROVIDER as AI provider API
    participant TURSO as Turso HTTP API

    UI->>HOOK: sendMessage(content, attachments)
    HOOK->>AGENTS: read active instruction / skill / agent content
    HOOK->>STORE: addMessage(user message)
    HOOK->>SDK: streamText with createOpenAICompatible
    SDK->>AIPROXY: fetch(url, init) via proxyFetch
    AIPROXY->>RUST: invoke("proxy_stream", { request, channel })
    RUST->>PROVIDER: reqwest streaming request
    PROVIDER-->>RUST: SSE / chunked response
    RUST-->>AIPROXY: channel.onmessage chunks
    AIPROXY-->>SDK: ReadableStream<Uint8Array> response
    SDK-->>HOOK: fullStream text + reasoning deltas
    HOOK->>STORE: appendMessageContent / appendMessageReasoning
    HOOK->>STORE: persistConversation(conversationId)
    STORE->>TURSO: saveConversation -> tursoExecuteMany -> fetch /v2/pipeline
    HOOK->>STORE: setConversationTitle (generated via generateConversationTitle)
```

Details:

- When `connectionMode` is `proxy`, the AI SDK gets `fetch: proxyFetch`; otherwise the webview fetches directly (use-chat.ts:253).
- `proxyFetch` (lib/ai.ts) converts a standard `fetch` signature into a Tauri channel stream, and maps `AbortSignal` to `invoke("abort_stream")`.
- Streaming chunks are appended to the message in the store, so the UI updates per token.
- Before the request is sent, `buildOutgoingContext` (lib/context.ts) collapses history into `[persisted summary] + [raw tail]` when a summary exists and its cutoff message is still present; otherwise it sends full history. If estimated tokens exceed 70% of the resolved context window and no valid summary covers the history, auto-compaction runs first (see section 9) before the real request goes out.
- Non-Gemini providers get `tools: { fetchUrl, webSearch?, googleSearch?, duckduckgoSearch? }` (built by `buildEnabledTools`, gated on stored API keys/toggles) with `stopWhen: stepCountIs(8)`, so the model can call tools mid-stream and receive results back in the same `streamText` run.
- Conversation and messages are persisted after stream completion (or retry after transient errors with up to 2 retries).
- Editing or regenerating a message inside the already-summarized region invalidates the persisted summary (`isSummaryInvalidatedBy`, store/chat-helpers.ts) so a stale summary is never sent alongside changed history.

## 5. Persistence flow (frontend -> Turso)

```mermaid
flowchart LR
    subgraph Repos["Repository layer"]
        TR[turso-repository.ts: conversations + messages]
        AR[agent-repository.ts: instructions, skills, agents]
    end

    subgraph Wire["Wire layer (lib/turso.ts)"]
        TS[tursoSelect]
        TE[tursoExecute]
        TEM[tursoExecuteMany]
    end

    subgraph Storage["Local config (localStorage)"]
        CFG[config.ts: turso url/token, selected model, disabled models]
        PS[providerStorage.ts: provider records with encrypted keys]
    end

    UI2[Store actions] --> Repos
    UI2 --> PS
    Repos -->|if Turso configured| Wire
    Wire -->|fetch POST /v2/pipeline, Bearer token| TURSO2[(Turso)]
    PS -->|AES-GCM via WebCrypto| ENC[providerEncryption.ts]
    ENC --> SYNC[providerSync.ts: push / pull / merge]
    SYNC --> TURSO2
```

Data mapping:

- `turso.ts` serializes JS values to wire types (`text` / `integer` / `real` / `null`) and maps rows back with `parseValue`.
- `runMigrations()` (turso-repository.ts) versions the schema through the `schema_meta` table (currently version 6; v6 added `conversations.summary` and `summarized_up_to_id` for persisted context-compaction summaries).
- Tables: `conversations` (incl. `summary`, `summarized_up_to_id`), `messages`, `user_instructions`, `skills`, `custom_agents`, `provider_configs`, `schema_meta`.
- SQL is written by hand with `?` placeholders; there is no ORM.
- All CRUD is guarded by `getTursoConfig()` - without a Turso URL/token in localStorage, persistence is a no-op and the app runs in memory only.

## 6. Rust backend (src-tauri)

```mermaid
flowchart LR
    subgraph Rust["src-tauri/src"]
        LIB[lib.rs: run + invoke_handler]
        PROXY[proxy.rs: proxy, proxy_stream, abort_stream, proxy_bytes]
        STATE[StreamState: abort-id -> oneshot sender]
        GS[google_search.rs]
        DDG[duckduckgo_search.rs]
        SW[search_window.rs: shared webview-window helpers]
    end

    subgraph Plugins["Tauri plugins"]
        P1[tauri-plugin-opener]
        P2[tauri-plugin-dialog]
    end

    LIB --> PROXY
    LIB --> STATE
    LIB --> GS
    LIB --> DDG
    LIB --> P1
    LIB --> P2
    GS --> SW
    DDG --> SW
    PROXY -->|Channel<StreamChunk>| FRONT[Frontend Channel API]
    SW -->|scripted WebviewWindow + eval polling| ENGINE[Google / DuckDuckGo results page]
```

Registered commands (lib.rs):

| Command | Purpose |
| --- | --- |
| `proxy` | One-shot HTTP proxy (JSON in / JSON out) |
| `proxy_stream` | Streaming proxy over `tauri::ipc::Channel` for AI SSE |
| `abort_stream` | Cancels an in-flight stream by `abort_id` |
| `proxy_bytes` | Binary proxy returning base64 (used for file downloads) |
| `google_search` / `collect_google_results` | Opens a scripted Google results webview and scrapes results |
| `duckduckgo_search` / `collect_duckduckgo_results` | Same pattern against DuckDuckGo |
| `write_file` | Writes bytes to a path chosen via the save dialog |

Rust holds no application state beyond `StreamState` (a map of abort IDs to oneshot senders); all business logic lives in the frontend. `google_search`/`duckduckgo_search` are the exception: `search_window.rs` opens a real, visible `WebviewWindow` pointed at the engine's results page, injects a "Done" button via `initialization_script`, and polls (`eval_with_callback`, 500ms interval, 2 minute timeout) until the user clicks it and `window.__paResults` is populated - this is a human-in-the-loop scrape, not a headless request, because these engines block scripted/headless traffic.

## 7. Module and path conventions

Path aliases (tsconfig.json): `#components/*`, `#lib/*`, `#hooks/*`, `#store/*`.

```mermaid
flowchart TD
    SRC[src] --> PAGES[pages: chat.tsx, settings.tsx]
    SRC --> COMP[components]
    SRC --> STORE[store: chat.ts, agents.ts, chat-helpers.ts]
    SRC --> HOOKS[hooks: use-chat.ts, use-mobile.ts]
    SRC --> LIB[lib]
    COMP --> CHAT[chat: chat-area, header, list, bubble, input, tag-editor, markdown, thinking-block, empty-state]
    COMP --> SET[settings: data-tab, providers-list, provider-form, provider-sync dialogs, web-search-tab, agents-tab, agent-dialogs, appearance-tab]
    COMP --> UI[ui: shadcn-style primitives]
    LIB --> TOOLS[tools: web-search, google-search, duckduckgo-search, fetch-url, search-window, proxy-request]
    LIB --> TYPES[types/chat.ts: Message, Conversation, UserInstruction, Skill, CustomAgent]
```

Responsibilities by layer:

- **pages** - route-level shells, no business logic.
- **components/chat** - pure presentational chat UI; reads stores via selectors; uses `useChat` for actions.
- **components/settings** - settings UI with local component state; calls store actions.
- **components/ui** - reusable shadcn/ui primitives (button, dialog, sidebar, combobox, etc.).
- **components/chat-width-provider** - React context for the fixed-vs-full chat column width toggle, persisted via `lib/config.ts`.
- **store** - zustand stores that own state + orchestrate persistence.
- **hooks/use-chat** - chat orchestration (streaming, retries, title generation, offline handling, context compaction).
- **lib** - stateless infrastructure: Turso wire client, repositories, provider storage/encryption/sync, Tauri proxy fetch, config keys, download helpers, AI SDK glue, context/token estimation (`context.ts`).
- **lib/tools** - AI SDK `tool()` definitions the model can call mid-stream, each individually toggled on in Settings > Web Search: `fetchUrl` (proxied GET + HTML-to-text), `webSearch` (Tavily API, also needs a saved API key), `googleSearch`/`duckduckgoSearch` (drive the Rust scripted-webview scrape via `search-window.ts`), `proxy-request` (shared `invoke("proxy")` wrapper).

## 8. Startup sequence

```mermaid
sequenceDiagram
    participant MAIN as main.tsx
    participant APP as App.tsx
    participant MR as MigrationRunner
    participant TR as turso-repository
    participant HL as HistoryLoader
    participant CS as useChatStore
    participant AL as AgentsLoader
    participant AS as useAgentsStore
    participant TURSO as Turso

    MAIN->>APP: render
    APP->>MR: check getTursoConfig()
    alt Turso configured
        MR->>TR: runMigrations()
        TR->>TURSO: CREATE TABLE IF NOT EXISTS ... + version bumps
    end
    APP->>HL: mount
    HL->>CS: loadHistory()
    CS->>TURSO: loadConversationSummaries (grouped by date)
    CS->>CS: loadProviderSyncKey() from localStorage
    APP->>AL: mount
    AL->>AS: loadFromTurso()
    AS->>TURSO: load user_instructions, skills, custom_agents
    APP->>ROUTES: render ChatPage or SettingsPage
```

## 9. Context compaction

Plans: `plans/context-compaction.md`, `plans/sidebar-optimization.md`. Tickets 21-26.

```mermaid
flowchart TD
    EST[estimateTokens: chars/4 heuristic + per-image flat cost, memoized per message id] --> CHECK{shouldCompact: tokens > 70% of resolveContextWindow}
    RESOLVE[resolveContextWindow: model's real contextWindow if known, else PROVIDER_WINDOW_RULES static table, else 256k default] --> CHECK
    CHECK -->|yes, and no valid summary| RUN[runCompaction: generateConversationSummary over history minus a raw tail]
    RUN --> PERSIST[setConversationSummary: summary + summarizedUpToId, written to conversations.summary/summarized_up_to_id]
    PERSIST --> OUT[buildOutgoingContext: send summary + raw tail instead of full history]
    CHECK -->|no| OUT
    EDIT[Edit / regenerate a message inside the summarized prefix] --> INVALIDATE[isSummaryInvalidatedBy clears summary + summarizedUpToId]
    INVALIDATE --> CHECK
```

- Auto-compaction runs inline in `use-chat.ts` right before a request would exceed the threshold; a manual "Compact" button (`compactNow`) in `MessageInput` triggers the same `runCompaction` path on demand, both guarded by their own `AbortController`.
- A fixed-size raw tail (`compactionTailSize`) is always kept unsummarized so the most recent turns stay verbatim in context even immediately after compaction.
- If compaction itself fails (e.g. provider error), the send proceeds with full history rather than blocking the message.
- `ContextUsageIndicator` (message-input.tsx) surfaces the same `estimateTokens`/`resolveContextWindow` numbers live in the UI so the user sees usage before it triggers compaction.

## 10. Agentic tool calling (web search / fetch)

```mermaid
flowchart LR
    HOOK2[useChat: buildEnabledTools] -->|gated on stored keys/toggles| TOOLS2[fetchUrl / webSearch / googleSearch / duckduckgoSearch]
    TOOLS2 -->|fetchUrl, webSearch| PR[proxy-request.ts: invoke proxy] --> RUSTP[proxy.rs]
    TOOLS2 -->|googleSearch, duckduckgoSearch| SWTS[search-window.ts: invoke google_search / duckduckgo_search]
    SWTS --> RUSTSW[search_window.rs: open scripted WebviewWindow, poll for user click]
    RUSTP --> EXT1[Tavily API / arbitrary fetched URL]
    RUSTSW --> EXT2[Google / DuckDuckGo results page, visible to the user]
```

- Tools are disabled entirely for Gemini-family providers (`isGeminiProvider`) due to a known 400 with tool schemas; otherwise `buildEnabledTools` assembles whichever tools are individually toggled on in `WebSearchTab` settings - `fetchUrl` and `googleSearch`/`duckduckgoSearch` are plain on/off switches, `webSearch` additionally requires a saved Tavily API key.
- `streamText` is called with `stopWhen: stepCountIs(8)`, so the model can chain multiple tool calls (e.g. search then fetchUrl) within one send before the AI SDK forces a stop.
- `googleSearch`/`duckduckgoSearch` are deliberately human-in-the-loop: they open a real, visible Tauri window on the actual results page (not a headless scrape) because both engines block scripted traffic; the model waits on `poll_for_results` until the user reviews results and clicks "Done".
