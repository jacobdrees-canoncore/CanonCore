# What to do next, and in what order

> **Superseded in part, 30 Sep 2026.** This note was grilled the same day, and
> `plan-2026-09-30.md` records what was decided; where they disagree, that record wins. Overruled
> here: the Faker seed (decision 3: a real snapshot instead), the prototype on a branch of this
> repository (decision 4: a private repository, ADR 0022), the portfolio as the design language
> (untitled.stream leads, ADR 0020), "four clients" (five: iPad was added, ADR 0009), the untitled
> remainder parked (decision 11: every web route before the web prototype), study sketches for
> Brink and MD Vinyl (decided after a look), cards for Apple TV (decision 9: a full recreation
> of Apple's TV app), brand research beside layer 1 (decision 10: the whole brand arrives at public
> release, CC-8, with a neutral face until then), study-only for unlicensed code (decision 7: use
> freely and ask for a licence before it ships, ADR 0019, with AML accepted), asking fayazara
> (decision 6: he agreed on 30 Sep), the prototype's start gates (decision 1: the web half waits for
> every untitled web route, the snapshot and the folder's web port; the Apple half for the untitled
> app replica), the recreation order (decision 8: the Brink look, the MD Vinyl look, then the
> untitled app on the phone; America.gov after untitled web), recording the web stack later
> (decision 5: now ADR 0021), and step 6's fixed budget (one session per follow-up). The graph's
> last two lines follow from these: the untitled remainder now blocks the web prototype and
> America.gov, and the brand no longer feeds the prototype. Later the same day the replica's
> coverage report was regenerated (13:41 UTC: 27 captured, 2 partial, 21 not captured, 12 built).
> The research below stands as a snapshot of 30 Sep.

Research note, 30 Sep 2026. Question from Jacob: "what we should do and in what order", written
so the plan can be grilled with `/grill-with-docs`. It covers the design references (the
untitled.stream replica and the other recreations), the bookmark decisions, the design prototype,
the ten product projects and the TMDB question.

Repo and Linear facts carry the file or ticket they came from. "(measured)" means read on this
date from the named source. Everything else carries a link to its owner.

## Where things stand

**No CanonCore code exists.** The README says so, and `CLAUDE.md` lists no commands until project
1 adds the pnpm and Turborepo monorepo (ADR 0016). The records are 18 founding ADRs in
`docs/adr/`, the glossary `CONTEXT.md`, and two design notes in `docs/design/`.

**Ten product projects wait in Backlog as early specs** (measured, Linear team CC): CC-2 Play Rose
on every device (project 1), CC-13 Orderings and franchises (2), CC-4 Friends and profiles (3),
CC-10 The CMPP Store (4), CC-7 Music (5), CC-12 Books and audiobooks (6), CC-9 Comics (7), CC-11
Playback polish (8), CC-6 Filming locations and songs (9), CC-8 Public release (10). The order is
D-88 of the deleted grill record (`git show fc2f3f07^:docs/rethink/grill-decisions.md`).

**Project 1 is gated on design.** CC-2's first open decision reads: "Design is decided by the design
prototype on all four clients before this spec is written, including curation on Apple TV with a
remote". CC-13 says the same of its own screens: the Franchise page, "As a timeline", "Also in" and
Entity pages "come from the design prototype on all four clients".

**The design prototype's plan now lives only in git history.** D-66 set it: all four clients,
Matt Pocock's `prototype` UI sub-shape B, `?variant=` on the web with a floating switcher, an
equivalent SwiftUI picker, 3 variants by default and at most 5, on a `prototype/design` branch, "on
real data (the library-model fetch)". D-98 step 8 placed it after the founding records and before
project 1's spec. `docs/rethink/` was deleted in fc2f3f07, and CC-15 still cites "D-98 step 8".

**CC-3 and CC-5 are already gone.** Both were seed duplicates from 28 Sep: CC-3 duplicated CC-13
(its own comment says "Filed in error during setup ... The spec for this project is CC-13"), and
CC-5 duplicated CC-10 with no comment. Both were trashed on 28 Sep (activity log, 23:53 UTC), which
is why `list-issues` does not return them; read by id they still show Backlog, which is why they
looked open (measured).

