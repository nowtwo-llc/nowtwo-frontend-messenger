# Frontend Messenger

[![CI](https://github.com/nowtwo-llc/nowtwo-frontend-messenger/actions/workflows/ci.yml/badge.svg)](https://github.com/nowtwo-llc/nowtwo-frontend-messenger/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Channel-based real-time messaging for the browser, built on [AWS AppSync Events](https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-welcome.html) via AWS Amplify.

Frontend Messenger turns AppSync connection plumbing into named channels. You declare the channels you care about, then subscribe and publish by name — the library owns the connection lifecycle, keeps one connection per channel, and surfaces failures instead of dropping them.

**[Try the live demo →](https://nowtwo-llc.github.io/nowtwo-frontend-messenger/)**

## Installing

### From npm

```bash
npm install @nowtwo-llc/frontend-messenger aws-amplify
```

`aws-amplify` is a **peer dependency**, not a bundled one. Amplify keeps its configuration in a process-wide singleton, so your application and this library must resolve to the same copy — two copies means the one you configured is not the one that connects.

### From a script tag

Download `frontend-messenger.min.js` from the [latest release](https://github.com/nowtwo-llc/nowtwo-frontend-messenger/releases) and serve it yourself:

```html
<script src="[JS_FILE_PATH]/frontend-messenger.min.js"></script>
```

The UMD build exposes `FrontendMessenger` as a browser global and is the one build that bundles Amplify, since a script tag has no module resolution.

## Usage

### ES modules

```js
import { Messenger } from '@nowtwo-llc/frontend-messenger';

const messenger = new Messenger({
    appId: 'your-appsync-id',
    region: 'us-east-1',
    key: 'your-api-key',
    channels: { alerts: 'alerts-v2' }
});

const subscription = await messenger.subscribe('alerts', {
    next: (data) => console.log('Received:', data),
    error: (err) => console.error('Error:', err)
});

await messenger.publish('alerts', { level: 'info', text: 'hello' });

subscription.unsubscribe();
await messenger.disconnectAll();
```

### CommonJS

```js
const { Messenger } = require('@nowtwo-llc/frontend-messenger');
```

### Script tag

```html
<script>
    window.onload = async function () {
        var messenger = new FrontendMessenger.Messenger({
            appId: 'your-appsync-id',
            region: 'us-east-1',
            key: 'your-api-key',
            globalChannel: 'broadcast'
        });

        await messenger.subscribe('global', {
            next: function (data) {
                console.log(data);
            }
        });
    };
</script>
```

### Publishing without a connection

`publish()` sends over the channel's WebSocket, opening it first if needed. If a client only ever sends, `post()` publishes over HTTP and never opens a connection at all:

```js
await messenger.post('alerts', { level: 'warn', text: 'disk filling up' });
```

### Connecting on demand

By default every configured channel connects as soon as the Messenger is constructed. Pass `autoConnect: false` to take that over yourself:

```js
const messenger = new Messenger({
    appId: 'your-appsync-id',
    region: 'us-east-1',
    key: 'your-api-key',
    channels: { alerts: 'alerts-v2', presence: 'presence' },
    autoConnect: false
});

await messenger.connect('alerts'); // presence stays closed
```

## Settings

Every option passed to `new Messenger(config)`.

| Variable | Type | Description |
| --- | --- | --- |
| appId | *string* | AppSync API ID. Required unless `endpoint` is given. |
| region | *string* | AWS region, e.g. `us-east-1`. Required unless `endpoint` is given. |
| key | *string* | AppSync API key. Required when `authMode` is `apiKey`. |
| endpoint | *string* | Full event endpoint URL, overriding the one derived from `appId` and `region`. Use this for custom domains. |
| namespace | *string* | AppSync channel namespace. (**Default: `default`**) |
| authMode | *string* | One of `apiKey`, `oidc`, `userPool`, `iam`, `lambda`, `none`. (**Default: `apiKey`**) |
| channels | *object* | Arbitrary named channels as `{ logicalName: channelName }`. Any number of them. |
| globalChannel | *string* | Channel name registered under the reserved logical name `global`. |
| userChannel | *string* | Channel name registered under the reserved logical name `user`. |
| proctoringChannel | *string* | Channel name registered under the reserved logical name `proctoring`. |
| testingChannel | *string* | Channel name registered under the reserved logical name `testing`. |
| autoConnect | *boolean* | Whether to open every configured channel from the constructor. (**Default: `true`**) |
| configureAmplify | *boolean* | Whether to call `Amplify.configure()`. Set `false` when your app configures Amplify itself. (**Default: `true`**) |
| onError | *function* | `(error, channelName) => void`, called whenever a connection attempt fails. |

A `channels` entry wins over the four dedicated options, so `{ globalChannel: 'a', channels: { global: 'b' } }` registers `b`.

### A note on `configureAmplify`

`Amplify.configure()` writes to a process-wide singleton. Constructing a second Messenger with different credentials reconfigures the first one's transport too. If your application already calls `Amplify.configure()`, pass `configureAmplify: false` and let the app own that configuration.

## API

| Method | Description |
| --- | --- |
| `new Messenger(config)` | Registers the configured channels and, unless `autoConnect` is `false`, connects them. Throws if the endpoint cannot be resolved, or if `apiKey` auth is used without a key. |
| `connect(name, options?)` | Opens a channel, or returns the connection already open or in flight. Returns `undefined` for an unregistered name. |
| `getChannel(name)` | The channel's connection promise, or `undefined` if it is unknown or not connected yet. |
| `subscribe(name, observer, options?)` | Subscribes to a channel, connecting first if necessary. Resolves to a handle with `unsubscribe()`. |
| `publish(name, event, options?)` | Publishes over the channel's WebSocket, connecting first if necessary. |
| `post(name, event, options?)` | Publishes over HTTP without opening a connection. |
| `disconnect(name)` | Closes one channel and ends its subscriptions. The registration survives, so `connect()` can reopen it. |
| `disconnectAll()` | Closes every channel this instance opened. |
| `addChannel(name, channel)` | Registers a channel after construction. Existing registrations are left alone. |
| `getChannelNames()` | The logical names of every registered channel. |
| `getChannelPath(name)` | The fully qualified `<namespace>/<channel>` path, or `undefined`. |
| `getStatus(name)` | The channel's connection state — see below. |

`options` on `connect`, `subscribe`, `publish` and `post` accepts per-request `authMode`, `authToken` and `apiKey` overrides, passed straight through to Amplify.

### Channel status

`getStatus(name)` returns one of:

| Status | Meaning |
| --- | --- |
| `idle` | Registered, never connected. |
| `connecting` | A connection is in flight. |
| `connected` | The channel is open. |
| `error` | The last connection attempt failed. Calling `connect()` again retries. |
| `closed` | Explicitly disconnected. |

### Error handling

A connection that fails is reported twice over, and you can use either: the promise returned by `connect()` (and by the getters) rejects, and the `onError` callback fires. Failures never surface as unhandled promise rejections, even when nothing awaits the constructor's automatic connections.

```js
const messenger = new Messenger({
    appId: 'your-appsync-id',
    region: 'us-east-1',
    key: 'your-api-key',
    globalChannel: 'broadcast',
    onError: (error, channel) => console.error(`${channel} failed:`, error)
});
```

## Migrating from 2.x

The 2.x API still works. `getGlobalChannel()`, `getUserChannel()`, `getProctoringChannel()` and `getTestingChannel()` are unchanged, and the four `*Channel` config options still register the same channels.

What changed:

- **The package moved** to `@nowtwo-llc/frontend-messenger` on the public npm registry. 2.x was `@classifylearning/frontend-messenger` on GitHub Packages.
- **`aws-amplify` is now a peer dependency.** Add it to your own dependencies if it is not there already.
- **The package entry points are real.** 2.x pointed `main` at `src/Messenger.ts`, which was never published — importing the package by name did not work. It now ships ESM, CJS, UMD and type declarations.
- **`key` is validated.** A missing API key used to fail later, at connection time; it now throws from the constructor.
- **Connection failures are handled.** 2.x leaked an unhandled rejection whenever a connection failed and nothing awaited the getter.

## Browser support

The bundles compile to ES2020 and require a browser with WebSocket support. This matches `aws-amplify` v6's own baseline.

## Development

```bash
npm install
npm run build:dev    # development UMD build → ./build
npm run build:prod   # production bundles + types → ./dist
npm run watch        # development build with file watching
npm test             # Vitest suite (jsdom)
npm run test:watch   # Vitest in watch mode
npm run typecheck    # tsc on the library and the tests
npm run lint         # ESLint, with autofix
```

To try the demo locally, run `npm run demo` — it builds `dist/` and serves the repo at <http://localhost:5050/>. The page also opens directly from the filesystem after a build, since it loads `../dist/` relatively.

The demo has a **demo mode** that runs an in-page stand-in transport, so it works without an AWS account, and a **live mode** that connects to an AppSync API you supply.

## Authors

* **NowTwo LLC** — [nowtwo.io](https://www.nowtwo.io/)

## License

This project is licensed under the MIT License — see [LICENSE](./LICENSE).
