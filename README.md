# Personal Agent

A local-first AI chat desktop application built with Tauri, React, and TypeScript. Talk to any OpenAI-compatible API from your desktop with full control over your data.

## Features

- Chat with any OpenAI-compatible provider (OpenAI, Ollama, LM Studio, DeepSeek, Opencode Go, and more)
- Provider management with connection testing and model discovery
- Per-message retry on errors
- Message editing and response regeneration
- Conversational history with search (debounced)
- Virtualized message list for smooth scrolling in long conversations
- Streaming responses with stop support
- Thinking / reasoning content display (collapsible)
- Auto-generated conversation titles
- Dark, light, and system theme support
- Keyboard shortcuts: Enter to send, Shift+Enter for newline, Esc to stop
- Offline detection with automatic reconnection
- Stream-drop retry with exponential backoff
- Credential-loss recovery: export provider settings without API keys
- API keys masked in all UI; never logged
- Dev-mode provider call logging (URL and model only, no keys)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://www.rust-lang.org/) (for Tauri native backend)
- Platform-specific Tauri [prerequisites](https://v2.tauri.app/start/prerequisites/)

### Install

```bash
npm install
```

### Development

```bash
npm run tauri dev
```

This starts the Vite dev server and opens the Tauri desktop window.

### Build

```bash
npm run tauri build
```

## Provider Setup

Personal Agent works with any OpenAI-compatible API. Choose a provider below or configure a custom endpoint.

### Opencode Go

Opencode Go provides zen-compatible models via the go router.

1. Install and start [Opencode](https://opencode.ai)
2. In Personal Agent Settings > Providers, click "Opencode Go" under Quick Add
3. The base URL is pre-filled: `https://opencode.ai/zen/go/v1`
4. Leave the API key blank (Opencode Go doesn't require one)
5. Click "Test connection" to verify, then "Add provider"

### OpenAI

1. Get an API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. In Personal Agent Settings > Providers, click "OpenAI" under Quick Add
3. The base URL is pre-filled: `https://api.openai.com/v1`
4. Paste your API key (starts with `sk-`)
5. Click "Test connection" to verify, then "Add provider"
6. After adding, click the refresh icon to fetch available models

### Ollama (local)

Ollama runs models locally on your machine.

1. Install [Ollama](https://ollama.com) and pull at least one model: `ollama pull llama3.2`
2. In Personal Agent Settings > Providers, click "Ollama" under Quick Add
3. The base URL is pre-filled: `http://localhost:11434/v1`
4. Leave the API key blank (Ollama runs locally)
5. Click "Test connection" to verify, then "Add provider"

If the connection fails, make sure Ollama is running (`ollama serve`).

### LM Studio (local)

LM Studio runs models locally with an OpenAI-compatible server.

1. Install [LM Studio](https://lmstudio.ai) and load a model
2. Start the local server from the LM Studio UI (Developer tab)
3. In Personal Agent Settings > Providers, click "LM Studio" under Quick Add
4. The base URL is pre-filled: `http://localhost:1234/v1`
5. Leave the API key blank
6. Click "Test connection" to verify, then "Add provider"

### DeepSeek

1. Get an API key from [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
2. In Personal Agent Settings > Providers, click "DeepSeek" under Quick Add
3. The base URL is pre-filled: `https://api.deepseek.com/v1`
4. Paste your API key
5. Click "Test connection" to verify, then "Add provider"

### Custom Provider

Any service with an OpenAI-compatible `/v1/models` and `/v1/chat/completions` endpoint works.

1. In Settings > Providers, click "Add provider"
2. Enter a label (any name), the base URL including `/v1`, and your API key
3. Optionally enter comma-separated model IDs if the provider doesn't expose a `/models` endpoint
4. Choose connection mode:
   - **Direct** - fetch from the browser (works for most providers)
   - **Proxy** - route through the Tauri Rust backend (use for CORS-restricted endpoints)

## Turso Database (optional)

Connect to a [Turso](https://turso.tech) database for persistent conversation storage across sessions.

1. Create a database at [turso.tech](https://turso.tech)
2. Get your database URL (`libsql://...`) and auth token
3. In Settings > Data, enter the URL and token, then click "Test Connection"
4. Once connected, conversations are automatically persisted and loaded on startup

## Settings Export

To back up your provider configuration without exposing API keys:

1. Go to Settings > Providers
2. Click "Export" at the bottom
3. A JSON file downloads with provider labels, base URLs, and model lists (no API keys)

## Architecture

- **Frontend**: React 19 + TypeScript + Vite
- **Desktop shell**: Tauri v2 (Rust backend)
- **State management**: Zustand
- **AI SDK**: Vercel AI SDK with OpenAI-compatible provider
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Markdown**: react-markdown with GFM and syntax highlighting via highlight.js
- **Database**: Turso (libsql) for optional cloud persistence; localStorage for provider config

### Key files

| Path | Purpose |
|------|---------|
| `src/hooks/use-chat.ts` | Core chat logic: send, stream, retry, edit, regenerate |
| `src/store/chat.ts` | Zustand store: conversations, providers, model selection |
| `src/lib/ai.ts` | AI SDK integration and Tauri proxy fetch |
| `src/lib/providers.ts` | Provider model discovery and connection testing |
| `src/components/chat/message-list.tsx` | Virtualized message rendering |
| `src/components/chat/message-input.tsx` | Input with Enter/Shift+Enter/Esc handling |
| `src/components/settings/provider-form.tsx` | Provider add/edit form with validation |
| `src-tauri/src/proxy.rs` | Tauri proxy and streaming backend |

## License

MIT
