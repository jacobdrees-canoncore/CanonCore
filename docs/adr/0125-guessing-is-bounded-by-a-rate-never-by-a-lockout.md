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

That takes the guess rate from roughly six billion a day to 5,760 a day per door, which is a
millionfold, and it costs an owner who has just mistyped their password nothing at all. Every daily
figure in this record is a measured per-second rate multiplied out, and carries that measurement's
precision and no more.

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

**THAT BOUND COVERS THIS MECHANISM'S OWN LINE, AND THE REST OF THE SURFACE IS COVERED BY WRITING NO
LINE AT ALL.** The first draft of this section read as though the bound covered the log, and it did
not. The RPC mount wrapped both handlers in `onError((error) => console.error(error))`, so every
refusal arriving over `/api/rpc` — this one, and `UNAUTHORIZED` from every other procedure since
CNCORE-109 — wrote a stack trace per ARRIVING request, which is exactly the unbounded shape
described above. It predated CNCORE-117 and was surface-wide rather than login-shaped.

**CNCORE-120 CLOSED IT, AND THE ANSWER WAS NOT A QUIETER LINE BUT NO LINE.** A quieter line is the
tempting answer and it is not one: the interceptor runs once per ARRIVING request, so anything it
writes AT ANY LEVEL is a line a stranger can ask for as fast as the process serves. There is no
level at which a per-request line is bounded, which is what makes this a different question from
what to call the event. So the mount says nothing about an `ORPCError` below 500 — those are answers
this surface chose to give — and logs a fault in full, with its stack: a 500, or anything that is
not an `ORPCError` at all. The test is the STATUS rather than a list of codes, because a list is
added to by every procedure that learns a new refusal and the one nobody remembered would be logged
as a fault.

**A REFUSAL IS LOGGED WHERE IT IS COUNTED, OR IT IS NOT LOGGED.** That is the rule the two halves
make together, and it is why the bounded line above is now the only thing this instance writes when
a password is refused — which is what this section claimed before it was true.

Asserted at ADR-0103's third seam, AGAINST EVERY CONSOLE LEVEL rather than `error` alone: a spy
watching one level would pass the quieter line this record has just said is not the answer, so the
assertion would have been weaker than the claim. A caller with no session asks a write procedure
twenty-five times and nothing is written anywhere. Forty-one wrong passwords arrive at the route,
forty are CHECKED and write forty lines, the forty-first is turned away with no allowance left and
writes none, and the mount itself writes nothing at any level throughout — so this mechanism's bound
and this section's claim are measured in the same test, which is the only way the sentence joining
them can be checked. A router that throws is logged whole, with its stack — and, since
CNCORE-122, with its message ESCAPED rather than pasted in raw; see below.

**WHAT THE MOUNT CLASSIFIES IS WHAT REACHES IT**, and `createContext` runs first: `seeSession`
touches the database for any caller presenting a session cookie, so a failure THERE leaves the
handler before any interceptor and is Next's to report. Measured against a closed port. That is not
a hole in the rule — it is why the rule is stated about what the handlers raise.

## Bounded in COUNT is not bounded in SHAPE — under CNCORE-122

Everything above bounds HOW OFTEN this instance writes. It says nothing about WHAT it writes, and
until CNCORE-122 that second bound was open: `console.error(error)` renders an `Error` as its
`stack`, and V8 builds that string by pasting the message in RAW at the top. **A message carrying a
newline therefore wrote a SECOND LINE into the owner's log, and the second line was composed by the
caller.** An owner reading the log, or the fail2ban-style tooling this record names as the reason
the log is the surface at all, could not tell an entry this process wrote from one somebody sent it.

That is the log-INJECTION cousin of the log-FILLING problem this record exists to close, and the
same family as [[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]] one surface over: a
stranger choosing the content of text on a surface they do not own. There it was the owner's page
and the lever was length; here it is the owner's log and the lever is a line break.

**IT IS NOT A REGRESSION FROM CNCORE-120, WHICH MADE IT STRICTLY NARROWER.** Before that change
every 4xx was logged too, so any refusal reached the log with no session and no bound. Only faults
are logged now, so reaching this at all means provoking a 500.

### The way in is the DRIVER, and the validation failures the ticket named are not

Measured on this stack, @orpc/server 1.15.0 and drizzle-orm 0.45.2, Node v24.19.0:

- **`DrizzleQueryError` is the live vector, and it needs no attack to demonstrate.** Its message is
  built as `Failed query: <sql>` then `params: <params>` — **ALREADY TWO LINES before anybody
  interferes** — with the parameters the caller supplied interpolated into the second. The pg error
  it wraps as `cause` quotes offending values in its own message too.
- **oRPC's validation failures do NOT carry caller text in a message, which the ticket assumed and
  this record checked.** Both `BAD_REQUEST` and the output-validation `INTERNAL_SERVER_ERROR` have
  a CONSTANT message — "Input validation failed", "Output validation failed" — and the received
  value arrives nested, under `data.issues` and under `cause.data`. **`inspect` has always escaped a
  string in a nested position**, so those were never the hole the message was. This agrees with
  ADR-0123's measurement of zod 4.5.4, where the received value is absent from a `ZodError`'s
  message as well.

So the defect had exactly ONE raw span — the top-level message — and it is the span every renderer
treats differently from the values around it.

### The boundary is drawn twice, because the stack cannot be the thing that is discarded

"One line per event" cannot mean dropping the stack: a stack is multi-line by nature and is the half
CNCORE-120 kept ON PURPOSE, being the part an owner cannot reconstruct from a response that says
only "Internal server error". So the entry stays multi-line and the boundary is made legible
instead, twice over:

1. **Caller text is QUOTED.** The message is rendered by `inspect`, so it arrives in quotes with its
   newlines escaped as `\n` — the same rendering every other string in the entry already got.
   Inside the quotes is what somebody sent; outside them is what this process said.
2. **An entry STARTS AT COLUMN 0, and nothing else does.** V8 indents its own frames, the carried
   properties are indented to match, and `breakLength` stops `inspect` wrapping a long value onto a
   fresh line of its own — which it does by default at 80 columns, and a long message is exactly
   what a caller controls. A line flush to the left margin is this app speaking, every time, which
   is the rule a reader skims by and a log pattern is written against.

**WHAT IS CARRIED ALONGSIDE IS WHAT `console.error` ALREADY WROTE**: the code and status on an
`ORPCError`, the query, parameters and `cause` on a driver fault. This closes an escaping defect and
is not licence to write less than before — the `cause` in particular is where oRPC puts the
offending value, so dropping it would have taken away the diagnosis while fixing the forgery.

**AND WHERE THE CALLER'S TEXT CANNOT BE LOCATED, NO FRAME IS WRITTEN.** The message is found by the
span V8 pasted atop `stack`; an error arriving without one offers nothing to measure against, and
guessing which lines came from V8 is the hole itself, since a message can carry a line that reads
exactly like a frame.

### What is NOT escaped, measured rather than assumed

`U+2028` and `U+2029` pass through both `inspect` and `JSON.stringify` raw. That is not a hole here
and the reason is worth writing down rather than rediscovering: **they do not terminate a line in a
POSIX text file**, which is what an owner reads and what a fail2ban regex is fed. What splits a line
there is the C0 set, and `inspect` escapes all of it — including `U+0085`, which `JSON.stringify`
leaves raw, and which is the reason `inspect` is the renderer here rather than the JSON one.

### As built

Whole. Asserted at ADR-0103's third seam, the catch-all route handler driven directly, alongside the
assertions above and sharing their spy across every console level. **The forgery each test plants is
`login-bound.ts`'s OWN line** — the one this record bounds four-a-minute — so "a line an owner could
mistake for one this process wrote" is asserted against the real one rather than an invented string.
The driver fault is built from the real `DrizzleQueryError` with a forged parameter AND a forged
cause, and the assertion is the invariant itself: after the first, no line begins at the margin.

## What this deliberately does not do

- **It does not stop somebody who keeps guessing from keeping the owner waiting, and that costs them
  FOUR REQUESTS A MINUTE rather than a flood.** An earlier version of this record called this case a
  flood and waved it off as something that would deny service anyway. It is not a flood, and the
  review of CNCORE-117 was right to say so: steady state is one check every fifteen seconds, so four
  requests a minute hold the allowance under one indefinitely while degrading nothing else on the
  instance. `TOO_MANY_REQUESTS` is refused BEFORE the comparison runs, so polling for the moment a
  check frees up costs nothing, and a guesser who wants every slot can have them. The owner then
  competes for checks and mostly loses, for as long as somebody cares to keep it up.

  **What remains true is what this record actually refuses: no state OUTLIVES the guessing, and
  nothing has to be lifted by anybody.** The guessing stops and the owner is in within fifteen
  seconds. And the owner holds a lever the guesser does not: a restart returns a full burst of forty,
  which four requests a minute cannot drain before the owner spends one of them. A per-caller bound
  would answer this properly and is unavailable here for the reasons above. This is still a far
  better answer than Jellyfin's, where the equivalent lever is two `UPDATE` statements against the
  database.
- **It does not distinguish callers.** See above: there is no trustworthy address on the path that
  matters.
- **It is not configuration.** No environment variable, per `CLAUDE.md`: nothing in the repo would
  read a second one. Audiobookshelf exposes `RATE_LIMIT_AUTH_MAX` and `RATE_LIMIT_AUTH_WINDOW`, and
  the day an owner asks for the same, these two constants become the thing that reads them.
- **It does not put refused attempts on a page.** Jellyfin is the only product of the four with a UI
  surface for this, an activity-log row in its admin dashboard, and CanonCore has no owner dashboard
  to put one on. The log is the surface, and a page is worth having on the day there is somewhere for
  it to live rather than a page invented to hold one row.

## One allowance per door, which was measured rather than assumed

The argument above is that a bound belongs at the procedure because both doors arrive there, and that
is how it is built. **What that does not give is ONE allowance, and this record implied otherwise
until it was measured.** Next bundles the Server Action graph and the route handler separately, so
`login-bound.ts` is evaluated twice in one server and each door carries an allowance of its own.

Measured on 2026-09-12 against a production build of this app on Next 16.3.4: forty wrong passwords
through `/api/rpc/session/logIn` were answered `401` and the forty-first `429`, and the login FORM
then took the correct password at once — which one shared allowance would have refused. Driven the
other way, the form refused forty and said "too many" on the forty-first while the RPC door went on
answering `401`.

Two consequences, and they do not point the same way:

- **The ceiling is twice what one allowance would give**: 11,520 checks a day rather than 5,760.
  Against the six billion measured before this, that is the same order of protection.
- **The doors cannot starve each other**, which is the better half of the same fact. Somebody
  hammering `/api/rpc` does not spend the allowance the owner's browser needs, so the residual named
  above costs a guesser the door the owner is actually using.

**The claim that survives does not depend on the count: EVERY door is bounded, because the bound is
inside the procedure every door calls.** A proxy rule on `/api/rpc` would have bounded one of these
two and left the other open, which is the Immich answer this record refuses. How many instances Next
makes is a fact about a bundler and may change with a version; that every caller meets the mechanism
is a fact about where the mechanism was put.

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
