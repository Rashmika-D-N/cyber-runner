# Contributing

Read [the README](README.md) and [asset setup](docs/ASSET-SETUP.md) first.
The source has no npm dependencies; Node.js 24 and the files in the repository
are sufficient for the public checks.

```sh
npm run check
npm run assets:check:public
npm test
```

For the full exhibition build, restore your permitted character locally and run
`npm run assets:check` and `npm run test:character`. Never add excluded character
or motion files to a public commit.

Keep camera processing on the device and runtime imports local. Preserve the
fixed simulation step, distance-based gait, pose freshness checks, lane-guide
persistence, countdown, and separate-screen connection behavior. Test relevant
changes using keyboard controls and, when available, a calibrated camera.

Use small, focused changes. Explain the behavior changed and the checks run in
the pull request. Changes to vendored libraries need their versions, license
notices and `assets-manifest.json` hashes updated together. Do not edit generated
vendor bundles casually. See [project licensing](LICENSE.md) before proposing
reuse or redistribution of project-specific content.
