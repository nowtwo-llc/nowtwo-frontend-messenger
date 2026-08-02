import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Amplify } from 'aws-amplify';
import { events } from 'aws-amplify/data';

import { DEFAULT_NAMESPACE, Messenger, type MessengerConfig } from '../src/Messenger';

vi.mock('aws-amplify', () => ({
    Amplify: {
        configure: vi.fn()
    }
}));

vi.mock('aws-amplify/data', () => ({
    events: {
        connect: vi.fn(),
        post: vi.fn(),
        closeAll: vi.fn()
    }
}));

const connectMock = vi.mocked(events.connect);
const postMock = vi.mocked(events.post);
const configureMock = vi.mocked(Amplify.configure);

const baseConfig: MessengerConfig = {
    appId: 'test-app-id',
    region: 'us-east-1',
    key: 'test-api-key'
};

const EXPECTED_ENDPOINT = 'https://test-app-id.appsync-api.us-east-1.amazonaws.com/event';

/** The observer shape Messenger hands to `EventsChannel.subscribe`. */
interface ForwardedObserver {
    next: (data: unknown) => void;
    error: (error: unknown) => void;
}

/**
 * A fresh stand-in for Amplify's EventsChannel. The parameters are spelled out
 * so the assertions below can read `subscribe.mock.calls[0][0]` as a typed
 * observer rather than casting an untyped tuple.
 */
const createChannel = () => ({
    subscribe: vi.fn((_observer: ForwardedObserver, _options?: unknown) => ({ unsubscribe: vi.fn() })),
    publish: vi.fn((_event: unknown, _options?: unknown) => Promise.resolve()),
    close: vi.fn()
});

let mockChannel: ReturnType<typeof createChannel>;

beforeEach(() => {
    vi.clearAllMocks();
    mockChannel = createChannel();
    connectMock.mockImplementation(() => Promise.resolve(mockChannel as never));
    postMock.mockImplementation(() => Promise.resolve());
});

describe('constructor', () => {
    it('configures Amplify with the derived endpoint and credentials', () => {
        new Messenger(baseConfig);

        expect(configureMock).toHaveBeenCalledWith({
            API: {
                Events: {
                    endpoint: EXPECTED_ENDPOINT,
                    region: 'us-east-1',
                    defaultAuthMode: 'apiKey',
                    apiKey: 'test-api-key'
                }
            }
        });
    });

    it('prefers an explicit endpoint over appId and region', () => {
        new Messenger({ ...baseConfig, endpoint: 'https://events.example.com/event' });

        expect(configureMock).toHaveBeenCalledWith(
            expect.objectContaining({
                API: { Events: expect.objectContaining({ endpoint: 'https://events.example.com/event' }) }
            })
        );
    });

    it('accepts an endpoint with no appId or region', () => {
        expect(() => new Messenger({ endpoint: 'https://events.example.com/event', key: 'k' })).not.toThrow();
    });

    it('throws when neither an endpoint nor appId/region are supplied', () => {
        expect(() => new Messenger({ key: 'k' })).toThrow(/either `endpoint`, or both `appId` and `region`/);
    });

    it('throws when apiKey auth is used without a key', () => {
        expect(() => new Messenger({ appId: 'a', region: 'us-east-1' })).toThrow(/`key` is required/);
    });

    it('does not require a key for non-apiKey auth modes', () => {
        expect(() => new Messenger({ ...baseConfig, key: undefined, authMode: 'userPool' })).not.toThrow();
    });

    it('passes a custom auth mode through as the connection default', () => {
        new Messenger({ ...baseConfig, authMode: 'userPool' });

        expect(configureMock).toHaveBeenCalledWith(
            expect.objectContaining({
                API: { Events: expect.objectContaining({ defaultAuthMode: 'userPool' }) }
            })
        );
    });

    it('skips Amplify.configure when configureAmplify is false', () => {
        new Messenger({ ...baseConfig, configureAmplify: false, globalChannel: 'broadcast' });

        expect(configureMock).not.toHaveBeenCalled();
        // The channel is still registered and connected.
        expect(connectMock).toHaveBeenCalledWith('default/broadcast', undefined);
    });

    it('connects no channels when none are configured', () => {
        new Messenger(baseConfig);

        expect(connectMock).not.toHaveBeenCalled();
    });

    it('does not connect when autoConnect is false', () => {
        const messenger = new Messenger({ ...baseConfig, globalChannel: 'broadcast', autoConnect: false });

        expect(connectMock).not.toHaveBeenCalled();
        expect(messenger.getChannel('global')).toBeUndefined();
        expect(messenger.getStatus('global')).toBe('idle');
    });
});

