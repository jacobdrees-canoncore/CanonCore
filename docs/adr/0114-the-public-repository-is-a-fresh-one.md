---
status: accepted
---

# The public repository is a fresh one, and the forensic record stays in the private one

CanonCore goes public as a NEW repository, seeded from the current tree. The existing repository
stays private and keeps everything it has: 332 commits, 55 merged pull requests, and the forensic
record of this product's previous attempts.

The forensic record is therefore never published, and is cited BY NAME rather than by a path that
will not resolve in the public tree. That follows
[[0057-the-archive-stays-outside-the-repo]]'s shape: evidence the project depends on, held where the
project can read it and the public cannot.

## Supersedes: a history rewrite was the plan, and it does not work

An earlier version of this record removed the forensic record from every commit with
`git filter-repo` and force-pushed. **It is superseded rather than deleted, because the reasoning was
sound and lost to a fact about GitHub rather than to a flaw in it.**

GitHub's own words, read 2026-09-11:

> If you only rewrite your history and force push it, the commits with sensitive data may still be
> accessible elsewhere: In any clones or forks of your repository / Directly via their SHA-1 hashes
> in cached views on GitHub / **Through any pull requests that reference them**

> This command will fail to push any refs starting with `refs/pull/`, since GitHub marks those as
> read-only.

> **GitHub Support won't remove non-sensitive data**, and will only assist in the removal of
> sensitive data in cases where we determine that the risk can't be mitigated by rotating affected
> credentials.

**None of what this record removes is a credential.** It is a research archive, a hostname and some
absolute paths. By GitHub's stated test that is non-sensitive data, which Support says it will not
remove — and 54 of the 55 merged pull requests are downstream of the commit that adds the archive,
so their read-only `refs/pull/*` keep every pre-rewrite object reachable. The rewrite's outcome is
therefore a cosmetically clean `main` and an archive still retrievable by SHA, permanently, from the
moment the repository goes public.

Three further costs the rewrite carried, each avoided by not doing it: `--replace-text` does not
touch commit messages, and the commit that adds the archive names a previous attempt's working
directory in its body; all three `.gitleaksignore` fingerprints are commit-pinned, so the rewrite
invalidates them and the Secret scan job goes red on two third-party values that survive; and the PR
diffs of all 54 downstream pull requests stop rendering.

## What the fresh repository costs, stated

**332 commits and 55 pull-request discussions do not come across.** That is the whole of the price
and it is not nothing: [[0107-canoncore-has-two-audiences]] says that for the length of version one
the repository IS the artefact the second audience reads.

**The artefact survives the move, and that is why this is affordable.** What that audience reads is
115 ADRs carrying dated evidence, `CONTEXT.md`, and the research corpus — all of which are files in
the tree and all of which are seeded. What is lost is the commit graph: 332 commits made by one
person over eight days. Buying certainty with that is a good trade; buying it with the ADRs would
not be.

**And some rewiring — less than an earlier draft of this record claimed.** Measured 2026-09-11:

| Thing | Travels? |
| --- | --- |
| Linear's GitHub integration | **YES, automatically.** The `linear-code` app is installed on the ORG with `repository_selection=all`, so a new repository in `jacobdrees-canoncore` is covered the moment it exists. Branch-name and magic-word PR automation need no action. An earlier version of this record said it had to be re-made; it does not. |
| `TMDB_READ_ACCESS_TOKEN` | **No.** A repository secret, re-added by hand. |
| The GHCR Manage Actions grant | **No.** Granted to a REPOSITORY, so the new one needs its own — and [[0089-provider-distribution-tiers]] records it as a web-UI step with no REST or GraphQL equivalent, which makes it a manual prerequisite of the first job that pulls a provider image. |

Anything org-scoped — the Actions budget, the plan, the packages themselves — is unaffected, because
the new repository sits in the same organisation.

## The word is "the forensic record", not "the archive"

**`CONTEXT.md` already spends "the archive" on the Tardis Wiki data**, and ADR-0057's title spends
it again on the same thing. Two different bodies of evidence, both held outside every published
repo, both called the archive, is the `duplicate` failure over again: a word doing two jobs in
exactly the documents that need to tell them apart.

