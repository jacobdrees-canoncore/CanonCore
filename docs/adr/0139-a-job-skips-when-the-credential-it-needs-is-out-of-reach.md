---
status: accepted
---

# A job skips when the credential it needs is out of reach

A CI job that starts a service container which will not boot without a stored secret runs only
when that secret is reachable, and is SKIPPED rather than failed when it is not. The decision is
taken on the credential's presence rather than on who opened the pull request.

**The store that would have made this unnecessary is refused on purpose, and that refusal is the
other half of this record.** GitHub keeps a separate secret store for Dependabot, and putting
`TMDB_READ_ACCESS_TOKEN` in it would have turned both red checks green in one click. It stays
empty. See "Why the Dependabot store stays empty" below.

## The defect: a check that CANNOT pass is worse than one that fails

Two jobs stand up `ghcr.io/jacobdrees-canoncore/provider-tmdb` as a service container:
`Import and browse over HTTP, against the real provider-tmdb` and
`One contract, both providers, no app`. That image ships no key and REFUSES TO START without
`TMDB_READ_ACCESS_TOKEN`, which is [[0035-ship-no-api-keys]] in operation: a startup failure rather
than a per-request one, so a container that runs at all is one somebody configured.

A Dependabot pull request has no such token, so both jobs died. Measured on #120, #122 and #123 on
2026-09-18, identically -- `fail 2, pass 12, skipping 1` -- and the runner log names the cause in
its own words at the top of the job:

```
Secret source: Dependabot
...
Error: TMDB_READ_ACCESS_TOKEN is required and this provider ships no key of its own (ADR-0035).
##[error]Failed to initialize container ghcr.io/jacobdrees-canoncore/provider-tmdb:latest
##[error]One or more containers failed to start.
```

**`GITHUB_TOKEN` IS NOT AFFECTED AND THAT IS WHAT MAKES THE FAILURE CONFUSING.** It is minted per
run rather than stored, so the private image PULLED fine on all three -- the `credentials:` block
was satisfied and only the `env:` block was empty. The job gets as far as having the image and then
cannot start it.

Seventeen bumps arrived that day and every one carried two red checks that meant nothing. **A bump
whose checks cannot pass has no merge gate at all**, so a dependency that genuinely broke the
contract suite would have looked exactly like the sixteen that did not. The signal that would have
caught it was already spent.

## The gate sits on the job, and the job cannot ask the question itself

Two constraints decide the shape entirely, and neither was a preference:

**A service container that will not start fails the job at `Initialize containers`, BEFORE the
first step.** So no step-level `if:` ever gets the chance to run. The condition has to be the job's
own.

**And `jobs.<job_id>.if` cannot see the `secrets` context.** GitHub's context availability table
gives it `github, needs, vars, inputs` and nothing else, so a job is structurally unable to ask
whether its own credential is present. `jobs.<job_id>.outputs` CAN see `secrets`, and `needs` is
available to `if`. That pair is the only arrangement that works: one job holds the single
expression permitted to look, and the jobs that need the answer read it back through `needs`.

So `ci.yml` gained a fifteenth job, `Which provider credentials this run can reach`. It checks out
nothing and installs nothing -- the answer is already in the environment -- and publishes
`true` or `false`.

**IT PUBLISHES A VERDICT AND NEVER THE VALUE.** An output whose text matches a secret is redacted
on the runner and arrives empty, so a job that passed the token itself along would gate on the
empty string forever: failing closed, permanently, and looking identical to a run with no
credential at all. A boolean is also the entirety of what a gate needs.

**A FIFTEENTH JOB COSTS NOTHING HERE**, which [[0111-ci-optimises-billed-minutes-over-named-checks]]
establishes in its own correction: standard runners are free in a public repository, so the count
is decided on diagnosability. It buys a named check that says in one line which way the run went
and why, instead of two skipped jobs a reader has to explain to themselves.

## Why the decision is the credential and not the author

