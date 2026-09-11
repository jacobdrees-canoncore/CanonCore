# Does CNCORE-60 need a host?

**Researched 2026-09-11.** One question, asked because an agent reading this spec might go and buy a
server: does the public-release effort install CanonCore onto a host — the Whatbox slot or any other
— and does anything in it break if no machine anywhere runs CanonCore for the public?

It answers. It decides nothing, and it changes no ticket and no record.

---

## The short answer: no, and nothing in the spec is close to it

**CNCORE-60 installs CanonCore onto no host, and none of its eighteen children asks for one.** All
eighteen were read on 2026-09-11. Their states moved while this was being written and are recorded
here as read at the end of that day: CNCORE-60 `In Progress`; CNCORE-61 and CNCORE-62 `Done`;
CNCORE-63, CNCORE-65 and CNCORE-77 `In Progress` in their own worktrees, each at its opening commit;
CNCORE-78 `In Review`; the remaining eleven `Todo`. Not one acceptance criterion names a server, a
VPS, a slot, a domain, an origin, a TLS certificate, an A record, a public URL or a running instance
anybody else can reach.

What the spec actually requires is four artefacts and a set of pages:

1. **A public git repository** (CNCORE-61, CNCORE-62). GitHub hosts it. Nothing runs.
2. **A container image in a registry** (CNCORE-63, CNCORE-70, CNCORE-75). GHCR holds it. Nothing runs.
3. **A compose file and a README section** that a stranger could follow on their own machine
   (CNCORE-64). Somebody else's machine, if they ever choose to; not one of ours.
4. **A list entry** four months later (CNCORE-76), pointing at 1 and 2.
5. **Reading and writing surfaces** (CNCORE-65 to CNCORE-69, CNCORE-71 to CNCORE-74), every one of
   them asserted against a server that CI starts and stops inside a job.

"Self-hosted" in this spec is a property of the SOFTWARE — installable by someone else — and not a
description of where it runs. The distinction is the whole answer. Version one's own research
already said so and named the cost of the alternative: `docs/research/the-cheap-end.md:226` —
"**Nothing, this month.** ... Buying anything now buys capacity for a spec that has not started."

**Where CanonCore runs is the playback spec's question, entirely.** Not shared with this one, not
half-landed in it.

The two things worth carrying away beyond that:

- **CNCORE-64's install path has an unstated prerequisite that is not a host but will fail the same
  way**: nothing in CNCORE-63 or CNCORE-64 asserts the published image is anonymously pullable, and
  GHCR's documented default is private. The owner testing the install path would not notice. §6.
- **The one machine requirement in the spec is a BUILD machine, and the environment this repository
  develops in does not currently meet it.** Measured today: the Docker this worktree talks to is
  colima with 1.91 GiB and no buildx. That is a `colima start --memory 8` or a CI runner, not a
  purchase. §2.

---

## 1. Does any ticket require deploying or installing CanonCore onto a host?

**No.** The strongest criteria in the tree, quoted in full, are these four, and every one of them is
about a machine that follows a documented path once and then does not matter:

| Ticket | The criterion | What it needs |
|---|---|---|
| CNCORE-64 | "One documented command brings up the app and its database from a clean machine" | Any machine with a container runtime |
| CNCORE-64 | "The documented path was followed on a machine with no repository checkout, and worked" | The same, once |
| CNCORE-70 | "The documented install path was followed from a clean machine at the tagged commit and worked" | The same, once |
| CNCORE-75 | "The documented install path works from a clean machine at the tagged commit" | The same, once |

None of them says the instance stays up, gets a name, gets an address, or is reachable by anyone
else. **A host is a machine that keeps running, has a name and an address, and serves somebody. A
clean machine is any computer that can run one command.** CNCORE-60 asks for the second, four times,
and never for the first.

Everything else that sounds like deployment is a PUBLISH to somebody else's registry rather than an
install onto a machine of ours:

- CNCORE-62 — "A new public repository exists, seeded from the scrubbed tree, with a description".
  GitHub.
- CNCORE-63 — "CI builds on every pull request, smoke-tests the container over HTTP, and pushes only
  from the default branch". The smoke test runs inside the job, on the runner, and is thrown away
  with it.
- CNCORE-70 — "The image is published and pullable at that version". GHCR.