`CLAUDE.md` was already using the better word — "the forensic record of those attempts" — so this
adopts a term in use rather than inventing one. `CONTEXT.md` carries it with `_Avoid_: archive`.

## What is seeded, and what is scrubbed first

Everything under `docs/research/` is seeded EXCEPT the forensic record: the competitor sweep, the
resolution working, the build-order study, the verification passes. **They are research about other
products; the forensic record is a record of this one's failures.** That is the whole of the
distinction, and it is what stops this becoming an argument for hiding the working — the working is
the part worth showing.

Pulling all of `docs/research/` was considered and refused for a second reason: nearly every ADR's
Evidence section cites a path under it, so the directory is what makes 115 records checkable rather
than assertions. A citation to a file a reader cannot open is worse than no Evidence section,
because it advertises a check that cannot be made.

**The redactions land as an ordinary pull request on the private repository BEFORE it is seeded**,
so the public tree never contains them and no history operation is needed:

- **The slot's host name comes out of [[0109-deployment-is-a-shape-not-a-vendor]]**, which names a
  live personal host at GBP 11/month and describes a first-hand SSH session against it. The EVIDENCE
  stays — plan, price, region, and what the session proved about running Postgres there — because
  that is what the record argues from. The name is an invitation and proves nothing. It also
  appears in `docs/research/the-cheap-end.md`, which an earlier version of this record missed.
  **The fully qualified name is not the whole of it**: the record uses the bare host label three
  more times on its own, which a search for the qualified form does not see. That is why the gate
  below matches the label.
- **Absolute paths into a previous attempt's working directory come out of nine files under
  `docs/research/competitor-sweep/`** and one under `docs/research/resolution/`. `CLAUDE.md` forbids
  referencing such an attempt at all, and the paths carry the owner's home directory with them. Only
  the machine-specific prefix goes, leaving the bare names the sweep corpus already uses everywhere,
  `urls/shards/<name>` and `prompt.md`. The shard lists are in the tree; the swept document never
  was, and naming it is the most a dated sweep can honestly do. An earlier version of this record
  said ten files, all under the competitor sweep; both halves were wrong. **So was the bare form it
  named**, `shards/<name>`: the lists have always been tracked at `urls/shards/`, so the five lines
  this scrub landed on the corpus's own convention resolved to nothing, and that is what showed the
  convention wrong rather than the edit. CNCORE-78 corrected all twenty-one citations and put
  `packages/config/src/sweep-shard-citations.test.ts` behind them, because a path wrong EVERYWHERE
  is the one a reviewer reads past.
- **And absolute paths into THIS checkout's own location**, three of them in
  `docs/research/competitor-sweep/verify-plex-claims.md`, pointing at schema dumps that are tracked
  in the tree and reachable by a relative path. Found by widening the gate rather than by reading,
  which is the argument for widening it: the narrow pattern each redaction suggests is the one that
  finds only what somebody already knew about.

**The scrub is a gate rather than an event**, a step in CI's `docs` job, because the thing that
makes this decision necessary — that publication cannot be undone — applies just as much to a
string reintroduced next month. Its patterns are deliberately broader than the values above, and
**neither pattern is the string it guards**: `.github/workflows/ci.yml` is seeded like the rest of
the tree, so a gate spelling the host name would be the last copy of the very thing it removes.
`packages/config/src/ci-workflow.test.ts` pins that, since spelling either value back in is a
one-line simplification that CI cannot catch — the gate excludes itself from its own search.

**What this ticket did NOT do is the other half of this record.** The scrub landed; seeding the
public repository, and with it the exclusion of the forensic record from the tree that is published,
is CNCORE-62's. This record therefore stays `proposed` until that lands.

**This record must not quote the values it removes.** An earlier version did, in the sentences
recording the redaction, which would have made its own acceptance criteria unsatisfiable.

