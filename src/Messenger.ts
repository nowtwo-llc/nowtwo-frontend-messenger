import { Amplify } from 'aws-amplify';
import { events, type EventsChannel } from 'aws-amplify/data';

/** Namespace used when the caller does not supply one. */
export const DEFAULT_NAMESPACE = 'default';

/**
 * Authentication modes AppSync accepts as a channel's default.
 *
 * This is Amplify's `GraphQLAuthMode` minus `identityPool`, which is only valid
 * as a per-request override and is rejected as a connection default.
 */
export type MessengerAuthMode = 'apiKey' | 'oidc' | 'userPool' | 'iam' | 'lambda' | 'none';

/**
 * Any JSON-serialisable value. Structurally identical to Amplify's
 * `DocumentType`, restated here so consumers never have to import from
 * `@aws-amplify/core/internals`.
 */
export type MessengerEvent = null | boolean | number | string | MessengerEvent[] | { [prop: string]: MessengerEvent };

/** Per-call authentication overrides, passed straight through to Amplify. */
export interface MessengerChannelOptions {
    authMode?: MessengerAuthMode | 'identityPool';
    authToken?: string;
    apiKey?: string;
}

/** Callbacks handed to {@link Messenger.subscribe}. */
export interface MessengerObserver<T = unknown> {
    /** Called for every event published to the channel. */
    next?: (data: T) => void;
    /** Called when the subscription itself fails. */
    error?: (error: unknown) => void;
}

/**
 * Handle returned by {@link Messenger.subscribe}.
 *
 * Amplify returns an RxJS `Subscription`; this is the part of it worth
 * depending on, so the published declarations do not drag RxJS in.
 */
export interface MessengerSubscription {
    unsubscribe(): void;
}

/** Connection state of a single channel. */
export type MessengerChannelStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

/** A connected AppSync event channel, or `undefined` if never configured. */
export type MessengerChannel = Promise<EventsChannel> | undefined;

/**
 * Configuration options for the {@link Messenger} class.
 */
export interface MessengerConfig {
    /** AWS AppSync API ID. Ignored when {@link MessengerConfig.endpoint} is set. */
    appId?: string;
    /** AWS region, e.g. `us-east-1`. Required unless `endpoint` is set. */
    region?: string;
    /** AppSync API key. Required when `authMode` is `apiKey` (the default). */
    key?: string;
    /**
     * Full event endpoint URL, overriding the one derived from `appId` and
     * `region`. Use this for custom domains.
     */
    endpoint?: string;
    /** AppSync channel namespace. (Default: `default`) */
    namespace?: string;
    /** Authentication mode for every channel. (Default: `apiKey`) */
    authMode?: MessengerAuthMode;
    /** Arbitrary named channels, as `{ logicalName: channelName }`. */
    channels?: Record<string, string>;
    /** Channel name for global broadcast messages. Registered as `global`. */
    globalChannel?: string;
    /** Channel name for user-specific messages. Registered as `user`. */
    userChannel?: string;
    /** Channel name for proctoring/monitoring messages. Registered as `proctoring`. */
    proctoringChannel?: string;
    /** Channel name for testing/exam-related messages. Registered as `testing`. */
    testingChannel?: string;
    /**
     * Whether to open every configured channel from the constructor.
     * Set `false` to connect on demand via {@link Messenger.connect}.
     * (Default: `true`)
     */
    autoConnect?: boolean;
    /**
     * Whether to call `Amplify.configure()`. Set `false` in apps that already
     * configure Amplify themselves — see the note on {@link Messenger}.
     * (Default: `true`)
     */
    configureAmplify?: boolean;
    /** Called whenever a connection attempt fails. */
    onError?: (error: unknown, channel: string) => void;
}

/** The four channel names 2.x exposed through dedicated getters. */
const LEGACY_CHANNEL_KEYS = {
    globalChannel: 'global',
    userChannel: 'user',
    proctoringChannel: 'proctoring',
    testingChannel: 'testing'
} as const;

/**
 * Messenger provides a channel-based abstraction for AWS AppSync real-time
 * events.
 *
 * Channels are registered by logical name and connected over a WebSocket. The
 * four names 2.x hard-coded — `global`, `user`, `proctoring` and `testing` —
 * are still available through their original getters, but any number of
 * additional channels can be declared via `channels`.
 *
 * **On Amplify configuration.** `Amplify.configure()` writes to a process-wide
 * singleton, so constructing a second Messenger with different credentials
 * reconfigures the first one's transport too. In an app that already calls
 * `Amplify.configure()`, pass `configureAmplify: false` and let the app own it.
 *
 * @example
 * ```typescript
 * const messenger = new Messenger({
 *     appId: 'your-appsync-id',
 *     region: 'us-east-1',
 *     key: 'your-api-key',
 *     globalChannel: 'broadcast',
 *     channels: { alerts: 'alerts-v2' }
 * });
 *
 * const subscription = await messenger.subscribe('alerts', {
 *     next: (data) => console.log('Received:', data),
 *     error: (err) => console.error('Error:', err)
 * });
 *
 * await messenger.publish('alerts', { level: 'info', text: 'hello' });
 *
 * subscription.unsubscribe();
 * await messenger.disconnectAll();
 * ```
 */
