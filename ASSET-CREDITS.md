# Third-party code and assets

The original Cyber Runner code has its own [licensing notice](LICENSE.md). The following third-party material retains its separate rights and terms. Vendored source and binaries are not covered by the project-specific notice.

## Included in the repository

| Component | Version / files | License and source |
| --- | --- | --- |
| Three.js | 0.180.0; selected runtime modules and helpers | MIT; [bundled license](public/vendor/three/LICENSE), [upstream source](https://github.com/mrdoob/three.js/tree/r180) |
| MediaPipe Tasks Vision | 0.10.21; JavaScript and SIMD/non-SIMD WASM | Apache-2.0; [bundled license](public/vendor/mediapipe/LICENSE), [distribution notes](public/vendor/mediapipe/THIRD-PARTY.md) |
| Pose Landmarker Full | float16, version 1 | Apache-2.0; [official model](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task), [maintainer clarification](https://github.com/google-ai-edge/mediapipe/issues/6306) |
| Concrete Floor Painted maps | `floor-nor_gl.jpg`, `floor-Rough.jpg`; local 1K maps | Rob Tuytel / Poly Haven, CC0; [asset](https://polyhaven.com/a/concrete_floor_painted), [license](https://polyhaven.com/license) |

The floor color, lane markings, laboratory geometry, circuit coins, energy-cell geometry and synthesized game audio are created in the project. The soundtrack is original; no Subway Surfers recording is included.

## Local exhibition character — excluded from Git

`public/assets/civilian-runner.glb` contains the adapted **Remy** character from Adobe Mixamo. Its original catalog / GLB conversion provenance is [three.ws / nirholas](https://github.com/nirholas/three.ws/blob/main/public/avatars/mixamo/catalog.json).

Run, walk and idle clips were adapted from the [official Three.js Soldier example](https://threejs.org/examples/webgl_animation_skinning_blending.html). That example uses the Vanguard character by T. Choonyung with Mixamo animation.

Local adaptations include skeleton retargeting, in-place root motion, physically lit materials, normal maps, masked hair, height normalization and procedural skeletal adjustments. Character geometry and animation are **not claimed as original, MIT or CC0 assets**.

Permission to use Mixamo content in a game is separate from public redistribution of its raw files. The character and motion sources are therefore ignored by Git. See [Adobe's Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html), [distribution guidance](https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400?lang=en), and [local asset setup](docs/ASSET-SETUP.md).

## Unused local prototype material — excluded from Git

- `human-runner.glb`: Soldier / Vanguard, used locally as an animation source.
- `motion-reference.glb`: Xbot / Mixamo, an unused animation reference.
- `runner.glb`: Cesium Man, copyright 2017 Cesium, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); [upstream asset information](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMan). It is not used by the current game.

These files may exist in the owner's exhibition folder, but they are not included in a fresh clone. Their presence in another example repository does not relicense them as project-owned content.