`github.actor == 'dependabot[bot]'` is one line and needs no extra job. It was rejected because it
names a symptom.

A pull request from a FORK gets no repository secrets either -- that is GitHub's rule for
`pull_request` runs, not a Dependabot quirk -- and this repository is public, so fork pull requests
are the ordinary case rather than a hypothetical. An author check would leave every one of them
red for a reason the contributor cannot fix and cannot be told. Keying on the credential covers
both without naming either, and keeps covering whatever the third cause turns out to be.

## What is lost, stated rather than glossed

**This is a real reduction in coverage on any run without the token, and it is not free.**

- `Import and browse over HTTP` is skipped, so `test:e2e` does not run against the real image. The
  `The page over HTTP` job runs the SAME suite against the stub and is not gated, so what is lost
  is the real provider specifically -- which is the half no run without a credential could ever
  have had.
- `One contract, both providers, no app` is skipped, and `test:contract` runs nowhere else. So a
  run without the token checks the contract NOT AT ALL.

Running the contract against `provider-wiki` alone was the obvious way to soften the second one,
and it is refused by that job's own rule: a contract checked against one participant is a schema
test wearing a contract's name. That is a worse answer than no answer, because it is green.

**The trade is a skip nobody has to read against a red nobody can act on**, and the skip is the
honest one: it says this run did not check that, where the red said this run checked it and it
broke.

## Why the Dependabot store stays empty

GitHub's own documentation is plain about the split -- "Your secrets are available in Dependabot
secrets rather than as GitHub Actions secrets" -- and the runner prints `Secret source: Dependabot`
at the top of every such job. Filling that store would have fixed the reporting in one click.

**The store is separate because the runs are differently trusted, and using it would trade a
reporting problem for a credential one.** A Dependabot pull request exists to execute dependency
code nobody in this repository has read; that is the whole content of the change. A live
third-party API token placed within its reach is a token reachable by whatever arrived in the bump.

The token is also not this project's to spend carelessly. [[0035-ship-no-api-keys]] rests on the
instance supplying its own credential precisely so that no key of anyone else's is being handled
loosely, and a secret store readable by unreviewed code is loose handling whatever the folder is
called.

**It is refused for this repository rather than as a rule about the feature.** A Dependabot secret
holding a REGISTRY credential -- the use the feature is documented for, so Dependabot can resolve a
private package at all -- is a different question and is not decided here.

## What the tests pin

Two tests in `packages/config/src/ci-workflow.test.ts`, beside the ones that already hold those
same jobs to having the scope and the credentials to pull a private image.

**The chain is walked link by link rather than matched on the `if:` text**, because a second
provider with a second credential is the next ordinary change here -- `provider-wiki` already runs
beside `provider-tmdb` in the contract job -- and a job gated on the wrong provider's credential
reads exactly like one gated on the right provider's. So the test requires that the gate names an
output, that the job publishing it is really in `needs:`, that it really publishes that key, and
that the step whose id that key's value reads was handed THIS secret. All four were planted and
each one reddens; naming an output of a job you do not depend on is the one worth keeping in mind,
because the expression evaluates to nothing silently and would skip the job forever.

**The second test refuses a condition on the ANSWERING job, which is the hole the first one opens
and cannot see.** A skipped job's outputs are empty, so every gate reading one evaluates false,
every job behind it skips, and the run goes GREEN having checked none of them -- worse than the
defect this record fixes, because red about the wrong thing is at least visible.
`continue-on-error` is refused beside `if` for the reason
[[0111-ci-optimises-billed-minutes-over-named-checks]] gives about the four static checks: both are
valid job keys and the second defangs a whole job at once. Both were planted and both redden.

## Evidence

GitHub's context availability table, its Dependabot Actions documentation and its secrets
documentation were read on 2026-09-18, and the three failing runs were read from the forge the
same day rather than recalled: run 35289963404 supplied the log lines quoted above.

Both halves were then observed on a real runner rather than reasoned about, under CNCORE-203.
