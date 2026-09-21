---
status: accepted
---

# CanonCore runs the newest LTS Node major, and the image is what pins it

The major is a RULE rather than a number: **the newest Node major that has reached LTS**. Today
that selects 24. On 2026-10-28 it selects 26.

This record exists because the major was stated in four places and argued in none of them
(CNCORE-50). `README.md` said "Requires Node 24", `package.json` said `">=24"`,
`.github/workflows/ci.yml` said `node@24` six times, and
[[0103-tests-bite-at-package-exports-and-the-router]] referred in passing to "the Node 24 LTS line
this repo pins" — a pin no record made. Four assertions, no decision, and one of them wrong.

**This record governs CanonCore and nothing else.**
[[0110-a-provider-repo-is-a-small-typescript-service]] carries the same rule for the two provider
repos and was deliberately not widened to cover the app, because extending a provider-repo record
over the application is a decision rather than a tidy-up. The two rules agree; they are not one
rule. CanonCore's reasons are below and three of them do not exist in a provider repo.

## Why the newest LTS line, in CanonCore's own terms

**The binding dependency already encodes it.** Vitest 5's own `engines` is
`^22.12.0 || ^24.0.0 || >=26.0.0` (read from the registry 2026-09-11). That range admits 22, 24 and
26 and REFUSES 23 and 25 — it is the LTS lines, written by someone else, for their own reasons.
Departing from LTS here does not mean taking on risk in the abstract; it means running outside the
range the test runner supports. This is the strongest reason and it is a measurement rather than a
preference.

**Node's own guidance for what CanonCore is.** "Production applications should only use *Active
LTS* or *Maintenance LTS* releases" (nodejs.org/en/about/previous-releases, read 2026-09-11).
CanonCore is a deployed, self-hosted application that other people run
([[0107-canoncore-has-two-audiences]], [[0109-deployment-is-a-shape-not-a-vendor]]), not a
development tool, so that sentence is addressed to it. **Following LTS at all is a JUDGEMENT and is
recorded as one:** the measurements here establish that nothing in this stack refuses 26, never that
a Current line would be wrong. A project willing to track Current could overrule this paragraph
without touching a single measurement.

**"Newest LTS" rather than "Active LTS", which is not pedantry.** 24 drops to Maintenance on
2026-10-20 and 26 does not become Active until 2026-10-28, so for eight days no major is Active LTS
and a rule worded that way selects NOTHING. The argument is ADR-0110's and is adopted here rather
than re-derived. Node's guidance permits Maintenance LTS, so "the newest major that has reached LTS"
is both defined at every instant and inside it.

**Node 25 was never a candidate**, which is worth saying because CNCORE-50 was filed partly on the
worry that a contributor might be on it. It reached end of life on 2026-06-01, it never became an
LTS line at all, and Vitest's range refuses it. The odd majors are not a shorter-supported option
here; they are not an option.

## What used to be different about CanonCore: it had no artifact to pin the major

**This section described an asymmetry that CNCORE-63 removed**, and the paragraph it replaces is
worth quoting because the rest of this record was built on it: "CanonCore ships no image. There is
no `Dockerfile` anywhere in this repository" (checked 2026-09-11, true for eleven days).

A provider states its major in four places, and one of them — `FROM node:24-alpine` — is the thing
it actually ships, so the major is pinned by the artifact whatever the other three say. **CanonCore
now has such a place.** Its `Dockerfile` builds and runs `FROM node:24-slim`, and an image is a
harder statement than a CI input is: a runner can be reconfigured, and a published layer cannot.

So:

| Place | What it does |
|---|---|
| `Dockerfile` | **Pins it**, by being the thing that ships |
| `.github/workflows/ci.yml` | **Enforces** it for everything that is not the image |
| `package.json`'s `engines` | Advisory floor. Nothing reads it — see below |
| `README.md` | Tells a contributor what to install |
| `packages/config/src/node-major.test.ts` | Holds the `Dockerfile`, `ci.yml` and `README.md` to one number and to this rule, and `engines` to not contradicting it |

## `engines` is an advisory FLOOR, and on this repo's pnpm it is completely silent

`">=24"` stays as it is. It is not tightened to a 24.x range, and it does not move when the rule
moves the CI major: on 2026-10-28 the floor is still 24 and that line needs no edit.

This matches what CNCORE-43 decided for `provider-wiki`, and the measurement behind it is WORSE
here than the one that record rests on. Measured 2026-09-11 in `node:24-alpine`, root project,
unsatisfiable `"engines": { "node": ">=99" }`, clean `node_modules`, `pnpm install
--frozen-lockfile`, run against both pnpm versions in the same container:

```
pnpm 11.20.0  ->  exit=0   "Unsupported engine" warnings = 1
pnpm 12.3.4   ->  exit=0   "Unsupported engine" warnings = 0
```