**The untitled.stream replica (CC-15) is part-way.** It lives in the local-only repo
`~/canoncore/untitled-replica`, tracked in the Linear project "Design references" (replica D13).
Done: CC-16 (the loop on the empty library), CC-17 (capture), CC-18 (seed), CC-29 (site assets),
CC-30 (Storybook). In Progress: CC-19 (app shell and player; branch `cc-19`, last commit 30 Sep
11:35). Todo: CC-31 (serve the site folders, blocked by CC-29) and CC-20 to CC-27 (the screens).
Its coverage report (`~/canoncore/untitled-replica-data/reports/coverage.md`, generated 30 Sep
10:50 UTC) counts 295 manifest routes, of which 50 are screens: 26 captured, 1 partial, 23 not
captured, and 1 built (the library, whose comparison records 0 of 42 passing; the Owner accepted
the empty library at 1400px for CC-16, where every difference is a text width caused by Klim's
66-character test build). CC-20 to CC-27 are blocked only by CC-17, CC-18 or CC-19, with no edges
among themselves, although the delivery order (replica D14, `docs/untitled-stream-capture.md`,
section 4) is a sequence (measured).

**The replica is meant to feed the prototype early.** CC-15 story 32: "I want the first slice
(shell plus library) handed to CanonCore's design prototype as soon as it passes, so that step 8 is
not waiting on 300 routes." The replica's own D14 says the same.

**The bookmark grill made new decisions** (`docs/design/x-bookmarks.md`, merged in PR #7 on 30
Sep). 85 bookmarks were sorted: 6 Recreate, 18 UI system, 3 Inspiration and UI system, 42
Inspiration, 16 Skip. The recreations are untitled.stream (web under way, plus a SwiftUI replica
of its app), America.gov (web), Brink and MD Vinyl (SwiftUI). Wafer's console was dropped and the
frosted-folder portfolio moved out of Recreate on 30 Sep: its code already exists, so it is used, not
rebuilt. None of the four remaining recreations publishes its source (checked on GitHub, 30 Sep).
The portfolio is "a foundation, not one reference among many". Adopt: shadcn/lint and
Google Stitch's DESIGN.md. Evaluate: Arc and ObsidianUI. A brand with a mascot is "its own piece of
work, later". Five follow-ups are listed. None of this has a Linear ticket yet (measured: the only
Design references tickets are CC-15 to CC-31).

**CC-15 still says the opposite on native replicas.** Its Out of Scope lists "Native iOS, Android
and macOS versions of untitled.stream"; the bookmark decisions (30 Sep) add a SwiftUI replica of
its app (App Store id 6445854828).

**No other recreation has started** (measured: `~/canoncore/` holds only `untitled-replica` and its
data folder).

**TMDB has not answered.** CC-14 (needs-info) records the question sent on 29 Sep: may CanonCore
ship one key, and may the public demo use TMDB. No answer or comment is recorded (measured). CC-2
already has the fallback: "Until TMDB says yes in writing, the Admin's own key is the only path in
the first Store."

## The dependency graph

Arrows read "must come before". Anything not joined by an arrow can run at the same time.

```
untitled web core (CC-19, 31, 20, 21, 22, 25) ─┐
folder foundation study ───────────────────────┤
one SwiftUI recreation (method proved) ────────┤
UI-system evaluation + web styling stack ──────┼──> design prototype, layer 1 ──> CC-2 refresh ──> project 1 ──> CC-13 ...
seeded data set ───────────────────────────────┤        (project 1's screens,         (spec, tickets)   (build, walk)
Apple TV study ────────────────────────────────┘         all four clients)
                                                          │
                                                          └──> design prototype, layer 2 ──> each later spec's refresh
                                                                (Orderings, Entities, readers,
                                                                 profiles, Store)
follow-ups (B2TF, fayazara repos, DESIGN.md files) ──> prototype variants (feeds, never blocks)
brand and mascot research ──> prototype's type and colour pick; mascot ──> CC-8 public release
TMDB answer (CC-14) ──> CC-2 detail (shipped key default) and CC-8 (demo data); blocks neither start
untitled remainder (CC-23, 24, 26, 27), America.gov ──> nothing downstream waits on them
```

What each edge rests on:

- **Prototype before CC-2's spec**: CC-2 open decision 1, and D-98 steps 8 and 9.
- **Layer 2 before later specs, not before project 1**: CC-13 assigns its visual design to the
  prototype, and CC-2 needs only its own screens. The principle "Grow the system in layers. Start
  from the smallest version that works end to end" (`CLAUDE.md`) argues against holding project 1
  for screens it does not ship.
- **Untitled core before the prototype**: CC-15 story 32 and replica D14 name the shell and library
  as the hand-off. Project and track screens (CC-21, CC-22) are the closest untitled has to an
  Item page and a Show page. Sign-in and onboarding (CC-25) bear on CanonCore's first run.
