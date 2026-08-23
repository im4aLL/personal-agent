# Build the Arch Linux package

This project does not publish to the AUR. Instead we build a native Arch
package (`.pkg.tar.zst`) from the already-built Tauri bundles so it can be
installed locally with `pacman` and uploaded to GitHub Releases for others.

## 1. Build the Tauri bundles

From the project root (see `deploy.md` for the required env vars):

```sh
NO_STRIP=1 APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri build
```

This produces, among others, the extracted deb tree at:

```
src-tauri/target/release/bundle/deb/Personal Agent_x.y.z_amd64/data
```

The Arch package is built from that `data/` tree.

## 2. Update the PKGBUILD

Edit `pkgbuild/PKGBUILD` and bump:

- `pkgver=` — match the new app version (e.g. `1.6.0`)
- `_debdata=` — point at the new extracted deb `data` folder

## 3. Build the package

```sh
cd pkgbuild
makepkg --nodeps
```

`--nodeps` skips the runtime dependency check (you install those with `pacman`
yourself). The output is:

```
pkgbuild/personal-agent-x.y.z-1-x86_64.pkg.tar.zst
```

## 4. Install locally

```sh
sudo pacman -U pkgbuild/personal-agent-x.y.z-1-x86_64.pkg.tar.zst
```

If `pacman` reports a missing dependency, install it first (e.g.
`libappindicator-gtk3`). Then launch `Personal Agent` from the app menu or run
`personal-agent`.

Uninstall:

```sh
sudo pacman -R personal-agent
```

## 5. Upload to GitHub Releases

```sh
gh release upload vX.Y.Z pkgbuild/personal-agent-x.y.z-1-x86_64.pkg.tar.zst
```

Others can then download it and install with `sudo pacman -U`.

## Notes

- `pkgbuild/` is gitignored — it only holds the local build and its output.
- The package depends on `webkit2gtk-4.1`, `libappindicator-gtk3`, `librsvg`,
  `gtk3`, and `openssl`.
