---
status: accepted
---

# Guessing at the owner's password is bounded by a rate, never by a lockout

`session.logIn` is the one procedure on the surface that takes a secret, and it is open by necessity
(ADR-0044): a caller with no session is who it is for. Until CNCORE-117 nothing bounded how often it
could be asked. **Measured at ADR-0103's router seam on this machine, the procedure answered 70,299
wrong passwords a second in sequence and 102,206 a second at a concurrency of 100** — six billion
guesses a day at the low end, against one password whose only floor is the twelve characters
`OWNER_PASSWORD` is validated to.

**THE DECISION: a burst of 40 refusals, then ONE password check every 15 seconds.** Global to the
instance, held in memory, spent only by refusals, and reset whole by a success. An attempt arriving
with no allowance left is refused WITHOUT the password being looked at, and a checked refusal writes
one line to the log.

That takes the guess rate from 6,073,867,081 a day to 5,760 a day, which is a millionfold, and it
costs an owner who has just mistyped their password nothing at all.

## A lockout is refused, and Jellyfin is the measurement

Jellyfin is the one product of the four studied that keys its counter where OWASP says to key it —
to the account rather than to the source address — and it is also the one that hands an anonymous
stranger the power to lock a single-account owner out of their own server. An unauthenticated
`POST /Users/AuthenticateByName` with a known username and any wrong password increments
`Users.InvalidLoginAttemptCount`; at the threshold, `UserManager` writes
`PermissionKind.IsDisabled = true` into the `Permissions` table, and from then on the account is
refused BEFORE the password is evaluated. The flag is cleared only through
`POST /Users/{userId}/Policy`, behind `RequiresElevation` — an authenticated administrator. On an
instance with one account there is no second administrator, so that route does not exist, and the
project's own documented recovery is `sqlite3 jellyfin.db` and two `UPDATE` statements.

**A lockout here would be strictly worse than Jellyfin's, not equal to it.** OWASP's Authentication
Cheat Sheet names this exact failure mode and names the mitigation in the same breath — "allow the
use of the forgotten password functionality to log in, even if the account is locked out". ADR-0044
gives this product one owner, one password and NO SIGNUP, so there is no forgotten-password path to
be let through, no second account, and no email the instance knows. A locked instance would be
opened by editing the environment and restarting, which is to say: by the remedy Jellyfin's
troubleshooting page exists to describe.

It is also worth recording what the evidence corrected, because the received version of it is what
makes a lockout sound safe: Jellyfin's lockout is **off by default** (`LoginAttemptsBeforeLockout`
is a nullable column, unset on a new user), and the widely repeated "3 for users, 5 for
administrators" is contradicted by the server, which maps `0 => 3` with no administrator branch at
all. The docs and the web client say it; the code does not. A design that copied what everyone
believes Jellyfin does would be copying something Jellyfin does not do.

## A log on its own is refused AS THE BOUND, and Immich is the measurement

Immich bounds login attempts nowhere: no throttler dependency, no guard on `@Post('login')`, no
counter, no table. The position is deliberate and stated by a maintainer closing a pull request that
added one, unmerged, after seven and a half minutes: "These things should mostly be handled on the
reverse proxy side or with a tool like fail2ban." Two issues asking for it are closed the same way.

That is a coherent answer for Immich and it is not one CanonCore can take, for two reasons.

**FIRST, THE SHAPE DOES NOT CONTAIN A PROXY.** ADR-0109 commits this product to running in one:
a registrable domain with a publicly-routable IPv4, a POSIX path for media, an injected Postgres URL,
and a process that something restarts. A reverse proxy is not in it, and requiring one would be
enlarging the shape rather than deploying into it — the thing that record exists to refuse.

**SECOND, AND DECISIVE: THE OWNER'S LOGIN DOES NOT CROSS HTTP AT ALL.** The web UI's form posts to a
Next Server Action, and `apps/web/src/app/login/actions.ts` reaches the procedure by calling it in
the same process. Nothing about that request looks like a login from outside: no `/api/rpc` path, no
RPC body, nothing a fail2ban regex or a proxy rule could match. An operator who did everything Immich
advises would have bounded the RPC route and left the form wide open. **A bound that the product's
own front door walks around is not a bound**, which is why this one sits at the procedure, where both
callers arrive.

