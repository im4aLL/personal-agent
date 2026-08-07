# 12 - personal-agent | Backend - Cross-machine provider sync via Turso

**What to build:** Users can optionally sync their provider configurations (label, base URL, API key, connection mode) to Turso, so they do not have to re-enter API keys when using the app on a different machine. Sync is opt-in per provider or globally. API keys are encrypted client-side before leaving the machine, so Turso never sees plaintext. A merge strategy handles conflicts when a user has providers in both localStorage and Turso. Settings > Data tab gains a provider sync section with a toggle and sync-status indicator.

**Blocked by:** #5 - Provider management and model discovery, #9 - Turso remote-only persistence and history search

**Status:** Backlog

## Prerequisites from ticket 05

- [ ] `providerStorage.ts` abstraction module (or similar) wraps all localStorage access. No other module calls `localStorage` for providers directly.
- [ ] Provider records include `updated_at` timestamp to support conflict resolution.

## Core tasks

- [ ] Provider storage abstraction: refactor existing localStorage calls into a single module (`lib/providerStorage.ts`) exporting `getAll`, `save`, `delete`, `getDefault`, `setDefault`. LocalStorage remains the backing store for now but the interface stays stable when Turso is added.
- [ ] Add `updated_at` field to the provider schema (ISO 8601), set on every save. Backfill existing providers on load.
- [ ] `lib/providerSync.ts`: sync module that pushes/pulls provider records to/from Turso. Reads providers from the storage abstraction, encrypts keys client-side, writes ciphertext to a `provider_configs` Turso table.
- [ ] Client-side encryption: derive an encryption key from a user-provided passphrase (or from a random key stored in localStorage, with a recovery flow). Encrypt only the API key field; label, base URL, and connection mode are stored as plaintext in Turso.
- [ ] Turso schema: `provider_configs` table with columns `id`, `label`, `base_url`, `encrypted_key`, `connection_mode`, `is_default`, `updated_at`, `synced_at`.
- [ ] Opt-in UX: per-provider "sync to cloud" toggle, or a global "sync providers" toggle in Settings > Data. Default is off. When toggled on for the first time, prompt for an encryption passphrase (or generate and display a recovery key).
- [ ] Merge strategy on first sync: compare `updated_at` timestamps between localStorage and Turso. Last-write-wins per provider. Show a summary of what will be imported/overwritten before applying.
- [ ] Sync-status indicator in Settings > Data and next to each provider: synced, pending, error, never-synced.
- [ ] Syncing states: loading skeleton while fetching remote, error toast on failure, success toast on completion.
- [ ] Handle Turso disconnection gracefully: providers still work from localStorage, sync indicator shows offline/error.

## Verification

- [ ] Verify: add a provider on machine A, enable sync, confirm it appears in Turso `provider_configs` table with encrypted key.
- [ ] Verify: on machine B, connect same Turso database, enter same passphrase/recovery key, providers appear with masked keys and work.
- [ ] Verify: conflict resolution picks the newer `updated_at` when both local and remote have edits.
- [ ] Verify: disabling sync does not delete local providers.
- [ ] Verify: invalid passphrase shows a clear error, does not corrupt local data.
