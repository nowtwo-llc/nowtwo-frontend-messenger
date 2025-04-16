# Frontend Messenger

A TypeScript project for handling real-time messaging using AWS AppSync.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Development build:
```bash
npm run build:dev
```

3. Production build:
```bash
npm run build:prod
```

4. Watch mode (for development):
```bash
npm run watch
```

## Project Structure

```
.
├── src/               # Source files
│   └── Messenger.ts   # Main messenger implementation
├── dist/              # Production build output
├── build/             # Development build output
├── tsconfig.json      # TypeScript configuration
└── webpack.config.js  # Webpack configuration
```

## Scripts

- `npm run build:dev` - Build for development
- `npm run build:prod` - Build for production
- `npm run watch` - Watch mode for development
- `npm run update` - Update dependencies

## License

MIT 