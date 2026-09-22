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

**AND IT OPENS ONE HOLE, WHICH IS CLOSED IN THE SAME JOB.** An author check cannot misfire on
`main`, because Dependabot does not push there; a credential check can. A repository secret
DELETED OR RENAMED would make the probe report `false` on every push, skip both jobs, and leave
the run green with the contract suite running nowhere at all -- trading a red that means nothing
for a green that checks nothing, which is no fix.

**A pull request has two innocent explanations and a push has none.** Dependabot reads its own
store; a fork gets no repository secret; neither is anything the contributor can do about. A push
to `main` or a version tag is neither of those, so an absent credential there means the secret has
gone, and the honest report is red. The probe job therefore carries a second step that FAILS when
the credential is absent on anything but a pull request.

That step is a YAML `if:` rather than a branch in the shell above it, and the reason is
assertability: a condition in the file is one the suite can EVALUATE against a synthetic context,
the way it already evaluates the concurrency key, while a branch inside `run:` could only be
matched as text.

## What is lost, stated rather than glossed

**This is a real reduction in coverage on any run without the token, and it is not free.**

- `Import and browse over HTTP` is skipped, so `test:e2e` does not run against the real image. The
  `The page over HTTP` job runs the suite against the stub and is not gated, and the one file it
  and the provider job leave out, because it never reaches a provider (CNCORE-343), runs in the
  ungated `cost` job (CNCORE-396), so what is lost is the real provider specifically -- which is the half no run without a credential could
  ever have had.
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

**AND THEN THE POLARITY, WHICH IS THE LINK THE OTHER FOUR CANNOT SEE**, because a gate can be
perfectly wired and point the wrong way. `if: needs.credentials.outputs.tmdb == 'false'` satisfies
every structural check above and inverts the whole fix, running both jobs exactly when the token
is absent -- which is the one state they cannot start in. So the condition is EVALUATED, twice,
against a verdict each way, using `@actions/expressions` and the synthetic-context machinery the
concurrency tests already use for the reason ADR-0111 gives: a test that matches an `if:` as text
restates the file and agrees with any condition spelled the same way.

**This was the review's finding rather than the author's**, caught independently on both axes, and
it is worth recording as a class: the first version walked the chain and never looked at the
comparison, so it read as thorough while asking nothing about what the gate decided. Three forms
were then planted and all three redden -- `== 'false'`, `== 'true' || true`, and the bare
`needs.credentials.outputs.tmdb`. **The bare one is the trap worth naming**: it reads like a
boolean and is a STRING, so under Actions' truthiness the value `false` is non-empty and therefore
TRUE, and the job runs exactly when the credential is missing. Measured against that evaluator
rather than assumed, it returns a string where the comparison forms return a boolean.

**The second test refuses a condition on the ANSWERING job, which is the hole the first one opens
and cannot see.** A skipped job's outputs are empty, so every gate reading one evaluates false,
every job behind it skips, and the run goes GREEN having checked none of them -- worse than the
defect this record fixes, because red about the wrong thing is at least visible.
`continue-on-error` is refused beside `if` for the reason
[[0111-ci-optimises-billed-minutes-over-named-checks]] gives about the four static checks: both are
valid job keys and the second defangs a whole job at once.

**`needs` is refused beside both, and it is the form nobody would look for.** A verdict job made to
wait on another job inherits that job's skip: nothing about the verdict job itself reads
conditional, and everything behind it disappears all the same. So the rule is that it waits on
nothing at all, which is what the file claims about it on its face. All three were planted and all
three redden.

The fail-closed half above is asked the same way, as four cases rather than as text -- a condition
merely MENTIONING the event name would satisfy any reading of the words and none of the cases. It
must not redden a push that has the credential, must not redden a pull request either way, and
must redden a push without one. Deleting the step, dropping its event half, and inverting its
reachability half were each planted, and each is reported in the words of the case it broke.

## Evidence

GitHub's context availability table, its Dependabot Actions documentation and its secrets
documentation were read on 2026-09-18. "Your secrets are available in Dependabot secrets rather
than as GitHub Actions secrets" is that documentation's own sentence. The three failing runs were
read from the forge the same day rather than recalled: run 35289963404 supplied every log line
quoted above.

**BOTH HALVES WERE THEN OBSERVED ON A REAL RUNNER, AND THE SECOND ONE NEEDED A THROWAWAY PULL
REQUEST** -- a Dependabot run cannot be summoned, so the credential-less case was reached by
pointing the probe at a secret name this repository does not have. It was closed and its branch
deleted once read.

| Run | The probe says | `Import and browse` | `One contract` |
|---|---|---|---|
| [35351756526] — the credential present | `reachable=true`, 3s | **pass**, 2m14s | **pass**, 36s |
| [35352104551] — probe pointed at a secret that does not exist | `reachable=false`, 3s | **skipping** | **skipping** |
| [35352462800] — credential present, failure planted in the provider job | `reachable=true`, 3s | **fail**, 37s | — |
| [35354682680] — credential present, failure planted in the contract job | `reachable=true`, 4s | **pass**, 2m7s | **fail**, 42s |

[35351756526]: https://github.com/jacobdrees-canoncore/CanonCore/actions/runs/35351756526
[35352104551]: https://github.com/jacobdrees-canoncore/CanonCore/actions/runs/35352104551
[35352462800]: https://github.com/jacobdrees-canoncore/CanonCore/actions/runs/35352462800
[35354682680]: https://github.com/jacobdrees-canoncore/CanonCore/actions/runs/35354682680

Row two is the fix. Rows three and four are what stop it being a mute button: **each gated job was
shown to still run and still redden with the credential there**, separately, because one of them
demonstrated is an argument about the other rather than a measurement of it. So the gate removed
the report that could not pass and nothing else.

The runner's own rendering of row two is `skipping`, the same word `One image, both architectures`
has carried on every pull request for months, so it is a shape this repository's checks already
read as "not asked" rather than "asked and fine".

**WHAT IS STILL UNOBSERVED, STATED PLAINLY: no Dependabot pull request has run this.** A Dependabot
run cannot be summoned, and the seventeen open ones were opened against a `main` that predates this,
so they carry the old file until each is rebased. Row two reaches the same state by another road --
`secrets.<NAME>` for a secret that does not exist renders empty exactly as Dependabot's empty store
does, which is the identical input to the identical expression -- but it is the same state reached
deliberately, not the event itself. **The first rebased bump is the observation**, and until one
runs this record's opening claim rests on row two.

**Row two also reddened `Test`, and that was the assertion above doing its job on a runner rather
than on a laptop.** Pointing the probe at another secret is exactly the mis-wiring
`ci-workflow.test.ts` walks the chain to catch, and it caught it: `1 failed | 175 passed`, naming
both jobs and the secret each one cannot start without. The row is therefore evidence twice over --
of the skip, and of the check that refuses the skip being reached by accident.
