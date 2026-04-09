# no-vnc-desktop

Electron desktop wrapper around noVNC with support for:

- `wss://...` and `ws://...` WebSocket VNC endpoints
- `vnc://host[:port]` raw TCP connections through Electron
- clipboard copy/paste between local system and remote session

## Download

- [Releases](https://github.com/all-completed/no-vnc-desktop/releases)
- [Build artifacts](https://github.com/all-completed/no-vnc-desktop/actions/workflows/build-client.yml)

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
