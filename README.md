# Personal Agent

Personal Agent is a local-first desktop AI workspace for your everyday chats, research, and notes. Bring any OpenAI-compatible provider, keep every conversation in one searchable place, and get answers in your format with custom instructions, skills, and agents.

- Website: https://personal-agent.habibhadi.com/
- Downloads: [GitHub Releases](https://github.com/im4aLL/personal-agent/releases)
- Setup guide: [docs/SETUP.md](docs/SETUP.md) - Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)

## Why Personal Agent?

I juggle several AI subscriptions plus local models, and I wanted one chat app for daily things without mixing them into my dev tools. Existing chat apps scatter history across platforms, lose old insights, and force their own output style. Personal Agent fixes that: one searchable store on your disk (optional Turso sync for other devices), global formatting rules, reusable skills, named agents, and tags and pins instead of a flat list of untitled chats.

## Screenshots

![Chat interface](screenshots/chat.png)

![Custom agent editor](screenshots/custom-agent.png)

![Provider and agent settings](screenshots/settings.png)

![Turso database configuration](screenshots/remote-db.png)

## Installation

Grab the latest release from the [releases page](https://github.com/im4aLL/personal-agent/releases) or the [website](https://personal-agent.habibhadi.com/): `.dmg` for macOS, `.msi` for Windows, and `.AppImage`, `.deb`, `.rpm`, or Arch `.pkg.tar.zst` for Linux.

```sh
# AppImage (any distro, no install)
chmod +x "Personal Agent_x.y.z_amd64.AppImage"
./"Personal Agent_x.y.z_amd64.AppImage"

# Debian / Ubuntu
sudo apt install ./Personal\ Agent_x.y.z_amd64.deb

# Fedora / RHEL / openSUSE
sudo dnf install ./Personal\ Agent-x.y.z-1.x86_64.rpm

# Arch Linux
sudo pacman -U personal-agent-x.y.z-1-x86_64.pkg.tar.zst
```

No official AUR package is published; to build the Arch package yourself, see [AUR.md](AUR.md).

### Build from source

```bash
# Prerequisites: Node.js 20+, Rust, and Tauri v2 system dependencies
git clone https://github.com/im4aLL/personal-agent.git
cd personal-agent
npm install
npm run tauri build # or: npm run tauri dev
```

Provider, web search, and database setup are covered in [docs/SETUP.md](docs/SETUP.md).

## Features

- **Chat** - Any OpenAI-compatible provider (OpenAI, Ollama, LM Studio, DeepSeek, Opencode Go, custom endpoints). Streaming with stop, edit and regenerate, auto titles, conversation search, tags and pins, attachments (images, PDFs as extracted text, text and code files). Enter to send, Shift+Enter for newline, Esc to stop.
- **Context management** - Live context-usage indicator, automatic summarization near the context limit plus a manual Compact button, and automatic invalidation of stale summaries after edits.
- **Agent tools** (opt-in under Settings > Web Search) - Tavily web search, URL fetching, Google/DuckDuckGo search windows with a human-in-the-loop Done button, and PDF creation. Disabled for Gemini providers due to an upstream tool-call issue.
- **Customization** - Global custom instructions, per-conversation skills, and named agents combining both, activated with slash commands. Details and examples: [docs/SETUP.md](docs/SETUP.md#custom-instructions-skills-and-agents).
- **Data** - Local-first storage (Turso/libsql) with optional cloud sync across devices, offline detection with reconnect, settings export without keys, and masked API keys.
- **Appearance** - Dark, light, and system themes, fixed/fluid chat width.

## Technology Stack

Tauri v2 (Rust) + React 19 + TypeScript + Tailwind CSS/shadcn + Vercel AI SDK + Turso. See [ARCHITECTURE.md](ARCHITECTURE.md) for details.

## License

MIT