CNCORE-43 measured 11.20.0 and found a warning that exits 0, which is ADR-0105's sentence in a
second tool: a severity nothing acts on is a severity that does not exist. **This repo is on pnpm
12.3.4, where even the warning is gone.** pnpm's reference page says installation "will always
fail" if the root project declares an incompatible engine, "regardless of this configuration"
(pnpm.io, `engineStrict`, read 2026-09-11); measured, it neither fails nor says anything. So the
field is not weakly enforced here, it is inert.

**And no `>=` range could state this repo's supported set anyway**, which is the second and more
interesting reason it stays advisory. The supported set is the LTS lines. `>=22` admits 23 and 25;
`>=24` admits 25. Every floor admits majors Vitest refuses, so the honest statement of what
CanonCore runs is the rule in this record, not a range in a manifest. `engines` says only "nothing
below this", which is all a floor can say.

## How the rule acts

`packages/config/src/node-major.test.ts` is the half of this record that does something, and it is
the answer to the four-assertions-one-decision defect rather than a fifth assertion. It reads the
`Dockerfile`, `ci.yml`, `package.json`, `README.md` and `.github/dependabot.yml` directly, for the
reason ADR-0103 gives about values TypeScript cannot see, and holds nine things — two of them are
throws inside the helpers that answer "the major this repo runs" and "the major it ships", so a
split `ci.yml` or a split `Dockerfile` fails whichever test asked rather than needing an assertion
of its own:

- the rule's selector is right, including across the eight days when no line is Active LTS;
- `ci.yml` names ONE major — ten jobs state it, and a bump applied to nine of them throws;
- the `Dockerfile` names ONE major — every stage building `FROM node:` states it;
- that major is the one this rule selects **on the day the suite runs**, in both files;
- `README.md` tells a contributor to install that same major;
- `engines.node` is a bare `>=<major>` floor that does not climb above it;
- the transcribed copy of Node's schedule has not gone blind;
- the Dependabot ignore holds back the base image's major and nothing else;
- and that ignore's `EXPIRES` marker is the day the rule starts selecting a newer major, stated
  once, and has not passed.

**The third of those goes RED ON 2026-10-28**, and so does the fourth. That is deliberate. CNCORE-50
was filed because a rule nobody acts on reads exactly like a rule nobody has, and a date written in
a comment is a date nobody meets. The cost is real and is accepted: CI goes red that day on whatever
work happens to be in flight.

**The repair then is not one line**, and the failure message says so rather than leaving someone to
find out: six `runtime:` values in `ci.yml`, every `FROM node:` in the `Dockerfile`, `README.md`'s
"Requires Docker and Node" line, and the DELETION of the Dependabot ignore that was holding the base
image back — moved together. `NODE_SCHEDULE` does NOT need extending for that — it already carries
26 — which is why the expiry below is a separate test with its own date.

**The fourth exists because the second is otherwise a ONE-SHOT device.** Node's schedule is
transcribed rather than fetched — the suite takes no network, and the gate ADR-0103 installs would
refuse the request. Bump `ci.yml` to 26 without extending that table and every test here passes for
ever, including through October 2027 when the rule starts selecting 28. A guard that can only fire
once is precisely the false signal this record is meant to remove, so the table carries an expiry
and fails when a line newer than any transcribed is due.

## What this rule does NOT reopen: ADR-0103's network gate

CNCORE-50 raised this before the rule was written rather than after, and it is the one consequence
worth chasing down. ADR-0103 chose undici's `MockAgent` over Node's `--allow-net` and gave
availability as the reason: the flag "is not available: added in v25.0.0 … absent from the Node 24
LTS line this repo pins". Under this record the newest LTS major becomes 26 on 2026-10-28, the flag
becomes available, and a reason resting on availability expires exactly when the rule fires.

**It does not reopen, and the reason has nothing to do with which major is running.** Measured in
`node:26-alpine` (v26.8.2) on 2026-09-11:

```
node --allow-net …                         ERR_MISSING_OPTION: --permission is required
node --permission …                        connect 1.1.1.1 -> ERR_ACCESS_DENIED
node --permission --allow-net …            connect 1.1.1.1 -> ALLOWED
node --permission --allow-net=127.0.0.1 …  connect 1.1.1.1 -> ALLOWED
node --permission --allow-net=example.com  connect 1.1.1.1 -> ALLOWED
```

**`--allow-net` is all-or-nothing.** It accepts an `=value` without complaint and ignores it; hosts
that are not in the list connect anyway. `node --help` in the same image documents it as
`--allow-net  allow use of network when any`, with no value, unlike `--allow-fs-read=`. The network
gate's entire job is "closed, except loopback" — ADR-0103 is explicit that the order of
`disableNetConnect()` and `enableNetConnect(matcher)` is load-bearing because it expresses exactly
that carve-out. A boolean flag cannot express a carve-out, so it cannot do this job on any major.

