# Android APK build guide

This document describes how to build the Android APK for `Personal Agent` so
that anyone can download it and install it manually on their phone (sideloading).
This is not a Google Play upload, so we build and sign an APK ourselves.

- Output: a single universal, signed release APK
- Install method: manual download + install on the phone
- Signing key: `src-tauri/gen/android/keystore/personal-agent-release.keystore`

## 0. One-time machine setup

These are already installed on the current machine. Listed here so a fresh
machine can be set up.

### 0.1 Required tools

| Tool | Version used | Install |
| --- | --- | --- |
| JDK | Temurin/OpenJDK 17 | `brew install openjdk@17` |
| Android SDK | cmdline-tools + platform-tools + android-36 | see below |
| Android NDK | 29.0.13846066 | see below |
| Rust targets | 4 Android targets | see below |
| rustup | for adding Rust targets | `brew install rustup` |

### 0.2 Android SDK and NDK

Install the Android command line tools, then:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME="$HOME/Library/Android/sdk"
SDK="$ANDROID_HOME"

yes | "$SDK/cmdline-tools/bin/sdkmanager" --sdk_root="$SDK" --licenses
"$SDK/cmdline-tools/bin/sdkmanager" --sdk_root="$SDK" \
  "platform-tools" "platforms;android-36" "ndk;29.0.13846066"
```

### 0.3 Rust Android targets

```sh
export PATH="/opt/homebrew/opt/rustup/bin:$PATH"
rustup target add aarch64-linux-android armv7-linux-androideabi \
  i686-linux-android x86_64-linux-android
```

### 0.4 Android project

The Android Studio project lives in `src-tauri/gen/android` and is committed to
the repo. If it is ever missing or needs regenerating:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/29.0.13846066"
export PATH="/opt/homebrew/opt/rustup/bin:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

npm run tauri android init
```

Note: regenerating the project wipes hand-edited files. See step 0.5 for what
must be re-applied after a regeneration.

### 0.5 If you ever regenerate the Android project

`tauri android init` overwrites the generated project and drops anything edited
by hand. After regenerating, re-apply all of the following or the build will be
wrong.

#### 0.5.1 App icon

The generated project ships the Tauri default icon (a colored swirl), not this
app's logo. Regenerate the Android icons from the app's own artwork:

```sh
cd /Users/hadi/repos/personal-agent
npm run tauri icon src-tauri/icons/512x512.png
```

That writes desktop icons into `src-tauri/icons/` and Android icons into the
generated `mipmap-*` folders. Then remove the leftover Android Studio template
drawables, which are unused once the adaptive icon is in place:

```sh
cd src-tauri/gen/android
rm -f app/src/main/res/drawable/ic_launcher_background.xml \
      app/src/main/res/drawable-v24/ic_launcher_foreground.xml
rmdir app/src/main/res/drawable-v24 app/src/main/res/drawable 2>/dev/null
```

Confirm the adaptive icon exists:

```sh
cat app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml
```

It should reference `@mipmap/ic_launcher_foreground` and
`@mipmap/ic_launcher_background`.

#### 0.5.2 Release signing config

Re-add the signing config to `app/build.gradle.kts`.

At the top, after the `tauriProperties` block:

```kotlin
val keystoreProperties = Properties().apply {
    val propFile = rootProject.file("keystore.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}
```

Inside `android { ... }`, before `buildTypes`:

```kotlin
    signingConfigs {
        create("release") {
            if (keystoreProperties.isNotEmpty()) {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }
```

In the `release` build type, add:

```kotlin
            signingConfig = signingConfigs.getByName("release")
```

#### 0.5.3 Keystore and secrets

The `.gitignore` files in the generated project already ignore
`keystore.properties` and `/keystore/`, but a regeneration may reset them.
Confirm:

```sh
cd src-tauri/gen/android
grep -E 'keystore' .gitignore
```

It must list `keystore.properties` and `/keystore/`. Restore the keystore file
and `keystore.properties` from your backup if regeneration removed them.

#### 0.5.4 Safe-area layout

The web layer reserves space for the Android system bars (see `src/App.css`,
`#root { padding-*: env(safe-area-inset-*) }` and the `viewport-fit=cover`
meta tag in `index.html`). Those live outside `gen/android`, so a regeneration
does not affect them. No action needed unless the layout is changed.

## 1. The signing keystore (one-time, keep forever)

Android identifies an app by its signing key. The same key must be used for
every future release, otherwise phones will refuse to update over an existing
install.

- Keystore file: `src-tauri/gen/android/keystore/personal-agent-release.keystore`
- Passwords file: `src-tauri/gen/android/keystore.properties`
- Both are gitignored (never committed).
- **Back these up somewhere safe. If lost, you can never ship an update that
  installs over an existing installation.**

Generate a new keystore only if it does not exist yet:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
cd src-tauri/gen/android
mkdir -p keystore

read -s -p "Keystore password: " PW; echo
"$JAVA_HOME/bin/keytool" -genkeypair -v \
  -keystore keystore/personal-agent-release.keystore \
  -alias personal-agent \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12 \
  -dname "CN=Personal Agent, OU=Mobile, O=Personal Agent, L=Unknown, ST=Unknown, C=US" \
  -storepass "$PW" -keypass "$PW"
