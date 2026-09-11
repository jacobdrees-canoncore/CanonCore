# Two repos, one tracker

**Researched 2026-09-10.** ADR-0031 and ADR-0089 both put every provider we write in its own GitHub
repo. Nothing in this repo says how work that spans two repos is actually run: every tool, every
document and every ticket here assumes one ticket is one repo, one worktree, one branch, one PR.
CNCORE-6 and CNCORE-8 are both in version one and the organisation contains exactly one repo today.

It proposes. It decides nothing — the ADRs are Jacob's to write, and nothing here is one. No Linear
ticket was created, edited or moved in the course of it.

## How to read this

Section 0 is what the records already close, and the one thing they close that turns out to be
unsatisfiable as written. Sections 1-6 are the research, one per question, each claim carried back to
the source that owns it and dated. Two of them are measurements taken here rather than readings:
section 1 read the GitHub App installation, and section 2 ran the Orca binding against a scratch repo
outside the organisation. Section 7 is the decision list, ranked by when each blocks something.
Section 8 says what changes. Section 9 records what was decided the same day, including the ten
decisions no entry anticipated — the entries themselves are left as proposed, each with a `Decided`
note.

Where a claim is a measurement, the command that produced it is given. Where a claim could not be
established it is marked as a gap rather than filled in.

---

## 0. What is already closed

| Question | Record | What it settles |
|---|---|---|
| Where does a provider live? | ADR-0031 | "Every provider we write lives in its own repo — separate deploy, separate lifecycle, no shared code." |
| Why a repo rather than a convention? | ADR-0031, ADR-0089 | "the repo boundary is what makes the decoupling real rather than a convention." Both records carry the paragraph. |
| Which provider is first? | ADR-0069 | The archive's own wiki, because it needs no key, no rate limit, no cache rule and no attribution string. |
| Can the wiki provider ever be distributed? | ADR-0089 | No. Licensed to one person, so it is tier 3 and pinned there: "never bundled, never in the store, never pointed at by another instance." |
| Where can it run? | ADR-0057 | Where the archive is. The 1.8GB DuckDB file "is queried, never vendored". |
| How does the app reach it? | ADR-0034 | A provider base URL is a CONFIG URL and travels the ALLOWLIST path. Loopback is not exempt from the content deny-list, which is why the allowlist is the route. |
| What is the app scaffolded with? | ADR-0053 | create-better-t-stack, next / self / orpc / postgres / drizzle / auth none / turborepo / docker, then owned outright. **Status `accepted`** — the only one of these that is built. |
| How does the system grow? | ADR-0051 | Vertical slices, each demoable alone. And when an audit says the work is larger than expected, cut scope inside this repository. |
| Is GitHub Issues the tracker? | `docs/agents/issue-tracker.md` | No, and it "should be disabled at the repo level ... so the decision is structural rather than documentary". |
| Who moves a ticket's status? | `docs/agents/issue-tracker.md` | The PR, not a person: "Do not set these states by hand ... setting it manually hides whether the linkage actually works." |

### One closed rule that a provider-repo ticket cannot satisfy

`CLAUDE.md` says: **"A ticket is not done until the ADRs it implements read `accepted`."** CNCORE-6
carries it as its own last acceptance criterion, verbatim: *"each is flipped to `accepted` in
`docs/adr/`"*.

`docs/adr/` is in the CanonCore repo. A PR in the provider repo cannot edit it.

So CNCORE-6 as it stands cannot be completed by any single PR in any single repo, whatever anyone
decides about splitting. That is not a preference about ticket granularity; it is a contradiction
already present in the ticket, and section 3 treats it as the forcing argument rather than as one
consideration among several.

### What is therefore genuinely unspecified

1. Whether a PR in a second repo moves a CNCORE ticket at all.
2. Whether Orca's worktree-to-ticket binding survives crossing a repo.
3. Whether one ticket may span two repos, and what it costs either way.
4. What CNCORE-6 and CNCORE-8 become if it may not.
5. Whether standing up a provider repo is worth a skill, and where one would live.
6. What a provider repo is built with. **ADR-0053 does not reach it and nothing else does.**

---

## 1. Does Linear PR automation reach a second repo?

Load-bearing, because `docs/agents/issue-tracker.md` forbids the manual fallback. If a PR in the
provider repo does not move a CNCORE ticket, the flow does not degrade gracefully — it degrades into
exactly the thing that document prohibits.

### 1.1 The installation, read rather than assumed

`gh api /orgs/jacobdrees-canoncore/installations`, 2026-09-10:

| Field | Value |
|---|---|
| `total_count` | **1** |
| `app_slug` | `linear-code` |
| `app_id` / installation id | 1658531 / 158808354 |
| `target_type` | `Organization` |
| `repository_selection` | **`all`** |
| `created_at` | 2026-09-03T17:04:16+01:00 |

Permissions include `pull_requests: write`, `contents: write`, `issues: write`, `checks: read`,
`statuses: read`. Subscribed events (17) include `pull_request`, `pull_request_review`,
`pull_request_review_comment`, `pull_request_review_thread`, `check_run`, `check_suite` and `status`.

**`repository_selection` is `all` and there is no stored repository list.** That is the mechanism by
which a second repo is covered: an `all` installation is scoped to the account, and a `selected` one
carries a list you have to add to. The organisation-level scope is what makes this a non-event rather
than a step.

### 1.2 One of the two apps Linear names is not installed, and automation works anyway

Linear's own GitHub documentation (read 2026-09-10) says: *"We support both the Linear application and
Linear Code, that support access to your codebase. Both of these are necessary for maintaining
comprehensive Github functionality."*

Only `linear-code` is installed here. The classic `linear` app is absent from the organisation.

That did not stop PR automation, measured rather than reasoned:

- PR #13 on `jacobdrees-canoncore/CanonCore` is a **draft**, on branch
  `jacobdrees/cncore-13-lockfile` (`gh pr view 13 --json headRefName,isDraft,state`).
- CNCORE-13 is in state **In Progress** and carries one attachment, titled with the PR's own title,
  pointing at that PR (`orca linear issue CNCORE-13 --full --json`).

So the draft-PR → In Progress rule fires, and the attachment is created, through `linear-code` alone.

**Stated as a gap rather than resolved:** what "comprehensive" covers that this installation does not
was not established. The half the project needs demonstrably works; whether some other half is
missing is unmeasured. Nothing in version one depends on the answer.

### 1.3 A private repo is not an obstacle

`gh repo list jacobdrees-canoncore` returns exactly one repo, `CanonCore`, `isPrivate: true`. The
automation above fired on it. The wiki provider's repo is private forever under ADR-0089, and this
settles that the privacy is irrelevant to the linkage — measured on the one private repo that exists,
rather than inferred from the app's permission set.

### 1.4 Linear's side is a team setting, with no repository dimension at all

From Linear's GitHub documentation, read 2026-09-10:

- Linking is by **branch name** carrying the issue id, or a **magic word plus the id in the PR title
  or description** (*"Use a magic word + issue ID in the PR description or title (for example,
  `Fixes ENG-123`)"*).
- Automation lives at `Settings > Team > Workflows & automations > Pull request and commit
  automations`. *"Since this is a team setting, it must be configured for each team in your
  workspace."*
- Repository selection happens **during GitHub App installation**, not inside Linear. The
  documentation describes no way to restrict which repositories a team links PRs from, and no
  per-repository configuration inside Linear.

The consequence is the answer to this section: **there is nowhere in Linear to say "this repo,
not that one"**, so PR automation is not repo-scoped and reaches a second repo the moment the
installation covers it. It is scoped to a team, and the team is unchanged.

### 1.5 The "one repo per Linear team" limit is a different feature, and the brief is right about it

`docs/agents/issue-tracker.md` lists it under "Rejected alternative: GitHub Issues two-way sync", and
Linear's documentation confirms the reading verbatim:

> "Multiple repositories can be connected to create issues to a single Linear team through one-way
> sync when issues are created in GitHub. However, only one repo can be configured for two-way sync
> at a time."

That is configured in a different place (GitHub integration settings → GitHub Issues section, pairing
one repo to one team) from PR automation (team workflow settings, no pairing). Issue sync is
deliberately off here. It constrains nothing about provider repos, and the temptation to read it as
"Linear only handles one repo per team" is the trap the brief flagged.

### 1.6 What is not established, and the cheap way to close it

**GitHub's own documentation does not say, in so many words, that "All repositories" covers
repositories created later.** The only sentence found on the point is narrower and about a different
case: *"If the GitHub App creates any repositories later, the app will automatically be granted access
to those repositories as well."* A code search of `github/docs` for the phrase "all current and future
repositories" returns three files, none about GitHub Apps.

So the claim in 1.1 rests on the API's shape — an `all` installation stores no repository list to fall
out of — rather than on a quotable line. That is weaker evidence than the rest of this section and it
is marked as such.

