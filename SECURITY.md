# Security Policy

## Supported Versions

SunderSeed is a static, client-side application that is deployed continuously
from `main` to <https://sunderseed.pages.dev>. Only the currently deployed
version is supported; there are no versioned releases or long-term support
branches.

## Reporting a Vulnerability

Report security issues **privately** through GitHub's private vulnerability
reporting:

**<https://github.com/lior21/SunderSeed/security/advisories/new>**

Please do not open a public issue for a vulnerability. A report submitted
through the link above is visible only to the maintainers until an advisory is
published.

Helpful details to include:

- A description of the issue and its security impact
- Steps to reproduce, or a proof of concept
- The affected commit or deployment date, browser, and operating system
- A suggested fix, if you have one

## Scope

In scope:

- The cryptographic logic in `src/` (BIP-39 to SLIP-39 splitting and recovery,
  share validation, randomness usage)
- Handling of secrets in the browser: seed phrases and shares must never leave
  the device, be logged, or be persisted
- The build and release pipeline in `.github/workflows/`

Out of scope:

- Third-party dependency advisories that are already public and have no
  patched version (for example the `elliptic` advisory reported by OpenSSF
  Scorecard, reachable only through unused Node crypto polyfills)
- Phishing, social engineering, or physical access to a user's device
- Issues that require an already compromised browser or extension

## What to Expect

- Acknowledgement of the report, usually within 7 days
- An assessment and, where warranted, a fix deployed to the live site
- Credit in the published advisory, unless you prefer to stay anonymous

## Disclosure

Please allow a reasonable window to ship a fix before publishing details.
Advisories are published through GitHub Security Advisories once a fix is
live.
