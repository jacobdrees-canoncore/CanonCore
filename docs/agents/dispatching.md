# Dispatching in this repository

What the `dispatch` skill needs to know that only CanonCore has. The skill carries the loop and
reads this file for the rest, so none of it sits in a file Sift also loads.

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
