# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Frontend Messenger is a TypeScript library for handling real-time messaging using AWS AppSync. It provides a channel-based abstraction for AWS Amplify event connections, supporting global broadcasts, user-specific messages, proctoring, and testing channels.

Published as `@classifylearning/frontend-messenger` to GitHub Package Registry.

## Build Commands

```bash
npm run build:dev     # Development build (outputs to ./build/)
npm run build:prod    # Production build with minification (outputs to ./dist/)
npm run watch         # Watch mode for development
npm run update        # Check and update dependencies
```

## Code Quality Commands

```bash
npm run lint          # Run ESLint on src/
npm run lint:fix      # Run ESLint with auto-fix
npm run format        # Format code with Prettier
npm run format:check  # Check formatting without changes
npm run typecheck     # Run TypeScript type checking
```

## Architecture

### Core Design

Single `Messenger` class (`src/Messenger.ts`) wraps AWS Amplify's AppSync event handling:

- **Constructor** accepts config with: `appId`, `region`, `key`, and channel names
- **Four channels**: globalChannel, userChannel, proctoringChannel, testingChannel
- **Public API**: `getGlobalChannel()`, `getUserChannel()`, `getProctoringChannel()`, `getTestingChannel()`

### Build Output

- **Development**: UMD bundle at `build/messenger.js` (~1.5MB with deps, includes sourcemaps)
- **Production**: Split bundles at `dist/messenger.min.js` (~2KB) + `dist/vendors-bundle.min.js` (~104KB)

### Key Dependencies

- `aws-amplify` v6.x - Runtime dependency for AppSync integration
- TypeScript compiles to ES2020, webpack bundles as UMD

## Configuration

Path alias `@/*` maps to `src/*` for imports.

Environment files (`env.development.json`, `env.production.json`) provide environment markers.

## Notes

- No test framework currently configured
- Type declarations (.d.ts) are auto-generated in build output
