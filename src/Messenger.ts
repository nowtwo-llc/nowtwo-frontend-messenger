import { Amplify } from 'aws-amplify';
import { events } from 'aws-amplify/data';

export class Messenger {
    public globalChannel: any;
    public userChannel: any;

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

        this.globalChannel = events.connect(`default/${configObject.globalChannel}`);
        this.userChannel = events.connect(`default/${configObject.userChannel}`);

        window.addEventListener('offline', () => {
            console.log('Network is offline.');
        });

        window.addEventListener('online', () => {
            console.log('Network is online.');
        });
    }

    public getGlobalChannel() {
        return this.globalChannel;
    }

    public getUserChannel() {
        return this.userChannel;
    }
}