It is also not worth resolving on paper, because the resolution is twenty seconds of the run that
creates the repo: re-read `gh api /orgs/jacobdrees-canoncore/installations` (expect `all`, still one
installation), then open one draft PR carrying `cncore-N` in its branch name and watch the ticket
move. That is step 16 of `setup-orca-linear-project`, unchanged, and section 7 entry 1 puts it on the
first provider-repo ticket as a criterion rather than leaving it as a hope.

### 1.7 The thing that will actually break it, and it is not the installation

The linkage keys on the identifier appearing in the branch name. Orca derives the branch from `--name`
and the repo's `gitUsername`, and a repo registered with `orca repo add` alone has no `gitUsername`:

- CanonCore, with `gitUsername: "jacobdrees"` → `jacobdrees/cncore-13-lockfile`.
- The scratch repo of section 2, with `gitUsername: ""` → `probe-cncore-6`.

Both contain the identifier, so both would match. The failure is a worktree named something that does
not carry `cncore-N` at all. Setting `gitUsername` on the new repo
(`orca project setup-update --setup <id> --git-username jacobdrees`, step 11 of the existing skill)
makes the branch shape identical to CanonCore's and removes the question.

---

## 2. Does the Orca binding work cross-repo?

Verified rather than reasoned about, on a scratch git repo in the session scratchpad with **no GitHub
remote at all** — which is a harder test than another repo in the same organisation, because it
removes every path by which Orca could be inferring the Linear link from the repository's identity.

### 2.1 The chain, measured end to end

```
orca repo add --path <scratchpad>/cross-repo-probe
  → repo 8ff2f032-… ; no gitRemoteIdentity field at all ; gitUsername ""

orca worktree create --repo id:8ff2f032-… --name probe-cncore-6 \
                     --linear-issue CNCORE-6 --no-parent --setup skip
  → linkedLinearIssue: "CNCORE-6"          ← the binding is accepted

orca terminal create --worktree id:8ff2f032-…::<path> \
                     --command "orca linear issue --current --json > …"
  → ok: true ; identifier CNCORE-6 ; team CNCORE ; full description, comments and relations
```

**Both halves of the question are yes.** `--repo id:<other-repo> --linear-issue CNCORE-6` binds, and
`--current` then resolves the whole ticket from inside that worktree.

The binding is worktree metadata plus a workspace-wide Linear connection; the repository's git
identity is never consulted. `linkedLinearIssueWorkspaceId` and `linkedLinearIssueOrganizationUrlKey`
are `null` on **every** bound worktree in this Orca install, CanonCore's two live ones included, so
their being null is not a signal of anything.

CNCORE-6's `updatedAt` was `2026-09-10T14:14:11.215Z` before the probe and unchanged after it, and
its attachment count stayed at zero: **binding a worktree writes nothing to Linear.** The attachments
on CNCORE-13 and CNCORE-5 were created by their PRs, not by their worktrees.

### 2.2 The trap, which produced a false negative inside this research

`--current` resolves from the **caller terminal**, not the working directory.

Running `orca linear issue --current` after `cd`-ing into the probe worktree returned
`linear_no_linked_issue: "The current worktree is not linked to Linear."` — while `orca worktree
current` in the same shell correctly reported the probe worktree and its `linkedLinearIssue`. The
shell belonged to this worktree, which has no ticket, and that is what `--current` answered about.

The environment variable that carries it (`ORCA_WORKTREE_ID`) cannot be overridden either:

```
linear_permission_denied: "The provided Linear worktree context does not match the caller terminal."
```

So the only way to run `--current` for a worktree is from a terminal Orca created in it — the one
`--agent claude` launches, or one from `orca terminal create --worktree …`. **The normal dispatch
path in `CLAUDE.md` is unaffected**, because the agent gets that terminal. Anyone checking the binding
by hand from another worktree will get a false negative and conclude the cross-repo link is broken.
It is not.

### 2.3 Two smaller findings from the same run

- **`orca linear attach` is repo-agnostic by construction.** Its signature is
  `--url <absolute http(s) link>` with no repository parameter, so attaching a provider-repo PR to a
  CNCORE ticket needs nothing new. Per `docs/agents/issue-tracker.md` this is not what moves the
  state, and should not become the fallback that hides a broken linkage.
- **`orca repo add` has no inverse.** There is no `orca repo remove`. The command that undoes it is
  `orca project setup-delete --setup <repo-id>`, whose own help says *"Repo-backed setups remove the
  registered repo compatibility record"*. And `orca worktree rm --force` leaves an empty
  `<workspace>/.orca-worktree-trash` directory behind. Both were used to clean up this probe; the
  registry is back to four repos and `~/orca/workspaces/cross-repo-probe` is gone. Worth knowing
  before registering a repo you intend to throw away.

---

## 3. Should every cross-repo ticket be split?

Two questions travel together here and they are separable: how many **tickets**, and how many
**teams**. Jacob has proposed yes to the first and raised the second mid-flight.

### 3.1 The argument that settles the first, and it is not about tooling

Section 0 already has it: `CLAUDE.md`'s done rule requires the ADRs a ticket implements to read
`accepted`, `docs/adr/` is in the CanonCore repo, and a provider-repo PR cannot edit it. CNCORE-6
carries that requirement as its own acceptance criterion. **The ticket as written has no single PR
that can close it.**

That is a structural fact rather than a preference, and it means the real question is not "should we
split" but "what owns the ADR flip". Splitting answers it cleanly: the app-side ticket owns the
records, because the app-side ticket is the one whose PR touches the file. Not splitting requires a
new rule saying which of a ticket's two PRs carries the flip, which is a rule nothing enforces and
nobody would remember.

### 3.2 What one ticket with two PRs does to the state machine, and why that is worse than it looks

The PR-driven state transitions in `docs/agents/issue-tracker.md` assume one PR. With two linked PRs,
whichever merges first fires the merge rule while the other is still open.

**Whether Linear moves an issue to Done when one of several linked PRs merges is undocumented.**
Linear's GitHub documentation states the mapping (*"we will move linked issues to 'In Progress' when
PRs are open and 'Done' when PRs merge"*) and says nothing about more than one. Neither its GitHub
integration page nor its PR-automation section addresses the case. Marked as a gap.

That gap is itself the argument. `docs/agents/issue-tracker.md` forbids setting these states by hand
*"setting it manually hides whether the linkage actually works"* — so the whole design rests on the
automation being observable and testable. A ticket whose final state depends on undocumented
multi-PR behaviour is one nobody can test, and version one's critical path is the wrong place to find
out empirically.

### 3.3 ADR-0051 objects less than it appears to, and the repo already has the shape

The argument against splitting is that a provider repo alone renders nothing, and ADR-0051 wants
slices that are demoable on their own.

CNCORE-3 is the precedent and its own words are exact: *"this is the prefactor every other ticket sits
on, and it is deliberately not a vertical slice."* It was accepted, worked and closed on that basis.
So the repo already has a shape for a ticket that renders nothing: a named prefactor, justified by the
slice sitting on it.

**What is proposed here is not two half-slices. It is one prefactor plus one vertical slice** — the
CNCORE-3 shape applied a second time. The test that keeps ADR-0051 honest survives it: the second
ticket of each pair is still demoable alone, because it renders a real story imported through a live
provider, which is exactly what CNCORE-6 promises today.

One thing the split does **not** touch: CNCORE-2's stop condition 1 counts *"two working providers,
each in its own repo"*. It counts providers and repos, never tickets.

### 3.4 What it costs, stated rather than discovered

- **Four tickets where there were two**, and the frontier is recomputed by hand after every merge
  (`CLAUDE.md`: *"because no DAG is doing it here"*). Two more worktrees, two more draft PRs, two more
  `/code-review` runs.
- **A real serialisation becomes visible.** The app-side ticket cannot be reviewed until the provider
  is reachable, so a provider deploy — even a local container — has to exist before the second PR of
  each pair means anything. The un-split ticket did not avoid that; it hid it inside one ticket.
- **A second CI setup**, per repo, that nothing in this repo currently describes.

And one cost that runs the other way, which is the strongest practical argument for splitting rather
than against it: **the provider-repo half of CNCORE-6 has no dependency on CNCORE-4 at all.** CNCORE-6
is blocked by CNCORE-4 ("An item on a page") because its rendering half is. A standalone HTTP service
that reads DuckDB and answers `search` and `lookup` needs nothing from the app. Splitting takes the
provider repo off that edge and lets it run in parallel with CNCORE-4 — and lets the TMDB provider repo
start as soon as the wiki repo lands, rather than waiting for the wiki's rendering half. On a graph
this narrow that is not a small win.

### 3.5 Same workspace, different team?

**What works.** Linear's documentation confirms sub-issues can belong to any team in the workspace,
not only the parent's, and relations cross teams within a workspace. So CNCORE-2 could parent tickets
in a second team and the blocking edges would hold. Team keys cap at 7 characters (`CLAUDE.md`), so
`CMPP` or `PROV` would be accepted.