**And it is not free to turn on.** `--allow-net` requires `--permission`, which in the same image
denied `worker_threads`, `child_process`, filesystem reads and filesystem writes, all with
`ERR_ACCESS_DENIED`. Vitest needs every one of those. Re-granting them
(`--allow-worker --allow-child-process --allow-fs-read=* --allow-fs-write=*`) leaves the permission
system switched on and doing nothing except the one thing it does worse than the gate already does.

ADR-0103's sentence has been corrected to rest on the flag's SHAPE rather than on its availability,
so it no longer expires. That correction is the load-bearing half of this section: had the reason
stayed as written, this rule would have quietly invalidated a decision in another record on
2026-10-28.

## Ruled out, with reasons

| Candidate | Why not |
|---|---|
| Pinning a number (`Node 24`) | It is what the repo had, and it is what produced four assertions and no decision. A number cannot say when it should change, so nobody changes it and the next reader re-opens the question from scratch. |
| Tightening `engines` to `24.x` | Would be a fifth assertion enforcing nothing: measured above, pnpm 12.3.4 exits 0 and does not even warn. It would also need editing at every major, which is maintenance bought for no signal. |
| `>=` range as the statement of support | Cannot express the supported set. Every floor that admits 24 also admits 25, which Vitest refuses and which is end-of-life. |
| Tracking Current | Outside Node's own guidance for production applications, and outside Vitest 5's `engines`. Available to a project that wants it, at the cost of both. |
| Widening ADR-0110 to cover both | CNCORE-44 deliberately scoped that record to provider repos. Three of the reasons above — no shipped image, Vitest as the binding dependency, pnpm 12.3.4's silence — are facts about this repository and do not hold in a four-route Hono service. |
| A Dependabot `ignore`, as the providers carry | **Taken, under CNCORE-63, having been ruled out here while the premise held.** The row used to read "nothing to ignore ... there is no `Dockerfile` and so no docker entry", and the moment there was one this repository inherited the recurring-noise problem CNCORE-43 solved: Dependabot can edit one of the five places the major is written, so every weekly `node` major pull request goes red with no defect in it. The major still does not live in a `with:` input anything bumps; the base image is what changed. |

## Evidence

Everything above was measured on 2026-09-11 and each command is reproducible from the text.

Node's schedule is `nodejs/Release`'s `schedule.json`, fetched that day: 24 (Krypton) LTS
2025-10-28, Maintenance 2026-10-20, end 2028-04-30; 26 LTS 2026-10-28, Maintenance 2027-10-20, end
2029-04-30; 25 never LTS, end 2026-06-01. The production-use sentence is
nodejs.org/en/about/previous-releases. Dependency ranges are from the npm registry: `vitest@5.0.0`
`^22.12.0 || ^24.0.0 || >=26.0.0`, `next@16.3.4` `>=20.9.0`, `typescript@7.0.2` `>=16.20.0`,
`@biomejs/biome@2.5.12` `>=14.21.3` — Vitest is the binding one. The permission-model and
`--allow-net` probes ran in `node:26-alpine` (v26.8.2). The `engines` runs were in `node:24-alpine`
(v24.21.0) against pnpm 11.20.0 and 12.3.4 in one container. Corepack's absence from the 25 line on
is the TSC vote in nodejs/TSC#1697, recorded by nodejs/node#61207, and was probed in both images:
present at `/usr/local/bin/corepack` in `node:24-alpine`, absent in `node:26-alpine`.

**The README's pnpm warning was measured the same day.** A globally installed pnpm self-switches to
the `packageManager` version only upward: with pnpm 11.20.0 installed and a pin of 12.3.4 it becomes
12.3.4, but with 12.3.4 installed and a pin of 11.20.0 `pnpm -v` exits 1 and prints nothing at all,
on `node:24-alpine` and `node:26-alpine` alike. `npm install -g corepack` has neither failure and was
run on both images and on this project's own nvm-managed Node v24.19.0, where it upgraded the bundled
corepack 0.35.0 to 0.36.0 without collision. A Homebrew-managed Node was NOT tested: none is
installed on the machine this was measured on.

**One thing here is NOT measured and is inherited.** ADR-0110 establishes that `@duckdb/node-api`'s
prebuilt bindings load on Node 26 via Node-API's ABI guarantee. CanonCore does not depend on that
package, so nothing in this repository re-tests it and nothing here depends on it either. It is
named only so a reader does not go looking for it under this record.

## Built, under CNCORE-50

**BUILT: the rule, and the thing that makes it act.** `packages/config/src/node-major.test.ts`
holds `ci.yml`, `package.json` and `README.md` to one major and to this rule. CNCORE-63 added the
`Dockerfile` and the Dependabot ignore to what it reads.

