# Deploy from Arch Linux

This document describes how to build and bundle `Personal Agent` on Arch Linux.

## Prerequisites

- Rust toolchain (via `rustup`)
- Node.js and npm
- Tauri system dependencies:
  - `webkit2gtk-4.1`
  - `libappindicator-gtk3`
  - `librsvg`
  - `patchelf`
- `fuse3` is preinstalled on Arch, but AppImage bundling additionally needs `fuse2` (libfuse.so.2) unless `APPIMAGE_EXTRACT_AND_RUN=1` is used.

## Required environment variables

Arch's system libraries (webkit2gtk, wayland, etc.) are built with RELR relocations (`.relr.dyn` sections), which the `strip` binary bundled inside linuxdeploy cannot process. The build fails with `unknown type [0x13] section .relr.dyn` unless stripping is disabled.

Set these before building:

| Variable | Purpose |
| --- | --- |
| `APPIMAGE_EXTRACT_AND_RUN=1` | Run AppImages without FUSE (avoids needing `fuse2`) |
| `NO_STRIP=1` | Skip linuxdeploy's strip step (avoids `.relr.dyn` failure) |

## Build commands

```sh
cd /home/hadi/repos/personal-agent

# Frontend + all bundles (deb, rpm, appimage)
NO_STRIP=1 APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri build

# Only the AppImage
NO_STRIP=1 APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri build --bundles appimage

# Only the deb package
NO_STRIP=1 APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri build --bundles deb
```

## Output

Bundles are written to:

```
src-tauri/target/release/bundle/
├── deb/Personal Agent_1.5.0_amd64.deb
├── rpm/Personal Agent-1.5.0-1.x86_64.rpm
└── appimage/Personal Agent_1.5.0_amd64.AppImage
```

## Optional: persist the environment variables

To avoid typing them every time, add to your shell profile (`~/.zshrc`):

```sh
export NO_STRIP=1
export APPIMAGE_EXTRACT_AND_RUN=1
```

Then run `npm run tauri build` directly.

## Troubleshooting

| Error | Cause | Fix |
| --- | --- | --- |
| `dlopen(): error loading libfuse.so.2` / `AppImages require FUSE to run` | `fuse2` is not installed | `sudo pacman -S fuse2`, or use `APPIMAGE_EXTRACT_AND_RUN=1` |
| `failed to run linuxdeploy` with `unknown type [0x13] section .relr.dyn` | linuxdeploy's bundled `strip` is too old for RELR relocations | Use `NO_STRIP=1` |

Note: disabling strip (`NO_STRIP=1`) produces a larger AppImage (~98 MB vs ~70 MB). This is expected.