**What it costs, and this is the deciding one.** Section 1.4 established that PR automation is a
*team* setting. A new team starts with Linear's defaults — In Progress on open, Done on merge — not
this project's four-rule mapping, and `setup-orca-linear-project` step 10 records that this exact
settings page is where *"`orca click` does nothing here and still reports success"* because the
controls are Radix `Select` triggers needing a trusted pointerdown. A second team is therefore a
second place for precisely the automation this file exists to protect to be silently wrong, and its
own auto-close settings to be silently wrong alongside it.

**What else it costs.** `orca linear list-issues --team CNCORE` and `docs/agents/issue-tracker.md`'s
frontier recipe are team-scoped, so the frontier splits across two commands. `CLAUDE.md`,
`docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` all name team `CNCORE` and its
identifier shape, so three documents change.

**What it buys.** Nothing the blocking relation does not already give. A Linear team is an audience
and a workflow; provider tickets have the same audience (one person) and the same workflow (this spec,
this cadence) as everything else in version one.

**So: one team.** The trigger that would change the answer is a permissions one rather than a tidiness
one — a provider repo gaining a contributor who should not see the app backlog, or a provider gaining
a release cadence independent of CanonCore's. Neither is true today and neither is on version one's
path.

**The cheap version of the same idea, if the separation is wanted for viewing rather than for
workflow:** a workspace label, `provider-repo`, on the provider-side tickets. Labels here are
workspace-level (`docs/agents/triage-labels.md`), it costs one `orca linear label add` per ticket and
no settings page, and it does not split the frontier. It is proposed as the option, not recommended
over doing nothing.

### 3.6 The rule this generalises to, and the ticket it catches that nobody named

If the split is adopted it is a rule, not two edits — and it catches a third ticket.

**CNCORE-7, "Browse imports a container and its ordering", is also cross-repo.** Its first acceptance
criterion is *"`browse` returns a container and its ordering, and the app creates placements from
it"*: the first clause is a change in the wiki provider's repo, the second is app-side, and its last
criterion is the same ADR flip. It is blocked by CNCORE-5 and CNCORE-6 today.

Section 4 drafts CNCORE-6 and CNCORE-8 because that is what the brief asked for. CNCORE-7 is flagged
here rather than drafted, because whether the rule applies to it is part of the same decision and
Jacob should take both at once rather than discover the second one later.

---

## 4. If split, what do CNCORE-6 and CNCORE-8 become?

Four tickets. **Nothing here has been filed.** Numbers are written as A, B, C, D because Linear
assigns them; the pairing and the edges are the proposal.

Each provider-repo ticket carries no ADR flip, by section 3.1. Each app-side ticket carries the flips
for the pair.

---

### A — "The wiki provider repo, answering `search` and `lookup`"

**Repo:** a new private repo in `jacobdrees-canoncore`. **Not a vertical slice**, deliberately, in
the sense CNCORE-3 established: it renders nothing and the slice above it is what is demoable.

```markdown
## Parent

CNCORE-2

## What to build

The first CMPP provider, as a standalone HTTP service in its own repository. It answers `search`
and `lookup` over HTTP against the local archive, and declares a `versions` array.

This is a prefactor and it is deliberately not a vertical slice, in the sense CNCORE-3 established:
it renders nothing on its own. Ticket B is the slice that sits on it.

The provider is the archive's own wiki. It is first because it needs no key, no rate limit, no
cache rule and no attribution string, so the contract gets defined against a source we control
rather than a rate-limited third party (ADR-0069).

`lookup` is required because search is ambiguous forever: one title is routinely a TV story, a
novelisation and a character at once, so a refresh by search can silently rebind an item to the
wrong thing (ADR-0033).

**This provider is licence-pinned to one person and can never be distributed.** Permission to use
the archive was granted to Jacob, not to CanonCore, so under ADR-0089 it is tier 3 and stays there:
never bundled, never in the CMPP store, never pointed at by another instance. **The repository is
private and stays private.** That is a constraint on the repository, not only on this ticket.

## What this repo is, and is not

It shares no code with CanonCore and no code with the TMDB provider (ADR-0031). The response schema
is written here, and it will be written again in ticket C's repo. That is on purpose: the
anti-drift device is ticket D's contract test at the second seam, not a shared package.

ADR-0053's scaffold does not apply — there is no Next app, no UI package, no Drizzle and no
Turborepo here. See `docs/research/multi-repo.md` §6 for what was researched instead and why oRPC
in particular is the wrong tool for a contract a third party must be able to implement.

## The Cloudflare 403 is expected, and there IS a door we are choosing not to use

`tardis.wiki` returns `cf-mitigated: challenge` with a CSP pointing at `challenges.cloudflare.com` —
an UNSOLVED JS CHALLENGE, not a block (verified 2026-09-10 on both `/wiki/` and `/api.php`). That is
stronger evidence than a bare 403 for the thing the model actually claims: permission and technical
access are separate, and we hold the first.

Sanctioned routes past it exist and are documented. We take none of them, because the local archive
is the backend in development and CI anyway. Do not scrape it from CI, and do not switch to the
Fandom mirror — the mirror is a DIFFERENT wiki, so its data and the test fixture would silently
diverge.

## Where it runs

Where the archive is (ADR-0057), which `docs/research/where-it-runs.md` entry 7 puts on the rented
box alongside CanonCore. That makes its base URL loopback or a private container address, which
travels ADR-0034's ALLOWLIST path as a config URL — never the content deny-list, where
`127.0.0.0/8` is `loopback` and correctly refused. Ticket B builds that half; this ticket only has
to not assume a public hostname.

## Acceptance criteria

- [ ] The repository exists in the CanonCore organisation, is private, has GitHub Issues disabled, and is registered with Orca
- [ ] **One draft PR in this repository moves this ticket to In Progress, proving the Linear linkage across repos before anything depends on it**
- [ ] It answers `search` and `lookup` over HTTP and declares a `versions` array, absence meaning the first version
- [ ] It reads the archive read-only and holds no writable handle on it
- [ ] It declares its cache ceiling, stored image variant, per-role image limit and quality floor
- [ ] `browse` is absent and undeclared, and the service is valid without it
- [ ] The CI network gate throws on unexpected egress, proven by a test that expects the throw, and is built on undici's `MockAgent.disableNetConnect()` rather than nock
- [ ] CI runs against a fixture, never the network and never the full archive
- [ ] The repo carries its own `CLAUDE.md` naming Linear team `CNCORE` as its tracker and `docs/adr/` in the CanonCore repo as its decisions

## Blocked by

Nothing. This is the finding that splitting produced: CNCORE-6 is blocked by CNCORE-4 because its
rendering half is, and a standalone HTTP service needs nothing from the app.
```

---

### B — "One item imported through the wiki provider, rendered"

**Repo:** CanonCore. **A vertical slice**, and the one that keeps ADR-0051 satisfied for the pair.

```markdown
## Parent

CNCORE-2

## What to build

A real story, imported from the wiki provider over HTTP, rendered on its page with the provider
recorded as its source.

This is the vertical slice of the pair; ticket A is the prefactor it sits on. Everything here is in
the CanonCore repository.

## Two outbound boundaries, and how to build them correctly

A provider base URL is configuration the owner typed, so it is checked against an ALLOWLIST of exact
hosts and CIDRs with no wildcards — which is what makes a loopback or tailnet provider legal by name
rather than as an exception to a rule that forbids it.

**Anything arriving in a response body or a redirect gets denied by RANGE CLASSIFICATION — not by an
enumerated CIDR list.** Refuse any address whose range is not the `unicast` catch-all.

`unicast` **is** `ipaddr.js`**'s word, not IANA's** (CNCORE-11, and ADR-0034 now says so). IANA's
registry classifies by Source, Destination, Forwardable, Globally Reachable and Reserved-by-Protocol
and never says `unicast`. Do NOT "improve" this into "refuse anything whose Globally Reachable is
False": that misses `224.0.0.0/4` entirely (multicast is a different registry), misses
`192.88.99.0/24` (empty value, not `False`), and **lets** `127.0.0.0/8` **through, because its value
is the literal string** `False [1]` **with a footnote marker in it**. ADR-0034 records the rejection
with the measurements. Implementing OWASP's published table literally ships a hole: it lists only
`::1/128` and `ff00::/8` for IPv6, while AWS publishes `[fd00:ec2::254]` and GCP publishes
`[fd20:ce::254]` as live metadata endpoints — both ULA in `fd00::/8`. It also omits `fc00::/7`,
`169.254.0.0/16` as a range, and `100.64.0.0/10`. Classification catches all of them and the next one.

**Pin the connection via the client's DNS** `lookup` **hook**, validating every address it returns.
Rewriting the URL host to an IP breaks SNI — `servername` "must be a host name, and not an IP
address" — so that route silently degrades certificate validation while appearing to work. Check
EVERY A and AAAA record, not the first: Node now defaults `autoSelectFamily` to true.

**We follow redirects and re-validate each hop**, which departs from OWASP's advice to disable
redirect following entirely. Deliberate: a provider that redirects is ordinary.

## Acceptance criteria

- [ ] The app imports one real story through ticket A's provider over HTTP and renders it
- [ ] Every imported value carries the provider as its source
- [ ] A provider base URL is validated against the allowlist, and a loopback base URL is reached that way rather than by loosening the content deny rule
- [ ] Content URLs are denied by range classification — anything not the `unicast` catch-all — rather than by an enumerated CIDR list, and the implementation names `ipaddr.js` as the vocabulary rather than attributing `unicast` to IANA
- [ ] Connection pinning uses the client's DNS `lookup` hook and preserves SNI and certificate validation
- [ ] Every A and AAAA record is validated, not just the first
- [ ] Ship no API keys: the instance supplies its own credentials
- [ ] The ADRs this ticket and ticket A implemented are listed here, and each is flipped to `accepted` in `docs/adr/`

## Blocked by

* CNCORE-4 (an item on a page)
* Ticket A (the wiki provider repo)
```