**The log is adopted, though, as the other half.** All four products studied write a line per refusal
and three of them have no other operator surface at all; it is how this class of event is made
visible, and it is what fail2ban-style tooling reads if an owner does choose to run some.

## What is taken is Audiobookshelf's family, with its two single-owner defects fixed

Audiobookshelf bounds its login route with `express-rate-limit` 7.5.1 at **40 requests per 600,000
ms, keyed on the client IP**, answering `429 {"error":"Too many authentication requests"}`. That is
the mechanism this record adopts, and 40-per-ten-minutes is where these numbers come from: a figure a
comparable self-hosted product ships and its users live with is worth more than one invented here.
Two things about it do not survive contact with a single-owner instance, and both are changed.

**IT COUNTS ATTEMPTS, AND THIS COUNTS REFUSALS.** The limiter is mounted before `passport`, with
`skipSuccessfulRequests: false` and no `resetKey` anywhere, so a successful login spends the same
budget as a wrong guess — and `/auth/refresh` shares the counter, so an ordinary busy client can
exhaust the owner's own allowance without anybody guessing anything. Here the allowance is spent only
when a password is WRONG and is restored whole when one is right, which is what Jellyfin and
Nextcloud both do on success. The practical effect is that an owner who can type their password
never meets this mechanism, and the end-to-end suite, which logs in dozens of times, never sees it
either.

**IT KEYS ON THE CLIENT IP, AND THIS KEYS ON NOTHING.** Per-IP is unavailable here and would be worse
than useless if forced. The web login never reaches the HTTP layer at all, so there is no socket
address on that path; and behind the reverse proxy ADR-0109 permits, the address every caller
presents is the proxy's, which collapses per-IP into one global bucket anyway. The alternative is to
read `X-Forwarded-For`, which is a header any caller can write unless a trusted-proxy list is
configured — and a forgeable key is not a weaker bound, it is an **unbounded** one, since a fresh
value mints a fresh allowance for every guess. So the bound is global, and on this product that is
not a compromise: OWASP asks for the counter to be keyed to the ACCOUNT rather than the source
address, and ADR-0044 gives this instance exactly one account. **The account IS the instance**, so
global and per-account are the same key.

## The cost is paid by refusing, never by sleeping

Nextcloud delays rather than locks out — `sleepDelay` calls `usleep`, up to `MAX_DELAY_MS = 25000` —
and it is the clearest available demonstration of why a delay alone is not a bound. A sleep occupies
one worker for its duration, so an attacker holding C connections gets roughly C guesses per delay
period; the bound is per connection and the aggregate is whatever the worker pool allows. What
actually bounds Nextcloud is the second half, the `MaxDelayReached` throw above `max-attempts` — a
refusal, not a sleep.

So this refuses. An attempt with no allowance left is answered `TOO_MANY_REQUESTS` immediately,
which also spares the owner's process a pile of held-open connections during exactly the flood that
would create them.

**AND THE CLAIM IS TAKEN BEFORE ANYTHING YIELDS, WHICH IS WHAT MAKES IT HOLD UNDER CONCURRENCY.**
`isTheOwner` is synchronous — it is two SHA-256 digests and a `timingSafeEqual` — so refilling the
allowance, testing it, spending it and comparing the password all complete in one turn of the event
loop, with no `await` anywhere between. Two hundred simultaneous guesses cannot interleave with each
other, and the 102,206-a-second concurrent figure measured above is bounded to the same one check
every 15 seconds as the sequential one. A design that checked the allowance and then awaited
something before spending it would be a race, and the race would be the hole.

## The allowance is in memory, and that is what keeps the owner in

Audiobookshelf's state is the `express-rate-limit` `MemoryStore`, two `Map`s in the Node process, and
a restart clears it completely. Jellyfin's is in `jellyfin.db` and survives everything short of
editing the database. This one is in memory, and the choice is the answer to "the owner cannot be
locked out by somebody else's guessing".

