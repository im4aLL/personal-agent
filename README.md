# Personal Agent

Personal Agent is a local-first desktop AI workspace that brings your conversations, AI providers, custom agents, skills, and instructions into one place. Connect to multiple cloud or local models, create reusable AI capabilities, and activate agents, skills, or instructions instantly using slash commands-all while keeping your conversations and data under your control.

See [ARCHITECTURE.md](ARCHITECTURE.md) for a detailed breakdown of the app's architecture, component tree, and data flows. See [docs/SETUP.md](docs/SETUP.md) for step-by-step provider, web search, and database setup.

## Table of Contents

- [Why Personal Agent?](#why-personal-agent)
- [Screenshots](#screenshots)
- [Installation](#installation)
- [Features](#features)
- [Customization](#customization)
- [Technology Stack](#technology-stack)
- [License](#license)

## Why Personal Agent?

I use multiple AI subscriptions - Gemini, Opencode Go, and other OpenAI-compatible providers. I also run models locally via LM Studio and Ollama. For development, I use Pi and Opencode with those same subscriptions. But I wanted a separate chat interface for daily random things - brainstorming, quick questions, research, notes - without mixing into my dev tools. Over time, I kept running into the same frustrations:

- **Scattered conversations.** I would ask questions across different platforms and forget where I asked what. There was no single place to find my conversation history.
- **Lost data.** Responses, insights, and decisions would disappear into separate chat logs with no way to search or retrieve them later.
- **No tagging or organization.** I could not tag a conversation, group related chats, or pin important ones. Everything was just a flat list of untitled chats.
- **No formatting control.** Every platform forces its own style - emojis, formatting quirks, and output structures I did not ask for. I wanted my responses in a specific format, every time, without fighting the system.
- **Generic outputs.** When I asked an LLM to plan something, it would give me a generic plan format instead of the structure I actually use. There was no way to enforce my own templates.

Personal Agent solves all of this:

- **Centralized storage.** All conversations live in one local database. Search across everything from a single place. Optionally sync to Turso for multi-device access.
- **Custom instructions.** Define global instructions that get prepended to every conversation. No emojis, specific formatting rules, your preferred response structure - it just works.
- **Skills.** Create reusable skill blocks (think: project-specific guidelines, coding conventions, domain knowledge) and activate them per conversation. The LLM follows your rules, not the other way around.
- **Custom agents.** Combine instructions and skills into named agent profiles. Switch between them depending on what you are working on.
- **Tagging and pinning.** Organize conversations with tags. Pin the ones that matter. Find what you need without scrolling through a list of "New Chat (47)".
- **Multi-device.** Turso database sync means your conversations, agents, and instructions follow you across macOS and Windows devices.

## Screenshots

![Chat interface](screenshots/chat.png)

![Custom agent editor](screenshots/custom-agent.png)

![Provider and agent settings](screenshots/settings.png)

![Turso database configuration](screenshots/remote-db.png)

## Installation

Download the latest release for your platform from the [GitHub Releases](https://github.com/im4aLL/personal-agent/releases) page. Packages are provided for macOS, Windows, and Linux (AppImage, `.deb`, `.rpm`, and a native Arch `.pkg.tar.zst`).

### macOS

Download the `.dmg` installer from the [releases page](https://github.com/im4aLL/personal-agent/releases), open it, and drag **Personal Agent** to your Applications folder.

### Windows

Download the `.msi` installer from the [releases page](https://github.com/im4aLL/personal-agent/releases) and run it.

### Linux

Pick the package for your distro — only the package file is needed; any staging folders next to it in the release are build artifacts and can be ignored.

#### AppImage (any distro, no install)

```sh
chmod +x "Personal Agent_x.y.z_amd64.AppImage"
./"Personal Agent_x.y.z_amd64.AppImage"
```

- No installation or root required — just run it, or double-click in a file manager.
- Optional: use [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher) to integrate it into the app menu automatically.
- Optional: move it to a permanent location, e.g. `~/.local/bin/` or `/opt/`.

#### .deb (Debian / Ubuntu / Mint / Pop!_OS / elementary OS)

```sh
sudo apt install ./Personal\ Agent_x.y.z_amd64.deb
# or
sudo dpkg -i ./Personal\ Agent_x.y.z_amd64.deb
```

Uninstall:

```sh
sudo apt remove personal-agent
```

#### .rpm (Fedora / RHEL / CentOS / openSUSE)

```sh
sudo dnf install ./Personal\ Agent-x.y.z-1.x86_64.rpm
# or on RHEL/CentOS
sudo yum localinstall ./Personal\ Agent-x.y.z-1.x86_64.rpm
# or on openSUSE
sudo zypper install ./Personal\ Agent-x.y.z-1.x86_64.rpm
```

Uninstall:

```sh
sudo dnf remove personal-agent
```

After installing deb/rpm, launch `Personal Agent` from your app menu.

#### Arch Linux (`.pkg.tar.zst` / AUR)

Each release ships a native Arch package. Download it from the [releases page](https://github.com/im4aLL/personal-agent/releases) and install with `pacman`:

```sh
sudo pacman -U personal-agent-x.y.z-1-x86_64.pkg.tar.zst
```

This registers the app so it can be tracked and removed like any other package. The package pulls in `webkit2gtk-4.1`, `libappindicator-gtk3`, `librsvg`, `gtk3`, and `openssl` as dependencies (install `libappindicator-gtk3` first if `pacman` reports it missing). Launch `Personal Agent` from your app menu, or run `personal-agent`.

Uninstall:

```sh
sudo pacman -R personal-agent
```

> The project does not publish an official AUR package. To build the `.pkg.tar.zst` yourself, follow [AUR.md](AUR.md). A community-maintained AUR package, if one appears, would install with `yay -S personal-agent` (or your preferred AUR helper).

### Build from source

```bash
# Prerequisites: Node.js 20+, Rust, and Tauri v2 system dependencies
git clone https://github.com/im4aLL/personal-agent.git
cd personal-agent
npm install
npm run tauri build
```

### Development

```bash
npm install
npm run tauri dev
```

### Provider setup

Personal Agent works with any OpenAI-compatible API. For step-by-step instructions to add Opencode Go, OpenAI, Ollama, LM Studio, DeepSeek, or a custom endpoint, see [docs/SETUP.md](docs/SETUP.md#provider-setup).

> Want multi-device sync or web search? Those are covered in [docs/SETUP.md](docs/SETUP.md) too.

## Features

### Chat

- Chat with any OpenAI-compatible provider (OpenAI, Ollama, LM Studio, DeepSeek, Opencode Go, and more)
- Streaming responses with stop support
- Thinking / reasoning content display (collapsible)
- Per-message retry on errors
- Message editing and response regeneration
- Auto-generated conversation titles
- Conversation search with debounced input
- Virtualized message list for smooth scrolling in long conversations
- Tagging and pinning for conversation organization
- File attachments - images, PDFs (text is extracted and sent to the model), plus common text/code formats (`.txt`, `.md`, `.json`, `.csv`, `.ts`, `.py`-style extensions, etc.)
- Keyboard shortcuts: Enter to send, Shift+Enter for newline, Esc to stop

### Context management

- Live context-usage indicator (estimated tokens vs. the model's context window) in the message input
- Automatic conversation summarization when a conversation approaches the context limit, so older turns are compacted instead of dropped
- Manual "Compact" button to summarize on demand
- Summaries are invalidated automatically if you edit or regenerate a message they cover, so a stale summary is never reused

### Tools (web search & fetch)

Opt-in per tool in Settings > Web Search - the model only calls a tool if you've turned it on:

- **Web search** - Search the web via your own [Tavily](https://tavily.com) API key
- **URL fetching** - Let the agent fetch and read the content of a URL
- **Google / DuckDuckGo search window** - Opens a real, visible search window; you do the searching yourself (handles logins/captchas), then click "Done" to hand the results back to the model
- Tools are disabled automatically for Gemini providers due to a known upstream issue with tool calls

> Detailed tool and web search setup: see [docs/SETUP.md](docs/SETUP.md#web-search-setup).

### Customization

- **Custom instructions** - Global rules that apply to every message you send. Define your preferred format, tone, and constraints once.
- **Skills** - Reusable knowledge blocks you can activate per conversation (coding conventions, project guidelines, domain-specific rules).
- **Custom agents** - Combine instructions and skills into named profiles. Switch agents when switching contexts.

> How instructions, skills, and agents work together: see [docs/SETUP.md](docs/SETUP.md#custom-instructions-skills-and-agents).

### Data

- Local-first storage with Turso (libsql) for optional cloud sync
- Conversations, agents, skills, and instructions sync across devices
- Offline detection with automatic reconnection
- Settings export without API keys (provider labels, URLs, and model lists only)
- API keys masked in all UI and never logged
- Dev-mode provider call logging (URL and model only, no keys)

### Other

- Dark, light, and system theme support
- Stream-drop retry with exponential backoff
- Provider management with connection testing and model discovery

## Customization

Custom instructions, skills, and custom agents form the core of Personal Agent's customization system. They are stored in your Turso database (or locally) and can be managed from Settings. See [docs/SETUP.md](docs/SETUP.md#custom-instructions-skills-and-agents) for details and examples.

## Technology Stack

| Layer                | Technology                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Desktop shell        | [Tauri v2](https://v2.tauri.app/) (Rust)                                                                         |
| Frontend             | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)                                   |
| Build tool           | [Vite](https://vitejs.dev/)                                                                                      |
| State management     | [Zustand](https://zustand.docs.pmnd.rs/)                                                                         |
| AI SDK               | [Vercel AI SDK](https://sdk.vercel.ai/) with OpenAI-compatible provider                                          |
| Styling              | [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)                                |
| Markdown             | [react-markdown](https://github.com/remarkjs/react-markdown) with GFM + [highlight.js](https://highlightjs.org/) |
| UI primitives        | [Radix UI](https://www.radix-ui.com/) + [Base UI](https://base-ui.com/)                                          |
| Icons                | [Lucide React](https://lucide.dev/)                                                                              |
| Database             | [Turso](https://turso.tech/) (libsql) for optional cloud sync; localStorage for provider config                  |
| Linting & formatting | [Biome](https://biomejs.dev/)                                                                                    |
| Routing              | [React Router v7](https://reactrouter.com/)                                                                      |

## License

MIT