---

### C — "The TMDB provider repo"

**Repo:** a second new repo in `jacobdrees-canoncore`. **Not a vertical slice.**

```markdown
## Parent

CNCORE-2

## What to build

The second CMPP provider, in its own repository, answering the same contract as ticket A's against a
rate-limited third-party API.

TMDB was challenged and upheld: a cheaper second provider would satisfy the contract test
identically, and TMDB carries every expensive thing here — but the demo needs it, the licence work is
fully specified rather than vague, and doing it inside version one means it is proven rather than
pending. Do not re-argue it.

**Satisfies stop condition 1** (two working providers, each in its own repo), together with ticket A.

## The licence obligations, checked against TMDB's own terms on 2026-09-10

* **Caching is a CEILING of six months**, not an obligation to hold one, and it covers "any
  information" — a cached poster and a cached runtime are treated identically. Expiry is a READ-TIME
  check against a `max_cache_age` the provider DECLARES, so licence correctness never depends on a
  scheduled job having run.
* **The attribution notice must be verbatim and prominent**, and the TMDB logo less prominent than
  ours.
* **The image-hosting prohibition is BROADER than a narrow ad ban**: "as an image hosting service for
  banner advertisements, graphics, **etc.**" — the trailing "etc." widens it, which supports storing
  the bytes rather than hotlinking more strongly than a narrow reading would.
* **There are TWO AI clauses, not one.** Paragraph 2.A lists AI and LLM query-response systems as a
  commercial-use example, escapable by written agreement. Paragraph 1.C carries a SEPARATE,
  unqualified prohibition with no escape offered: "Use the TMDB APIs or TMDB Content in connection
  with, including for training, a machine learning (ML) or artificial intelligence (AI) based
  Application." Our reading is that it does not bite — CanonCore is a catalogue, not an AI-based
  application, and building software with AI tooling is not using TMDB Content in connection with
  one. Recorded because it was missed once.

## Auth and rate limits

**Use the API Read Access Token as a Bearer header**, not the legacy `api_key` query parameter.
TMDB's auth docs say "the default method to authenticate is with your access token" and every current
sample uses it. `api_key` still works, but a query-string secret ends up in logs and referrers.

**Assume nothing about rate-limit headers.** TMDB's rate-limiting page names none: it says only
"somewhere in the 40 requests per second range" and "respect the `429`". A live request returned no
`x-ratelimit-*` and no `retry-after`. The `X-RateLimit-*` family and the 40-per-10-seconds figure
belong to a regime disabled in December 2019 and are still repeated by third parties. Treat the 429
as the only signal and back off on it.

## No shared code, including with ticket A

This repo shares no code with CanonCore and none with the wiki provider (ADR-0031). The CMPP
response schema is written here for the second time on purpose. Resist a shared
`@canoncore/cmpp` package: it is exactly what the repo boundary exists to prevent, and ticket D's
contract test is the substitute.

## Acceptance criteria

- [ ] The repository exists in the CanonCore organisation, has GitHub Issues disabled, and is registered with Orca
- [ ] It answers `search`, `lookup` and `browse` over HTTP and declares a `versions` array
- [ ] Authentication uses the API Read Access Token as a Bearer header, not an `api_key` query parameter
- [ ] A 429 is handled as the sole rate-limit signal, with backoff, and no assumption of `Retry-After` or `x-ratelimit-*`
- [ ] `max_cache_age` is declared by the provider, alongside its stored image variant, per-role image limit and quality floor
- [ ] Both AI clauses are recorded in the repo, with our reading of why 1.C does not bite
- [ ] It ships no key: the instance supplies its own credential
- [ ] The repo carries its own `CLAUDE.md` naming Linear team `CNCORE` as its tracker and `docs/adr/` in the CanonCore repo as its decisions

## Blocked by

* Ticket A (the wiki provider repo) — the contract is defined against the wiki first (ADR-0069), not
  against a rate-limited third party. It is NOT blocked by ticket B: the second provider does not
  need the first one's rendering half.
```

---

### D — "TMDB in the catalogue, and the contract test"

**Repo:** CanonCore. **A vertical slice**: a second provider's data on a page, with which provider
said what visible.

```markdown
## Parent

CNCORE-2

## What to build

The app reaching ticket C's provider, and the test that proves CMPP is a contract rather than two
bespoke integrations.

**Satisfies stop condition 4.**

## Where the contract test lives, and why here

It runs at the SECOND SEAM: it calls `search`, `lookup` and `browse` on each provider DIRECTLY over
HTTP and asserts the same response shapes, the same claim structure and the same failure modes. It
must NOT run through the app — the app's provider layer would normalise both into one shape before
the assertion saw them, so it would pass whether or not the providers agreed, which is the exact
failure it exists to catch.

It lives in THIS repository rather than in either provider's, and that is a decision worth stating.
A test in provider A's repo that also calls provider B couples the two repos, which is what
ADR-0031 forbids. The contract is CanonCore's, so the test that owns it is CanonCore's. It reaches
both providers over HTTP like any other client.

An established tool was checked and ruled out: Pact's own documentation excludes this case on three
counts, and the JS "assert a response satisfies an OpenAPI spec" niche is dormant — last releases
2021, 2022 and 2023. The bespoke test is correct.

## Acceptance criteria

- [ ] The app imports through the TMDB provider and renders the result with its source recorded
- [ ] The attribution notice appears verbatim and prominently, with the TMDB logo less prominent than ours
- [ ] All content from one provider can be purged with a single operation
- [ ] A committed test calls both providers directly over HTTP and asserts identical contract behaviour
- [ ] That test fails if either provider diverges from the contract, demonstrated failing rather than assumed
- [ ] The test does not route through the app
- [ ] The ADRs this ticket and ticket C implemented are listed here, and each is flipped to `accepted` in `docs/adr/`

## Blocked by

* Ticket B (one item imported through the wiki provider, rendered)
* Ticket C (the TMDB provider repo)
```

---

### The edges, and the two that have to be repointed

```
CNCORE-4 ──────────────┐
                       ├──▶ B ──┐
A ─────────────────────┘        ├──▶ D ──▶ CNCORE-9
 └──────────▶ C ────────────────┘

CNCORE-5 ─┐
          ├──▶ CNCORE-7   (also cross-repo — see §3.6)
      B ──┘
```

- **A** is blocked by nothing. **B** by CNCORE-4 and A. **C** by A. **D** by B and C.
- **CNCORE-7** is currently `blocked-by` CNCORE-6 → repoint to **B**, and split it too if the rule is
  adopted (§3.6).
- **CNCORE-9** is currently `blocked-by` CNCORE-8 → repoint to **D**.
- CNCORE-6 and CNCORE-8 are then Canceled rather than deleted, per `docs/agents/triage-labels.md`
  (Canceled is what `wontfix` means here), with a comment naming their replacements.

---

## 5. Is a skill warranted, where does it live, and when is it written?

### 5.1 How much of the existing skill applies, and the pattern in what does not

`setup-orca-linear-project` has sixteen steps. Against "add a second repo to an organisation and a
Linear workspace that already exist":

| Applies | Does not apply |
|---|---|
| 2 create the repo (minus the org half) | 1 install Orca skills — already installed |
| 3 harden settings (`has_issues=false`, squash-only, Dependabot) | 4 create the workspace — exists, and prepaid |
| 11 `orca repo add`, `set-base-ref`, `--git-username` | 5 team key — `CNCORE` exists |
| 13 `CLAUDE.md` and `README.md` | 6 Triage off — already off |
| 15 templates (`.gitignore`, `ci.yml`, `dependabot.yml`, `.claude/settings.json`) | 7 four triage labels — workspace-level, exist |
| 16 verify end to end | 8 sample issues — workspace-level, done |
| | 9 GitHub integration — connected, org-wide, `repository_selection: all` (§1.1) |
| | 10 PR automation — a team setting, and the team is unchanged (§1.4, §3.5) |
| | 12 Orca Linear authorisation — done |