**Two path references to the forensic record are deliberately left standing, and both are
quotations.** `docs/research/supersession-check.md` block-quotes an older `docs/research/README.md`,
and `docs/research/audit-new-adrs-internal.md` quotes an older `CLAUDE.md` inline. Both quoted
documents have since been rewritten, so the quotations are now the only record of what they said on
their date, and editing one to pass a grep destroys the single thing a quotation is for. A reader of
the public tree meets them as what they are — dated evidence about a directory that is not there —
rather than as a pointer they are invited to follow. Every other citation names the record.

**Two things are deliberately NOT changed.** Commit author emails stay: publishing them is ordinary
for open source. The three values in `.gitleaksignore` stay: each is documented there as a
third-party value already published by its own owner — Jellyfin's hardcoded TMDb key, quoted from
their repository, and Plex's published GPG fingerprint. Nothing there is this project's secret, and
under a fresh repository their commit pins are regenerated once at seeding rather than invalidated.

## Evidence

GitHub's position on rewriting and on Support: `docs.github.com`, "Removing sensitive data from a
repository", read 2026-09-11. That page now names `git filter-repo` exclusively; BFG and
`filter-branch` are absent from it, and git's own documentation deprecates `filter-branch`.

Repository state the same day: 332 commits (`git rev-list --count HEAD`), 55 merged pull requests
(`gh pr list --state merged`), 0 open, 0 forks, 0 stars, private, org plan Free, one remote, no
version tags. **Both figures rise with ordinary work, so whoever seeds the new repository counts
them on the day rather than trusting these.**

The forensic record: 17 files, all Markdown, 300KB by `du -sh`, all tracked, no subdirectories. Not
read, deliberately — this record decides where the files live and is not a summary of them.

Citations of it, counted before the scrub: 17 lines across nine files by
`git grep -c archive-2026-09-04`, excluding this record, ADR-0115 and `.gitleaksignore`'s
commit-pinned fingerprint. An earlier version said 15 and named a file list that does not reach that
number by any counting method. CNCORE-61 recounted on the day, found the same 17, and turned 15 into
the term; the two it left are the quotations above. **Run the same command now and it returns four
lines** — the fingerprint, the two quotations, and this sentence — so re-count rather than reading
the 17 as the state of the tree.

The credential scan that accompanied this decision is recorded rather than repeated: no `.env` file
is tracked, no token-shaped string survives grep beyond a `sha512-` integrity hash in
`pnpm-lock.yaml`, and no personal email address appears in any file's CONTENT. CI already runs
gitleaks pinned by digest ([[0111-ci-optimises-billed-minutes-over-named-checks]]), so this was a
second pass over a gate that already exists rather than a substitute for one.

**One claim was checked twice and holds: no CanonCore commit SHA is cited in any tracked document.**
Verified by pattern (`git grep` for forge commit URLs, empty) and by extracting all 26 hex literals
of length 7-40 from tracked Markdown and testing each with `git cat-file -e` — none resolves in this
repository. Every SHA in the docs belongs to Jellyfin, Plex, Navidrome, Immich, Stash or Romm. That
mattered when a rewrite was planned and no longer bites, but it is kept because it is the check a
future reader would otherwise redo.

## As built, under CNCORE-61 and CNCORE-62

The scrub landed first as an ordinary pull request on the private repository, and it did more than
this record asked: it turned the one-off redaction into a CI gate that greps the tree on every run
and distinguishes `git grep`'s "no match" from its "search failed", so the gate cannot pass by
having searched nothing.

Then the tree was seeded into a new public repository at one commit, and the private one was renamed
`canoncore-history` and ARCHIVED, which makes it read-only and removes the possibility of work
landing in the wrong place. `CanonCore` names the public repository, because ADR-0058 settles that
the product's name belongs on the surface the second audience reads.

**One thing this record got wrong, found by the first CI run rather than by reading.** The
`.gitleaksignore` it inherited claimed its values "have been redacted from the working files". That
was true of one value and false of the other, and the fix then failed a second time for this
record's own reason: `gitleaks git` scans COMMITS, so redacting a file does not remove a value from
the commits that already carry it. The resolution splits by what each mechanism can do — the
redaction stops any future commit carrying it, and one pinned fingerprint closes the single
immutable commit that already does. The argument at the top of this record, met three orders of
magnitude smaller.
