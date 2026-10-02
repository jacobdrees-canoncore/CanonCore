# Invited Accounts and Profiles on Better Auth

Admins invite people, each with an Account on their own devices holding one or more Profiles, and all watch state, Continue Watching and private Orderings are keyed by Profile from the first migration, while only Admins edit the Library, set Locks, add Providers and invite. Better Auth handles Accounts, passwords, sessions, device-code pairing (RFC 8628, through its `device-authorization` plugin), bearer tokens and API keys on SQLite through its Kysely adapter, while Profiles and pairing an Apple TV stay CanonCore's own, because "don't roll your own auth" is the 2026 norm a reviewer looks for. This supersedes the single password of old ADR-0044 and the edit rules of old ADR-0072 (canoncore-history).

## Considered Options

- Hand-rolled auth, as in Jellyfin and Kavita: rejected. The accepted risk is that Vercel has owned Better Auth since 2026-07-07; it is open source and the data stays in CanonCore's tables.

## Consequences

- Login slows down and never locks out, because Jellyfin-style lockout lets an attacker lock out the only Admin. Better Auth's 2FA plugin locks accounts by default, so CanonCore sets its lockout `enabled: false`; its limiter is per IP and per path with no account lock (verified in v1.7.6, 2026-09-28), so the per-Account limit with growing delays is CanonCore's own to build.
- Behind a proxy, `ipAddressHeaders` must be set, so the limiter sees the real client IP.
- An Apple TV follows the tvOS profile, as Apple documents in "Mapping Apple TV users to app profiles" (verified 2026-10-02): the app is signed in once per Apple TV, with the entitlement `com.apple.developer.user-management` set to `runs-as-current-user-with-user-independent-keychain` and `TVUserManager`, and opens in the Profile remembered for the current tvOS profile, skipping the picker (the Owner, 2 Oct 2026). Apple's sample says the app "should save shared login information where it can access the credentials regardless of the current user, and your code should also remember which profile to load for each user": that memory lives on the Apple TV, in each tvOS profile's own app data, so the server keeps no record of it and an Apple TV is one signed-in device. No competitor checked uses this pattern: Infuse follows the tvOS profile with fully separate data per profile, set up again in each, the Apple TV app uses the system profile itself, and Plex and Swiftfin show their own picker.
- Passkeys are offered wherever the browser allows them: an HTTPS domain, or http://localhost for local testing. A plain http:// LAN install signs in with a password and says why.