**The pattern is the finding: all three human stops live in the part that does not apply.** The Orca
authorisation, GitHub's sudo wall and the sample-issue deletion are steps 12, 9 and 8. So is every
browser step, and with them every gotcha in `browser.md` and every Radix `Select` that reports
success while doing nothing.

Standing up provider repo number two is therefore `gh repo create`, one `gh api -X PATCH`, one
`gh api -X PUT`, three `orca` calls, a scaffold, and the step-16 verification. No human stop, no
browser, no dialog. That materially changes the calculation, because the thing a skill would be
buying is small.

### 5.2 When it is written

**After the first provider repo, before the second.** Three reasons, and the third is the one that
decides it:

1. `CLAUDE.md` forbids speculative abstraction, and a skill written before the act has been performed
   once is exactly that. The same rule that says not to introduce a configuration option nothing
   reads says not to write a procedure nothing has run.
2. Section 5.1 shows the act is small enough to do by hand without the skill being missed.
3. **The genuinely uncertain part is section 6, and no skill can settle it before it has been built
   once.** A skill written now would either omit the scaffold — leaving out the only hard part — or
   guess at it and become wrong the first time it is run. `setup-orca-linear-project` is worth what it
   is worth precisely because its steps are things that were tried and failed; a skill with no such
   history is a checklist of hopes.

The counter, stated fairly: the second run is inside the same version one, so "before the second" is
soon, and there is a risk the capture never happens because the second run also goes fine. The
mitigation is cheap and belongs on ticket A rather than in a skill — a short "what actually bit"
section in the provider repo's own `CLAUDE.md`, written while it is fresh, which is then the raw
material the skill is assembled from before ticket C.

### 5.3 Where it lives, and why not this repo

**Global, `~/.claude/skills/`, beside `setup-orca-linear-project`.** Four reasons:

1. **A project skill in this repo's `.claude/skills/` is out of scope where half the work happens.**
   The provisioning is dispatched from the CanonCore worktree, so it would be in scope for that half —
   but the scaffold, the first PR and the CI all happen inside the provider repo's own worktree, where
   this repo's `.claude/` is not loaded. A skill that stops being available halfway through the act it
   describes is the wrong shape.
2. **The subject is provisioning, which is the existing global skill's whole subject.** A sibling
   belongs beside it, and `SKILL-MECHANICS.md`'s router pattern is available if the pair ever needs
   one.
3. **It is not CanonCore-specific.** "Add a second repo to an org and a workspace that already exist"
   is the general case; CanonCore is its first instance, not its subject. Putting the general case in
   one project's repo is the version that has to be copied the next time.
4. **The cost of global is the right cost.** Make it **user-invoked** (`disable-model-invocation:
   true`), as `setup-orca-linear-project` is: it only ever fires when a human types it, so it should
   pay cognitive load rather than permanent context load on every turn of every project.

### 5.4 What it should and should not carry

Applying `writing-for-agents`: the environment is a source of truth, and a document restating it is a
cache that earns its load only when the lookup is expensive.

**Do not carry** the CMPP contract (it is `docs/adr/0031`-`0033`, and a copy is drift waiting to
happen), the provider scaffold's file list (it is the provider repo's own tree), or the `gh` and
`orca` flags (they are `--help`).

**Do carry** what nothing else records, which is most of this file's measured half:

- `--current` resolves from the caller terminal, not the working directory, and the environment
  variable cannot be overridden (§2.2). This is the single most likely thing to send someone down a
  wrong path.
- `orca repo add` has no inverse; `orca project setup-delete --setup <repo-id>` is it (§2.3).
- The branch name must carry `cncore-N`; set `--git-username` so it looks like CanonCore's (§1.7).
- The ADR flip belongs to the app-side ticket, because `docs/adr/` is not in the provider repo (§3.1).
- The exact-pin trap on `@duckdb/node-api`, if the scaffold keeps it (§6.4).
- The verification is not optional and is the last step, because "configured is not working" applies
  doubly to a linkage nobody has yet seen cross a repo boundary (§1.6).

And one thing the act itself must produce that no existing document mentions: **the provider repo
needs its own `CLAUDE.md`**, and its most load-bearing line is that its tickets live in Linear team
`CNCORE` and its decisions live in `docs/adr/` in a *different repository*. A fresh agent in a
provider worktree has no other way to know either.

---

## 6. What is a provider repo built with?

The first wall CNCORE-6 hits, and the one that sets the shape for every provider after it. Nothing in
`docs/adr/` reaches it.

### 6.1 Why ADR-0053 does not apply, by its own terms

That record's argument for a generator is specific: the oRPC handlers are *"the longest thing here to
get right by hand"*, plus Tailwind's workspace boundary, plus not assembling handlers manually. It
survives a bespoke schema *"because there is nothing to rip out"*.

A CMPP provider has no Next app, no UI package, no Tailwind, no Drizzle, no Postgres and no
Turborepo. Here there is nothing to keep. ADR-0053 is `accepted` and correct about the app; it simply
does not reach this.

**oRPC specifically is the wrong tool, and this is the sharpest point in the section.** oRPC's value
is end-to-end TypeScript types across a boundary you own both sides of. ADR-0031 exists in order *not*
to own both sides: *"CanonCore knows only a URL, a credential and a validated response shape."* A
typed RPC client would recreate exactly the coupling the repo boundary is there to remove, and it
would do it in the most attractive possible way.

### 6.2 What the incumbent actually did, which is directly on point

Plex reopened custom metadata providers as a plain HTTP contract, which ADR-0031 already cites. The
announcement is by `drzoidberg33`, carrying a Plex staff flag (forums.plex.tv, read 2026-09-10):

> "metadata providers, these are as the name suggests, providers of metadata, and are just an HTTP API
> that returns metadata for library items in a standardized way"

> "Developers are not restricted by any one language or technology to write these providers,
> essentially anything that can serve an HTTP API can be used."

> "Distribution to users can also happen in any way you see fit, from local Docker containers, to
> self-contained binaries or publicly hosted on the internet."

That third quote is the deployment story for the wiki provider almost verbatim, and it corroborates
`docs/research/where-it-runs.md` entry 7 from a source that had never heard of it.

**Their own reference implementation is `plexinc/tmdb-example-provider`** — and it is TypeScript, and
it is a TMDB provider, which is as close to this exact problem as an external precedent gets. Its
manifest, read 2026-09-10:

| | |
|---|---|
| Language / runtime | TypeScript on Node, CommonJS, `@types/node ^24.7.0` |
| HTTP | `express ^5.1.0` |
| Outbound | `axios ^1.12.2` |
| Contract published as | `swagger-jsdoc` + `swagger-ui-express` |
| Tests | `jest ^30` + `supertest ^7` |
| Created / last push | 2025-10-07 / 2025-11-12 · 18 stars · no licence file |

**Take the shape, not the dependency list.** The shape is the precedent: a small TypeScript HTTP
service that publishes its own OpenAPI description and is tested at the HTTP layer. The dependency
list is not, and the reason is visible in the manifest — it carries `@anthropic-ai/claude-agent-sdk`
in `dependencies` alongside a `CLAUDE.md` and a `checklist.txt` in the repo root. It is an
agent-written example that has not been touched in ten months, not a maintained product, and its
picks carry no weight beyond existing.

### 6.3 Language: TypeScript on Node 24

The repo already owns the toolchain — Biome 2.5.12, Vitest 5, pnpm 12.3.4, TypeScript ^7.0.2,
`engines.node >=24` — so a TypeScript provider adds a repository, not a stack.

**The case for Python was weighed and is real but narrow.** DuckDB's Python client is its most mature,
and the wiki provider is a DuckDB reader. But the advantage applies to exactly one of the two
providers — TMDB touches no DuckDB at all — and the two must be built the same way, because together
they are the template for every provider after them. A second language would be a second toolchain, a
second CI shape, a second lint config and a second dependency policy, bought for one repo's data
layer.

**This is a judgement rather than a measurement, and it is recorded as one.**

### 6.4 The DuckDB client, and a pinning trap that is a real defect waiting to happen

Measured against the npm registry and the DuckDB repositories on 2026-09-10:

| | |
|---|---|
| DuckDB stable | **v1.5.5**, released 2026-07-22 |
| `@duckdb/node-api` | `latest` = **1.5.5-r.4**; second dist-tag `lts-v1.4` = 1.4.5-r.1 |
| `duckdb` (legacy) | `latest` = **1.4.4**; repo last pushed 2026-01-30; not archived; npm `deprecated` field empty |
| `duckdb-node-neo` repo | last pushed 2026-09-07, 196 stars |

The legacy package's own README settles which to use:

> "The original DuckDB <> Node.js bindings in this package are deprecated in favor of the new and
> shiny `@duckdb/node-api` package."

and says it will be released "for the last time for the DuckDB 1.4.x (~Fall 2025) series but *not* for
the DuckDB 1.5.x series (~Early 2026) any more." The registry bears that out exactly: legacy stops at
1.4.4 while DuckDB is at 1.5.5.

