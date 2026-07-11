---
date: 2026-07-12
topic: electron-transition
---

# Electron Transition for Steam

## Decision

Start the lightweight desktop transition early, while keeping the browser build working. Add Vite and a secure Electron shell before the game grows much further. Defer Steam account configuration, Steamworks features, signing, notarization, and SteamPipe uploads until the game is closer to release.

This avoids a late platform rewrite without making ordinary gameplay development depend on Steam.

## Staged Direction

1. **Desktop foundation:** retain the current HTML/CSS/JavaScript game, add a Vite production bundle, and add an Electron development/package entry point for Windows and macOS.
2. **Release behavior:** add versioned file-based saves, window/fullscreen settings, pause/focus handling, icons, and native cross-platform build verification.
3. **Steam release:** add optional achievements or other Steamworks features, configure Steam Auto-Cloud and OS depots, then sign, notarize, upload, and test through Steam.

## Electron-Safe Development Rules

- Keep gameplay and rendering modules browser-compatible and independently testable. Do not import Electron, Node.js, filesystem, or operating-system APIs directly into `src/` gameplay code.
- Put privileged desktop operations behind a small preload bridge with context isolation and renderer sandboxing. Do not enable general Node.js access in the renderer.
- Package runtime assets with the game. Do not make gameplay depend on a development server, CDN, remote script, or always-online service.
- Use relative asset paths and imports that work from a packaged application. Avoid hard-coded localhost URLs and machine-specific paths.
- Keep game state serializable as versioned JSON. Do not make durable saves depend only on browser `localStorage` or IndexedDB; use a storage interface that can write an explicit save file in Electron.
- Keep operating-system differences out of game logic. Avoid native Node dependencies unless they provide clear release value and support Windows x64 plus macOS Intel and Apple Silicon.
- Let Steam manage game updates. Do not add an independent Electron auto-updater to the Steam build.
- Preserve the static browser build so gameplay can still be tested quickly in Chrome and deployed to the web.
- Test new input, audio, sizing, and lifecycle behavior in both the browser and packaged Electron app once the desktop shell exists.

## Deferred Decisions

- Steam App ID and store setup
- Achievement list and other Steamworks features
- Exact Windows and macOS depot layout
- Windows signing provider and macOS signing credentials
- Whether macOS ships as a universal app or separate Intel and Apple Silicon depots

## Next Step

Create the minimal Vite plus Electron Forge foundation without changing gameplay behavior or removing the existing web deployment.
