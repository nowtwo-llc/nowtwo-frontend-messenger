# Contributing to Frontend Messenger

Thanks for taking the time to contribute.

## Getting set up

Requires Node 20 or newer.

```bash
git clone git@github.com:nowtwo-llc/nowtwo-frontend-messenger.git
cd nowtwo-frontend-messenger
npm install
```

## Development workflow

```bash
npm run watch        # rebuild ./build on change
npm run test:watch   # re-run the suite on change
npm run demo         # build dist/ and serve the demo at localhost:5050
```

The demo page has a demo mode backed by an in-page stand-in transport, so most changes can be exercised without an AWS account. Anything touching the Amplify calls themselves needs live mode and an AppSync API you control.

## Before opening a pull request

Run the same checks CI does:

```bash
npm run typecheck
npm run lint:check
npm run test:coverage
npm run build:prod
```

`npm run lint` autofixes what it can; `npm run lint:check` is the non-mutating version CI runs. Formatting is Prettier's job via `eslint-plugin-prettier` — please don't hand-format around it.

## Conventions

- **Source lives in one file.** `src/Messenger.ts` holds the whole library and is the only entry point in the generated declarations.
- **`aws-amplify` is a peer dependency.** The ESM and CJS bundles mark it external; only the UMD bundle inlines it, because a `<script>` tag has no module resolution. If you add an Amplify import, check it is externalised in `webpack.config.js`.
- **TypeScript stays on 6.x.** TypeScript 7 is the native Go port and exposes no JavaScript compiler API, so `ts-loader` cannot run against it. Dependabot is configured to hold TypeScript at major 6 for that reason; moving to 7 is a deliberate migration of the whole build, not a version bump.
- **Coverage thresholds are enforced.** `vitest.config.mts` requires 100% statements, lines and functions. A new branch needs a new test.
- **Connection failures must never leak.** `connect()` attaches its own handler so a rejected connection cannot surface as an unhandled rejection, while still rejecting for callers who await it. Keep that property if you touch the lifecycle.
- **The demo mirrors the real API.** `example/main.js` drives the mock and the real Messenger through identical code. If the mock grows methods the library does not have, the demo has stopped being an honest illustration.

## Releasing

Releases publish from CI:

1. Bump `version` in `package.json`.
2. Commit, then tag: `git tag v3.1.0 && git push --tags`.

The publish workflow verifies the tag matches `package.json`, runs the full check suite, publishes to npm with provenance, then mirrors to GitHub Packages. `prepublishOnly` rebuilds `dist/` from the tagged source, so build output never needs to be committed.
