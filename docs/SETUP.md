# Setup Guide

Detailed, step-by-step setup for Personal Agent. For the project overview and feature list, see the [main README](../README.md).

## Table of Contents

- [Provider Setup](#provider-setup)
- [Custom Instructions, Skills, and Agents](#custom-instructions-skills-and-agents)
- [Web Search Setup](#web-search-setup)
- [Turso Database](#turso-database)
- [Settings Export](#settings-export)

## Provider Setup

Personal Agent works with any OpenAI-compatible API. Choose a provider below or configure a custom endpoint.

### Opencode Go

Opencode Go provides zen-compatible models via the go router.

1. Install and start [Opencode](https://opencode.ai)
2. In Personal Agent Settings > Providers, click "Opencode Go" under Quick Add
3. The base URL is pre-filled: `https://opencode.ai/zen/go/v1`
4. Leave the API key blank (Opencode Go does not require one)
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
3. Optionally enter comma-separated model IDs if the provider does not expose a `/models` endpoint
4. Choose connection mode:
   - **Direct** - fetch from the browser (works for most providers)
   - **Proxy** - route through the Tauri Rust backend (use for CORS-restricted endpoints)

## Custom Instructions, Skills, and Agents

These features form the core of Personal Agent's customization system. They are stored in your Turso database (or locally) and can be managed from Settings.

### Custom Instructions

Custom instructions are global rules injected as system prompts into every conversation. Use them to enforce formatting preferences, tone, or constraints.

Examples:

- "Never use emojis in responses."
- "Always format code blocks with the language tag."
- "Respond in plain English without marketing fluff."

### Skills

Skills are reusable blocks of domain knowledge or guidelines you can activate per conversation. They are injected into the system prompt only when you activate them.

Examples:

- A skill with your project's coding conventions
- A skill with your preferred meeting note format
- A skill with rules for writing commit messages

### Custom Agents

Custom agents combine a system prompt with a description. Activate an agent to switch the AI's persona and behavior for a specific workflow.

Examples:

- A "Code Reviewer" agent that focuses on security and performance
- A "Technical Writer" agent that produces documentation in your preferred style
- A "DevOps" agent that knows your infrastructure setup

## Web Search Setup

Each tool below is off by default and toggled independently in Settings > Web Search.

1. **Web search** - Get a free API key from [Tavily](https://app.tavily.com/home), paste it into Settings > Web Search, click "Save", then enable the "Web search" switch.
2. **URL fetching** - Enable the "URL fetching" switch to let the agent read the content of a URL it's given.
3. **Google / DuckDuckGo search window** - Enable either switch to let the agent open a dedicated search window. You perform the search yourself (so logins/captchas aren't a problem) and click "Done - send results" when finished; the results are then handed back to the model.

Tools are unavailable on Gemini-family providers regardless of these settings (see [ARCHITECTURE.md](../ARCHITECTURE.md#10-agentic-tool-calling-web-search--fetch)).

## Turso Database

Connect to a [Turso](https://turso.tech) database for persistent conversation storage and multi-device sync.

1. Create a database at [turso.tech](https://turso.tech)
2. Get your database URL (`libsql://...`) and auth token
3. In Settings > Data, enter the URL and token, then click "Test Connection"
4. Once connected, conversations, agents, skills, and instructions are automatically persisted and synced across devices

## Settings Export

To back up your provider configuration without exposing API keys:

1. Go to Settings > Providers
2. Click "Export" at the bottom
3. A JSON file downloads with provider labels, base URLs, and model lists (no API keys)