**Any bound that genuinely slows a search must be able to turn away a correct password too.** If the
right password always got through immediately, every candidate would still cost exactly one test and
the search would not be slowed at all — the mechanism would be theatre. So the question is not
whether the owner can ever be told to wait. It is whether **a stranger can create a state that the
owner has to ask somebody else to lift**, and the answer here is no, twice over:

1. **It lapses on its own.** The allowance refills whether anyone is guessing or not, so 15 seconds
   after a flood stops the owner has a check and ten minutes after it stops the allowance is whole.
   Nothing persists, and no action is required of anyone.
2. **The one party who can clear it instantly is the one holding the machine.** A self-hosted owner
   can restart their own process; an attacker on the network cannot. A row in Postgres would have
   inverted that, and the remedy would have been a `DELETE` typed against the production database at
   the moment the owner was least able to reach it — which is Jellyfin's troubleshooting page,
   rewritten for this repo.

It costs what in-memory state costs, and the cost is small here: a restart forgives an attacker their
first 40 guesses, and a process serving one owner is not scaled horizontally, so there is no second
copy of the allowance to disagree with this one. A table would also have written a row per attempt
into a database an attacker is choosing the write rate of, taking a `nextval` from ADR-0075's single
global change sequence each time.

## The log is bounded by the same bound

Only a CHECKED refusal is logged. An attempt turned away with no allowance left writes nothing.

That is deliberate, and it is a property neither of the products that log this has: Audiobookshelf
writes a `[RateLimiter] Rate limit exceeded` line per request over the limit, so the flood it is
describing is also a flood of log lines. A line per arriving request is a way to fill an owner's disk
from the outside. Bounded to the checks, the log is bounded to four lines a minute in the worst case,
and it says the thing worth saying: a password was offered and was wrong.

The line names no IP and no username, because this instance has neither to name — one owner, and no
trustworthy source address on the path the form posts to. It names what it knows, which is how much
of the allowance is left.

## What this deliberately does not do

- **It does not stop a flood from denying service while the flood is running.** With the allowance
  empty the owner competes for checks alongside the guesser and may be turned away. That is the flood
  denying service, which it would do to every other page as well; what this record refuses is a state
  that OUTLIVES the guessing, and there is none.
- **It does not distinguish callers.** See above: there is no trustworthy address on the path that
  matters.
- **It is not configuration.** No environment variable, per `CLAUDE.md`: nothing in the repo would
  read a second one. Audiobookshelf exposes `RATE_LIMIT_AUTH_MAX` and `RATE_LIMIT_AUTH_WINDOW`, and
  the day an owner asks for the same, these two constants become the thing that reads them.
- **It does not put refused attempts on a page.** Jellyfin is the only product of the four with a UI
  surface for this, an activity-log row in its admin dashboard, and CanonCore has no owner dashboard
  to put one on. The log is the surface, and a page is worth having on the day there is somewhere for
  it to live rather than a page invented to hold one row.

## As built, under CNCORE-117

Whole. `packages/api/src/routers/login-bound.ts` holds the allowance and the only thing that reads
it; `session.logIn` calls it around the password comparison and answers `TOO_MANY_REQUESTS` when it
is spent. The web app tells the owner to wait rather than that their password was wrong, because
those are different sentences and only one of them is true. Asserted at ADR-0103's second seam, the
router called in the same process.

**The allowance is offered a check to run rather than being asked whether one is allowed.** It takes
the comparison as a synchronous callback and answers what happened, so a caller cannot test the
allowance and forget to spend it, and cannot put an `await` in the middle of the claim. The
signature's being synchronous is the concurrency argument above, expressed in a type.

## Evidence

Every product claim here was read from the owner's own source on 2026-09-12: the code at a named tag,
the project's own issue tracker, OWASP's own cheat-sheet file. Working, with the lookups and the
verdicts that went against the received story, in `docs/research/verify-adr-login-bound.md`. The two
rate figures for this procedure were measured at the router seam in this worktree on 2026-09-12,
against the container on 55432 (ADR-0104).
