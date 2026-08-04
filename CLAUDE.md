# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Frontend Messenger is a TypeScript library for real-time messaging over AWS AppSync Events. It provides a channel-based abstraction over AWS Amplify's Events client: channels are registered by logical name, and the library owns their connection lifecycle.

Published as `@nowtwo-llc/frontend-messenger` to the public npm registry only. A GitHub
Packages mirror was published previously and has been removed; do not reintroduce it.

## Build Commands

```bash
npm run build:dev     # Development UMD build (outputs to ./build/)
npm run build:prod    # Production bundles + declarations (outputs to ./dist/)
npm run watch         # Watch mode for development
npm run demo          # Build dist/ and serve the demo at localhost:5050
npm run update        # Check and update dependencies
```

## Testing Commands

```bash
npm test              # Run the Vitest suite
npm run test:watch    # Watch mode
npm run test:coverage # Coverage, with the thresholds CI enforces
```

## Code Quality Commands

```bash
npm run lint          # oxlint --fix, then Prettier --write
npm run lint:check    # oxlint --max-warnings=0 + prettier --check — what CI runs
npm run format        # Prettier over src/, tests/ and root config files
npm run typecheck     # tsc against the library and the tests
```

Linting is [oxlint](https://oxc.rs/docs/guide/usage/linter.html), configured in `.oxlintrc.json`. There is no ESLint in this repo.

## Architecture

### Core design

A single `Messenger` class (`src/Messenger.ts`) is the whole library.

- **Channels are registered by logical name.** `config.channels` takes `{ logicalName: channelName }` and has no fixed vocabulary. `globalChannel` and `userChannel` are the only shorthand options, registering the reserved names `global` and `user`; an explicit `channels` entry overrides them. Keep it that way — domain-specific channel names belong in the consuming application, not in this library's API. (`proctoringChannel`/`testingChannel` were removed in 3.0.0 for exactly this reason.)
- **Connections are memoised per channel.** `connect()` returns the in-flight promise if one exists, so repeated calls never open a second socket.
- **Failures are handled but still thrown.** `connect()` attaches its own settle handler, so a rejected connection cannot become an unhandled rejection, while the promise it returns still rejects for callers who await it. Both handlers check they still own the connection slot before mutating state, so a late resolution cannot resurrect a channel that was closed mid-connect.
- **`getGlobalChannel()` and `getUserChannel()`** are thin wrappers over `getChannel()`.

### Build output

Three webpack configs run for a production build, plus one declaration-only `tsc` pass:

| Artifact | Contents |
| --- | --- |
| `dist/frontend-messenger.min.js` | UMD, global `FrontendMessenger`, **Amplify bundled** (~115 KiB) |
| `dist/frontend-messenger.mjs` | ESM, Amplify external (~12 KiB) |
| `dist/frontend-messenger.cjs` | CJS, Amplify external (~14 KiB) |
| `dist/types/Messenger.d.ts` | Declarations, emitted once by `tsconfig.types.json` |

`esbuild-loader` transpiles without typechecking, so declarations come from a separate `tsc -p tsconfig.types.json` pass. Its `target` must stay in step with `target` in `tsconfig.json` and the per-config webpack targets.

### Key constraints

- **`aws-amplify` is a peer dependency.** `Amplify.configure()` writes to a process-wide singleton, so the host app and this library must share one copy. Only the UMD build inlines it, since a `<script>` tag has no module resolution.
- **TypeScript 7 rules out anything using the compiler API.** TS 7 is the native Go port and exposes no JavaScript compiler API. That is why the build uses `esbuild-loader` rather than `ts-loader`, and `oxlint` rather than `typescript-eslint` — both of those drive the compiler programmatically and cannot work. `tsc` is still used directly for typechecking and declaration emit. A dependency needing the compiler API will not install cleanly; this mismatch was the original `ERESOLVE` failure.
- **No type-aware lint rules.** Losing `typescript-eslint` cost `no-floating-promises`, which matters in a promise-heavy library. `tsconfig.json` sets `noUncheckedIndexedAccess`, `noImplicitOverride` and `noFallthroughCasesInSwitch` as partial compensation. `exactOptionalPropertyTypes` is deliberately off — it flags two real sites in `src/Messenger.ts` that need signature changes, worth doing as its own task.
- **No `baseUrl` in tsconfig.** It is removed in TS 7; `paths` resolves relative to the config file on its own.
- **Dev requires Node 22.22.2+** (`.nvmrc`), set by jsdom 30. `engines` stays at `>=20` because that describes consumers, who never run this code in Node.

## Demo

`example/index.html` uses the shared NowTwo demo shell. **`example/demo.css` is byte-identical across `nt-fireworksify`, `nt-hedgehogify` and `nt-quick-switcher`** — keep edits in sync across those repos rather than forking it. The only per-project changes are `--nt-accent` and `--nt-accent-ink`, set in the page (teal `#0ea5a4` here).

`example/main.js` drives a `MockMessenger` in demo mode and a real `Messenger` in live mode through identical code, so the demo works on GitHub Pages without an AWS account.

Prettier is deliberately **not** run over `example/*.html` — it reflows the `<h1>` wordmark and injects whitespace into it.

## Notes

- `dist/` and `coverage/` are build output and are not tracked; `prepublishOnly` rebuilds `dist/` at publish time.
- Tests live in `tests/*.spec.ts` and mock `aws-amplify` wholesale — no network access.
