# Cyber Runner — exhibition guide

After completing the [local asset setup](ASSET-SETUP.md), run Start game.bat and open http://127.0.0.1:5173 in Chrome or Edge. Keep the server window open. Node.js must be installed. All runtime code, character textures, animations, WASM and the pose model are local; internet is not required even on first launch. Allow camera access for body controls. The start button waits for the human asset and rendering shaders to be ready.

## New graphics and character
Robotics Lab is the default environment: two levels of industrial work bays, articulated robot arms, service walkways, equipment cabinets, inspection benches, cable runs, overhead ventilation and lights, painted lane markings, and detailed logistics robots and barriers. Most surfaces are opaque and matte. Surface sheen comes from a small static environment map; there are no mirror render passes, ray tracing, screen-space reflections or transparent glass walls.

The player is a textured and skinned human (Mixamo Remy), with clothing, hair, skin and normal maps. Captured run/idle/walk clips were adapted offline to this skeleton. Jumping, crouching, landing compression and lane lean adjust actual bones. A two-segment leg solver keeps crouch feet near the floor without squashing the character. This is a human game animation driven by gesture events, not a reconstruction of every joint in the player's live body. See [ASSET-CREDITS.md](../ASSET-CREDITS.md) for sources and usage terms.

## Exhibition setup
Use 1920×1080 and Full screen. Start with Balanced graphics, runner speed 4–5 m/s, obstacle interval 2.8–3.4 seconds. Balanced adjusts the internal game resolution between 70% and 100% when sustained rendering gets slow; the interface stays sharp. High allows up to 1.25× device-pixel ratio. Performance uses 75% resolution and disables dynamic shadows. Use the header's measured FPS and p95 frame interval to compare settings on the actual screen with tracking enabled. A 60 FPS frame budget is about 16.7 ms; performance is not guaranteed until measured with the camera and exhibit display.

## Two monitors: player display and operator controls

1. In Windows display settings, use **Extend** (Win + P), rather than duplicating the same screen. Open the game in Chrome or Edge at http://127.0.0.1:5173/.
2. Select **Separate screens**. The current window becomes the player display, and a new **Controls & camera** window opens. If the browser blocks it, allow pop-ups for this local address and try again.
3. Move the player window to the exhibition monitor, then select **Full screen** there. Keep the controls window visible on your laptop or second monitor. Both layouts fit 1920×1080 without scrolling.
4. In the control window, enable the camera, align the red lane guides with the floor tape, and calibrate the player. Choose **Body movement**, then **Start round**. Switching out of single-screen mode stops the old camera, so enable and calibrate it in its new control window.
5. Start, pause, resume, restart, speed, obstacle spacing, jump sensitivity, lane stability, action duration, scenery, graphics, music and volume are all available in the operator window. It also shows the live camera, tracked skeleton, lane guides, score, lives, timer and player-display performance.

Only the player window renders the 3D game. The operator window handles local camera inference and audio; it sends small movement and setting messages over a same-origin BroadcastChannel. Video frames are never transmitted to the other window or over the internet. Both windows must use the same browser profile and the same localhost address; the session in the URL pairs the correct windows.

Closing or losing the controls pauses the round. Reopen it with **Open controls** on the player display. **Show game window** in the operator window brings back the player display. Reloading the game resets the round but keeps the session and game settings; the connection recovers automatically. Body mode needs a fresh tracked pose before starting or resuming. Keep both windows visible, not minimized or in background tabs, to avoid browser camera/render throttling. Switching focus between two visible windows does not pause the game.

The player display's **Single screen** button restores the original combined interface. Its display setup buttons fade during play and reappear when the pointer moves over the game. Floor alignment remains saved in the browser. Music and sound effects run in the operator window in two-screen mode, activated by its Start button; they use the computer's selected audio output.

Run `npm test` for the game and display-link checks, and `npm run check` for syntax checks. Display-link checks cover session isolation, command delivery, stale/duplicate gesture rejection, pose age and configuration validation. Physical camera calibration and dual-monitor performance should also be checked with the exhibition setup.