export class Messenger {
    private readonly namespace: string;
    private readonly authMode: MessengerAuthMode;
    private readonly onError?: (error: unknown, channel: string) => void;

    /** Logical name → AppSync channel name. */
    private readonly channelNames = new Map<string, string>();

    /** Logical name → in-flight or settled connection. */
    private readonly connections = new Map<string, Promise<EventsChannel>>();

    /** Logical name → last known connection state. */
    private readonly statuses = new Map<string, MessengerChannelStatus>();

    /**
     * Creates a new Messenger instance and, unless `autoConnect` is `false`,
     * connects every configured channel.
     *
     * @param config - AppSync credentials and channel names
     * @throws if the endpoint cannot be resolved, or if `apiKey` auth is used
     *         without a key
     */
    constructor(config: MessengerConfig) {
        const endpoint = Messenger.resolveEndpoint(config);

        this.namespace = config.namespace ?? DEFAULT_NAMESPACE;
        this.authMode = config.authMode ?? 'apiKey';
        this.onError = config.onError;

        if (this.authMode === 'apiKey' && !config.key) {
            throw new Error('Messenger: `key` is required when `authMode` is "apiKey".');
        }

        for (const [option, name] of Object.entries(LEGACY_CHANNEL_KEYS)) {
            const channel = config[option as keyof typeof LEGACY_CHANNEL_KEYS];

            if (channel) {
                this.channelNames.set(name, channel);
            }
        }

        // Declared after the legacy options so an explicit `channels` entry can
        // deliberately point one of the four reserved names somewhere else.
        for (const [name, channel] of Object.entries(config.channels ?? {})) {
            if (channel) {
                this.channelNames.set(name, channel);
            }
        }

        for (const name of this.channelNames.keys()) {
            this.statuses.set(name, 'idle');
        }

        if (config.configureAmplify !== false) {
            Amplify.configure({
                API: {
                    Events: {
                        endpoint,
                        region: config.region,
                        defaultAuthMode: this.authMode,
                        apiKey: config.key
                    }
                }
            });
        }

        if (config.autoConnect !== false) {
            for (const name of this.channelNames.keys()) {
                // Deliberately not awaited: a constructor cannot be async, and
                // connect() already routes failures to onError. Callers who
                // need to know when a channel is live await the getter.
                void this.connect(name);
            }
        }
    }

    /**
     * Builds the AppSync event endpoint from the supplied configuration.
     */
    private static resolveEndpoint(config: MessengerConfig): string {
        if (config.endpoint) {
            return config.endpoint;
        }

        if (!config.appId || !config.region) {
            throw new Error('Messenger: either `endpoint`, or both `appId` and `region`, must be provided.');
        }

        return `https://${config.appId}.appsync-api.${config.region}.amazonaws.com/event`;
    }

    /**
     * Returns the fully qualified `<namespace>/<channel>` path for a channel.
     * @returns the path, or `undefined` if the name was never registered
     */
    public getChannelPath(name: string): string | undefined {
        const channel = this.channelNames.get(name);

        return channel ? `${this.namespace}/${channel}` : undefined;
    }

    /** Returns the logical names of every registered channel. */
    public getChannelNames(): string[] {
        return [...this.channelNames.keys()];
    }

    /** Returns the connection state of a channel. */
    public getStatus(name: string): MessengerChannelStatus {
        return this.statuses.get(name) ?? 'idle';
    }

    /**
     * Registers a channel after construction. Existing registrations are left
     * alone; disconnect first if you need to repoint a name.
     *
     * @param name - logical name used by the other methods
     * @param channel - AppSync channel name within the namespace
     */
    public addChannel(name: string, channel: string): void {
        if (this.channelNames.has(name)) {
            return;
        }

        this.channelNames.set(name, channel);
        this.statuses.set(name, 'idle');
    }

    /**
     * Opens a channel, or returns the existing connection if one is already
     * open or in flight. Called automatically from the constructor unless
     * `autoConnect` is `false`.
     *
     * @param name - logical channel name
     * @param options - per-connection authentication overrides
     * @returns the connection promise, or `undefined` if the name is unknown
     */
    public connect(name: string, options?: MessengerChannelOptions): MessengerChannel {
        const existing = this.connections.get(name);

        if (existing) {
            return existing;
        }

        const path = this.getChannelPath(name);

        if (!path) {
            return undefined;
        }

        this.statuses.set(name, 'connecting');

        const connection = events.connect(path, options);

        this.connections.set(name, connection);

        // Attaching a handler here is what keeps a failed connection from
        // surfacing as an unhandled rejection when the caller never awaits the
        // getter. `connection` itself still rejects for anyone who does.
        //
        // Both handlers run a microtask after the fact, by which time the
        // channel may have been disconnected or reconnected. They only touch
        // state while they still own the slot, so a late resolution cannot
        // resurrect a channel that was closed while it was in flight.
        void connection.then(
            () => {
                if (this.connections.get(name) === connection) {
                    this.statuses.set(name, 'connected');
                }
            },
            (error: unknown) => {
                if (this.connections.get(name) === connection) {
                    this.connections.delete(name);
                    this.statuses.set(name, 'error');
                }

                this.onError?.(error, name);
            }
        );

        return connection;
    }

