/*
 * Demo driver for @nowtwo-llc/frontend-messenger.
 *
 * The page runs in one of two modes. In live mode it builds a real Messenger
 * from the UMD bundle loaded above. In demo mode it builds a MockMessenger,
 * which implements the same method names against an in-page transport so the
 * deployed GitHub Pages demo does something useful without an AWS account.
 *
 * Both objects are driven by identical code below — that is the point. If the
 * two ever diverge, the demo stops being an honest illustration of the API.
 */
(function () {
    'use strict';

    const CHANNEL = 'demo';

    const el = (id) => document.getElementById(id);

    const dom = {
        credentials: el('credentials'),
        modeNote: el('mode-note'),
        connect: el('connect'),
        disconnect: el('disconnect'),
        publish: el('publish'),
        clear: el('clear'),
        message: el('message'),
        status: el('status'),
        dot: el('dot'),
        log: el('log')
    };

    /** The active Messenger (real or mock), and its subscription handle. */
    let messenger = null;
    let subscription = null;

    /* ── Logging ──────────────────────────────────────────────────────── */

    let logEmpty = true;

    function log(kind, text) {
        if (logEmpty) {
            dom.log.textContent = '';
            logEmpty = false;
        }

        const time = new Date().toLocaleTimeString([], { hour12: false });
        const item = document.createElement('li');
        item.dataset.kind = kind;

        const stamp = document.createElement('time');
        stamp.textContent = time;

        const body = document.createElement('span');
        body.className = 'nt-log-body';
        // textContent, never innerHTML: message payloads are untrusted input,
        // and in live mode they come off the network.
        body.textContent = text;

        item.append(stamp, body);
        dom.log.append(item);
        dom.log.scrollTop = dom.log.scrollHeight;
    }

    function setStatus(state, text) {
        dom.dot.dataset.state = state;
        dom.status.textContent = text;
    }

    function setConnected(connected) {
        dom.connect.disabled = connected;
        dom.disconnect.disabled = !connected;
        dom.publish.disabled = !connected;
        getModeInputs().forEach((input) => {
            input.disabled = connected;
        });
    }

    /* ── Mock transport ───────────────────────────────────────────────── */

    /**
     * Stands in for Messenger when the page has no AppSync credentials.
     *
     * Only the surface the demo touches is implemented; it is a teaching aid,
     * not a general-purpose fake.
     */
    class MockMessenger {
        constructor(config) {
            this.namespace = config.namespace || 'default';
            this.channel = config.channels[CHANNEL];
            this.observers = new Set();
            this.status = 'idle';
            this.timer = null;
            this.tick = 0;
        }

        getChannelPath() {
            return `${this.namespace}/${this.channel}`;
        }

        getStatus() {
            return this.status;
        }

        connect() {
            this.status = 'connecting';

            // A short delay so the connecting state is actually visible, the
            // way a real WebSocket handshake would be.
            return new Promise((resolve) => {
                setTimeout(() => {
                    this.status = 'connected';
                    this.startSyntheticEvents();
                    resolve();
                }, 450);
            });
        }

        subscribe(name, observer) {
            this.observers.add(observer);

            return Promise.resolve({
                unsubscribe: () => this.observers.delete(observer)
            });
        }

        publish(name, event) {
            // AppSync fans a published event back out to every subscriber on
            // the channel, including the publisher.
            return new Promise((resolve) => {
                setTimeout(() => {
                    this.emit(event);
                    resolve();
                }, 120);
            });
        }

        disconnectAll() {
            clearInterval(this.timer);
            this.timer = null;
            this.observers.clear();
            this.status = 'closed';

            return Promise.resolve();
        }

        emit(event) {
            this.observers.forEach((observer) => observer.next && observer.next(event));
        }

        startSyntheticEvents() {
            this.timer = setInterval(() => {
                this.tick += 1;
                this.emit({ source: 'simulated', tick: this.tick, at: new Date().toISOString() });
            }, 6000);
        }
    }

    /* ── Mode handling ────────────────────────────────────────────────── */

    const getMode = () => document.querySelector('input[name="mode"]:checked').value;

    const getModeInputs = () => [...document.querySelectorAll('input[name="mode"]')];

    const NOTES = {
        demo:
            'Demo mode runs a stand-in transport in this page. The library is never contacted, but every control ' +
            'below drives the same method names you would call for real.',
        live:
            'Live mode builds a real Messenger against your AppSync API. Credentials stay in this page — nothing is ' +
            'sent anywhere except AWS. Use a development API key.'
    };

    function applyMode() {
        const mode = getMode();
        dom.credentials.hidden = mode !== 'live';
        dom.modeNote.textContent = NOTES[mode];
    }

    /* ── Wiring ───────────────────────────────────────────────────────── */

    function buildMessenger() {
        const namespace = el('namespace').value.trim() || 'default';
        const channel = el('channel').value.trim() || 'broadcast';

        if (getMode() === 'demo') {
            return new MockMessenger({ namespace, channels: { [CHANNEL]: channel } });
        }

        const authMode = el('authMode').value;
        const key = el('key').value.trim();

        if (authMode === 'apiKey' && !key) {
            throw new Error('An API key is required when the auth mode is apiKey.');
        }

        // The UMD bundle exposes the library as window.FrontendMessenger.
        return new FrontendMessenger.Messenger({
            appId: el('appId').value.trim(),
            region: el('region').value.trim(),
            key: key || undefined,
            namespace,
            authMode,
            channels: { [CHANNEL]: channel },
            autoConnect: false,
            onError: (error) => log('error', `Connection error: ${describe(error)}`)
        });
    }

    /** Renders an unknown thrown value as something worth reading. */
    function describe(error) {
        if (error instanceof Error) {
            return error.message;
        }

        try {
            return JSON.stringify(error);
        } catch {
            return String(error);
        }
    }

    async function connect() {
        try {
            messenger = buildMessenger();
        } catch (error) {
            setStatus('error', 'Configuration error.');
            log('error', describe(error));
            return;
        }

        setStatus('connecting', `Connecting to ${messenger.getChannelPath(CHANNEL)}…`);
        log('meta', `Connecting to ${messenger.getChannelPath(CHANNEL)}`);

        try {
            await messenger.connect(CHANNEL);

            subscription = await messenger.subscribe(CHANNEL, {
                next: (data) => log('in', typeof data === 'string' ? data : JSON.stringify(data)),
                error: (error) => log('error', `Subscription error: ${describe(error)}`)
            });

            setConnected(true);
            setStatus('connected', `Connected — ${messenger.getChannelPath(CHANNEL)}`);
            log('meta', 'Subscribed. Publish something below.');
        } catch (error) {
            setStatus('error', 'Connection failed.');
            log('error', describe(error));
            messenger = null;
        }
    }

    async function disconnect() {
        if (!messenger) {
            return;
        }

        if (subscription) {
            subscription.unsubscribe();
            subscription = null;
        }

        await messenger.disconnectAll();
        messenger = null;

        setConnected(false);
        setStatus('idle', 'Disconnected.');
        log('meta', 'Disconnected.');
    }

    async function publish() {
        if (!messenger) {
            return;
        }

        const raw = dom.message.value;

        // A convenience for the demo only: the library itself takes any
        // JSON-serialisable value and does no parsing of its own.
        let payload;
        try {
            payload = JSON.parse(raw);
        } catch {
            payload = raw;
        }

        log('meta', `Publishing ${raw}`);

        try {
            await messenger.publish(CHANNEL, payload);
        } catch (error) {
            log('error', `Publish failed: ${describe(error)}`);
        }
    }

    function clearLog() {
        dom.log.textContent = '';
        const item = document.createElement('li');
        item.dataset.kind = 'meta';
        const body = document.createElement('span');
        body.className = 'nt-log-body nt-log-empty';
        body.textContent = 'Nothing yet. Connect to start.';
        item.append(body);
        dom.log.append(item);
        logEmpty = true;
    }

    window.addEventListener('load', () => {
        applyMode();
        getModeInputs().forEach((input) => input.addEventListener('change', applyMode));

        dom.connect.addEventListener('click', () => void connect());
        dom.disconnect.addEventListener('click', () => void disconnect());
        dom.publish.addEventListener('click', () => void publish());
        dom.clear.addEventListener('click', clearLog);

        dom.message.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !dom.publish.disabled) {
                void publish();
            }
        });
    });
})();
