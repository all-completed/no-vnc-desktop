# no-vnc-desktop

Electron desktop wrapper around noVNC with support for:

- `wss://...` and `ws://...` WebSocket VNC endpoints
- `vnc://host[:port]` raw TCP connections through Electron
- clipboard copy/paste between local system and remote session

## Download

- [macOS x64](https://github.com/all-completed/no-vnc-desktop/releases/latest/download/noVNC-Desktop-1.0.0-macos-x64.zip)
- [macOS arm64](https://github.com/all-completed/no-vnc-desktop/releases/latest/download/noVNC-Desktop-1.0.0-macos-arm64.zip)
- [Windows x64](https://github.com/all-completed/no-vnc-desktop/releases/latest/download/noVNC-Desktop-Setup-1.0.0-windows-x64.exe)
- [Windows arm64](https://github.com/all-completed/no-vnc-desktop/releases/latest/download/noVNC-Desktop-Setup-1.0.0-windows-arm64.exe)
- [Linux Snap x64](https://github.com/all-completed/no-vnc-desktop/releases/latest/download/no-vnc-desktop_1.0.0_amd64.snap)
- [Linux Snap arm64](https://github.com/all-completed/no-vnc-desktop/releases/latest/download/no-vnc-desktop_1.0.0_arm64.snap)
- [All releases](https://github.com/all-completed/no-vnc-desktop/releases)
- [Build artifacts](https://github.com/all-completed/no-vnc-desktop/actions/workflows/build-client.yml)

### macOS: app from GitHub won’t open

Release builds are **not signed with an Apple Developer ID** and are **not notarized**, so Gatekeeper may block them after download (browser adds a quarantine flag). The app itself is fine; macOS is refusing to run unsigned software from the internet.

**Option A — remove quarantine, then open normally**

```bash
xattr -cr "/full/path/to/noVNC Desktop.app"
open "/full/path/to/noVNC Desktop.app"
```

**Option B — first launch only**

Right-click `noVNC Desktop.app` → **Open** → confirm **Open** in the dialog.

**Option C**

**System Settings → Privacy & Security** — if macOS shows that the app was blocked, use **Open Anyway** for that app.

To ship builds that open without these steps, you need an Apple Developer account, **Developer ID Application** signing, and **notarization** (configure in `electron-builder` / Xcode).

## Requirements

- Node.js 18+
- npm

## Install

```bash
npm install
```

## Run in development

```bash
npm run dev
```

## Build web bundle

```bash
npm run build
```

## Package desktop app

```bash
npm run pack
```

## Connect

Enter one address in the app:

- `wss://host:6080/websockify`
- `ws://host:6080/websockify`
- `vnc://192.168.1.10:5900`

If you enter an address without a scheme, it is treated as `wss://`.

For `vnc://...`, the Electron desktop app is required because raw TCP is handled on the desktop side.

## Notes

- The app asks for a VNC password when the server requests credentials.
- Local clipboard paste also sends key events, which helps with terminal-style remote sessions.
