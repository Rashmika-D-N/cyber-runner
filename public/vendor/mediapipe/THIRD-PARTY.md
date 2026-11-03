# MediaPipe distribution notes

This directory contains unmodified runtime files from the npm package
`@mediapipe/tasks-vision` version **0.10.21**, plus the **Full float16 version 1**
Pose Landmarker model. The browser uses the `.mjs` bundle and local WASM files.

- Package: https://www.npmjs.com/package/@mediapipe/tasks-vision/v/0.10.21
- Source: https://github.com/google-ai-edge/mediapipe/tree/v0.10.21
- License: Apache-2.0; the adjacent `LICENSE` is copied from that source tag.
- Model: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task
- Maintainer clarification of runtime and Full model licensing:
  https://github.com/google-ai-edge/mediapipe/issues/6306

The npm archive did not supply a separate LICENSE or NOTICE file. This document
records provenance; it is a project-written note, not an upstream NOTICE.
Existing notices embedded in the distributed JavaScript and WASM are retained.
The downloaded npm archive and unused Lite model are excluded from Git.

`assets-manifest.json` at the project root records checksums for the required
runtime files. Future updates should review the upstream terms and offline
behavior again rather than silently replacing this pinned version.
