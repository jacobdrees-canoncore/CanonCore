# Dispatching in this repository

What the `dispatch` skill needs to know that only CanonCore has. The skill carries the loop and
reads this file for the rest, so none of it sits in a file Sift also loads.

The project's standing decisions go in a `## Standing decisions` section of this file, which the
skill's first run creates. Only the dispatcher's own PR may change it, and the merge gate refuses
any other ([[0203-standing-dispatch-decisions-live-in-dispatching-md-and-no-agent-can-change-them]]).

## The ceiling, and the prompt that carries it

The skill takes a project's ceiling from the prompt that starts a dispatch, and stops if it is not
given. CanonCore's is stated in `CLAUDE.md` under "Working substrate", derived from the connection
peak of one e2e run -- a figure stated there once and held to the tree by a test, so it is not
repeated here. The ceiling itself is not test-held. Pass that
figure, not a remembered one. A satellite's worktree is not in it: neither provider's suite touches
the shared Postgres -- `provider-wiki` runs DuckDB fixtures and `provider-tmdb` hits the live API.

Slices land on `main` behind their own pull request (ADR-0051), so `retire.sh` needs no `--base`.

## Twins

The two provider repos' `ci.yml` and `dependabot.yml` are deliberate twins. One agent takes both
repos and opens a PR in each naming the other. After merging the pair, diff the two files and
confirm the only difference is the one each repo owns. Two agents, or one repo alone, is how they
diverge — CNCORE-41, 45 and 57 are each that divergence found later.

## An action bump in one provider repo is half a change

Both provider repos pin the same action digests at two sites each, so merging one side diverges the
twins. Wait for the pair and merge them together — held from 2026-09-18 until provider-tmdb's own
PRs appeared, then all four went in as a set.

## A patch published today is the one the cooldown is for

pnpm's `minimumReleaseAge` is 24 hours, and taking a release inside it writes a
`minimumReleaseAgeExclude` waiver — waiving the cooldown for exactly the case it exists to catch.
ADR-0105 already refused that trade. Take the aged version and let the range pick the newer one up
later.

## A claims table is a rung

`packages/config/src/tree-figures.test.ts` holds one row per figure this repository states about
itself, and ADR-0153 states how many rows it holds. It was contended the day it landed: three
branches appended within two hours of CNCORE-251 merging on 2026-09-20, and CNCORE-248 went `DIRTY`
on the collision. Broadcast an append to it the way you broadcast a migration number
([[0175-a-claims-table-is-a-rung-and-the-removable-part-was-the-self-claim]]).

## Checking a claim against its owner

The skill's first step puts a pull request's load-bearing claim back to its owner. Here that
includes the development Postgres on 55432 (ADR-0104), which answers a question about trigger or
constraint semantics in one `docker exec` and answers it for the engine this repository runs.

## Standing decisions

The Owner's answers, given once and read on every pass. Only the dispatcher's own PR changes this
section, merged with `merge-if-green.sh --standing-decisions`.

### The data

- **Check-in points**: CNCORE-367, CNCORE-365. Each rebuilds the Owner's install, so when one reaches
  Done the Owner walks it and whatever builds on it pauses until the walk is done.
- **Held-back tickets**: none.
- **Standing permissions**:
  - Merge a dependency bump whose provider twin has merged, after the gate passes and the diff is read.
- **Precondition checks**:
  - The live wiki session: the Owner confirms it before each wave that includes a wiki-gated ticket.
    `pnpm session` in provider-wiki compares the host and provider copies but spends no request, so
    it cannot say the wiki still accepts them; until a live check exists, this is asked.
- **Check-in pauses**: none.

Given by the Owner on 2026-09-26.
