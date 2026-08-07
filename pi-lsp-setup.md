# Setting up LSP access for Pi agents

Pi does not ship a built-in LSP client/tool. By default it exposes file and shell tools such as `read`, `write`, `edit`, `bash`, `grep`, `find`, and `ls`. To let agents use Language Server Protocol features, add an extension or package that exposes LSP operations as Pi tools, then install the language servers used by the project.

## Recommended shape

Expose a small set of read-first LSP tools to the agent:

- `lsp_diagnostics` — get compiler/type diagnostics for a file or workspace.
- `lsp_definition` — jump from a symbol use to its definition.
- `lsp_references` — find semantic references.
- `lsp_symbols` — list document/workspace symbols.
- `lsp_rename_preview` — preview rename-sensitive edits before applying them.

Keep file mutation in Pi's normal `edit`/`write` tools unless the LSP extension safely participates in Pi's file mutation queue.

## 1. Install project language servers

Install the language servers that match the repo. Prefer project-local dev dependencies when possible so every developer gets the same version.

Examples:

```bash
# TypeScript / JavaScript
npm install -D typescript typescript-language-server

# Python
python -m pip install pyright

# Rust
rustup component add rust-analyzer

# Go
go install golang.org/x/tools/gopls@latest
```

Verify each server is available from the same shell that launches Pi:

```bash
npx typescript-language-server --version
pyright --version
rust-analyzer --version
gopls version
```

## 2. Add or install a Pi LSP extension

Use one of these approaches:

### Project-local extension

Place the extension under the project:

```text
.pi/extensions/lsp/index.ts
```

Pi auto-discovers project-local extensions after the project is trusted. Restart Pi or run `/reload` after adding or editing the extension.

### Shared package

If the LSP integration is packaged, install it globally or for the project:

```bash
# Global
pi install npm:<package-name>

# Project-local, shared through .pi/settings.json
pi install -l npm:<package-name>
```

Review extension/package source before installing; Pi extensions run with local system permissions.

## 3. Tell agents when to use LSP

Add this to `AGENTS.md`:

```markdown
## Agent Workflow

- When available, use LSP features for symbol lookup, references, diagnostics, and rename-sensitive edits. Fall back to text search when LSP is unavailable, incomplete, or too slow.
```

Reload Pi after changing `AGENTS.md`:

```text
/reload
```

## 4. Confirm the tools are active

Inside Pi, ask:

```text
What LSP tools are available, and can you run diagnostics on the current project?
```

A working setup should let the agent call the LSP tools directly. If the extension dynamically enables tools, ask it to load the LSP tools first.

## Troubleshooting

- **No LSP tools shown**: restart Pi or run `/reload`; confirm the extension path is under `.pi/extensions/` or installed as a Pi package.
- **Language server not found**: launch Pi from a shell where the server command is on `PATH`; prefer project-local commands like `npx typescript-language-server` when possible.
- **Diagnostics are stale**: ensure dependencies are installed and the language server was initialized from the repo root.
- **Large or noisy output**: the extension should truncate diagnostics/results before returning them to the model.
- **Unsafe edits**: prefer LSP for navigation/diagnostics and Pi `edit` for file changes unless the extension explicitly implements safe queued mutations.