```

`keystore.properties` (already present, gitignored) holds the file path, alias,
and passwords. It is intentionally **not** reproduced in this document - the
actual password value never appears in version-controlled files. The file has
this shape:

```properties
storeFile=keystore/personal-agent-release.keystore
storePassword=<your password>
keyAlias=personal-agent
keyPassword=<your password>
```

The real file lives only on your machine (gitignored). See step 1.1 for how to
read the password back when you need it.

### 1.1 Where the password lives

The keystore password is deliberately kept out of every committed file.

- It is stored in `src-tauri/gen/android/keystore.properties`, which is
  gitignored.
- It is **not** written in this document or anywhere else that ships with the
  repo.

To read it back when you need it:

```sh
cd src-tauri/gen/android
grep '^storePassword=' keystore.properties
```

If you ever lose the password, the keystore is unusable and you cannot ship
updates that install over existing installs. Store it in a password manager as
well as the local file.

Do not commit, paste, or screenshot `keystore.properties` or the `.keystore`
file. The password only protects the keystore file, so the two must never be
exposed together.

## 2. Build the APK

Every time, from the repo root.

### 2.1 Version bump checklist

Keep these in sync before building:

| File | Field |
| --- | --- |
| `package.json` | `version` |
| `src-tauri/tauri.conf.json` | `version` |
| `src-tauri/Cargo.toml` | `version` |

The Android `versionName` comes from `tauri.conf.json` and `versionCode` is
derived automatically, so bumping the config is enough.

### 2.2 Build command

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/29.0.13846066"
export PATH="/opt/homebrew/opt/rustup/bin:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

cd /Users/hadi/repos/personal-agent
npm run tauri android build -- --apk
```

- `--apk` builds an installable APK (not an `.aab`, which is Play Store only).
- Omitting `--target` builds a universal APK containing all CPU architectures
  (arm64-v8a, armeabi-v7a, x86, x86_64), so one file works on any phone.
- Add `--target aarch64` to build a smaller arm64-only APK for modern phones.

### 2.3 Output and rename

Gradle names the file after the module and build type, not after the app, so we
rename it to something shareable. The filename has no effect on the app
identity (package name, version, signature), so renaming is safe.

Build output:

```text
src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

Copy it to the gitignored `release/` folder with a clear name:

```sh
cd /Users/hadi/repos/personal-agent

VERSION=$(node -p "require('./package.json').version")
SRC="src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk"
DEST="release/Personal-Agent-$VERSION-android.apk"

mkdir -p release
cp "$SRC" "$DEST"
ls -lh "$DEST"
```

Result, for version `1.10.0`:

```text
release/Personal-Agent-1.10.0-android.apk
```

The `release/` folder is gitignored. Attach this file to a GitHub Release
instead of committing it.

## 3. Verify the APK

Confirm the build is signed with your release key and contains the expected
architectures. Run this on the renamed file in `release/`.

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
cd /Users/hadi/repos/personal-agent

VERSION=$(node -p "require('./package.json').version")
APK="release/Personal-Agent-$VERSION-android.apk"
APKSIGNER=$(find "$HOME/Library/Android/sdk/build-tools" -name apksigner | head -1)
AAPT=$(find "$HOME/Library/Android/sdk/build-tools" -name aapt2 | head -1)

echo "=== signature ==="
"$APKSIGNER" verify --print-certs "$APK"

echo "=== architectures ==="
unzip -l "$APK" | grep '\.so$'

echo "=== package info ==="
"$AAPT" dump badging "$APK" | grep -E '^package|native-code|sdkVersion'
```

Expected: signer `CN=Personal Agent`, four `lib/*/libpersonal_agent_lib.so`
entries, and `targetSdkVersion:'36'`.

You can also install it directly to a USB-connected phone:

```sh
adb install -r "$APK"
```

## 4. Install on a phone (for users)

1. Copy the APK to the phone (download link, USB, email, cloud drive, etc.).
2. Open the file from the phone's Files app.
3. When prompted, allow installing from this source (Android asks for the
   specific app, e.g. "Files" or "Chrome").
4. Tap Install. If a previous version is installed, tap Update.

Alternative over USB:

```sh
VERSION=$(node -p "require('./package.json').version")
adb install -r "release/Personal-Agent-$VERSION-android.apk"
```

## 5. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Android SDK not found` | `ANDROID_HOME` not set | Export `ANDROID_HOME` (step 2.2) |
| `failed to run command rustup` | `rustup` not on `PATH` | Put `/opt/homebrew/opt/rustup/bin` first (step 2.2) |
| `Could not find directory of OpenSSL` | Something re-enabled `native-tls` | Keep `reqwest` on `rustls-tls`, no `native-tls` (see `src-tauri/Cargo.toml`) |
| `could not find menu in tauri` | Desktop-only menu code not gated | Menu code in `src-tauri/src/lib.rs` must stay behind `#[cfg(desktop)]` |
| APK installs but older version rejects update | Different signing key | Always use the same keystore (step 1) |
| `App not installed` on device | Unsigned or debug-signed release | Verify with `apksigner` (step 3) |

## 6. Notes

- Debug builds (`--debug`) are auto-signed with the Android debug key and are
  much larger; use them only for local testing.
- Release APKs are signed with the key in step 1. Keep that key and its
  passwords out of git and backed up.
- The Android Rust build uses `rustls` instead of `native-tls` because Android
  has no system OpenSSL. Do not switch `reqwest` back to its default TLS
  feature set.
