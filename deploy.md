# Linux distribution builds

This document describes how to build all Linux packages for `Personal Agent`
on Arch Linux.

Reference: [release 1.5.0](https://github.com/im4aLL/personal-agent/releases/tag/1.5.0)
shipped these Linux assets:

| File | Distro / use |
| --- | --- |
| `Personal.Agent_1.5.0_amd64.deb` | Debian / Ubuntu / Mint / Pop!_OS |
| `Personal.Agent-1.5.0-1.x86_64.rpm` | Fedora / RHEL / openSUSE |
| `Personal.Agent_1.5.0_amd64.AppImage` | Any distro (portable, no install) |
| `personal-agent-1.5.0-1-x86_64.pkg.tar.zst` | Arch / Manjaro / EndeavourOS (`pacman -U`) |
| `personal-agent_1.5.0_amd64.snap` | Snap Store / Ubuntu (`snap install`, gitignored, upload separately) |

Windows (`.exe`, `.msi`) and macOS (`.dmg`) assets are built separately and
are not covered here.

## 0. Version bump checklist

Keep these in sync before building (currently `1.8.0` except PKGBUILD):

| File | Field |
| --- | --- |
| `package.json` | `version` |
| `src-tauri/tauri.conf.json` | `version` |
| `snapcraft.yaml` | `version:` |
| `pkgbuild/PKGBUILD` | `pkgver=` + `_debdata=` path (see step 2) |

## 1. deb / rpm / AppImage (via Tauri)

### Prerequisites

- Rust toolchain (via `rustup`)
- Node.js and npm
- Tauri system dependencies:
  - `webkit2gtk-4.1`
  - `libappindicator-gtk3`
  - `librsvg`
  - `patchelf`
- `fuse3` is preinstalled on Arch, but AppImage bundling additionally needs `fuse2` (libfuse.so.2) unless `APPIMAGE_EXTRACT_AND_RUN=1` is used.

### Required environment variables

Arch's system libraries (webkit2gtk, wayland, etc.) are built with RELR relocations (`.relr.dyn` sections), which the `strip` binary bundled inside linuxdeploy cannot process. The build fails with `unknown type [0x13] section .relr.dyn` unless stripping is disabled.

Set these before building:

| Variable | Purpose |
| --- | --- |
| `APPIMAGE_EXTRACT_AND_RUN=1` | Run AppImages without FUSE (avoids needing `fuse2`) |
| `NO_STRIP=1` | Skip linuxdeploy's strip step (avoids `.relr.dyn` failure) |

### Build commands

```sh
cd /home/hadi/repos/personal-agent

# Frontend + all bundles (deb, rpm, appimage) - this is what 1.5.0 used
NO_STRIP=1 APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri build

# Only the AppImage
NO_STRIP=1 APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri build -- --bundles appimage

# Only the deb package
NO_STRIP=1 APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri build -- --bundles deb

# Only the rpm package
NO_STRIP=1 APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri build -- --bundles rpm
```

### Output

Bundles are written to (version in file names follows `tauri.conf.json`):

```
src-tauri/target/release/bundle/
├── deb/Personal Agent_<version>_amd64.deb
├── rpm/Personal Agent-<version>-1.x86_64.rpm
└── appimage/Personal Agent_<version>_amd64.AppImage
```

Note: disabling strip (`NO_STRIP=1`) produces a larger AppImage (~98 MB vs ~70 MB). This is expected.

### Optional: persist the environment variables

To avoid typing them every time, add to your shell profile (`~/.zshrc`):

```sh
export NO_STRIP=1
export APPIMAGE_EXTRACT_AND_RUN=1
```

Then run `npm run tauri build` directly.

## 2. Arch package `.pkg.tar.zst` (via `makepkg`)

This project does not publish to the AUR. Instead we build a native Arch
package from the already-built Tauri deb tree so it can be installed locally
with `pacman` and uploaded to GitHub Releases (full details in `AUR.md`).

### Prerequisites

- Step 1 completed (the extracted deb tree must exist)
- `base-devel` (for `makepkg`)
- Runtime deps installed: `webkit2gtk-4.1 libappindicator-gtk3 librsvg gtk3 openssl`

### Build commands

```sh
cd /home/hadi/repos/personal-agent

# 1. Build the Tauri bundles first (see step 1)
NO_STRIP=1 APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri build

# 2. Bump pkgbuild/PKGBUILD to the new version:
#    pkgver=<version>  (must match tauri.conf.json)
#    _debdata="/home/hadi/repos/personal-agent/src-tauri/target/release/bundle/deb/Personal Agent_<version>_amd64/data"

# 3. Build the package (--nodeps skips the dep check, you install deps via pacman yourself)
cd pkgbuild
makepkg --nodeps
```

### Output / install

```
pkgbuild/personal-agent-<version>-1-x86_64.pkg.tar.zst
```

```sh
# Install locally
sudo pacman -U pkgbuild/personal-agent-<version>-1-x86_64.pkg.tar.zst

# Uninstall
sudo pacman -R personal-agent

# Launch
personal-agent
```

Note: `pkgbuild/` output (`.pkg.tar.zst`, `pkg/`, `src/`) is gitignored - only
`pkgbuild/PKGBUILD` is committed.

## 3. Snap package `.snap` (via `snapcraft`)

Builds a `core22` (Ubuntu 22.04) strict-confinement snap from the `snapcraft.yaml`
in the project root, following the [Tauri snapcraft guide](https://v2.tauri.app/distribute/snapcraft/).

### Prerequisites

- `snap`, `core22`, and `snapcraft` (all three) installed: `sudo snap install core22 snapcraft --classic`
- The user must be in the `lxd` group so snapcraft can build without sudo: `sudo usermod -aG lxd $USER` (re-login afterwards)
- An [UbuntuOne](https://login.ubuntu.com) account and the snap name `personal-agent` registered on [snapcraft.io](https://snapcraft.io): `snapcraft register personal-agent`

### Build commands

```sh
cd /home/hadi/repos/personal-agent

# Bump version: in snapcraft.yaml before building
snapcraft
```

Output is `personal-agent_<version>_amd64.snap` in the project root. The built `.snap`
is gitignored.

Notes:

- The build installs Rust via `rustup-init` inside `override-build` instead of the
  `rustup` classic snap, because the classic snap fails to install inside the LXD
  build container.
- The webkit2gtk-4.1 packages are pulled from the `snappi-dev/snapcraft-daily` PPA
  declared under `package-repositories` (core22's archive only ships webkit2gtk-4.0).

### Test locally

```sh
sudo snap install --dangerous personal-agent_<version>_amd64.snap
snap run personal-agent
```

### Release to Snap Store

```sh
snapcraft login          # Login with your UbuntuOne credentials
snapcraft upload --release=stable personal-agent_<version>_amd64.snap
```

### Troubleshooting (snap)

| Error | Cause | Fix |
| --- | --- | --- |
| `Timed out waiting for networking to be ready` (`getent hosts snapcraft.io` retries, container has IPv6 only, no `10.59.48.x`) | Host firewall (`ufw` active) blocks DHCP/DNS between the LXD container and `lxdbr0` | Allow the bridge through ufw, restart the stale instance, and rebuild (see below) |
| `dpkg-deb: error: --extract takes at most two arguments` | Stale `.deb` from a previous version next to the fresh one (`source: .` copies the local `target/` tree into the container, so `*.deb` matches two files) | Delete the old `src-tauri/target/release/bundle/deb/*<old-version>*` files on the host (fixed in `snapcraft.yaml`, which now picks the newest deb) |

```sh
# UFW blocks the LXD bridge by default. Allow it:
sudo ufw allow in on lxdbr0
sudo ufw allow out on lxdbr0
sudo ufw route allow in on lxdbr0
sudo ufw route allow out on lxdbr0

# Drop the stale half-provisioned instance so snapcraft relaunches it:
lxc stop --project snapcraft local:snapcraft-personal-agent-on-amd64-for-amd64-2469516

# Rebuild
snapcraft pack
```

Fallback if local LXD networking still fails: `snapcraft remote-build` builds on
Launchpad instead (requires `snapcraft login`, no local container needed).

## 4. Full release flow (example: 1.5.0)

```sh
cd /home/hadi/repos/personal-agent

# 1. Bump version in package.json, src-tauri/tauri.conf.json, snapcraft.yaml, pkgbuild/PKGBUILD
# 2. Build everything
NO_STRIP=1 APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri build
cd pkgbuild && makepkg --nodeps && cd ..
snapcraft

# 3. Create the GitHub release and upload (snap goes to Snap Store, not GitHub)
gh release create v<version> --title "<version>" --notes-file CHANGELOG.md
gh release upload v<version> \
  "src-tauri/target/release/bundle/deb/Personal Agent_<version>_amd64.deb" \
  "src-tauri/target/release/bundle/rpm/Personal Agent-<version>-1.x86_64.rpm" \
  "src-tauri/target/release/bundle/appimage/Personal Agent_<version>_amd64.AppImage" \
  "pkgbuild/personal-agent-<version>-1-x86_64.pkg.tar.zst"
snapcraft upload --release=stable personal-agent_<version>_amd64.snap
```

## Troubleshooting

| Error | Cause | Fix |
| --- | --- | --- |
| `dlopen(): error loading libfuse.so.2` / `AppImages require FUSE to run` | `fuse2` is not installed | `sudo pacman -S fuse2`, or use `APPIMAGE_EXTRACT_AND_RUN=1` |
| `failed to run linuxdeploy` with `unknown type [0x13] section .relr.dyn` | linuxdeploy's bundled `strip` is too old for RELR relocations | Use `NO_STRIP=1` |