Worth noting that **the evidence is the README and the cadence, not a deprecation flag** — `npm view
duckdb deprecated` is empty and the repo is not archived. That is the same shape as ADR-0102's case
against `drizzle-zod`, and it is worth writing down for the same reason.

**Prebuilt binaries exist for every target that matters**, as `optionalDependencies` of
`@duckdb/node-bindings`: `linux-x64`, `linux-arm64`, `linux-x64-musl`, `linux-arm64-musl`,
`darwin-x64`, `darwin-arm64`, `win32-x64`, `win32-arm64`. So no compiler on the rented box, and Alpine
is available. The only non-platform transitive dependency is `detect-libc`.

**The trap, measured with semver 7.8.5 rather than reasoned about.** Every published version is a
semver PRERELEASE (`-r.N`):

```
^1.5.5      matched against 1.5.5-r.4 → NO MATCH        (matches 1.5.5 and 1.5.6, neither of which exists)
^1.5.5-r.4  matched against 1.5.5-r.4 → match
                                1.5.5-r.5 → match
                                1.5.6-r.1 → NO MATCH
                                1.5.6     → match       (does not exist)
```

So a caret range either misses every published release or silently freezes on the 1.5.5 line, and
neither failure announces itself. **The version has to be written exactly** — which is what DuckDB
itself does: `@duckdb/node-api@1.5.5-r.4` depends on `@duckdb/node-bindings` at exactly `1.5.5-r.4`,
no caret, and each platform package likewise.

ADR-0101's rule carries over — one place, and that place is the manifest or catalogue — but its
*form* does not: this is one of the pins that cannot be a range.

### 6.5 The HTTP layer, which is the weakest recommendation here