## Floor alignment
Place three tape lines at the lane CENTERS. Fix the camera. Enable it and enlarge the preview. Match the guides' near/far ends to the tape. The view is mirrored; screen-left is game-left. Alignment is manual and saves in this browser for this localhost address. Re-align if the camera moves.

Calibrate each player upright with shoulders and feet in view, then select Body movement. Standing on each tape line selects that lane directly. Boundary hysteresis and an 85 ms confirmation reduce lane jitter. The renderer preserves the existing three-lane controls.

## Tracking and game physics
MediaPipe Full 0.10.21 runs locally in a worker with one frame in flight and a 640-pixel inference width. Adaptive smoothing uses torso tracking when ankles briefly disappear. Prolonged tracking loss pauses the game. Processing time and result age are displayed separately; these are not a complete end-to-end latency measurement.

Gameplay uses a 120 Hz fixed simulation, interpolated lateral/vertical movement, swept-depth collisions and a ballistic jump arc. Collisions use the moving player's position rather than only the target lane. The game remains intentionally forgiving and adjustable for an exhibition. It does not simulate full human biomechanics. Long rendering stalls pause the round. Hidden browser tabs stop drawing the scene.

Keyboard: arrows / WASD, Space to jump, P to pause. Tune speed, obstacle spacing, jump threshold, lane stability and action duration in the panel.

## Checks
Run `npm test`, `npm run assets:check` and `npm run check`. The camera-free worker check is /worker-check.html. The development-only /visual-check.html page shows run, idle, jump and crouch motion with visible rendering statistics. Its synthetic course is for visual inspection, not a camera-latency benchmark.

Before the exhibition, disconnect internet, restart the server/browser, enable and calibrate the camera, try all lanes/jumps/squats, and leave view to verify the pause. Test with spectators outside the camera's player area. Local backup folders are excluded from Git.

## Ground and stride synchronization
The painted floor, all surface maps, lab bays and obstacles move toward the camera together. Rendering interpolates travelled distance and uses it to sample the human's running clip. RUN_CYCLE_DISTANCE in public/motion.js controls metres per complete left/right animation cycle; keep your preferred calibration there. This prevents a separate animation clock from slipping behind the ground during slower frames or speed changes. Pausing stops both.
The speed control covers 3–12 m/s and starts at 4.5 m/s. Obstacles spawn with 7.5 seconds of travel time rather than a fixed 100-metre distance. Offline camera tracking and lane calibration are unchanged.

## Circuit coins, sound and countdown
Gold circuit coins use shared 3D geometry, a hexagonal illuminated core and a subtle additive halo. The trail is instanced, with a short pooled sparkle when collected; no extra lights or full-screen bloom are used.

Start a round to activate browser audio. An original 116 BPM synthesized arcade loop and coin, jump, duck, lane, impact and round-end effects are generated entirely by Web Audio; no external soundtrack, audio files or network downloads are required. Music, effects and volume controls are in the header and persist locally. Music stops when paused, when the tab is hidden and when the round ends.

Every start and resume displays 3, 2, 1, GO with matching tones. The round timer, movement and collisions wait until the countdown finishes. If the game is paused during a countdown, resume gives a fresh three seconds. Character assets and body calibration must be ready before starting.

## Rare energy cell
The green energy cell awards one additional life, including increasing three lives to four. Each round has a 30% chance of one cell, scheduled to appear after 16–28 seconds of active play, followed by the normal approach time. Pauses and countdowns do not advance that clock. There is at most one cell per round, and missed cells disappear after passing the player.

The cell has a metal casing, a softly glowing green core and a lightning emblem. Its local pickup chime, green burst and +1 LIFE notice distinguish it from coins. Spawn rules leave a clear gap from obstacles and coins. Rarity and timing can be adjusted with the ENERGY_CELL constants in public/powerups.js. /powerup-check.html is a separate development fixture for previewing the model and checking a single 3-to-4-life award; it does not change normal-game spawn odds.
