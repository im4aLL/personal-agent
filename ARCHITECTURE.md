# Personal Agent - Architecture

Personal Agent is a Tauri 2 desktop app (React 19 + TypeScript + Vite frontend, Rust backend) that provides a chat client for any OpenAI-compatible provider.
Conversations persist to a Turso (libsql) cloud database via HTTP, and AI streaming is proxied through Rust to avoid CORS restrictions.

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
    end

    UI --> STORE
    STORE --> LIB
    LIB -->|invoke proxy_stream / proxy / proxy_bytes| RUST
    LIB -->|fetch /v2/pipeline| TURSO
    RUST -->|reqwest streaming| PROVIDER
```

Two distinct outbound paths exist from the frontend:

- **Persistence path**: `fetch` directly to the Turso HTTP API (`/v2/pipeline`) with a bearer token from localStorage.
  Rust is not involved in SQL at all.
- **AI path**: `invoke("proxy_stream")` -> Rust reqwest -> provider API, streaming back over a Tauri `Channel`.
  This bypasses browser CORS and lets the webview connect to arbitrary OpenAI-compatible endpoints.

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

    SETPAGE --> NAV[Section nav: Data, Providers, Appearance, Instructions, Skills, Agents]
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
- Conversation and messages are persisted after stream completion (or retry after transient errors with up to 2 retries).

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
- `runMigrations()` (turso-repository.ts) versions the schema through the `schema_meta` table (currently version 5).
- Tables: `conversations`, `messages`, `user_instructions`, `skills`, `custom_agents`, `provider_configs`, `schema_meta`.
- SQL is written by hand with `?` placeholders; there is no ORM.
- All CRUD is guarded by `getTursoConfig()` - without a Turso URL/token in localStorage, persistence is a no-op and the app runs in memory only.

## 6. Rust backend (src-tauri)

```mermaid
flowchart LR
    subgraph Rust["src-tauri/src"]
        LIB[lib.rs: run + invoke_handler]
        PROXY[proxy.rs: proxy, proxy_stream, abort_stream, proxy_bytes]
        STATE[StreamState: abort-id -> oneshot sender]
    end

    subgraph Plugins["Tauri plugins"]
        P1[tauri-plugin-opener]
        P2[tauri-plugin-dialog]
    end

    LIB --> PROXY
    LIB --> STATE
    LIB --> P1
    LIB --> P2
    PROXY -->|Channel<StreamChunk>| FRONT[Frontend Channel API]
```

Registered commands (lib.rs):

| Command | Purpose |
| --- | --- |
| `proxy` | One-shot HTTP proxy (JSON in / JSON out) |
| `proxy_stream` | Streaming proxy over `tauri::ipc::Channel` for AI SSE |
| `abort_stream` | Cancels an in-flight stream by `abort_id` |
| `proxy_bytes` | Binary proxy returning base64 (used for file downloads) |
| `write_file` | Writes bytes to a path chosen via the save dialog |

Rust holds no application state beyond `StreamState` (a map of abort IDs to oneshot senders); all business logic lives in the frontend.

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
    COMP --> SET[settings: data-tab, providers-list, provider-form, provider-sync dialogs, agents-tab, agent-dialogs, appearance-tab]
    COMP --> UI[ui: shadcn-style primitives]
    LIB --> TYPES[types/chat.ts: Message, Conversation, UserInstruction, Skill, CustomAgent]
```

Responsibilities by layer:

- **pages** - route-level shells, no business logic.
- **components/chat** - pure presentational chat UI; reads stores via selectors; uses `useChat` for actions.
- **components/settings** - settings UI with local component state; calls store actions.
- **components/ui** - reusable shadcn/ui primitives (button, dialog, sidebar, combobox, etc.).
- **store** - zustand stores that own state + orchestrate persistence.
- **hooks/use-chat** - chat orchestration (streaming, retries, title generation, offline handling).
- **lib** - stateless infrastructure: Turso wire client, repositories, provider storage/encryption/sync, Tauri proxy fetch, config keys, download helpers, AI SDK glue.

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