And the spec says the negative itself, in the sentence that would most easily have been fudged.
CNCORE-60, Out of Scope, on authentication: **"This effort ships a single-owner instance with no
login, exactly as version one did. The public repository is not a public instance."** The same
section puts "the public demo" out of scope outright, which is the only surface in the whole product
that is defined by being reachable (ADR-0097, via `docs/research/where-it-runs.md:33`).

Test seams agree, and they are where a hosting dependency would have to surface if one existed.
CNCORE-60's Testing Decisions name three: the existing `apps/web/e2e` suite which "builds the app,
serves it, and asks it for a page"; the `packages/config` meta-tests which read files in the tree;
and one browser job. CNCORE-73 puts the browser job inside the existing "page over HTTP" job for
cost. All three run on a GitHub runner. **No seam in this spec ever points at a URL it did not just
start.**

---

## 2. What machine does CNCORE-64's "no repository checkout" mean?

**A clean container or VM on the developer's laptop satisfies it, and that is what it means.** The
criterion is testing the INSTRUCTIONS, not a deployment. Read it against its neighbours: the other
five criteria on CNCORE-64 are README content, a sample environment file, and two meta-tests that
fail when the schema and the documentation drift apart. The sixth is the manual confirmation that
the five produce something that works when you have nothing but them.

"No repository checkout" is the precise thing under test, and it is precise for a reason: CNCORE-64
is blocked by CNCORE-63 because "the compose file references the published image". So the path is
`fetch a compose file, pull an image, set the variables the README names, run one command` — with no
`pnpm install`, no source tree, no `packages/db/docker-compose.yml`. The nearest existing statement
of why that matters is the README's own developer path, which today starts from a checkout and a
corepack install and is therefore not an install path at all.

**Is anything ambiguous enough to send an implementer shopping for a server? One line, and it is in
CNCORE-63 rather than CNCORE-64:**

> The image build runs somewhere with buildx and more than 2 GB — the verification build was
> OOM-killed at 1.63 GiB RSS in a 2 GB VM

"Somewhere" plus multi-arch plus that ticket's "Multi-arch on NATIVE runners, not QEMU" could be
read as "provision an arm64 box". It should not be, and two measurements close it:

- **The 2 GB VM is this repository's own local Docker.** Measured 2026-09-11 from this worktree:
  `docker info` reports `colima | 29.5.2 | NCPU 2 | MemTotal 2053586944` — 1.91 GiB — and
  `docker buildx` answers `unknown command`. So the constraint is real and it is currently unmet,
  and the fix is a colima restart with more memory, on this Mac.
- **CI already exceeds it, and for free once CNCORE-62 lands.** GitHub's own runner reference, read
  2026-09-11: standard `ubuntu-latest` is 4 CPU / 16 GB for public repositories (2 CPU / 8 GB for
  private), the arm64 labels `ubuntu-24.04-arm` and `ubuntu-22.04-arm` are 4 CPU / 16 GB and are
  listed for public repositories, and "Use of the standard GitHub-hosted runners is free and
  unlimited on public repositories."

That second measurement is worth noting beside CNCORE-60's "CI is on a budget" paragraph, which was
written while every CanonCore repository was private. It is not this file's to change, and the
budget note stays true of `provider-wiki` and `provider-tmdb`, which ADR-0089 keeps private.

Nothing else in the eighteen is ambiguous in that direction. "Clean machine" appears three times and
never with a qualifier about reachability, uptime, address or ownership.

---

## 3. Is the Whatbox slot load-bearing for anything in CNCORE-60?

**No. It is load-bearing for one paragraph of one record, and that paragraph is about the playback
spec's shopping list.** The slot was bought under CNCORE-18, whose own text says the quiet part:
"Nothing in version one waits on this. CI runs Postgres as a service container on GitHub's runners."