- **First run matters early**: both big competitors open on a first-run wizard. Plex: "The first
  time you open Plex Web App, a Startup Wizard will load" to name the server and set up libraries
  ([Plex, Basic Setup Wizard](https://support.plex.tv/articles/200288896-basic-setup-wizard/)).
  Jellyfin: language, administrator account, media libraries, metadata language, networking
  ([Jellyfin, setup wizard](https://jellyfin.org/docs/general/post-install/setup-wizard)).
  CanonCore's first run differs (install a Provider, import by Proposal, then Match: ADR 0001,
  0002), so it has no competitor screen to copy and must be in layer 1.
- **SwiftUI method before the Apple half of the prototype**: the web replica proves exactness by DOM
  and pixel comparison (CC-15 Testing Decisions). A SwiftUI replica built from App Store screenshots
  has no DOM, so its method is unproved until one is done.
- **Web styling stack before the web prototype**: shadcn/lint "works with Tailwind v4 projects"
  ([shadcn-ui/lint README](https://github.com/shadcn-ui/lint)); Arc installs "with the shadcn CLI"
  and uses Motion ([Arc README](https://github.com/kuratlielia/arc-library)); ObsidianUI is "React &
  Tailwind CSS" with a shadcn registry ([ObsidianUI](https://github.com/Atharvsinh-codez/ObsidianUI));
  uselayouts is Framer Motion and Tailwind ([uselayouts](https://github.com/iurvish/uselayouts)).
  CC-2's web stack (React 19, Vite 8, TanStack Router 1) names no styling system, so adopting any
  of these is a decision the prototype has to make first.
- **TMDB blocks nothing**: CC-14's own "what each answer changes" gives a path for no reply.

## Recommended order

Each step names what it needs and when it is done. Steps 1 to 6 overlap; see the next section.

**Step 0. Tidy the board (an hour).** Add blocked-by edges
along CC-15's delivery order (CC-20 after CC-19 and CC-31; CC-21 and CC-22 after CC-20; the rest
after those) so the frontier is computed rather than remembered (`docs/agents/issue-tracker.md`,
"The task graph"). Amend CC-15's Out of Scope to match the SwiftUI decision. File one spec per
further recreation, and the follow-ups as `spike` tickets, in Design references. Write D-66's
prototype plan into a live record (the prototype's own spec issue), since its only source is
deleted. *Done when* the Design references frontier from `orca linear issue CC-15 --children
--relations` matches replica D14, and no open issue points at `docs/rethink/`.

**Step 1. Finish the untitled core slice.** CC-19, CC-31, CC-20, then CC-21, CC-22 and CC-25. One
capture agent at a time (dark mode is account-wide: replica `CLAUDE.md`); build-only tickets may
run beside it (replica commit 424a66f). *Done when* each of those screens passes the reference
comparison at every width, theme and state, or its remaining differences are recorded and accepted
by the Owner as CC-16's were, and story 44's per-screen notes on tokens, layout and patterns exist.

**Step 2. Study the folder foundation.** The portfolio is an Astro 7 site with Tailwind 4 and
Motion (measured, its `package.json`), so it runs as it is; nothing needs capturing. The work is to
measure the folders and their opening animation (durations, spring settings, blur, how contents
peek) into a card, then try the folder-to-gallery open once in React and once in SwiftUI, including
on tvOS, where movement is by the focus system ([Apple HIG, Designing for tvOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-tvos):
"Embrace the tvOS focus system"). *Done when* the card exists and both ports show whether the
metaphor survives a remote. No code from the repo enters CanonCore until licensing is settled
(decision 6).

**Step 3. Prove the SwiftUI recreation method on one app.** Start with untitled's own app, because
it pairs with the web replica and shows how one product adapts across platforms; Brink next, for
its player and cover tint; MD Vinyl for its first-run tour. iTunes Lookup gives 8 iPhone
screenshots for [untitled] and 10 for MD Vinyl, and 0 Apple TV screenshots for either (measured,
`itunes.apple.com/lookup`, GB store). *Done when* the first replica's key screens sit beside their
screenshots in Xcode previews and the Owner accepts the method; the spec for the others then copies
it.

**Step 4. Settle the web styling stack and the agent rules.** Evaluate Arc and ObsidianUI against
React 19, Vite and TanStack Router; decide Tailwind v4 with the shadcn registry and Motion; set up
shadcn/lint (0.2.0 on npm, measured) and a first DESIGN.md. DESIGN.md "combines machine-readable
design tokens (YAML front matter) with human-readable design rationale (markdown prose)"
([google-labs-code/design.md](https://github.com/google-labs-code/design.md), Apache-2.0).
*Done when* the choice and the licence table below are agreed, and the DESIGN.md skeleton exists
for the prototype to fill.

**Step 5. Build the seeded data set.** One deterministic data set in CanonCore's own shape
(`CONTEXT.md`): every medium and hierarchy of ADR 0005, Editions and Versions (ADR 0006), Missing
Items, Offline Versions, Unmatched files, Repeats (ADR 0007), a long Timeline (ADR 0014 names a
603-Placement one), Entities, several Profiles, long and short titles, absent artwork. A seeded
generator such as Faker (`@faker-js/faker` 10.6.0 on npm, measured) keeps it repeatable. It must
not be Doctor Who alone (ADR 0008). The web and SwiftUI prototypes read the same file. *Done when*
one file drives both clients and covers every glossary term that has a screen.

**Step 6. Run the follow-ups, time-boxed.** B2TF's 38 apps, fayazara's repositories, competitors'
DESIGN.md files (awesome-design-md, MIT), the dhruvmakes post, backgrounds.supply. Each yields
cards, not decisions. *Done when* each has its cards and a one-line verdict, within a fixed budget
set in the grill. Nothing waits on these.

**Step 7. Design prototype, layer 1: project 1's screens on all four clients.** First run, the
first Store with TMDB, search and the import Proposal, Matching and Unmatched files, the Library,
an Item page with Editions and Versions, the player, device-code pairing, and Apple TV curation
with a remote (CC-2 stories and Modules). Three variants each, at most five (D-66; the `prototype`
skill's UI.md). The web renders in Storybook, whose stories are "a declarative syntax for supplying
props and mock data to simulate component variations" ([Storybook, Why
Storybook](https://storybook.js.org/docs/get-started/why-storybook)), plus `?variant=` routes;
SwiftUI uses Xcode previews, which show "a preview of the view's content that stays up-to-date"
([Apple, Previews in Xcode](https://developer.apple.com/documentation/swiftui/previews-in-xcode)).
This is component-driven order: build components, combine, then "Assemble pages ... Use mock data
to simulate pages in hard-to-reach states", and only then integrate with the back end
([Component Driven UIs](https://www.componentdriven.org/)). *Done when* the Owner has picked a
variant per screen on each client, DESIGN.md holds the tokens, and the verdicts are on CC-2.

**Step 8. Refresh CC-2 and build project 1.** `/grill-me` on its open decisions, `/to-spec`,
`/to-tickets`, `/implement` (CC-2 header and D-98 step 9). *Done when* its own "Done when" is met:
the Owner imports Doctor Who (2005), matches Rose.mkv, watches it on the Apple TV and resumes it on
the iPhone, the Mac and the web, and walks it with the accessibility pass (`CLAUDE.md`, "How a
project closes").

**Step 9. Design prototype, layer 2, running beside project 1.** Orderings, "As a timeline", "Also
in", Franchise and Entity pages first (CC-13 is next), then profiles, the full Store, the readers.
*Done when* each later spec, at its refresh, finds its screens already picked.

**Step 10. The remaining projects in D-88 order**, each refreshed when its turn comes. The
remaining untitled screens (CC-23, 24, 26, 27), America.gov continue only as spare
capacity allows, because nothing downstream waits on them.

## What can run in parallel

Assuming about four agents at once, four lanes keep every slot busy without two agents fighting over
one resource:

1. **Untitled lane.** Steps 1 then the remainder. Only one capture agent at a time; a build-only
   ticket can share the lane.
2. **Apple lane.** Step 3, then the SwiftUI half of step 2's port, then the SwiftUI half of step 7.
3. **Web lane.** Step 2's study and React port, step 4, then the web half of step 7.
4. **Research lane.** Step 5's seed (early, since both prototypes need it), step 6's follow-ups,
   the Apple TV study (decision 9), brand research, the licence requests, and CC-2's facts to
   measure: the Whatbox upload allowance, the backup destination and whether `@reboot` fires (CC-2
   Further Notes).

Steps 7 and 8 draw two lanes each when they arrive: web and Apple for the prototype, then server,
web and Apple for project 1.

## Licences for anything the plan might copy

CanonCore is AGPL-3.0 (ADR 0018). Code that enters its repo must be under a licence that allows
it. Checked with the GitHub API on 30 Sep 2026:

| Source | Licence | Consequence |
| --- | --- | --- |
| fayazara/portfolio-site-template (folders) | none (its README says MIT, but no LICENSE file) | Study and reimplement; copying needs a written grant |
| fayazara/macos-app-skills | none | Read as guidance only |
| kuratlielia/arc-library (Arc) | MIT | May be used |
| Atharvsinh-codez/ObsidianUI | MIT | May be used |
| iurvish/uselayouts | MIT | May be used |
| danielwh2/cuelume | MIT | May be used |
| shadcn-ui/lint | MIT | May be used |
| google-labs-code/design.md | Apache-2.0 | May be used |
| VoltAgent/awesome-design-md | MIT | May be used |
| davidmokos/beautiful-expo (progressive blur) | MIT | Expo, not SwiftUI: the effect only |
| armondschneider/interactionkit | MIT declared in README and package, no LICENSE file | May be used, with an MIT notice; ask for a LICENSE file |
| Boring-Software-Inc/dither-kit | MIT declared in package.json, no LICENSE file | May be used, with an MIT notice; ask for a LICENSE file |
| DavidHDev/react-bits | MIT plus Commons Clause | Study only (see below) |

**No licence means no copying.** GitHub: "without a license, the default copyright laws apply ...
no one may reproduce, distribute, or create derivative works from your work"
([GitHub, licensing a repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)).
The Owner reports verbal permission for the folders; a public AGPL repo needs that in writing, as
a licence the author can add to the repo.

**Commons Clause is a further restriction.** React Bits' licence forbids selling or redistributing
"the components themselves ... as a ported version". AGPL-3.0 section 10: "You may not impose any
further restrictions on the exercise of the rights granted or affirmed under this License"
(`LICENSE`, line 451).

## Risks

- **The references outrun the product.** Nothing of CanonCore exists, the untitled replica has 1
  of 50 screens built in its first day (report 10:50 UTC, 30 Sep), and the bookmark grill added three more recreations.
  Waiting for all of them before the prototype contradicts "Grow the system in layers" and "Never
  trade a working product for unfinished complexity" (`CLAUDE.md`).
- **A prototype of everything becomes the product.** Four clients, dozens of screens and three
  variants each is a large build. Matt Pocock's rule is "Throwaway from day one" and "The main
  branch keeps only the validated decision" (`prototype` skill, rules 1 and 6). Layering it (steps
  7 and 9) keeps layer 1 small.
- **Seeded data looks fine where real data would not.** The `prototype` skill prefers real data and
  density (UI.md: "real header, real sidebar, real data, real density"). A synthetic seed must reach real
  scale and real ugliness (long titles, missing art, thousands of Items), or it misses that density.
- **Apple TV has no reference.** None of the four recreations is a tvOS app, and neither App Store
  listing looked up carries an Apple TV screenshot (measured). CC-2 still needs "curation on Apple
  TV with a remote".
- **Licences.** The foundation Jacob wants to copy exactly has no LICENSE file; one studied source
  has none (macos-app-skills); React Bits carries the Commons Clause.
- **Fonts.** The replica renders with Klim's test build of Untitled Sans (replica research note,
  section 5). CanonCore needs its own faces, licensed for web embedding and app embedding, which is
  a brand decision (the serif-with-sans theme in `x-bookmarks.md`).
- **The capture depends on the Owner.** A Cloudflare challenge or expired session stops a run and
  needs his sign-in (replica `CLAUDE.md`), so the untitled lane stalls when he is away.
- **Records have drifted.** D-66 and D-98 exist only in git history; CC-15 contradicts the SwiftUI
  decision; D-66 said "real data" and the Owner now asks for seeded data; ADR 0016 says Node 24 and
  CC-2 says Node 26 LTS. Each is small, and each misleads an agent that reads it cold.

## Open decisions for the grill

1. **What "done" means for the recreations before the prototype starts.** Recommended: the untitled
   core slice (CC-19, 31, 20, 21, 22, 25), the folder study with both ports, and one proved SwiftUI
   recreation. Everything else continues beside the prototype. Rests on CC-15 story 32, replica
   D14, and the layers principle.
2. **How much of "everything" the first prototype covers.** Recommended: every project's screens
   appear in one navigation shell so the structure is judged whole, but variants go only to project
   1's screens and the shell (layer 1); the rest get variants before their own spec (layer 2).
   Rests on CC-2 open decision 1 and CC-13, which each ask the prototype only for their own screens.
3. **Seeded or real data.** Recommended: a deterministic synthetic seed in CanonCore's shape as the
   default, at real-corpus scale, across every medium; the `prototype/library-model` real data (TMDB
   and Tardis Fandom, Doctor Who only) as a second switchable set for stress. Rests on ADR 0008,
   D-66, and UI.md's preference for real data and density.
4. **Throwaway or foundation.** Recommended: throwaway, on `prototype/design`, with DESIGN.md, the
   tokens and the verdicts as what is kept. Rests on D-66 and the `prototype` skill's rules 1 and 6.
5. **The web styling stack.** Recommended: Tailwind v4, the shadcn registry and Motion (`motion`
   13.4.6, MIT, on npm), since shadcn/lint works with Tailwind v4, ObsidianUI and uselayouts are
   Tailwind components installed by the shadcn CLI, and Arc installs by the shadcn CLI with Motion
   (its styles are CSS modules, no Tailwind needed). Record it at CC-2's refresh, as an ADR if the grill finds it hard to reverse.
   Rests on the four READMEs cited above.
6. **The folder foundation: copy or reimplement.** Recommended: ask fayazara for a licence added to
   the repo (MIT would do); until it exists, reimplement from measured behaviour. The code is Astro,
   so the web client ports it either way. Rests on GitHub's no-licence statement and ADR 0018.
7. **A standing rule for outside code.** Recommended: only code under a licence compatible with
   AGPL-3.0 enters the repo; no-licence and Commons Clause sources are study-only. Rests on AGPL
   section 10 and the licence table.
8. **Which recreations, in what order.** Recommended: untitled web core, untitled SwiftUI, Brink,
   MD Vinyl; America.gov after the prototype's layer 1. Rests on how close each is to a media player (Brink's player and cover
   tint, MD Vinyl's first-run tour) against America.gov's single ask bar.
9. **An Apple TV reference.** Recommended: add a tvOS study, as cards rather than a replica, of how
   Infuse, Swiftfin, Plex and Apple's TV app handle focus, rows and curation, read against Apple's
   tvOS guidance. Rests on the Apple TV gap above and CC-2's remote-curation requirement.
10. **When the brand arrives.** Recommended: brand research runs beside the prototype so type and
    palette are picked in layer 1; the mascot follows by CC-8 (public release). The prototype uses
    a placeholder wordmark until then. Rests on `x-bookmarks.md` ("later") and D-90's README
    showcase, which is public from project 1.
11. **The remaining untitled screens.** Recommended: park CC-23, 24, 26 and 27 until layer 1 is
    picked, then resume; D4 wanted every route, so the Owner decides whether "every" still holds.
12. **Where the design work is tracked.** Recommended: one spec per recreation and one for the
    prototype in Design references, each with blocked-by edges, and the follow-ups as spikes.
    Rests on `docs/agents/issue-tracker.md`.
13. **TMDB.** Recommended: do not wait. If no answer by CC-2's refresh, the Admin's own key stands,
    as CC-2 and CC-14 already provide.
14. **How America.gov is recreated.** Recommended: the untitled pipeline (capture every width and
   theme, download the site's assets, rebuild as a standalone site, show each piece in Storybook), as
   one small addition to it rather than a new pipeline: the site is roughly one long page against
   untitled's 50 screens. The ask bar's look and motion are copied, not its live AI service. Its first
   ticket proves the capture end to end, since the site is behind Cloudflare and the 30 Sep captures
   rendered only the hero. Before anything is copied, check each asset's rights: work by federal
   employees has no copyright (17 U.S.C. 105, https://www.govinfo.gov/content/pkg/USCODE-2024-title17/html/USCODE-2024-title17-chap1-sec105.htm),
   but a contractor's work can (ARL brief, https://www.arl.org/wp-content/uploads/2015/06/copyright-status-of-government-works.pdf),
   and photos and fonts may carry their own licences. Rests on Jacob's 30 Sep question and the
   untitled pipeline's tickets (CC-16, 17, 29, 30).

## Claims not sourced

- That React Bits Micro (bookmark 19) is covered by the DavidHDev/react-bits licence was not
  checked; it may be a separate product.
- Bencho.dev has no public repository that I could find, so its licence is unknown.
- That Brink has no Apple TV screenshots was not checked by id (only [untitled] and MD Vinyl were).
- Whether Infuse, Swiftfin and Plex's tvOS apps are the right study set is my recommendation, not a
  measured comparison.