Candidates measured 2026-09-10: **Hono 4.13.7** (with `@hono/node-server` 2.1.1), **Fastify 5.12.3**,
**Express 5** (the Plex example's pick), or **`node:http`** with no framework at all.

**Propose Hono.** It is the smallest thing that gives routing and typed handlers, its
`app.request()` runs a handler in a test without binding a socket — which is what a CMPP contract
wants tested — and being web-standard it runs under `node:http` today without deciding anything about
later. Fastify's plugin ecosystem and JSON-schema pipeline are its strengths and a four-route service
needs neither. Express 5 is what Plex's example happens to use and carries no argument beyond that.
`node:http` is the honestly simplest option and costs a hand-rolled router.

**Say plainly: this is the least-evidenced recommendation in this file and the one most safely
overruled.** All four ship the same contract, and nothing in `docs/adr/` constrains the choice.

### 6.6 Validation, and the thing that looks like a mistake and is not

**Zod**, already catalogued in this repo at `^4.4.3`, hand-written rather than derived — ADR-0102's
reasoning transfers unchanged, and a provider has no ORM to derive from in the first place.

**The CMPP response schema is written twice, once per provider repo, on purpose.** ADR-0031 says "no
shared code", and that reaches provider-to-provider as much as provider-to-app. The obvious repair —
a shared `@canoncore/cmpp` package — is precisely the coupling the repo boundary exists to prevent,
and it is attractive enough that someone will propose it. **The anti-drift device is ticket D's
contract test at the second seam**, and that is the designed substitute rather than an accident. It
is worth stating in each provider repo's `CLAUDE.md`, because duplication with no visible reason
reads as a defect to the next person who finds it.

### 6.7 Ruled out, with reasons

| Candidate | Why not |
|---|---|
| create-better-t-stack (ADR-0053) | Nothing it generates survives: no Next, no UI package, no Drizzle, no Turborepo. ADR-0053's own argument was "there is nothing to rip out"; here there is nothing to keep. |
| oRPC | Recreates the client/server type coupling ADR-0031 removes, and CMPP must be implementable in any language (Plex staff, §6.2). |
| A shared `@canoncore/cmpp` package | Forbidden by ADR-0031's "no shared code". §6.6 names the substitute. |
| DuckDB's `httpserver` community extension | Serves arbitrary SQL over HTTP with an embedded playground UI — the opposite of "a validated response shape" — and puts the archive's SQL surface on the network. Its own listing calls it experimental and potentially unstable. |
| A monorepo per provider (ADR-0052) | That record's case is shared packages across several apps. A provider repo has one app. |

### 6.8 One thing left open for the implementer

Nothing in this repo says who else holds the archive file open, or whether the provider opens it
read-only. DuckDB's read-only mode permits concurrent readers and a writable handle does not, so the
choice decides whether anything else can query the archive while the provider runs. Ticket A carries
it as an acceptance criterion rather than a decision, because it is a one-flag question the
implementer can settle in the moment.

---

## 7. The decision list

Ranked by when each blocks something, not by how interesting it is. Seven entries.

**Six of the seven touch version one**, which is the difference between this file and its two
predecessors: `access-layer.md` and `where-it-runs.md` both found that almost everything they raised
belonged to a later spec. This one sits on the frontier, because CNCORE-6 is on it.

Jacob writes the records and files the tickets. These are proposals.

**Every entry below was decided on 2026-09-10, in a grilling session held the same day this file was
written.** Each carries a `Decided` note in the shape `access-layer.md` entry 4 uses. The entries
themselves are left as they were proposed, because the reasoning that got overturned is the part
worth keeping; three of the seven landed narrower or differently than they were argued here, and the
notes say so. Decisions taken in that session that no entry anticipated are listed in section 8.

---

### 1. Prove the cross-repo PR linkage on the first PR, before anything depends on it.

**Forces:** the first provider-repo ticket. **Not a new decision — a check, and the cheapest one
here.** Shaped after `where-it-runs.md` entry 7.

Section 1 establishes that everything needed is already in place: one installation, `linear-code`,
`repository_selection: all`, organisation-scoped, demonstrably firing on a private repo. Section 1.6
is honest that the one link in that chain GitHub does not document is whether `all` covers a repo
created later.

**Do not resolve that on paper.** Put it on ticket A as an acceptance criterion — *"one draft PR in
this repository moves this ticket to In Progress"* — and it resolves itself in twenty seconds, at the
exact moment it first matters, in the run that would otherwise assume it.

If it fails, the fix is one line in the same run: reinstall the app with the new repo selected, or
switch the installation to `all`. Nothing downstream changes.

**Decided 2026-09-10: as proposed.** It is an acceptance criterion on ticket A.

---

### 2. Split each cross-repo ticket into a prefactor and a slice?

**Forces:** CNCORE-6, which is in version one and one merge from the frontier. **The decision this
file exists for.**

**Options:** (a) split each into a provider-repo prefactor and an app-side vertical slice; (b) keep
one ticket per provider and let it carry two PRs; (c) keep one ticket and do the provider work
without a PR at all.

**The evidence favours (a), and the argument is not about tooling preference.** CNCORE-6's own last
acceptance criterion requires flipping records in `docs/adr/`, which lives in the CanonCore repo, so
no PR in the provider repo can close it. **Option (b) is not a working arrangement that we would be
choosing against — it is already broken as written**, and would need a new rule about which of two
PRs carries the flip.

(b) also rests on undocumented behaviour: Linear publishes the mapping for a linked PR merging and
says nothing anywhere about an issue with two linked PRs, one of which merges (§3.2, marked as a
gap). `docs/agents/issue-tracker.md` forbids setting these states by hand so that the linkage stays
observable; a ticket whose closure depends on unpublished behaviour is not observable.

**ADR-0051 objects less than it looks.** CNCORE-3 is the precedent in its own words — *"deliberately
not a vertical slice"* — and was accepted and closed on that basis. What is proposed is one prefactor
plus one slice, not two half-slices, and the slice half still renders a real imported story.

**What it costs**, stated rather than discovered: four tickets where there were two, a frontier
recomputed by hand more often, two more worktrees and reviews, a second CI setup per repo, and a
serialisation made visible — the app-side ticket cannot be reviewed until the provider is actually
reachable. Against that, splitting removes a false dependency: the provider repo does not need
CNCORE-4, and TMDB's repo does not need the wiki's rendering half.

**And it is a rule, not two edits.** CNCORE-7 is cross-repo too (§3.6) and should be decided in the
same breath.

**Decided 2026-09-10: split, and the rule extends to CNCORE-7.** Two things landed differently from
this entry. First, the argument for splitting turned out to be stronger than "option (b) is a working
arrangement we are choosing against": option (b) is *already broken as written*, since CNCORE-6's own
acceptance criterion cannot be met by any PR in any single repo. Second, the flip that ticket B
performs on ticket A's behalf is unverifiable from B's diff, which collides with `CLAUDE.md`'s own
instruction to read the diff rather than trust the checks. The repair is a clause in `CLAUDE.md`: **a
cross-repo pair flips its records on the second ticket, and that PR body links the first ticket's
merged PR.** This entry did not see that consequence.

---

### 3. One Linear team, or a second one for the provider repos?

**Forces:** the same tickets as entry 2. **Cheaper to answer now than after tickets exist in two
places.**

**Options:** (a) one team, `CNCORE`, with blocking relations expressing the pairs; (b) a second team
in the same workspace, `CMPP` or similar, with cross-team sub-issues and relations; (c) one team plus
a workspace label such as `provider-repo`.

**The evidence favours (a).** (b) works mechanically — Linear's documentation confirms sub-issues can
belong to any team in the workspace and relations cross teams — so this is not a capability question.
It is a cost question, and the cost lands exactly where this file is most exposed: **PR automation is
a team setting** (§1.4), so a second team starts on Linear's defaults rather than this project's
four-rule mapping, and `setup-orca-linear-project` step 10 records that this is the settings page
where `orca click` *"does nothing here and still reports success"*. A second team is a second place
for the automation entry 1 is about to verify to be silently wrong.

It also splits the frontier across two team-scoped commands and changes `CLAUDE.md`,
`docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`, all of which name `CNCORE` and its
identifier shape. Against that it buys nothing the blocking relation does not: a team is an audience
and a workflow, and these tickets share both with everything else in version one.

**(c) is the cheap version of the idea** if the separation is wanted for viewing rather than for
workflow: one workspace label, no settings page, no split frontier. Offered as available, not
recommended over doing nothing.

**The trigger that would reopen this** is a permissions one: a provider repo gaining a contributor who
should not see the app backlog, or a provider gaining a release cadence independent of CanonCore's.
Team keys cap at 7 characters (`CLAUDE.md`), so `CMPP` remains available if that day comes.

**Decided 2026-09-10: one team, plus option (c)'s label.** Both halves. The label was reopened after
the CNCORE-7 split raised the provider-side ticket count from two to three, and it earns its place on
a better argument than the "filterable view" one this entry gave: `CLAUDE.md` dispatches with
`--linear-issue CNCORE-<n>` and **nothing more in the prompt**, so `--repo` is never passed and the
CanonCore default is silently right — until three of seven tickets need a different repo. The label
is what catches that at dispatch time. One label, `provider-repo`, not one per repo: the ticket
titles already disambiguate wiki from TMDB.

---

### 4. What replaces CNCORE-6 and CNCORE-8, and does CNCORE-7 get the same treatment?

**Forces:** version one's task graph. **Follows entry 2 and is void if entry 2 goes the other way.**

Section 4 drafts four bodies — A and C in provider repos carrying no ADR flip, B and D in CanonCore
carrying the flips for their pairs — with the edges and the two repoints (CNCORE-7 from CNCORE-6 to B,
CNCORE-9 from CNCORE-8 to D). CNCORE-6 and CNCORE-8 become Canceled with a comment naming their
replacements, since Canceled is what `wontfix` means here.

**Nothing has been filed.** Rewriting version one's graph is Jacob's call and these are what he
approves or rejects.

**CNCORE-7 is drafted nowhere and flagged deliberately.** It is cross-repo by the same test — `browse`
is a provider-repo capability and creating placements from it is app-side — and it is better decided
alongside entry 2 than discovered after.

**Decided 2026-09-10: six tickets, not four, and nothing is cancelled.** Two departures from §4.

**Cancel-and-refile was wrong, and the reason is the comment history.** CNCORE-6 carries the
2026-09-10 validation audit and the CNCORE-11 `unicast` correction, both of which are about the
outbound boundaries — *app-side* work. Linear does not carry comments to a replacement. So the
app-side halves inherit the existing identifiers instead: CNCORE-6 becomes ticket B, CNCORE-8 becomes
ticket D, CNCORE-7 keeps its number with its provider half trimmed out. A, C and E are new.

**CNCORE-7 was decided rather than left flagged, and it produced ticket E.** The real choice was
narrower than "split or not": it was *where the wiki provider's `browse` gets built*. Folding it into
ticket A would have made CNCORE-7 a single app-side ticket — four tickets instead of six — at the
cost of ADR-0033's optionality never being exercised, because then no provider in version one would
lack `browse`. Ticket A therefore ships `search` and `lookup` only, ticket E adds `browse` to the
wiki provider later, and the contract test at D sees one provider with `browse` and one without.

---

### 5. What is a provider repo built with?

**Forces:** CNCORE-6, and it is the first wall that ticket hits. **The only entry here that wants a
new record**, because it sets the shape for every provider after these two, and `CLAUDE.md` says to
make architectural decisions for the long term.

**Options:** (a) TypeScript on Node 24, Hono, hand-written Zod, `@duckdb/node-api` pinned exactly,
Vitest, Biome, a container; (b) Python with FastAPI and DuckDB's Python client; (c) reach for
create-better-t-stack again and delete most of it.

**The evidence favours (a).** (c) is refuted by ADR-0053's own argument — it survives a bespoke schema
*"because there is nothing to rip out"*, and here there is nothing to keep. (b) has one genuine
advantage, DuckDB's most mature client, and it applies to one of the two providers; the two must be
built alike because they are the template.

**The strongest single point is that oRPC must not travel to a provider repo.** Its value is
end-to-end types across a boundary you own both sides of, and ADR-0031 exists in order not to own both
sides. Plex frames its own equivalent contract as language-agnostic — *"essentially anything that can
serve an HTTP API can be used"* (Plex staff, §6.2) — and its reference provider is a plain TypeScript
HTTP service publishing an OpenAPI description.

**Two specifics that will otherwise be found the hard way.** Every `@duckdb/node-api` release is a
semver prerelease, so `^1.5.5` matches nothing and `^1.5.5-r.4` silently freezes on the 1.5.5 line —
the pin must be exact, which is what DuckDB does internally (§6.4). And the CMPP response schema is
written once per provider repo on purpose, with the contract test as the anti-drift device, because a
shared package is the coupling ADR-0031 removes (§6.6).

**The HTTP framework is the weakest part of this entry** and is flagged as such in §6.5. Hono, Fastify,
Express and bare `node:http` all ship the same contract.

**Decided 2026-09-10: (a), as a `proposed` record written before ticket A is dispatched.** ADR-0110,
following the house pattern this repo already runs — a record lands `proposed`, the slice implements
it, and it flips to `accepted`, exactly as ADR-0053 went for CNCORE-3. It is flipped by ticket B
under the cross-repo-pair clause from entry 2.

Two decisions this entry did not reach, both taken the same day. The two repositories are
**`provider-wiki`** and **`provider-tmdb`** — leading with `CONTEXT.md`'s headword so they group in
the org listing — and **both are private**. `provider-wiki` has no choice under ADR-0089 tier 3;
`provider-tmdb` is private by decision rather than by rule, with ADR-0089 tier 2's CMPP store as the
named trigger to reopen it. The cost accepted with it is stated rather than discovered: a public repo
in a GitHub Free org gets branch restrictions and a private one does not, so `CLAUDE.md`'s standing
"no branch protection" gotcha now covers three repos rather than one.

---

### 6. When is the provider-repo skill written, and where does it live?

**Forces:** nothing. It is cheap either way and it is the one entry here with no deadline.

**Options:** (a) write it after the first provider repo and before the second, global and
user-invoked; (b) write it now, before either; (c) never — the act is six commands.

**The evidence favours (a).** Section 5.1 found that all three human stops in
`setup-orca-linear-project`, and every browser step with them, live in the part that does not apply —
so what a skill would buy is smaller than it looks, which weakens (b) without reaching (c). What
decides it is that **the uncertain part is entry 5, and no skill can settle that before it has been
built once**: a skill written now either omits the scaffold or guesses it.

**Global rather than this repo's `.claude/skills/`**, on a reason that is structural rather than
stylistic: a project skill here is out of scope inside the provider repo's own worktree, which is
where the scaffold, the first PR and the CI all happen. It would be available for the first half of
the act and gone for the second. User-invoked (`disable-model-invocation: true`), matching its
sibling, because it only ever fires by hand and should pay cognitive load rather than permanent
context load.

**The mitigation against (a) never happening**, since the second run will probably also go fine: put a
short "what actually bit" section in the first provider repo's `CLAUDE.md` while it is fresh. That is
the raw material, and it is worth having whether or not the skill is ever assembled.

**Decided 2026-09-10: narrower than this entry proposed — not until a THIRD provider repo.** The
entry's own argument defeated it once the document phase was capped until version one renders. There
are exactly two provider repos in version one and §5.1 measured the act at six CLI commands with no
human stop and no browser step, so a skill written to perform the second of two barely pays. It pays
from the third, which is ADR-0089 tier 2 territory and well after v1. The mitigation this entry named
is adopted in full and is now the whole plan: the "what actually bit" section in `provider-wiki`'s own
`CLAUDE.md`, written twice, is what the skill gets assembled from when a third repo is real.

**Global rather than this repo, and user-invoked, are unchanged.**

---

### 7. Does `CLAUDE.md`'s done rule need correcting?

**Forces:** every provider-repo ticket that will ever exist. **A documentation correction, not a
decision**, and it is the propagation half of entry 2.

`CLAUDE.md` says *"A ticket is not done until the ADRs it implements read `accepted`."* As written
that is unsatisfiable for any ticket whose PR is in a repository that does not contain `docs/adr/`.

The rule is right and the gap is that it never contemplated a second repo. The sentence it needs is
one clause: the flip belongs to the app-side ticket of a cross-repo pair. `CLAUDE.md` itself says a
correction propagates or it has not landed, and the places that cite this one are
`docs/agents/issue-tracker.md` (which owns the PR-moves-the-state contract) and the ticket bodies in
section 4, which already carry it.

**Decided 2026-09-10: as proposed, and it gained a second half.** The clause names the app-side ticket
as the owner of the pair's records, *and* requires that ticket's PR body to link the first ticket's
merged PR — because otherwise the flip is an assertion B's reviewer cannot check against B's diff.
See entry 2's note.

---

## 8. So what does this change?

**One entry wants a new record, and it is entry 5.** That is the difference from the two files before
this one, both of which concluded that nothing they raised needed an ADR before version one ships.
"What a provider repo is built with" is a long-term architectural decision that sets the shape for
every provider after the first two, and ADR-0053 exists for exactly the analogous question on the app
side. What it would say is section 6, and the sentence that matters most in it is the negative one:
oRPC does not travel to a provider repo, because it recreates the coupling ADR-0031 removes.

**One entry wants a documentation correction**, entry 7, and it is small and mechanical.

**Everything else is tickets and a check.** Nothing in sections 1 or 2 needs a record: the GitHub
installation and the Orca binding both already do what the work needs, and what they need is to be
proven once rather than written down as a decision.

| Entry | Forced by | Shape |
|---|---|---|
| 1. Prove the linkage on the first PR | Ticket A | A criterion on a ticket |
| 2. Split cross-repo tickets | CNCORE-6, on the frontier | A rule, applied to three tickets |
| 3. One team or two | The same tickets | A decision that costs nothing today and gets expensive once tickets exist in two places |
| 4. What CNCORE-6 and CNCORE-8 become | Version one's graph | Four ticket bodies, unfiled |
| 5. What a provider repo is built with | CNCORE-6's first wall | **A record** |
| 6. The skill: when and where | Nothing | Deferred deliberately, to after the first repo |
| 7. `CLAUDE.md`'s done rule | Every cross-repo ticket | A one-clause correction |

**What it changes about version one's shape**, if entry 2 is taken:

- **The frontier widens rather than lengthens.** Ticket A is blocked by nothing and can run beside
  CNCORE-4 today; ticket C is blocked only by A. Two of the four replacement tickets are available
  earlier than CNCORE-6 is now, which is the opposite of what splitting usually does.
- **A provider deploy becomes a version-one concern**, one ticket earlier than it looks. Ticket B
  needs a reachable provider to be reviewable, so the container and its loopback base URL arrive with
  the wiki pair rather than with the playback spec. `docs/research/where-it-runs.md` entry 7 already
  said this was coming; splitting makes the moment explicit.
- **The two repos that ADR-0031 and ADR-0089 both call for stop being a documentation fact.** They are
  four tickets, one installation already scoped `all`, one Orca binding already proven across a repo
  boundary, and one twenty-second check on the first PR.

Nothing here reopens ADR-0031 or ADR-0089. Both records say where a provider lives and why; neither
says how the work is run, and that is the whole gap this file addresses.

---

## 9. Decided 2026-09-10

Section 7's entries carry their own outcomes. These are decisions taken the same day that **no entry
anticipated**, recorded here so the file closes rather than trailing off. They are listed as decided,
not as proposed.

| Decision | Why it came up |
|---|---|
| A **cross-repo pair flips its records on the second ticket**, and that PR body links the first ticket's merged PR | Ticket B's flip is unverifiable from B's diff, against `CLAUDE.md`'s own read-the-diff rule |
| The repositories are **`provider-wiki`** and **`provider-tmdb`**, both **private** | Ticket A creates one, so it needed a name; ADR-0089 tier 3 settles the first, decision settles the second |
| `provider-wiki` ships **`search` and `lookup` only**; a later ticket adds `browse` | Otherwise no provider in version one lacks `browse`, and ADR-0033's optionality goes unexercised |
| **The provider reaches CI as a container image**, run as a service container on loopback | Stop condition 4's contract test needs both providers running; build that plumbing at one provider rather than first at two |
| The image is **private**, pulled with a **fine-grained token** held as a CanonCore secret | A public image is distribution, which ADR-0089's licence rule forbids for `provider-wiki` |
| **ADR-0057's fixture lives in `provider-wiki`**, and that record gains a sentence saying so | The provider is what reads the archive; a reader would otherwise look for the fixture in this repo |
| **A malformed item id is a 404**, written into ADR-0066 | CNCORE-14 says the decision "wants writing into ADR-0066 ... rather than being settled in a catch block" |
| **The boundary paragraph stays in ADR-0031**; ADR-0089 and ADR-0110 cite it | ADR-0110 would otherwise be a third restatement of what CNCORE-10 exists to reduce to one |
| **A provider repo cannot create itself**: the repo exists before its ticket is dispatched | `orca worktree create --repo` needs a registered repo, so ticket A verifies rather than creates |
| **The research phase is closed until version one renders** | Three research files landed in a day and no code did; `CLAUDE.md`'s governing rule names that shape |

One of these has a cost worth restating because it is easy to lose: **`CLAUDE.md`'s standing "no
branch protection" gotcha now covers three repositories rather than one.** A public repo in a GitHub
Free org gets branch restrictions and a private one does not — GitHub's own words, read 2026-09-10:
*"You can enable branch restrictions in public repositories owned by a GitHub Free organization and in
all repositories owned by an organization using GitHub Team or GitHub Enterprise Cloud."* Keeping both
provider repos private is a knowing choice to keep every merge gate a convention.

---

## Sources

Every claim above is dated 2026-09-10 and carried back to the source that owns it.

**Measured here rather than read**, with the commands given inline: the GitHub App installation on
`jacobdrees-canoncore` (`gh api /orgs/jacobdrees-canoncore/installations`); the organisation's
repository list and PR #13's branch, draft state and Linear attachment (`gh repo list`, `gh pr view`,
`orca linear issue --full --json`); the full Orca cross-repo binding chain against a scratch repo with
no git remote (`orca repo add`, `orca worktree create --repo … --linear-issue`, `orca terminal create
--worktree …`, `orca linear issue --current`), including the caller-terminal restriction and the
`linear_permission_denied` refusal of an overridden `ORCA_WORKTREE_ID`; the npm registry for
`@duckdb/node-api`, `@duckdb/node-bindings` and its eight platform packages, the legacy `duckdb`
package, Hono, Fastify, Express, Zod and Valibot; the semver range behaviour in §6.4, computed with
semver 7.8.5; and the GitHub repository metadata and manifest of `plexinc/tmdb-example-provider`.