What the slot bought was an answer to a question that turned out to be the wrong one, and the answer
now lives in ADR-0109:118-247. Post-CNCORE-61 that section argues from plan, price, region and what
the SSH session proved, and from nothing else. Searching the tree for the redacted hostname returns
only the CI guard that enforces its absence (`.github/workflows/ci.yml:113-132`, "The owner's personal
host is named in the tree ... the name is an invitation and proves nothing"). **That guard caught an
earlier draft of this very file**, which spelled the hostname out while describing the search for it,
which is a fair demonstration that it works. The argument survives the redaction intact
because the finding was never about that machine:

- The doubt it was bought to settle — `docs/research/the-cheap-end.md:173`, "the one thing that could
  sink row 1" — was **Postgres**, and Postgres was never the risk. ADR-0109:126-134.
- What it found instead is now a clause of the SHAPE, at the top of the record rather than in the
  vendor section: ADR-0109:7-9, "a process that needs no root **and that something starts again when
  the machine comes back**". ADR-0109:237-242 says so explicitly: "Nothing about the vendor question,
  and one clause of the shape".

Does that clause touch CNCORE-60? Only as a fact about a file the spec does not ship. The
development compose file carries `restart: unless-stopped` (`packages/db/docker-compose.yml:32`) and
a `healthcheck:`, and ADR-0109:180-189 measured both inert on a shared slot. That is a note for
whoever deploys, on the day there is a deployment. No CNCORE-60 criterion asserts anything about
restart behaviour, and CNCORE-64's install path is exercised once by hand rather than left running.

**So: entirely a playback-spec concern.** `docs/research/the-cheap-end.md:269` states its own
scope — "Nothing here needs a new record. It is a price correction to research, and the decision it
feeds belongs to the playback spec" — and ADR-0109:105-109 does the same for the rung: "Deliberately
not decided. Which rung beyond the entry plan, and when. That belongs to the playback spec, which is
the first spec that puts bytes anywhere."

One factual note, offered rather than acted on: the slot is a recurring GBP 11/month whose question
is answered and whose successor recommendation is the split rather than the slot
(`docs/research/the-cheap-end.md:230-237`). Whether it keeps running is a money decision for the
playback spec, not a CNCORE-60 dependency in either direction.

---

## 4. Which spec owns "where CanonCore runs"?

**`docs/research/where-it-runs.md` is correct as written, and the count is exact.** Its table at
lines 1393-1401 tags each of seven entries to the spec that forces it:

| Entry | Forced by, per the file |
|---|---|
| 1. The canonical HTTPS origin | **The playback spec.** Hard-blocks the clients spec. |
| 2. Which rung, and does it change the code | **The playback spec** |
| 3. A test environment, and what seeds it | **The playback spec** |
| 4. Where the backup goes | A later spec, not yet named |
| 5. One box or a split | The demo spec |
| 6. Rent now or wait | No spec. A money decision |
| 7. Where the provider repos deploy | Version one — a check, not a new decision |

Three of seven on playback: entries 1, 2 and 3, and the two named in the question are entry 1 (the
canonical HTTPS origin) and entry 2 (the rung). Confirmed, with two refinements neither of which
moves anything into CNCORE-60:

- **Entry 2's code half was already answered without a host, and answered NO.** The entry says the
  `basePath` half lands "in whichever slice first deploys the web app". ADR-0109:36-45 closed it in
  advance: "**`basePath` is NOT added**", on `CLAUDE.md`'s rule against a configuration option
  nothing reads. What was adopted instead is a coding rule — "a URL that the framework does not
  rewrite is never hand-built" — and ADR-0109:55-60 names the first live member of that class, the
  canonical at `apps/web/src/app/items/[id]/page.tsx:142`. It touches this spec as a constraint on
  how CNCORE-65, CNCORE-67 and CNCORE-68 write links, not as a machine.

  **An earlier version of this file said that rule was the only place hosting touches this spec, and
  building CNCORE-65 falsified it the same day.** That slice found `/` being prerendered at BUILD
  time, because it reads the catalogue but touches no request-time API: on self-hosted software that
  is a front page frozen at the moment the image was built, which no import would ever change. It is
  fixed with `connection()` and recorded as ADR-0117, "a read surface renders per request". The two
  are different kinds of evidence for the same claim and both are worth keeping: ADR-0109's is a rule
  about a host that does not exist yet, and ADR-0117's is a bug that would have shipped in the
  artefact. Neither is a machine. Both are consequences of the fact that a stranger runs the image.
- **Entry 3 is out of scope here by name.** CNCORE-60's Out of Scope lists "backup and restore" among
  the "Also out" items, so ADR-0048's forced test environment (ADR-0048:35-41, "somewhere to run a
  migration against a POPULATED database first is a requirement") does not arrive with this effort —
  even though this effort adds migration rungs (CNCORE-66's `pg_trgm`, CNCORE-74's `note`). Those
  rungs meet ADR-0047's gate where that gate already lives, which is CI: ADR-0047:35, "CI RUNS
  EMPTY-TO-HEAD EVERY RELEASE, as a gate".

`where-it-runs.md:1177` is the sentence that settles the ownership question outright: "**No entry
needs an ADR before version one ships.**" CNCORE-60 is the effort that ships version one's work to
strangers; it adds no entry to that list and answers none of them.

For completeness, the third file in the reading list agrees from the other side:
`docs/research/access-layer.md:803-805` — "**The playback spec absorbs login.** Entries 1, 2 and 5 all
land inside it" — which is the reason CNCORE-60 can ship "a single-owner instance with no login".
ADR-0115:33-36 restates the whole concentration as the reason THIS effort goes first.

**Plainly: the playback spec owns "where CanonCore runs".** CNCORE-60 owns "what somebody else can
install", and the two do not overlap.

---

## 5. Does CNCORE-60 need `canoncore.com` to resolve?

**No, and nothing in the spec breaks if it never does.** `git grep -n "canoncore.com"` returns
nothing: the domain appears in no record, no research file, no ticket and no line of code. There is
nothing to break.

The one place in the tree where an external URL is mandatory is CNCORE-76's submission file:
"`software/canoncore.yml` exists with `description`, `website_url`, `source_code_url`, `licenses`,
`tags`". awesome-selfhosted's own addition template, read 2026-09-11, says "all fields are mandatory
unless noted otherwise" and comments `website_url` as "URL of the software project's homepage".

**A repository URL is an accepted value for it, and commonly is one.** Measured 2026-09-11 against a
shallow clone of `awesome-selfhosted/awesome-selfhosted-data` at `master`, over all 1,346
`software/*.yml` entries:

- **314 entries (23%) set `website_url` identical to `source_code_url`.**
- **259 entries point `website_url` at a code-forge host** (github, gitlab, codeberg, a `git.*`).
- Examples: `onionshare.yml`, `homer.yml`, `black-candy.yml`, `filerise.yml`, `rss2email.yml`.

That is the list's own CI-validated data rather than an inference about it. So CNCORE-76 is
satisfiable with the GitHub repository URL in both fields, and the optional `demo_url` — the only
field that would need a running instance — is not among the five that ticket names, and the demo is
out of scope for this spec anyway.

MX records with no A or AAAA are a mail-only configuration and are exactly right for a domain that
is not yet serving anything. The day it needs to resolve is entry 1 of `where-it-runs.md` — the
canonical HTTPS origin — which is the playback spec's, and ADR-0109:94-96 already explains why the
domain rather than the address is the product's identity: "the move is a repointed A record rather
than a migration."

---

## 5a. The owner's intent, recorded because it dates the choice

Everything above is what the spec and the records say. This section is what the OWNER wants, which is
a different kind of claim and is marked as one. ADR-0109 carries an equivalent section for the same
reason, and says so in its own words: "Recorded because it dates the choice, not because it constrains
the product."

**Jacob intends to run CanonCore on the Whatbox slot he already holds, once CNCORE-60 and all its
children are done.** He also holds a written allowance from that vendor covering whatever he wants to
run on it, which is why the demo prohibition in `where-it-runs.md:1324` does not bind his account even
though the published AUP is unchanged for everyone else. CNCORE-81 exists to get both of those into
the records with a date and an author, because today they are a conversation rather than evidence.

**Nothing in this file derives that choice, and it should not be read as recommending it.** Three
things stay true beside it:

- **CNCORE-60 still needs no host**, which is the whole answer above. The intent changes the plan
  after this effort, not inside it.
- **The repo's own priced comparison still recommends something else.** `the-cheap-end.md:230-237`,
  written 2026-09-10: the recommendation "for when it does start" is the SPLIT, a ~GBP 4 VPS with root
  plus a Storage Box at GBP 2.09/TB, "unless Whatbox fixes cron". Same money, and what it buys is root,
  a systemd that restarts things, and storage that survives a later move.
- **One measured fact decides between them**, and it is the open half of CNCORE-81: nothing on a shared
  slot restarts a process after a reboot, because cron is refused by PAM and there is no systemd user
  session. If support fixes it, the slot satisfies all five clauses of ADR-0109's shape and the split
  is a pound wasted. If not, an always-on instance that needs a human after every host reboot is not
  always-on.

**And ADR-0109 makes this reversible by construction**, which is why recording an intent here costs
nothing: it commits to a shape rather than a vendor, the domain rather than the address is the
product's identity, and a move is "a repointed A record rather than a migration".

---

## 6. The one thing in the tree that does smuggle a dependency

Not a host. An unstated manual prerequisite, in exactly the class CNCORE-62 is careful to name twice
and CNCORE-63 does not name once.

**CNCORE-64's install path requires an anonymous pull of the image, and nothing asserts the image is
anonymously pullable.** CNCORE-63's eleven criteria cover the build, the runner stage, pnpm,
`.dockerignore`, migrations, the smoke test, both architectures, OCI labels, attestation, the Node
major and Dependabot. None of them says the published package is public. CNCORE-64's criteria say
the path "was followed on a machine with no repository checkout" — which the owner's own machine will
satisfy while logged in to `ghcr.io`, and a stranger's will not.

GitHub's own packages documentation, read 2026-09-11: "**When you first publish a package, the
default visibility is private and only you can see the package**", and "By default, if you publish a
package that is linked to a repository, the package automatically inherits the access permissions
(**but not the visibility**) of the linked repository." A public repository does not make its package
public.

Three things make this worth writing down rather than shrugging at:

1. **The failure is a false green.** The install test passes for whoever runs it and fails for the
   audience it exists to serve. It would most likely be found by a stranger, after the tag.
2. **The repository already knows the pattern, in the mirror image.** ADR-0089:62-64 requires each
   provider image's own CI to assert its package visibility on every publish and to fail "if the
   package's visibility ever stops reading `private`, because **a default is what a later click
   changes**". CanonCore's image needs the same assertion with the opposite value, and has no
   criterion asking for it.
3. **CNCORE-62 names two prerequisites of exactly this kind and gets them right** — the
   `TMDB_READ_ACCESS_TOKEN` secret that "is repository-scoped and does not travel", and the GHCR
   Manage Actions grant that is "a web-UI step with no API equivalent". This one belongs beside them.

Stated as a finding, not as an edit: **the tickets are not changed by this file.** Whoever picks up
CNCORE-63 or CNCORE-64 should carry it.

### ADR-0111 was bought with money this repository no longer spends

Not a hosting dependency either, and the largest thing this audit turned up.

ADR-0111 is `accepted`. It merged Typecheck, Lint, Build and the missing-`DATABASE_URL` guard into
one `static-checks` job, overriding a principle the workflow stated in its own words — "Separate
jobs, so a red check names the thing that broke rather than making someone open the log to find
out" — and it bought that override with money: "The stakes are the allowance rather than the money.
GitHub Free gives this organisation 2,000 **private-repo** minutes a month."

CNCORE-62 made this repository public. GitHub's Actions billing documentation, read 2026-09-11:
"GitHub Actions usage is free for self-hosted runners and for public repositories that use standard
GitHub-hosted runners", and "The use of standard GitHub-hosted runners is free: In public
repositories." **The saving ADR-0111 measured — 2.98 minutes off a 13.4-minute run, 24% of what CI
cost — is now exactly zero here.** What remains is the trade, still being paid, buying nothing.

It reaches forward twice inside this spec: CNCORE-73 justifies folding the browser job on "~37-48s
of paid headroom", and CNCORE-60's Further Notes says "CI is on a budget" and "the lever is job
count". Both were measured while this repository was private, and the same clause makes the arm64
half of CNCORE-63 free as well: `ubuntu-24.04-arm` and `ubuntu-22.04-arm` are standard runners at
4 CPU / 16 GB, listed for public repositories.

The arithmetic still holds where it was taken, since `provider-wiki` and `provider-tmdb` stay
private under ADR-0089 and keep billing against the 2,000. **Filed as CNCORE-80**, which corrects
the record in the sentences that are false and splits the named checks back out.

### ADR-0109's one rule reached no ticket that needed it

Measured across all eighteen children on 2026-09-11: **ADR-0109 is cited by exactly one of them,
CNCORE-61, and there only as a file to scrub a hostname out of.** CNCORE-65 cites ADR-0094 and
ADR-0114, CNCORE-67 cites ADR-0066 and ADR-0077, CNCORE-68 cites ADR-0033. None of the three
surfaces that will write links carried the rule that governs how they write them.

CLAUDE.md makes a proposed record binding whether or not a ticket names it, so this is not a licence
to ignore it. It is a question of reach: with 116 records, nobody reads all of them per ticket, and
a rule no ticket names is a rule the implementer does not meet. Fixed by messaging the live CNCORE-65
worktree, which put the citation at the call site in the shell the other surfaces copy, and by a
tracker note on CNCORE-66, CNCORE-67 and CNCORE-68 carrying both this rule and ADR-0117.

### Two smaller things, neither a hosting dependency

- **The redaction is complete in the tree and not on the tracker.** CNCORE-61 removed the hostname
  from the repository and `.github/workflows/ci.yml:113-132` keeps it out, scanning the tree only.
  CNCORE-18's Linear description still contains it. Linear is private, the ticket is `Done`, and
  CNCORE-61's scope was the tree — so this is an observation about where the guard reaches, not a
  defect in what landed.
- **CNCORE-60's own spec text is clean on hosting.** Its Implementation Decisions never mention a
  deployment, and the only appearance of the word "instance" is the sentence disclaiming one.

### What this audit changed

Recorded so the file says what happened rather than what was proposed:

| Change | Where |
|---|---|
| GHCR visibility assertion and the manual web-UI step | Messaged the live CNCORE-63 worktree |
| ADR-0109 and ADR-0117 at the call site | Messaged the live CNCORE-65 worktree |
| The logged-out install run | CNCORE-64, appended criterion |
| Both coding rules | CNCORE-66, CNCORE-67, CNCORE-68, appended criteria |
| `website_url` is the repository URL | CNCORE-76, appended note |
| Correct ADR-0111 and split the checks back out | **CNCORE-80**, filed under CNCORE-60 |
| Pin what Whatbox permits and does, into the records | **CNCORE-81**, filed unparented |

**No ADR was edited by this audit and no ticket had text removed from it.** CNCORE-80 and CNCORE-81
carry the record changes as work for someone else to do, which is where a correction found by a
reader belongs.

---

## Sources

**Read 2026-09-11 from the tracker**: CNCORE-60 in full, and all eighteen children CNCORE-61 to
CNCORE-78, via `orca linear issue <id> --json`. Every criterion quoted above is verbatim from those
descriptions. CNCORE-18 for what the Whatbox slot was bought to answer.

**Read in the tree at the line numbers cited**: `docs/adr/0109-deployment-is-a-shape-not-a-vendor.md`,
`docs/adr/0104-one-container-a-database-per-worktree.md`,
`docs/adr/0047-migrations-are-a-forward-only-ladder.md`,
`docs/adr/0048-backup-and-restore-not-an-export.md`,
`docs/adr/0089-provider-distribution-tiers.md`,
`docs/adr/0115-the-public-release-comes-before-the-playback-half.md`,
`docs/research/the-cheap-end.md`, `docs/research/where-it-runs.md`,
`docs/research/access-layer.md`, `.github/workflows/ci.yml`,
`packages/db/docker-compose.yml`, `apps/web/src/app/items/[id]/page.tsx`, `README.md`.

**Measured on this machine 2026-09-11**: `docker info` (colima, 2 CPU, 2053586944 bytes, Docker
29.5.2) and `docker buildx version` (`unknown command`); `git grep` for `canoncore.com`, for the
redacted hostname, and for `whatbox`.

**Measured against upstream data 2026-09-11**: a shallow clone of
`github.com/awesome-selfhosted/awesome-selfhosted-data` at `master`, 1,346 `software/*.yml` entries,
counting `website_url` against `source_code_url`. Its `.github/ISSUE_TEMPLATE/addition.md` for field
mandatoriness.

**Read at vendor source 2026-09-11**: GitHub's GitHub-hosted runners reference for standard runner
specifications and the public-repository free-and-unlimited clause; GitHub's Actions billing page for
"GitHub Actions usage is free ... for public repositories that use standard GitHub-hosted runners";
GitHub's "Configuring a package's access control and visibility" for the default-private rule and the
permissions-not-visibility inheritance clause; GitHub's REST reference for organization packages,
whose nine endpoints include none that changes visibility.

**Not established, and stated rather than filled in**: the written allowance the owner holds from
Whatbox, which overrides that vendor's published Acceptable Use Policy for his account and is the
only thing standing between the AUP text and `where-it-runs.md:1324`. It is a document only he holds,
so it is named here as a gap and filed as CNCORE-81 rather than quoted from memory. Nothing in
CNCORE-60 reads that slot either way.