describe('channel registration', () => {
    it.each([
        ['globalChannel', 'global', 'broadcast'],
        ['userChannel', 'user', 'user-123'],
        ['proctoringChannel', 'proctoring', 'proctor-session-1'],
        ['testingChannel', 'testing', 'exam-456']
    ])('registers %s under the reserved name "%s"', (option, name, channel) => {
        const messenger = new Messenger({ ...baseConfig, [option]: channel });

        expect(connectMock).toHaveBeenCalledWith(`default/${channel}`, undefined);
        expect(messenger.getChannelNames()).toEqual([name]);
        expect(messenger.getChannelPath(name)).toBe(`default/${channel}`);
    });

    it('connects all four legacy channels when all are specified', () => {
        const messenger = new Messenger({
            ...baseConfig,
            globalChannel: 'broadcast',
            userChannel: 'user-123',
            proctoringChannel: 'proctor-1',
            testingChannel: 'exam-456'
        });

        expect(connectMock).toHaveBeenCalledTimes(4);
        expect(messenger.getChannelNames()).toEqual(['global', 'user', 'proctoring', 'testing']);
    });

    it('registers arbitrary named channels', () => {
        const messenger = new Messenger({
            ...baseConfig,
            channels: { alerts: 'alerts-v2', presence: 'presence' }
        });

        expect(messenger.getChannelNames()).toEqual(['alerts', 'presence']);
        expect(connectMock).toHaveBeenCalledWith('default/alerts-v2', undefined);
        expect(connectMock).toHaveBeenCalledWith('default/presence', undefined);
    });

    it('lets a channels entry override a reserved name', () => {
        const messenger = new Messenger({
            ...baseConfig,
            globalChannel: 'broadcast',
            channels: { global: 'broadcast-v2' }
        });

        expect(messenger.getChannelPath('global')).toBe('default/broadcast-v2');
        expect(connectMock).toHaveBeenCalledTimes(1);
    });

    it('applies a custom namespace to every channel path', () => {
        const messenger = new Messenger({ ...baseConfig, namespace: 'classify', globalChannel: 'broadcast' });

        expect(messenger.getChannelPath('global')).toBe('classify/broadcast');
        expect(connectMock).toHaveBeenCalledWith('classify/broadcast', undefined);
    });

    it('defaults the namespace to "default"', () => {
        expect(DEFAULT_NAMESPACE).toBe('default');
        const messenger = new Messenger({ ...baseConfig, globalChannel: 'broadcast' });

        expect(messenger.getChannelPath('global')).toBe('default/broadcast');
    });

    it('returns undefined for an unregistered channel path', () => {
        expect(new Messenger(baseConfig).getChannelPath('nope')).toBeUndefined();
    });

    it('registers a channel after construction', () => {
        const messenger = new Messenger({ ...baseConfig, autoConnect: false });
        messenger.addChannel('alerts', 'alerts-v2');

        expect(messenger.getChannelNames()).toEqual(['alerts']);
        expect(messenger.getChannelPath('alerts')).toBe('default/alerts-v2');
    });

    it('leaves an existing registration alone', () => {
        const messenger = new Messenger({ ...baseConfig, channels: { alerts: 'alerts-v2' }, autoConnect: false });
        messenger.addChannel('alerts', 'something-else');

        expect(messenger.getChannelPath('alerts')).toBe('default/alerts-v2');
    });
});

