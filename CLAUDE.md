# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Frontend Messenger is a TypeScript library for real-time messaging over AWS AppSync Events. It provides a channel-based abstraction over AWS Amplify's Events client: channels are registered by logical name, and the library owns their connection lifecycle.

Published as `@nowtwo-llc/frontend-messenger` to the public npm registry, and mirrored to GitHub Packages.

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
npm run lint          # ESLint with autofix
npm run lint:check    # ESLint without autofix — what CI runs
npm run eslint:format # Prettier over src/tests, then ESLint autofix
npm run typecheck     # tsc against the library and the tests
```

## Architecture

### Core design

A single `Messenger` class (`src/Messenger.ts`) is the whole library.

- **Channels are registered by logical name.** `config.channels` takes `{ logicalName: channelName }`. The four 2.x options (`globalChannel`, `userChannel`, `proctoringChannel`, `testingChannel`) are sugar that register the reserved names `global`, `user`, `proctoring` and `testing`; an explicit `channels` entry overrides them.
- **Connections are memoised per channel.** `connect()` returns the in-flight promise if one exists, so repeated calls never open a second socket.
- **Failures are handled but still thrown.** `connect()` attaches its own settle handler, so a rejected connection cannot become an unhandled rejection, while the promise it returns still rejects for callers who await it. Both handlers check they still own the connection slot before mutating state, so a late resolution cannot resurrect a channel that was closed mid-connect.
- **The 2.x getters are preserved** and delegate to `getChannel()`.

### Build output

Three webpack configs run for a production build, plus one declaration-only `tsc` pass:

| Artifact | Contents |
| --- | --- |
| `dist/frontend-messenger.min.js` | UMD, global `FrontendMessenger`, **Amplify bundled** (~115 KiB) |
| `dist/frontend-messenger.mjs` | ESM, Amplify external (~12 KiB) |
| `dist/frontend-messenger.cjs` | CJS, Amplify external (~14 KiB) |
| `dist/types/Messenger.d.ts` | Declarations, emitted once by `tsconfig.types.json` |

ts-loader has `declaration: false` because three parallel compilers would otherwise race to write the same `.d.ts`.

### Key constraints

- **`aws-amplify` is a peer dependency.** `Amplify.configure()` writes to a process-wide singleton, so the host app and this library must share one copy. Only the UMD build inlines it, since a `<script>` tag has no module resolution.
- **TypeScript is pinned to 6.x.** TypeScript 7 is the native Go port and exposes no JavaScript compiler API, so `ts-loader` cannot run against it — and neither `typescript-eslint` nor `ts-jest` accept it as a peer. This was the cause of the `ERESOLVE` failure that 3.0.0 fixed. Dependabot holds TypeScript at major 6.
- **No `baseUrl` in tsconfig.** It is deprecated in TS 6 and removed in TS 7; `paths` resolves relative to the config file on its own.

## Demo

`example/index.html` uses the shared NowTwo demo shell. **`example/demo.css` is byte-identical across `nt-fireworksify`, `nt-hedgehogify` and `nt-quick-switcher`** — keep edits in sync across those repos rather than forking it. The only per-project changes are `--nt-accent` and `--nt-accent-ink`, set in the page (teal `#0ea5a4` here).

`example/main.js` drives a `MockMessenger` in demo mode and a real `Messenger` in live mode through identical code, so the demo works on GitHub Pages without an AWS account.

Prettier is deliberately **not** run over `example/*.html` — it reflows the `<h1>` wordmark and injects whitespace into it.

## Notes

- `dist/` and `coverage/` are build output and are not tracked; `prepublishOnly` rebuilds `dist/` at publish time.
- Tests live in `tests/*.spec.ts` and mock `aws-amplify` wholesale — no network access.
