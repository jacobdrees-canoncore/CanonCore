# One standard across CanonCore's repositories

Research note, 30 Sep 2026. Question from Jacob: CanonCore now has private design-reference
repositories beside its public one (ADR 0022, `plan-2026-09-30.md`): `untitled-replica` and
`prototype-snapshot` exist, and `folder-component`, `design-prototype`, `untitled-app-replica`,
`brink-replica`, `md-vinyl-replica`, `tv-app-replica` and `america-gov-replica` are planned. Hold
every one to the same standard as CanonCore, above all "Verify, don't recall" and the Principles,
with the standard kept in one place. Every new repository lives in the `jacobdrees-canoncore` org
and files its tickets in the existing Linear workspace `jacobrees-canoncore`, team `CC`, project
Design references (Owner, 30 Sep 2026), so no org, workspace or team is ever created for one.

**Changed 1 Oct 2026 by the Owner:** the standard is written inline in every repository's
`CLAUDE.md`, not imported ("I really wanted that to stay in CLAUDE.md and everyone's CLAUDE.mds",
CC-84). The master copy is CanonCore's `CLAUDE.md`, between the lines `<!-- standard:start -->` and
`<!-- standard:end -->`; every other repository carries the identical block between the same
markers, and its CI compares the two. The separate standard file this note first recommended was
made in #14 and deleted by CC-84. The recommendation below is written to that decision.

"(measured, 30 Sep 2026)" means read or run on this Mac on this date. Everything else is linked, or
listed under "Claims not sourced".

## The short answer

**The standard is already copied three ways, and the copies have drifted.** CanonCore's
`CLAUDE.md`, the `setup-orca-linear-project` skill's `claude-md-template.md`, and the copies in
Sift and XMCP each carry the Principles. The template's last Principle and its Verify section
differ from CanonCore's, and neither private repository carries the standard at all (measured,
30 Sep 2026; details under "Where things stand").

**Claude Code cannot share one file across these repositories by location alone.** A `CLAUDE.md`
in `~/canoncore/` would load for a session started in `~/canoncore/untitled-replica`, but every
implementer runs in an Orca worktree under `~/orca/workspaces/<repo>/<slug>`, where that ancestor
is not above it (measured, 30 Sep 2026). An `@~/…` import works but asks for approval once per
project and is invisible on GitHub. The user-level `~/.claude/CLAUDE.md` and `~/.claude/rules/`
load everywhere, but for every project on the Mac, and `/code-review` looks for standards in the
repository, not there.

**GitHub Free gives a private repository no gate and no org-wide file for this.** Rulesets on a
private repository answer 403 "Upgrade to GitHub Pro" (measured, 30 Sep 2026), an org `.github`
repository must be public and `CLAUDE.md` is not one of its supported files, and a template
repository copies once with no link back. What Free does give is 2,000 Actions minutes a month for
private repositories, and a private repository's workflow may read anything in CanonCore, because
CanonCore is public.

**Recommendation:** keep the master text in CanonCore's own `CLAUDE.md`, between two marker
comments, and carry the same block inline in every other repository's `CLAUDE.md`. Make `setup-orca-linear-project` the one way a repository gets
it: a new "Add a repository to an existing project" path that runs only the repo-level steps, whose
template carries the block fetched from CanonCore, and whose `ci.yml` fails when a
repository's block differs from CanonCore's `main`. A new repository gets it from the first ticket of
its spec. A change to the standard is one CanonCore PR; every other repository then goes red at its
next push or on Monday's scheduled run, and the error prints the one-line fix.

## Where things stand

**CanonCore's `CLAUDE.md` is the newer text** (last changed 30 Sep 2026; the template's text last
changed 25 Sep in `67414db`, measured). Line by line, against `claude-md-template.md`:

| Part | CanonCore `CLAUDE.md` | `claude-md-template.md` |
| --- | --- | --- |
| Verify heading | "Most Important: Verify, don't recall", placed first | "Verify, don't recall", after Principles |
| Verify body | adds: before a spec or its tickets publish, check competitors and run `/verify` on every claim a decision rests on | adds: "Your training data is older than this stack", and "The point is current industry best practice" |
| Principles 1 to 12 | identical | identical |
| Principle 13 | "Keep this file a pointer file. Repeated gotchas become checks (lint, hooks, CI), not prose here." | "Keep this file under 200 lines", then move path-specific guidance to `.claude/rules/`; `@path` imports do not help |
| How a project closes | Owner's walk, accessibility pass, README showcase | absent (CanonCore's own) |
| Gotchas | `main` refuses deletion and force-push | "No branch protection" on a Free private repo |
| Implementing | absent | `/implement`, `/implement-spec`, integration-branch rules |

