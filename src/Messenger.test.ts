import { Messenger, MessengerConfig } from './Messenger';
import { Amplify } from 'aws-amplify';
import { events } from 'aws-amplify/data';

// Mock aws-amplify modules
jest.mock('aws-amplify', () => ({
    Amplify: {
        configure: jest.fn(),
    },
}));

jest.mock('aws-amplify/data', () => ({
    events: {
        connect: jest.fn(),
    },
}));

describe('Messenger', () => {
    const mockChannel = {
        subscribe: jest.fn(),
        publish: jest.fn(),
        close: jest.fn(),
    };

    const baseConfig: MessengerConfig = {
        appId: 'test-app-id',
        region: 'us-east-1',
        key: 'test-api-key',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (events.connect as jest.Mock).mockReturnValue(Promise.resolve(mockChannel));
    });

    describe('constructor', () => {
        it('should configure Amplify with correct endpoint and credentials', () => {
            new Messenger(baseConfig);

            expect(Amplify.configure).toHaveBeenCalledWith({
                API: {
                    Events: {
                        endpoint: `https://${baseConfig.appId}.appsync-api.${baseConfig.region}.amazonaws.com/event`,
                        region: baseConfig.region,
                        defaultAuthMode: 'apiKey',
                        apiKey: baseConfig.key,
                    },
                },
            });
        });

        it('should connect to global channel when specified', () => {
            const config: MessengerConfig = {
                ...baseConfig,
                globalChannel: 'broadcast',
            };

            new Messenger(config);

            expect(events.connect).toHaveBeenCalledWith('default/broadcast');
        });

        it('should connect to user channel when specified', () => {
            const config: MessengerConfig = {
                ...baseConfig,
                userChannel: 'user-123',
            };

            new Messenger(config);

            expect(events.connect).toHaveBeenCalledWith('default/user-123');
        });

        it('should connect to proctoring channel when specified', () => {
            const config: MessengerConfig = {
                ...baseConfig,
                proctoringChannel: 'proctor-session-1',
            };

            new Messenger(config);

            expect(events.connect).toHaveBeenCalledWith('default/proctor-session-1');
        });

        it('should connect to testing channel when specified', () => {
            const config: MessengerConfig = {
                ...baseConfig,
                testingChannel: 'exam-456',
            };

            new Messenger(config);

            expect(events.connect).toHaveBeenCalledWith('default/exam-456');
        });

        it('should connect to all channels when all are specified', () => {
            const config: MessengerConfig = {
                ...baseConfig,
                globalChannel: 'broadcast',
                userChannel: 'user-123',
                proctoringChannel: 'proctor-1',
                testingChannel: 'exam-456',
            };

            new Messenger(config);

            expect(events.connect).toHaveBeenCalledTimes(4);
            expect(events.connect).toHaveBeenCalledWith('default/broadcast');
            expect(events.connect).toHaveBeenCalledWith('default/user-123');
            expect(events.connect).toHaveBeenCalledWith('default/proctor-1');
            expect(events.connect).toHaveBeenCalledWith('default/exam-456');
        });

        it('should not connect to any channels when none are specified', () => {
            new Messenger(baseConfig);

            expect(events.connect).not.toHaveBeenCalled();
        });
    });

    describe('getGlobalChannel', () => {
        it('should return the global channel when configured', () => {
            const config: MessengerConfig = {
                ...baseConfig,
                globalChannel: 'broadcast',
            };

            const messenger = new Messenger(config);
            const channel = messenger.getGlobalChannel();

            expect(channel).toBeDefined();
        });

        it('should return undefined when global channel is not configured', () => {
            const messenger = new Messenger(baseConfig);
            const channel = messenger.getGlobalChannel();

            expect(channel).toBeUndefined();
        });
    });

    describe('getUserChannel', () => {
        it('should return the user channel when configured', () => {
            const config: MessengerConfig = {
                ...baseConfig,
                userChannel: 'user-123',
            };

            const messenger = new Messenger(config);
            const channel = messenger.getUserChannel();

            expect(channel).toBeDefined();
        });

        it('should return undefined when user channel is not configured', () => {
            const messenger = new Messenger(baseConfig);
            const channel = messenger.getUserChannel();

            expect(channel).toBeUndefined();
        });
    });

    describe('getProctoringChannel', () => {
        it('should return the proctoring channel when configured', () => {
            const config: MessengerConfig = {
                ...baseConfig,
                proctoringChannel: 'proctor-session-1',
            };

            const messenger = new Messenger(config);
            const channel = messenger.getProctoringChannel();

            expect(channel).toBeDefined();
        });

        it('should return undefined when proctoring channel is not configured', () => {
            const messenger = new Messenger(baseConfig);
            const channel = messenger.getProctoringChannel();

            expect(channel).toBeUndefined();
        });
    });

    describe('getTestingChannel', () => {
        it('should return the testing channel when configured', () => {
            const config: MessengerConfig = {
                ...baseConfig,
                testingChannel: 'exam-456',
            };

            const messenger = new Messenger(config);
            const channel = messenger.getTestingChannel();

            expect(channel).toBeDefined();
        });

        it('should return undefined when testing channel is not configured', () => {
            const messenger = new Messenger(baseConfig);
            const channel = messenger.getTestingChannel();

            expect(channel).toBeUndefined();
        });
    });

    describe('channel resolution', () => {
        it('should return a promise that resolves to the channel', async () => {
            const config: MessengerConfig = {
                ...baseConfig,
                globalChannel: 'broadcast',
            };

            const messenger = new Messenger(config);
            const channel = await messenger.getGlobalChannel();

            expect(channel).toEqual(mockChannel);
        });
    });
});
