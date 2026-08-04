# Contributing to Frontend Messenger

Thanks for taking the time to contribute.

## Getting set up

**Use Node 22** — there is an `.nvmrc`, so `nvm use` picks it up.

The `engines` field says `>=20` because that describes *consumers*: the package ships browser code, so nothing in it executes in Node and it imposes almost nothing on projects that install it.

Developing it is stricter. The dev toolchain floor is **Node 22.22.2**, set by jsdom 30 (`^22.22.2 || ^24.15.0 || >=26.0.0`). On an older Node the test run fails with `webidl.util.markAsUncloneable is not a function` before a single test executes. That constraint lives in `.nvmrc` rather than in `engines`, which would push it onto consumers who are unaffected by it.

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

`npm run lint` autofixes what it can; `npm run lint:check` is the non-mutating version CI runs. Linting is [oxlint](https://oxc.rs/docs/guide/usage/linter.html) (`.oxlintrc.json`) and formatting is Prettier, run separately — please don't hand-format around it.

## Conventions

- **Source lives in one file.** `src/Messenger.ts` holds the whole library and is the only entry point in the generated declarations.
- **`aws-amplify` is a peer dependency.** The ESM and CJS bundles mark it external; only the UMD bundle inlines it, because a `<script>` tag has no module resolution. If you add an Amplify import, check it is externalised in `webpack.config.js`.
- **TypeScript 7 constrains the toolchain.** TS 7 is the native Go port and exposes no JavaScript compiler API, so anything that drives the compiler programmatically cannot run against it. That is why the build uses `esbuild-loader` rather than `ts-loader`, and `oxlint` rather than `typescript-eslint`. `tsc` itself is still used for typechecking and for emitting declarations. Adding a dependency that needs the TypeScript compiler API will not work — check before reaching for one.
- **Type-aware lint rules are gone.** `typescript-eslint` provided `no-floating-promises` and friends; oxlint has no equivalent. `tsconfig.json` enables `noUncheckedIndexedAccess`, `noImplicitOverride` and `noFallthroughCasesInSwitch` as partial compensation. This library is promise-heavy, so be deliberate about unawaited promises — the linter will no longer catch them.
- **Coverage thresholds are enforced.** `vitest.config.mts` requires 100% statements, lines and functions. A new branch needs a new test.
- **Connection failures must never leak.** `connect()` attaches its own handler so a rejected connection cannot surface as an unhandled rejection, while still rejecting for callers who await it. Keep that property if you touch the lifecycle.
- **The demo mirrors the real API.** `example/main.js` drives the mock and the real Messenger through identical code. If the mock grows methods the library does not have, the demo has stopped being an honest illustration.

## Releasing

Releases publish from CI:

1. Bump `version` in `package.json`.
2. Commit, then tag: `git tag v3.1.0 && git push --tags`.

The publish workflow verifies the tag matches `package.json`, runs the full check suite, and publishes to npm with provenance. `prepublishOnly` rebuilds `dist/` from the tagged source, so build output never needs to be committed.