Two defects fall out of the comparison. CanonCore's `ci.yml` fails a long `CLAUDE.md` with "over the
200-line limit set in its own Principles", but CanonCore's Principles no longer state a 200-line
limit. And the template's Verify section lacks the `/verify` rule that CanonCore calls most
important.

**Neither private repository carries the standard or any check** (measured, 30 Sep 2026):

- `untitled-replica`: a 93-line `CLAUDE.md` of repo rules with no Principles and no Verify section;
  no `.claude/settings.json`, no `docs/agents/`, no workflows (`actions/workflows` total 0).
- `prototype-snapshot`: no `CLAUDE.md` at all, on `main` or on CC-42's branch, so the agent running
  CC-42 has only the Owner's user-level file. No workflows.
- Both skipped the skill's step 3: Issues on, merge commits and rebase merges allowed, branches kept
  after merge. CanonCore has all three set the other way.

Sift and XMCP carry the template's Verify section; MoneyMind, provider-tmdb and provider-wiki carry
neither (measured, 30 Sep 2026). They are outside this question and are left as they are.

## 1. How Claude Code loads instructions

From [Claude Code, memory](https://code.claude.com/docs/en/memory) (v2.1.286 installed, measured):

- **Locations, broadest first:** managed policy (`/Library/Application Support/ClaudeCode/CLAUDE.md`
  on macOS), user (`~/.claude/CLAUDE.md`), project (`./CLAUDE.md` or `./.claude/CLAUDE.md`), local
  (`./CLAUDE.local.md`, gitignored). "All discovered files are concatenated into context rather than
  overriding each other", ordered from the filesystem root down, so the nearest is read last.
- **Ancestors load, siblings do not.** Files in the working directory "and every directory above it"
  load at launch; subdirectory files load when Claude reads there. An Orca worktree at
  `~/orca/workspaces/untitled-replica/cc-21` has no `~/canoncore/` above it, so a shared
  `~/canoncore/CLAUDE.md` would reach the main checkouts and miss every implementer.
- **`@path` imports:** "Both relative and absolute paths are allowed. Relative paths resolve relative
  to the file containing the import", up to four hops deep, and `@~/…` home paths are shown working.
  An import that resolves outside the working directory is "external": "The first time Claude Code
  encounters external imports in a project, it shows an approval dialog", and a decline disables them
  for good. Imports in `~/.claude/CLAUDE.md` and `~/.claude/rules/` load without the dialog. An import
  inside backticks is not imported. Imports "don't reduce its context cost, because imported files
  also load at launch".
- **Where the approval is kept:** `~/.claude.json` holds `hasClaudeMdExternalIncludesApproved` per
  project path; every entry is a main checkout and no worktree path appears (measured, 30 Sep 2026).
  So an external import would be approved once per repository, but by a person pressing a dialog,
  which a dispatched agent's terminal would wait on.
- **`.claude/rules/`:** every `.md` loads at launch "with the same priority as `.claude/CLAUDE.md`",
  or on demand with a `paths:` frontmatter. The directory "supports symlinks, so you can maintain a
  shared set of rules and link them into multiple projects", but a target outside the working
  directory is treated like an external import. `~/.claude/rules/` applies "to every project on your
  machine"; it exists here and is empty (measured, 30 Sep 2026).
- **`AGENTS.md`** is read only when no `CLAUDE.md` exists in or above the working directory, by
  default. These repositories use `CLAUDE.md` (the skill's `defaults.md`), so it changes nothing.
- **HTML comments** "are stripped before the content is injected into Claude's context", so a
  maintainer's note costs no context.
- **Instructions are advisory:** "Claude treats them as context, not enforced configuration. To block
  an action regardless of what Claude decides, use a PreToolUse hook". Hence a CI check for the part
  that must hold.

**`disable-model-invocation: true`** stops Claude invoking a skill on its own; the user can still
run it as `/name` ([Claude Code, skills](https://code.claude.com/docs/en/skills)). Both
`setup-orca-linear-project` and `setup-matt-pocock-skills` carry it (measured), so a dispatched worker
cannot call either through the Skill tool. It can still read `SKILL.md` by path and follow it.

## 2. The Owner's tooling today

**`setup-orca-linear-project` already is the mechanism, for a whole new project.** Step 13
scaffolds `CLAUDE.md` from `claude-md-template.md` ("copying the Principles list across verbatim"),
step 14 hands off to `setup-matt-pocock-skills` for the Agent skills block and `docs/agents/*`, and
step 15 copies `templates/` in with one `rsync`: `.gitignore`, `.github/workflows/ci.yml`,
`.github/dependabot.yml` and `.claude/settings.json`. It has no path for adding a repository to an
existing project: `reusing-a-workspace.md` covers replacing a team, and nothing in the skill mentions
a second repository (measured, 30 Sep 2026).

**Only the repo-level steps apply to these repositories,** and they can run alone:

| Step | For a new repo in `jacobdrees-canoncore` + team `CC` |
| --- | --- |
| 1 Orca skills | already installed; skip |
| 2 Create org and repo | repo only: `gh repo create jacobdrees-canoncore/<name> --private --source=. --remote=origin --push` |
| 3 Harden settings | run: both existing private repos skipped it (above) |
| 4 to 10 Linear | skip: workspace, team, labels and PR automation exist, and the Linear app `linear-code` is installed on the org for **all** repositories (measured, 30 Sep 2026), so a new repo's PRs move tickets with no step 9 |
| 11 Register with Orca | run |
| 12 Authorise Linear in Orca | skip: done |
| 13 `CLAUDE.md` + README | run, with the change below |
| 14 `docs/agents/*` | copy CanonCore's `triage-labels.md` and `domain.md`; write `issue-tracker.md` for this repo's landing (PR, or local merge like `untitled-replica`) |
| 15 Templates | run |
| 16 Verify the chain | only when the repo lands by PR |

**`templates/ci.yml` suits a private repository on Free as it stands.** It is byte-identical to
CanonCore's `ci.yml` (measured, 30 Sep 2026). Its gitleaks job runs the bare image because "GitHub's
own secret scanning needs paid Secret Protection on private repos" and `gitleaks-action` needs a paid
licence key for org repositories; the templates README says so and says CI cannot gate on Free. Two
jobs of about 20 to 26 seconds each run (CanonCore's last three runs, measured), against 2,000 free
minutes a month for private repositories on GitHub Free for organizations
([GitHub, Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)).
Its "Agent docs" job asserts the three `docs/agents/*.md` files, so step 14 has to land first, as
the skill already orders. The org allows all actions and reusable workflows with no SHA pinning
required (`actions/permissions`, measured).

**`writing-for-agents`** treats a `CLAUDE.md` line naming a doc as a context pointer and a restated
lookup as a cache that goes stale; CanonCore's last Principle turns that into "repeated gotchas become
checks". The drift check below is that rule applied to the standard itself.

**`/code-review`'s Standards axis reads "anything in the repo that documents how code should be
written"**, and stops when `docs/agents/issue-tracker.md` is missing (its `SKILL.md`). A standard
that lives only in `~/.claude/` would be invisible to it; one in the repository is found.

**The skills repository cannot be the file CI reads.** `jacobdrees/claude-skills` is private and
owned by the user account, not the org (measured, 30 Sep 2026), so an org repository's workflow
cannot fetch the template without a cross-owner token stored as a secret in every repository.
CanonCore is public and in the same org, and its raw files answer without a token (HTTP 200 for
`raw.githubusercontent.com/jacobdrees-canoncore/CanonCore/main/CLAUDE.md`, measured).

## 3. What GitHub offers an org on Free

- **Rulesets and branch protection:** "for customers on GitHub Team and GitHub Enterprise plans"
  ([GitHub, About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)).
  `untitled-replica`'s rulesets endpoint answers 403 "Upgrade to GitHub Pro or make this repository
  public" (measured). CI in a private repository reports; it never blocks.
- **Org `.github` repository:** "The `.github` repository must be **public**", and the supported
  files are community health files such as `CONTRIBUTING.md` and issue templates
  ([GitHub, default community health file](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file)).
  `CLAUDE.md` is not among them. Workflow templates there only pre-fill the "New workflow" page, and
  from a private `.github` "are only available to private repositories"
  ([GitHub, reusable workflows reference](https://docs.github.com/en/actions/reference/workflows-and-actions/reusable-workflows)).
- **Template repository:** a new repository gets "the same directory structure and files", and
  "Branches created from a template have unrelated histories, so you cannot create pull requests or
  merge between the branches"
  ([GitHub, template repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository)).
  Creation only; a later change reaches nothing.
- **Reusable workflows (`workflow_call`):** a private caller may use workflows in "`private` and
  `public`" repositories; a private callee needs its Access policy opened, a public one does not
  (same reference). CanonCore could host one for every repository, referenced
  `jacobdrees-canoncore/CanonCore/.github/workflows/<file>.yml@main`. "Using the commit SHA is the
  safest option" ([GitHub, reuse workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)).
- **Scheduled runs:** auto-disable after 60 days without activity applies to public repositories
  ([GitHub, events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)),
  and a scheduled run's notification goes to "the user who initially created the workflow"
  ([GitHub, notifications for workflow runs](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)).

## 4. What multi-repo projects do, for 8 to 10 small agent-run repositories

| Pattern | How a change arrives | Cost here |
| --- | --- | --- |
| Shared config package (npm, like shareable lint configs) | a version bump per repo | the standard is prose for Claude, not config a tool reads; half these repos are Swift |
| Template repository | never after creation | the skill's `templates/` already does this, with one `rsync` |
| Sync bot ([repo-file-sync-action](https://github.com/BetaHuhn/repo-file-sync-action)) | "it will open a pull request in the target repository" on each push | needs a PAT with "the full repo scope" (`GITHUB_TOKEN` will not work) or a GitHub App; `untitled-replica` never takes a PR and only the dispatcher pushes it |
| Git submodule | a pinned SHA bumped per repo | the same per-repo bump as a copy, plus every Orca worktree must initialise it before the import resolves |
| `@` import of an absolute path | instant | an approval dialog per repo, invisible on GitHub and to CI, and it reads whatever branch the CanonCore checkout is on |
| User-level `~/.claude/rules/` | instant | reaches every project on the Mac, lives in no repository, and `/code-review` cannot see it |
| Copy + drift check against one public source | red CI names the fix | one `curl` per repo per change; no secret, no bot |

The last row is the smallest thing that keeps one source and makes drift visible. A reusable workflow
would also centralise the checks, but it makes CanonCore's `main` a runtime dependency of every
private repository's CI for a two-job file that changes rarely; it is worth doing only once the
checks themselves change often enough to hurt.

## Recommendation

**CanonCore's `CLAUDE.md` holds the master copy,** between `<!-- standard:start -->` and
`<!-- standard:end -->`. The block carries "Most Important: Verify, don't recall" and the
Principles, merged from both copies (draft below). HTML comments are stripped before Claude reads
the file, so the markers cost no context. Everything CanonCore-only stays in CanonCore's `CLAUDE.md`: "How a
project closes" (the Owner's walk on their install, the accessibility pass and axe, the README
recording, diagram and ADR links, and "never the habits of this product's earlier attempt"),
Commands, and the Gotchas about `main`'s ruleset, which only a public repository has.

**Each repository gets, at creation:**

- `CLAUDE.md` from the template: its own summary, then the marked block copied byte for byte
  from CanonCore's `main`, then its own Rules, Commands, Gotchas, Working substrate and landing. Under 200 lines.
- `docs/agents/issue-tracker.md` (Linear `jacobrees-canoncore`, team `CC`, project Design references,
  and how this repo lands), plus `triage-labels.md` and `domain.md` copied from CanonCore.
- `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.claude/settings.json` and `.gitignore` from
  `templates/`, with the CI changes below.
- Step 3's settings: Issues off, squash only, branches deleted on merge, Dependabot alerts on.

**The changes to `setup-orca-linear-project` (skills repo):**

1. **Add "Add a repository to an existing project"** to `SKILL.md`: steps 2 (repo only), 3, 11, 13,
   14 (the copy form above), 15, and 16 only for a repo that lands by PR. Keep
   `disable-model-invocation: true`, since the full skill creates orgs and workspaces; the first
   ticket names the section and the worker reads the file by path.
2. **Delete the template's Principles and Verify sections** and put in their place the two markers
   and the command that fills the block from CanonCore's `main`. The skill then holds no copy of the
   text, only the way to get it.
3. **Add two steps to `templates/ci.yml`'s "Agent docs" job**, and a weekly `schedule` so an idle
   repository still goes red: one that the markers exist and wrap a non-empty block, and one that
   the block matches CanonCore's `main`. CanonCore's own `ci.yml` runs only the first ("CLAUDE.md
   carries the standard between its markers"), since the master cannot be compared with itself on a
   PR that changes it. The comparison extracts the block, markers included, from both files:

   ```yaml
   - name: The standard matches CanonCore's main
     run: |
       url=https://raw.githubusercontent.com/jacobdrees-canoncore/CanonCore/main/CLAUDE.md
       block() { sed -n '/^<!-- standard:start -->$/,/^<!-- standard:end -->$/p' "$1"; }
       curl -fsSL "$url" -o "$RUNNER_TEMP/CLAUDE.md"
       diff <(block "$RUNNER_TEMP/CLAUDE.md") <(block CLAUDE.md) || {
         echo "::error file=CLAUDE.md::The standard block differs from CanonCore main. Fix: replace the lines between the markers with the same lines in $url"
         exit 1; }
   ```

4. **Keep the 200-line check,** its error quoting the 13th Principle.

**A new repository gets it from the first ticket of its spec,** "Start the `<name>` repository",
whose acceptance criteria are the file list above and a green first CI run. The two existing
repositories each need one ticket to catch up: `untitled-replica` (CI runs when the dispatcher
pushes `main`) and `prototype-snapshot` (after CC-42 lands, so the running agent is not disturbed).

**A change to the standard reaches every repository like this:** a CanonCore PR edits
the block in `CLAUDE.md`. Each other repository's next push, or Monday's scheduled run, fails
"The standard matches CanonCore's main" with the fix printed, and whoever works there next lands the
copy the way that repository lands anything. A change to the other templates (`ci.yml`,
`settings.json`, `.gitignore`) does not travel on its own: it is re-applied per repository with
step 15's `rsync`, which is honest for files that change a few times a year.

**What stays per repository:** the summary; the remote, landing and data-folder rules (untitled's
"never open a PR" is the opposite of prototype-snapshot's PR landing); Commands; stack CI jobs (lint,
test, a Swift build); Dependabot ecosystems; `.gitignore` additions such as `/captures/`; browser
exceptions such as untitled's Playwright capture; and `issue-tracker.md`'s landing section.

### Draft of the standard block

The 30 Sep proposal, kept as the record of what was weighed. The text in force is the block in
CanonCore's `CLAUDE.md`, whose 13th Principle is worded differently from the draft's.

```markdown
## Most Important: Verify, don't recall

Look up any version, API signature, limit or price before stating it (`context7` for a library,
`WebSearch` otherwise); the lookup wins over memory. The point is current industry practice: what
the ecosystem does today, not what it did when the model was trained. Before a spec or its tickets
publish, check what competitors do and run `/verify` on every claim a decision rests on.

## Principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
- Study how established products solve the problem before designing a solution. Adopt their proven patterns and conventions rather than inventing an approach from scratch.
- Do not introduce a configuration option, feature flag, or environment variable unless something in the repo reads it in the same change.
- Do not add a dependency without stating in the PR body what you checked in the existing dependencies first.
- Report status with evidence. "Tests pass" requires the command and its output. If a check was skipped, or failed, say so plainly rather than describing the work as complete.
- Prefer deletion. A change that removes more lines than it adds needs no justification; one that adds more needs a reason in the PR body.
- Keep CLAUDE.md a pointer file under 200 lines (CI checks the count). Repeated gotchas become checks (lint, hooks, CI), not prose in it.
```

"In the PR body" reads as "in the landing record" for a repository that lands by local merge; the
Owner may want that said, or left to each repository's landing rules.

### Open for the Owner

- **Principle 13:** the draft keeps CanonCore's pointer-file line and adds the 200-line limit CI
  already enforces, dropping the template's `.claude/rules/` advice (reference, better in
  `writing-for-agents`). Either original could win instead.
- **Sift and XMCP** carry the template's older text. Once the template stops carrying its own copy,
  a future non-CanonCore project would carry CanonCore's standard block too; whether that is wanted, or
  those projects keep their own, is a separate call.

## Claims not sourced

- That GitHub bills each job's partial minute rounded up: not found on the billing page read; the
  minutes figure above uses measured run times only.
- How `git submodule` behaves in an Orca-created worktree: inferred from git's usual need for
  `git submodule update --init` in a new worktree, not tested here.
- That a dispatched agent's terminal would wait on the external-import dialog: the docs say the
  dialog appears; that it blocks an Orca worker was not tried.
- What a missing `@` import target does (silently skipped, or an error): not stated in the docs read.
- That raw.githubusercontent.com rate limits will never touch a weekly check across ten
  repositories: not looked up; the load is a handful of requests a week.
