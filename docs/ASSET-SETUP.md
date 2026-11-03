# Restore the human character after cloning

The public source includes the game, floor maps, Three.js, MediaPipe runtime,
WASM files and Full pose model. The local Mixamo character and its motion
sources are excluded from Git. Your current exhibition folder still has them;
adding a `.gitignore` does not delete files.

## If you already have the working exhibition build

1. Keep a private backup of `public/assets/civilian-runner.glb` from that build.
2. After cloning into a different folder, copy that file to the same relative
   path in your clone. Do this only for your own use or authorized project-team
   use under the asset's terms.
3. Run:

   ```sh
   npm run assets:check
   npm run test:character
   npm start
   ```

There are no runtime downloads. Once the clone and local character are present,
the game can start and track the camera with the internet disconnected.

## If you are providing your own character

A raw download of Remy is **not** a drop-in replacement for this project's
adapted GLB. Provide a rigged glTF 2.0 binary with embedded textures and buffers,
named `civilian-runner.glb`, including:

- `Idle` and `Run` animation clips, retargeted to the included skeleton;
- in-place root motion (the game advances the environment);
- the Mixamo-style spine, shoulder, arm, leg, foot and toe bones used in
  `public/character.js` (`mixamorig` and `mixamorig:` prefixes are handled);
- a forward-facing, upright bind pose and valid skinned meshes.

Use a character and animations you are allowed to use. For a different rig,
update `public/character.js` and its animation verification as needed. Run the
character test and inspect `/visual-check.html` before the exhibition. Gait
distance is tuned in `public/motion.js` through `RUN_CYCLE_DISTANCE`.

## Why the character is separate

Adobe permits Mixamo assets in games, but its published distribution guidance
distinguishes finished projects from sharing raw character and animation files.
This repository takes the conservative approach of excluding those raw files;
it does not assume that public-source redistribution is covered by permission
to use a character in a game. See the [Adobe FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)
and [Mixamo distribution guidance](https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400?lang=en).

Do not force-add `civilian-runner.glb`, the original motion sources, or an archive
containing them to a public repository. A GitHub source archive is not a backup
of the entire local exhibition folder. Keep your permitted local assets backed
up separately. See [ASSET-CREDITS.md](../ASSET-CREDITS.md) for provenance.

## Verification

- `npm run assets:check:public` verifies the included offline dependencies and
  their SHA-256 checksums. It does not require a character and runs in CI.
- `npm run assets:check` also requires the local character and checks its GLB
  structure and required clips.
- `npm test` runs gameplay and communication checks. The actual-character test
  is explicitly skipped when its ignored GLB is absent.
- `npm run test:character` requires the character and fails if it is missing.