describe('connect', () => {
    it('reuses an in-flight connection rather than opening a second one', () => {
        const messenger = new Messenger({ ...baseConfig, globalChannel: 'broadcast' });
        const first = messenger.connect('global');
        const second = messenger.connect('global');

        expect(first).toBe(second);
        expect(connectMock).toHaveBeenCalledTimes(1);
    });

    it('returns undefined for an unknown channel', () => {
        expect(new Messenger(baseConfig).connect('nope')).toBeUndefined();
        expect(connectMock).not.toHaveBeenCalled();
    });

    it('forwards per-connection auth overrides', () => {
        const messenger = new Messenger({ ...baseConfig, channels: { alerts: 'alerts-v2' }, autoConnect: false });
        void messenger.connect('alerts', { authMode: 'userPool', authToken: 'token' });

        expect(connectMock).toHaveBeenCalledWith('default/alerts-v2', { authMode: 'userPool', authToken: 'token' });
    });

    it('tracks status through a successful connection', async () => {
        const messenger = new Messenger({ ...baseConfig, globalChannel: 'broadcast', autoConnect: false });
        expect(messenger.getStatus('global')).toBe('idle');

        const connection = messenger.connect('global');
        expect(messenger.getStatus('global')).toBe('connecting');

        await connection;
        expect(messenger.getStatus('global')).toBe('connected');
    });

    it('reports a failed connection through onError without an unhandled rejection', async () => {
        const failure = new Error('connect failed');
        const onError = vi.fn();
        connectMock.mockImplementation(() => Promise.reject(failure));

        const messenger = new Messenger({ ...baseConfig, globalChannel: 'broadcast', onError });

        // Nothing awaits the constructor's connection, which is exactly the
        // case that used to surface as an unhandled rejection.
        await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(failure, 'global'));
        expect(messenger.getStatus('global')).toBe('error');
    });

    it('still rejects for a caller that awaits the connection', async () => {
        const failure = new Error('connect failed');
        connectMock.mockImplementation(() => Promise.reject(failure));

        const messenger = new Messenger({ ...baseConfig, globalChannel: 'broadcast', autoConnect: false });

        await expect(messenger.connect('global')).rejects.toThrow('connect failed');
    });

    it('allows a retry after a failed connection', async () => {
        connectMock.mockImplementationOnce(() => Promise.reject(new Error('connect failed')));

        const messenger = new Messenger({ ...baseConfig, globalChannel: 'broadcast', autoConnect: false });
        await expect(messenger.connect('global')).rejects.toThrow('connect failed');

        await expect(messenger.connect('global')).resolves.toBe(mockChannel);
        expect(messenger.getStatus('global')).toBe('connected');
    });
});

describe('getChannel and the legacy getters', () => {
    it('resolves to the connected channel', async () => {
        const messenger = new Messenger({ ...baseConfig, globalChannel: 'broadcast' });

        await expect(messenger.getChannel('global')).resolves.toBe(mockChannel);
    });

    it('returns undefined before the channel is connected', () => {
        const messenger = new Messenger({ ...baseConfig, globalChannel: 'broadcast', autoConnect: false });

        expect(messenger.getChannel('global')).toBeUndefined();
    });

    it.each([
        ['getGlobalChannel', 'globalChannel'],
        ['getUserChannel', 'userChannel'],
        ['getProctoringChannel', 'proctoringChannel'],
        ['getTestingChannel', 'testingChannel']
    ] as const)('%s returns the channel when configured', async (getter, option) => {
        const messenger = new Messenger({ ...baseConfig, [option]: 'some-channel' });

        await expect(messenger[getter]()).resolves.toBe(mockChannel);
    });

    it.each(['getGlobalChannel', 'getUserChannel', 'getProctoringChannel', 'getTestingChannel'] as const)(
        '%s returns undefined when not configured',
        (getter) => {
            expect(new Messenger(baseConfig)[getter]()).toBeUndefined();
        }
    );
});

describe('subscribe', () => {
    it('connects on demand and forwards events to next', async () => {
        const messenger = new Messenger({ ...baseConfig, channels: { alerts: 'alerts-v2' }, autoConnect: false });
        const next = vi.fn();

        const subscription = await messenger.subscribe('alerts', { next });

        expect(connectMock).toHaveBeenCalledWith('default/alerts-v2', undefined);

        const observer = mockChannel.subscribe.mock.calls[0][0];
        observer.next({ hello: 'world' });

        expect(next).toHaveBeenCalledWith({ hello: 'world' });
        expect(subscription.unsubscribe).toBeTypeOf('function');
    });

    it('forwards subscription errors to error', async () => {
        const messenger = new Messenger({ ...baseConfig, channels: { alerts: 'alerts-v2' } });
        const error = vi.fn();
        await messenger.subscribe('alerts', { error });

        const observer = mockChannel.subscribe.mock.calls[0][0];
        const failure = new Error('subscription failed');
        observer.error(failure);

        expect(error).toHaveBeenCalledWith(failure);
    });

    it('tolerates an observer with no callbacks', async () => {
        const messenger = new Messenger({ ...baseConfig, channels: { alerts: 'alerts-v2' } });
        await messenger.subscribe('alerts', {});

        const observer = mockChannel.subscribe.mock.calls[0][0];

        expect(() => observer.next({})).not.toThrow();
        expect(() => observer.error(new Error('x'))).not.toThrow();
    });

    it('forwards auth overrides to the subscription', async () => {
        const messenger = new Messenger({ ...baseConfig, channels: { alerts: 'alerts-v2' } });
        await messenger.subscribe('alerts', {}, { authMode: 'userPool' });

        expect(mockChannel.subscribe).toHaveBeenCalledWith(expect.anything(), { authMode: 'userPool' });
    });

    it('rejects for an unknown channel', async () => {
        await expect(new Messenger(baseConfig).subscribe('nope', {})).rejects.toThrow('unknown channel "nope"');
    });
});

