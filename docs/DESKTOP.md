# Cyber Runner for Windows

## Players

Download a finished Windows release from
https://github.com/Rashmika-D-N/cyber-runner/releases.

- Installer: run `Cyber-Runner-1.0.0-Windows-Setup.exe`. It installs for the
  current Windows user without administrator rights and creates a shortcut.
- Portable: extract the complete `Cyber-Runner-1.0.0-Windows-x64.zip`, then
  open `Cyber Runner.exe`. Keep all the extracted files together.

Both include the character, graphics, sounds, MediaPipe model, WASM runtime,
Chromium and Node runtime. No further download or development tool is needed.
Windows 10/11 x64 and WebGL2-capable graphics are required. Keyboard play works
without a webcam. Motion play requires Windows camera access for desktop apps.

The app opens in a combined view. `Separate screens` / `Ctrl+Shift+E` opens the
operator window and, if a second monitor is attached, places game and operator
on external and primary displays. Windows must use Extend mode. Both windows
must stay visible. F11 toggles full screen; Escape exits. Alt reveals the menu.

Calibration is stored in the app's per-user data directory, separate from Chrome
and the browser exhibition build. Adjust it on first launch. A USB portable
copy still stores preferences per Windows user, not on the USB drive.

This release is unsigned. Windows may report an unknown publisher. Release
checksums let you compare a downloaded file with the official release; they do
not replace a publisher signature.

## Maintainer build

On Windows x64 with Node 24+:

1. Restore your permitted `public/assets/civilian-runner.glb`; see ASSET-SETUP.md.
2. Run `npm ci` (downloads pinned development tools and Electron).
3. Run `npm run desktop` to launch the development app.
4. Run `npm run desktop:build` for checks, installer and portable ZIP.

Build output is in `dist/`. `npm run desktop:pack` creates only the unpacked app
for faster checks. Source checks still run without npm installation. Runtime
never downloads assets. No build secrets or signing certificate are required
for the unsigned build. Electron-builder may download build tools during the
first build. Installers and build archives are ignored by Git.

Only `civilian-runner.glb` is bundled, inside the playable application's ASAR;
prototype GLBs, source animations, backups, QA fixtures and credentials are
excluded. Third-party notices and PLAY-ME.txt accompany the app. See
ASSET-CREDITS.md for the finished-game / raw-source distinction.

## Desktop architecture

`desktop/main.cjs` owns native windows, monitor placement, the application menu,
camera permission and a display-sleep blocker. A registered standard, secure
`cyber-runner://app/` protocol reads the embedded game from `app.asar`.
No HTTP server or open port is needed. This fixed origin preserves calibration
across restarts and shares BroadcastChannel between operator and player.

Renderers are sandboxed with Node integration off and context isolation on.
Only local application requests and local blobs/data are accepted. Navigation
and popups are restricted to the application's windows. Microphone and other
unneeded permissions are denied. The existing worker performs pose inference;
camera pixels do not cross the local screen-control channel.

## Release

After testing the finished app, publish only the installer, portable ZIP,
SHA256SUMS.txt and release notes to a GitHub Release. Keep the raw character out
of source commits. Verify the installed and extracted app, including offline
model loading, manual start, countdown, jump, pause/resume and split screens.
Physical-camera performance and different monitor arrangements should also be
checked on exhibition hardware.