    /**
     * Returns a channel's connection promise.
     *
     * @param name - logical channel name
     * @returns the connection, or `undefined` if the channel is unknown or not
     *          connected yet
     */
    public getChannel(name: string): MessengerChannel {
        return this.connections.get(name);
    }

    /**
     * Subscribes to a channel, connecting it first if necessary.
     *
     * @param name - logical channel name
     * @param observer - `next` and `error` callbacks
     * @param options - per-request authentication overrides
     * @returns a handle whose `unsubscribe()` ends the subscription
     * @throws if the channel is unknown or the connection fails
     */
    public async subscribe<T = unknown>(
        name: string,
        observer: MessengerObserver<T>,
        options?: MessengerChannelOptions
    ): Promise<MessengerSubscription> {
        const channel = await this.requireChannel(name);

        return channel.subscribe(
            {
                next: (data: unknown) => observer.next?.(data as T),
                error: (error: unknown) => observer.error?.(error)
            },
            options
        );
    }

    /**
     * Publishes an event over the channel's existing WebSocket, connecting it
     * first if necessary.
     *
     * @param name - logical channel name
     * @param event - a JSON-serialisable value, or an array of them to batch
     * @param options - per-request authentication overrides
     * @throws if the channel is unknown or publishing fails
     */
    public async publish(name: string, event: MessengerEvent, options?: MessengerChannelOptions): Promise<void> {
        const channel = await this.requireChannel(name);

        await channel.publish(event, options);
    }

    /**
     * Publishes an event over HTTP instead of the WebSocket. Does not require —
     * and does not open — a connection, which makes it the cheaper choice for
     * a send-only client.
     *
     * @param name - logical channel name
     * @param event - a JSON-serialisable value, or an array of them to batch
     * @param options - per-request authentication overrides
     * @throws if the channel is unknown or the request fails
     */
    public async post(name: string, event: MessengerEvent, options?: MessengerChannelOptions): Promise<void> {
        const path = this.getChannelPath(name);

        if (!path) {
            throw new Error(`Messenger: unknown channel "${name}".`);
        }

        await events.post(path, event, options);
    }

    /**
     * Closes a channel and drops its connection, ending every subscription on
     * it. The name stays registered, so {@link Messenger.connect} can reopen it.
     *
     * @param name - logical channel name
     */
    public async disconnect(name: string): Promise<void> {
        const connection = this.connections.get(name);

        if (!connection) {
            return;
        }

        this.connections.delete(name);
        this.statuses.set(name, 'closed');

        try {
            const channel = await connection;
            channel.close();
        } catch {
            // A connection that never established has nothing to close, and
            // connect() already reported the failure through onError. Reporting
            // it a second time here would double-count a single failure.
        }
    }

    /**
     * Closes every channel this Messenger opened.
     *
     * Deliberately not Amplify's `events.closeAll()`, which would also tear
     * down connections opened elsewhere in the host application.
     */
    public async disconnectAll(): Promise<void> {
        await Promise.all([...this.connections.keys()].map((name) => this.disconnect(name)));
    }

    /**
     * Resolves a channel, connecting on demand, and fails loudly when the name
     * was never registered.
     */
    private async requireChannel(name: string): Promise<EventsChannel> {
        const connection = this.connect(name);

        if (!connection) {
            throw new Error(`Messenger: unknown channel "${name}".`);
        }

        return connection;
    }

    /**
     * Returns the global broadcast channel connection promise.
     * @returns the global channel, or `undefined` if not configured
     */
    public getGlobalChannel(): MessengerChannel {
        return this.getChannel('global');
    }

    /**
     * Returns the user-specific channel connection promise.
     * @returns the user channel, or `undefined` if not configured
     */
    public getUserChannel(): MessengerChannel {
        return this.getChannel('user');
    }

    /**
     * Returns the proctoring channel connection promise.
     * @returns the proctoring channel, or `undefined` if not configured
     */
    public getProctoringChannel(): MessengerChannel {
        return this.getChannel('proctoring');
    }

    /**
     * Returns the testing channel connection promise.
     * @returns the testing channel, or `undefined` if not configured
     */
    public getTestingChannel(): MessengerChannel {
        return this.getChannel('testing');
    }
}

export default Messenger;