describe('publish', () => {
    it('publishes over the channel websocket', async () => {
        const messenger = new Messenger({ ...baseConfig, channels: { alerts: 'alerts-v2' } });
        await messenger.publish('alerts', { level: 'info' });

        expect(mockChannel.publish).toHaveBeenCalledWith({ level: 'info' }, undefined);
        expect(postMock).not.toHaveBeenCalled();
    });

    it('connects on demand', async () => {
        const messenger = new Messenger({ ...baseConfig, channels: { alerts: 'alerts-v2' }, autoConnect: false });
        await messenger.publish('alerts', 'ping');

        expect(connectMock).toHaveBeenCalledTimes(1);
    });

    it('rejects for an unknown channel', async () => {
        await expect(new Messenger(baseConfig).publish('nope', 'x')).rejects.toThrow('unknown channel "nope"');
    });

    it('propagates a publish failure', async () => {
        mockChannel.publish.mockImplementation(() => Promise.reject(new Error('publish failed')));
        const messenger = new Messenger({ ...baseConfig, channels: { alerts: 'alerts-v2' } });

        await expect(messenger.publish('alerts', 'x')).rejects.toThrow('publish failed');
    });
});

describe('post', () => {
    it('publishes over HTTP without opening a connection', async () => {
        const messenger = new Messenger({ ...baseConfig, channels: { alerts: 'alerts-v2' }, autoConnect: false });
        await messenger.post('alerts', { level: 'info' });

        expect(postMock).toHaveBeenCalledWith('default/alerts-v2', { level: 'info' }, undefined);
        expect(connectMock).not.toHaveBeenCalled();
    });

    it('rejects for an unknown channel', async () => {
        await expect(new Messenger(baseConfig).post('nope', 'x')).rejects.toThrow('unknown channel "nope"');
    });
});

describe('disconnect', () => {
    it('closes the channel and clears the connection', async () => {
        const messenger = new Messenger({ ...baseConfig, globalChannel: 'broadcast' });
        await messenger.disconnect('global');

        expect(mockChannel.close).toHaveBeenCalledTimes(1);
        expect(messenger.getChannel('global')).toBeUndefined();
        expect(messenger.getStatus('global')).toBe('closed');
    });

    it('keeps the registration so the channel can be reopened', async () => {
        const messenger = new Messenger({ ...baseConfig, globalChannel: 'broadcast' });
        await messenger.disconnect('global');

        expect(messenger.getChannelNames()).toEqual(['global']);
        await expect(messenger.connect('global')).resolves.toBe(mockChannel);
    });

    it('is a no-op for a channel that was never connected', async () => {
        const messenger = new Messenger({ ...baseConfig, globalChannel: 'broadcast', autoConnect: false });

        await expect(messenger.disconnect('global')).resolves.toBeUndefined();
        expect(mockChannel.close).not.toHaveBeenCalled();
    });

    it('reports an error exactly once for a connection that never established', async () => {
        const onError = vi.fn();
        connectMock.mockImplementation(() => Promise.reject(new Error('connect failed')));

        const messenger = new Messenger({ ...baseConfig, globalChannel: 'broadcast', autoConnect: false, onError });
        void messenger.connect('global');
        await messenger.disconnect('global');

        await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    });

    it('keeps the closed status when a connection resolves after disconnect', async () => {
        const messenger = new Messenger({ ...baseConfig, globalChannel: 'broadcast' });

        // disconnect() runs while connect() is still in flight, so the
        // resolution handler settles after the channel is already closed.
        await messenger.disconnect('global');

        expect(messenger.getStatus('global')).toBe('closed');
        expect(messenger.getChannel('global')).toBeUndefined();
    });

    it('closes every open channel', async () => {
        const channels = [createChannel(), createChannel()];
        connectMock.mockImplementationOnce(() => Promise.resolve(channels[0] as never));
        connectMock.mockImplementationOnce(() => Promise.resolve(channels[1] as never));

        const messenger = new Messenger({ ...baseConfig, globalChannel: 'broadcast', userChannel: 'user-123' });
        await messenger.disconnectAll();

        expect(channels[0].close).toHaveBeenCalledTimes(1);
        expect(channels[1].close).toHaveBeenCalledTimes(1);
        expect(messenger.getChannel('global')).toBeUndefined();
        expect(messenger.getChannel('user')).toBeUndefined();
    });
});
