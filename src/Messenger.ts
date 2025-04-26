import { Amplify } from 'aws-amplify';
import { events } from 'aws-amplify/data';

export class Messenger {
    public globalChannel: any;
    public userChannel: any;
    public protoringChannel: any;
    public testingChannel: any;

    constructor(configObject: any) {
        Amplify.configure({
            API: {
                Events: {
                    endpoint: `https://${configObject.appId}.appsync-api.${configObject.region}.amazonaws.com/event`,
                    region: configObject.region,
                    defaultAuthMode: 'apiKey',
                    apiKey: configObject.key
                }
            }
        });

        if (configObject.globalChannel) {
            this.globalChannel = events.connect(`default/${configObject.globalChannel}`);
        }
        if (configObject.userChannel) {
            this.userChannel = events.connect(`default/${configObject.userChannel}`);
        }
        if (configObject.protoringChannel) {
            this.protoringChannel = events.connect(`default/${configObject.protoringChannel}`);
        }
        if (configObject.testingChannel) {
            this.testingChannel = events.connect(`default/${configObject.testingChannel}`);
        }
    }

    public getGlobalChannel() {
        return this.globalChannel;
    }

    public getUserChannel() {
        return this.userChannel;
    }

    public getProtoringChannel() {
        return this.protoringChannel;
    }

    public getTestingChannel() {
        return this.testingChannel;
    }
}