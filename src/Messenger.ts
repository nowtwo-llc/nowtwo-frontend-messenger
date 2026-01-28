import { Amplify } from 'aws-amplify';
import { events, type EventsChannel } from 'aws-amplify/data';

/**
 * Configuration options for the Messenger class.
 */
export interface MessengerConfig {
    /** AWS AppSync API ID */
    appId: string;
    /** AWS region (e.g., 'us-east-1') */
    region: string;
    /** API key for AppSync authentication */
    key: string;
    /** Channel name for global broadcast messages */
    globalChannel?: string;
    /** Channel name for user-specific messages */
    userChannel?: string;
    /** Channel name for proctoring/monitoring messages */
    proctoringChannel?: string;
    /** Channel name for testing/exam-related messages */
    testingChannel?: string;
}

/** Represents a connected AppSync event channel (async connection) */
type Channel = Promise<EventsChannel> | undefined;

/**
 * Messenger provides a channel-based abstraction for AWS AppSync real-time events.
 *
 * Supports four independent channels for different messaging contexts:
 * - Global: Broadcast messages to all connected clients
 * - User: Messages targeted to specific users
 * - Proctoring: Messages for exam proctoring/monitoring
 * - Testing: Messages for testing/exam-related features
 *
 * @example
 * ```typescript
 * const messenger = new Messenger({
 *     appId: 'your-appsync-id',
 *     region: 'us-east-1',
 *     key: 'your-api-key',
 *     globalChannel: 'broadcast',
 *     userChannel: 'user-123'
 * });
 *
 * const channel = await messenger.getGlobalChannel();
 * channel?.subscribe({
 *     next: (data) => console.log('Received:', data),
 *     error: (err) => console.error('Error:', err)
 * });
 * ```
 */
export class Messenger {
    private readonly globalChannel: Channel;
    private readonly userChannel: Channel;
    private readonly proctoringChannel: Channel;
    private readonly testingChannel: Channel;

    /**
     * Creates a new Messenger instance and connects to specified channels.
     * @param config - Configuration object with AppSync credentials and channel names
     */
    constructor(config: MessengerConfig) {
        Amplify.configure({
            API: {
                Events: {
                    endpoint: `https://${config.appId}.appsync-api.${config.region}.amazonaws.com/event`,
                    region: config.region,
                    defaultAuthMode: 'apiKey',
                    apiKey: config.key,
                },
            },
        });

        this.globalChannel = config.globalChannel
            ? events.connect(`default/${config.globalChannel}`)
            : undefined;

        this.userChannel = config.userChannel
            ? events.connect(`default/${config.userChannel}`)
            : undefined;

        this.proctoringChannel = config.proctoringChannel
            ? events.connect(`default/${config.proctoringChannel}`)
            : undefined;

        this.testingChannel = config.testingChannel
            ? events.connect(`default/${config.testingChannel}`)
            : undefined;
    }

    /**
     * Returns the global broadcast channel connection promise.
     * @returns Promise resolving to the global channel, or undefined if not configured
     */
    public getGlobalChannel(): Channel {
        return this.globalChannel;
    }

    /**
     * Returns the user-specific channel connection promise.
     * @returns Promise resolving to the user channel, or undefined if not configured
     */
    public getUserChannel(): Channel {
        return this.userChannel;
    }

    /**
     * Returns the proctoring channel connection promise.
     * @returns Promise resolving to the proctoring channel, or undefined if not configured
     */
    public getProctoringChannel(): Channel {
        return this.proctoringChannel;
    }

    /**
     * Returns the testing channel connection promise.
     * @returns Promise resolving to the testing channel, or undefined if not configured
     */
    public getTestingChannel(): Channel {
        return this.testingChannel;
    }
}