**Every assertion except one was shown failing against a broken version of its own subject before
being kept**, which is worth stating exactly rather than as a round number. Run and observed: a
half-applied bump across the jobs; a `ci.yml` with no `pnpm/setup` step at all; `engines` turned
into a pin; `engines` above the major CI runs; a README naming a different major; a README whose
setup sentence was reworded out from under the regex; the clock advanced to 2026-10-28; and two
wrong readings of the schedule table — ignoring whether a line has reached LTS, and an off-by-one on
the changeover day.

**THE EXCEPTION IS THE EXPIRY TEST**, and it is the one most worth knowing about. It cannot be shown
failing without moving the clock past 2027-10-01, so what was observed is only that it fails when
its own assertion is mis-written — it was red on a type error first, and fixed. Its real firing is
unverified, and that is the weakest link in this mechanism. **CNCORE-63's Dependabot expiry is a
different test with the same shape and it does NOT share that weakness**: its date is 2026-10-28
rather than 2027-10-01, and it was observed red by writing a date that had already passed.

**BUILT: the README instruction, which was the one thing here that was wrong rather than merely
unargued.** `corepack enable` alone fails on every major above 24, and the replacement was measured
in both images rather than reasoned about.

**BUILT: ADR-0103's correction**, which is the half most likely to be missed, because that record
had already made the right choice for a reason that was about to expire.

**NOT BUILT, and deliberately: anything that checks a CONTRIBUTOR's Node major.** CI is the only
enforcing place, and a contributor running a different major finds out when CI tells them. A
`preinstall` gate was the obvious candidate and is not here: pnpm's `engines` handling is inert
(measured above), so it would have to be a hand-written script running on every install, to catch
a case the README already states and CI already fails. That is a real gap rather than a solved
one — someone can develop happily on the wrong major until they open a pull request.

**ONE DEPENDENCY WORTH NAMING.** The paragraph above saying ADR-0110 carries the same rule for the
provider repos describes that record AS AMENDED BY CNCORE-44, whose pull request was still open
when this landed. If CNCORE-44 changes shape, the sentence about the two rules agreeing is the one
to re-read; nothing else here depends on it, because every reason in this record was measured
against CanonCore rather than borrowed.

## What shipping the image changed, and it was the three things this record predicted

This record's enforcement argument rested on a fact that was true when it was written and was
DECIDED TO STOP BEING TRUE: "CanonCore ships no image. There is no `Dockerfile` anywhere in this
repository." [[0115-the-public-release-comes-before-the-playback-half]] added one, because in this
genre the container is the install instructions.

**It was written while the premise still held, so that the ticket adding the Dockerfile would not
discover it late — and that worked.** CNCORE-63 priced all three from this section rather than
meeting them one at a time, and all three landed with it. They are recorded here in the past tense
because each one is now a thing somebody can go and read:

1. **The asymmetry is gone**, and the table above has moved with it. `FROM node:24-slim` is an
   artifact that pins the major, which is exactly the property this record used to explain why a
   provider repo enforces differently. "CI is the only place that enforces it" was the title of this
   record and is no longer true of it.
2. **The fifth assertion exists and is held.** `packages/config/src/node-major.test.ts` now reads
   the `Dockerfile` as well, and holds every stage of it to one major and to the rule. Added without
   that, its major could have drifted while every other assertion still passed — CNCORE-50's
   four-assertions-one-decision defect, re-created by the fix for something else. **It was observed
   failing against a broken Dockerfile rather than assumed**: a file bumped to 26 ahead of the rule,
   a file whose two stages named different majors, and a file with no `node` base at all.
3. **Dependabot gained a docker entry**, with the Node-major ignore and the `EXPIRES` marker the
   provider repos carry. One thing was done better here than there, and it is the only part of this
   that was not simply ported: **the expiry is derived rather than transcribed.** provider-wiki
   writes the date and a test reads it; here the test asserts the marker equals the LTS date of the
   next line in `NODE_SCHEDULE`, so the ignore cannot outlive the rule that justifies it, and a
   marker moved by hand to buy quiet fails.

**One thing this section got wrong, in this repository's favour.** It said the image "inherits the
recurring-noise problem ... including the 2026-10-28 expiry machinery", implying the same failure the
providers met. The provider images' naked bump FAILED THE BUILD at `corepack enable` (exit 127),
because the Node TSC stopped distributing corepack from the 25 line on. CanonCore's Dockerfile never
had that defect to inherit: it installs pnpm from the `packageManager` pin, which works on every
major, and CNCORE-63 wrote it that way from the first line rather than fixing it afterwards. What
this repository inherited is the NOISE alone — a weekly red pull request with no defect in it — which
is a smaller problem wearing the same clothes.
