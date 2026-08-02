# Security Policy

## Supported versions

Only the latest published version of `@nowtwo-llc/frontend-messenger` receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for a security report.

Use GitHub's private vulnerability reporting instead — go to the
[Security tab](https://github.com/nowtwo-llc/nowtwo-frontend-messenger/security/advisories/new)
and open a draft advisory. That keeps the report private until a fix ships.

If you cannot use that, email <support@nowtwo.io>.

Please include what the issue is, how to reproduce it, and which version you tested.
We aim to acknowledge reports within a few business days.

## Scope

This library is a thin wrapper over AWS Amplify's AppSync Events client. It opens WebSocket
connections, forwards subscription callbacks, and publishes JSON payloads. It does not parse
markup, touch the DOM, or persist anything.

The things most worth reporting:

- **Credential handling.** The API key you pass in `config.key` goes to `Amplify.configure()`
  and nowhere else. If you find a path where credentials are logged, thrown in an error
  message, attached to an event payload, or otherwise leave that call, that is a report.
- **Channel path construction.** `<namespace>/<channel>` is built by string concatenation
  from caller-supplied values. If a crafted channel name can reach a different channel than
  the one configured, that is a report.
- **Payload handling.** Inbound event data is handed to your `next` callback untouched — the
  library never evaluates or interpolates it. If you find a path where a received payload is
  executed rather than passed through, that is a report.

The following are **out of scope**, though we are still glad to hear about them as ordinary issues:

- AppSync or Amplify misconfiguration in your own account, including overly permissive API
  keys or channel authorisation rules. Channel-level access control is AppSync's job, not
  this library's.
- The demo page in `example/`. It accepts credentials you type in and sends them only to AWS,
  and it is not part of the published package.
- Vulnerabilities in `aws-amplify` itself — please report those to
  [aws-amplify/amplify-js](https://github.com/aws-amplify/amplify-js/security).