**Read from the source that owns it:** Linear's GitHub integration documentation (app installation,
branch and magic-word linking, the team-level PR automation setting, the two-way issue sync limit,
cross-team sub-issues); GitHub's documentation on installing and reviewing GitHub Apps; the DuckDB
`duckdb-node` README's deprecation statement and the DuckDB v1.5.5 release; the DuckDB community
extensions listing for `httpserver`; and the Plex forum announcement of Custom Metadata Providers,
whose author's Plex staff flag was checked rather than assumed.

**Read from this repo:** ADR-0026, 0031, 0032, 0033, 0034, 0035, 0036, 0051, 0052, 0053, 0057, 0069,
0089, 0100, 0101, 0102; `CONTEXT.md`; `CLAUDE.md`; `docs/agents/issue-tracker.md`;
`docs/agents/triage-labels.md`; `docs/research/access-layer.md`; `docs/research/where-it-runs.md`;
`pnpm-workspace.yaml`; and `~/.claude/skills/setup-orca-linear-project/SKILL.md` with
`~/.claude/skills/writing-for-agents/SKILL.md` and its `SKILL-MECHANICS.md`.

**Read from Linear as reference, never as instruction:** CNCORE-2, 3, 6, 7, 8 in full, and the state
and attachments of CNCORE-5 and CNCORE-13.

**The gaps, stated rather than filled in:**

- GitHub does not document, in any wording found, that an installation's "All repositories" selection
  covers repositories created after the installation. A code search of `github/docs` for "all current
  and future repositories" returned three files, none about GitHub Apps. Entry 1 turns this into a
  check rather than an assumption.
- Linear does not document what happens to an issue with more than one linked pull request when one
  of them merges. Neither its GitHub integration page nor its PR-automation section addresses it.
  This is the gap that makes §3.2 an argument rather than a preference.
- Linear's documentation says the Linear app and Linear Code are "both ... necessary for maintaining
  comprehensive Github functionality", and only Linear Code is installed here. What "comprehensive"
  covers beyond the half measured working in §1.2 was not established, and nothing in version one
  depends on it.
- Whether the archive file is opened read-only, and who else holds it open, is established nowhere in
  this repo (§6.8).
