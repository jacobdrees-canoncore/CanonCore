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

## Half built, under CNCORE-109 and CNCORE-116 — and this record stays PROPOSED

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

**BUILT, UNDER CNCORE-116: THE SURFACE TO LOG A DEVICE OUT FROM.** `/devices` lists the sessions
the owner is live on, marks the one drawing the page, and offers an End button against each of the
others. `session.list` and `session.end` are both behind `ownerProcedure` -- who is logged in to an
instance is not in the catalogue, so ADR-0044's open read path does not reach it -- and
`session.end` REFUSES the caller's own session, because logging THIS browser out is the row and the
cookie together and `logOut` is the operation that does both halves. `endSession` needed no change
to reach any of it, which is what CNCORE-109 was holding the shape of that function for.

**AND THE PAGE TAUGHT THAT IT IS HALF-LEGIBLE WITHOUT THE DECLARATION ABOVE.** Every row a browser
writes is identical: five null columns, so the page can honestly say only "A browser, which declared
nothing" and a sighting to tell them apart by. An owner with a laptop and a phone reads two rows
differing in one timestamp and has to work out which is which from when they last used each. The
surface is finished; what makes it LEGIBLE is the declaration channel, and the two are more tightly
coupled than this record read before one of them existed. Jellyfin's own Devices page is worth
knowing beside that: read 2026-09-12, it offers RENAME and REMOVE, calls removal "cleans out old
entries" rather than a logout, and says nothing about a session expiring at all. A NAME THE OWNER
TYPED is the other way to make a list legible, and it is a decision for the day a second device
exists rather than one to take now.

**BUILT, UNDER CNCORE-116: A SESSION LAPSES, ON BOTH CLOCKS.** Thirty days from `created_at`
whatever the device does, and seven days from `last_seen_at` when it does nothing. `seeSession` and
the device list ask one predicate, so a session the write path refuses is never one the list offers
to end.

BOTH RATHER THAN EITHER, WHICH IS OWASP'S OWN INSTRUCTION in its Session Management Cheat Sheet
(read 2026-09-12): "All sessions should implement an idle or inactivity timeout", and separately
"All sessions should implement an absolute timeout, regardless of session activity." They close
different doors. The absolute limit bounds every copy of a token; the idle limit reaches the device
that stopped being used in week one, which the absolute limit leaves live for the other three.

AND THE NUMBERS ARE DAYS RATHER THAN OWASP'S MINUTES, DELIBERATELY. That page's ranges are "2-5
minutes for high-value applications and 15-30 minutes for low risk" idle, and "between 4 and 8
hours" absolute for an office worker's day. This is a catalogue somebody reads from a sofa, and the
product had already decided thirty days when it set the cookie's `Max-Age`. A quarter-hour idle
timeout here would be an instance that asks for a password every time a tablet is picked up, which
is how an owner ends up choosing a password worth guessing.

THIRTY DAYS IS NOW ONE NUMBER RATHER THAN TWO THAT AGREED. `SESSION_LIFETIME_SECONDS` is the row's
lifetime and the cookie's `Max-Age`, read from one place, so neither outlives the other at the
OUTSIDE limit. It does NOT make the two agree in every case, and an earlier draft of this paragraph
said it did: the idle limit ends a session after seven unused days with up to twenty-three still on
the browser's copy of the token. That is the harmless direction -- a cookie that answers nothing
meets the login form -- but it is a gap rather than no gap, and the sentence claiming otherwise was
falsified by the limit added in the same change.

**AND IT COST NO COLUMN, WHICH IS THE HALF CNCORE-116 EXPECTED TO BE WRONG ABOUT.** That ticket
reads "ADR-0043 names seven columns and no expiry, so adding one is a DECISION" -- and the decision
turned out to need nothing added: `created_at` and `last_seen_at` are two of the seven, and both
clocks the policy compares were already on the row. The expiry is a predicate over what this record
already asked for rather than a rung on the ladder, which is why it could be taken as a policy
argument alone.

**WHAT NEITHER LIMIT CLOSES, AND WHICH HALF DOES.** A copy IN ACTIVE USE. Whoever holds it keeps
`last_seen_at` fresh by using it, so the idle limit never fires and the absolute one is the only
bound -- thirty days. What ends it sooner is the owner reading a device they do not recognise and
pressing End, which is the page above. The three things CNCORE-116 carried are one mechanism seen
from three sides rather than three features that happened to be filed together.

**AND THE SWEEP IS ADR-0049'S, WHICH IS WHY IT IS HALF HERE.** `sweepSessions` removes every row
past its LIFETIME and nothing else: one rule, whatever state the row reached on the way, so an ended
session and an idle one both wait out the rest of their thirty days rather than going the moment
they stop answering. That is deliberate -- a tombstone that vanished as `endSession` wrote it would
cost the distinction that function keeps, between the owner having logged a device out and the
device never having logged in -- and it means a row refused on the idle clock at day eight is still
in the table on day nine. The registry ADR-0049 decides now exists and now calls it (CNCORE-119):
`sweep-sessions`, on a daily trigger, with a run history the owner reads at `/tasks`. It was
uncalled until then rather than attached to a login, a page render or the container's boot, because
each of those is exactly the hidden timer that record refuses. Nothing's security waits on it
either way: `seeSession` refuses a lapsed session
whether or not it has been swept, so an unswept table is a table that grew rather than a door left
open.

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

The expiry policy's two external claims were read from the source that owns each, on 2026-09-12:
OWASP's Session Management Cheat Sheet for the instruction to implement both timeouts and for the
ranges it names, and Jellyfin's own Devices documentation for what a comparable product's device
page actually offers. Neither is quoted from memory, and the Jellyfin claim is deliberately no wider
than what that page says: it is silent on expiry rather than known to have none.
