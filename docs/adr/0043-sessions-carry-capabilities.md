---
status: proposed
---

# A session is per device and carries a capability declaration

One row per logged-in device: client name, device name, stable device id, client version,
capabilities, created_at, last_seen_at. It arrives with the slice that first logs something in, but
arrives WHOLE, because the row is the expensive part rather than any column on it.

Audiobookshelf began close to our position — a signed JWT persisted on the user row, so it had a
row but no SESSION row — and moving to real sessions took 52 files and 3,168 lines, then ten months
of session bugs; the per-device logout everyone actually wanted then cost 131 lines.

The capability declaration is not decoration — direct play only makes it decisive.

Plex splits it across two channels and an earlier version of this record conflated them. Its eleven
`X-Plex-*` headers are client IDENTITY, and `X-Plex-Provides` carries ROLES —
`client,controller,player,sync-target,server` — which is what casting from phone to TV needs. The
CODEC decision runs on `X-Plex-Client-Profile-Name` ("Which built in Client Profile to use in the
decision") plus `X-Plex-Client-Profile-Extra`, with its `add-direct-play-profile` and
`add-limitation` grammar. We need both, and they are not the same field.

Single-owner is not an argument against any of it: one owner routinely has several devices, which is
the case the opaque token did not survive.

## Half built, under CNCORE-109 — and this record stays PROPOSED

**BUILT: THE ROW, WHOLE.** Migration 10 adds `sessions` with every column this record names --
client name, device name, stable device id, client version, capabilities, `created_at`,
`last_seen_at` -- plus the two the mechanism needs: `owner_id`, and `token_hash`, which is SHA-256
of the secret the caller presents. The table is a set of verifiers rather than a set of live
credentials, so a backup or a logged query hands over neither.

**BUILT: WHAT THE ROW IS FOR.** Everything that writes on the RPC surface is behind it
(`ownerProcedure` in `packages/api`), the owner's one password is exchanged for a token by
`session.logIn`, and `endSession` takes the SESSION it ends rather than the token the caller
happens to be holding -- which is this record's per-device logout, addressable from the moment the
row exists.

**NOT BUILT: THE DECLARATION CHANNEL, WHICH IS THE HALF THIS RECORD IS NAMED AFTER.** Five columns
stand empty, because the only surface that logs in today is a browser on the web UI and
`CONTEXT.md` is explicit that the web UI is not a Client -- the server serves it, at the server's
own origin. So there is no `X-Plex-*` equivalent, no answer to `X-Plex-Provides`, and no client
profile grammar. That is not an oversight deferred: the capability declaration is decided by
DIRECT PLAY (ADR-0041), and nothing in this product plays anything yet, so a shape pinned now
would be the one the first client has to argue with. `capabilities` is therefore `jsonb` and
opaque: the column is whole, its contents are the clients' to settle.

**NOT BUILT: A SURFACE TO LOG A DEVICE OUT FROM.** `endSession` names a session, so the operation
this record says everyone actually wants is one page away -- and the page is not here, because
with one device and no client there is nothing to list.

**NOT BUILT, AND LARGER THAN IT FIRST READ: A SESSION DOES NOT LAPSE.** This record names seven
columns and no expiry, so what landed has none: `seeSession` reads `deleted_at IS NULL` and nothing
else, and the cookie's thirty-day `Max-Age` is the BROWSER forgetting rather than the session ending.
A token copied off a request is good until somebody logs that session out by hand — and the surface
to do it by hand is the per-device logout above, which is also unbuilt. An earlier version of this
section recorded only the harmless half of that, the dead rows nothing sweeps (ADR-0049's registry,
which is where a sweep belongs). Tracked as CNCORE-116, which carries all three, because an expiry
policy is a decision this record does not make rather than an implementation of one it does.

**AND THE DECLARATION, WHEN IT ARRIVES, VALIDATES AT THE PROCEDURE.** `startSession` takes a
`DeclaredDevice` and writes it; that is a TypeScript interface, so today's only caller passing `{}`
is the whole of what checks it. A client declaring five fields is a client sending five strings, and
the procedure that accepts them states a schema for them like every other input on this surface.

**AND ONE THING THE BUILD TAUGHT, because it cost a passing test its meaning.** `created_at`
defaults to the DATABASE'S `now()`, so stamping `last_seen_at` from the application's clock
compares two clocks: measured against the container on 55432 (ADR-0104), the skew ran BACKWARDS and
a session read as last seen 60ms BEFORE it was created. A sighting is stamped with `now()` in the
same statement that finds the row.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-products.md`.
