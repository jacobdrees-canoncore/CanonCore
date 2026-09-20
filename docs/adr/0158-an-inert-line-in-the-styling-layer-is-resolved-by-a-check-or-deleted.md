---
status: proposed
---

# An inert line in the styling layer is resolved by a check, or it is deleted

A glob that matches no file, a class that compiles to no CSS, a `"use client"` with nothing behind
it and an arbitrary value another rule overrides are all the same defect: a line that reads as
load-bearing and does nothing. Each one is either held to working by a check that runs the real
tool, or removed.

## Why this layer and not the others

**Everything else here has a compiler.** A wrong identifier in TypeScript is a build failure, a
wrong column in a query fails a test, a wrong import fails to resolve. The styling layer has none of
that, because every part of it is a STRING. A class name is a string the browser is content to
ignore, an `@source` glob is a string that is allowed to match nothing, and a directive is a string
whose only effect is on a bundle nobody diffs.

So the usual signal is absent in exactly the place the usual care is lowest, and four instances of
it stood at once, found by the 688-file scan (CNCORE-261):

- **`globals.css:4`'s `@source` matched zero files.** It read `"../../../apps/**/*.{ts,tsx}"`, and
  Tailwind resolves an `@source` against the DIRECTORY OF THE STYLESHEET, so three `..` from
  `packages/ui/src/styles` is `packages/` and the glob was `packages/apps/**`. The app was styled
  anyway, by `@tailwindcss/postcss` falling back to `base = e.base ?? process.cwd()` with Next
  running from `apps/web`. **The line a reader takes to be the mechanism contributed nothing, and
  the mechanism was a working-directory default nobody had written down.**
- **Four `cn-*` names, across five sites, compiled to no CSS**, and three of them shipped: the live
  production stylesheet carried zero `cn-` selectors while `/search` served `cn-font-heading` twice.
- **`label.tsx` carried `"use client"`** and rendered a bare `<label>` with no state, effect,
  handler, ref or browser API, shipping a client chunk to render markup the server had already sent.
- **`mode-toggle.tsx` sized its icons `h-[1.2rem] w-[1.2rem]`**, a value on no scale, which the
  Button's own `[&_svg:not([class*='size-'])]:size-4` overrode at (0,2,1) against (0,1,0). Both
  icons computed to 16px.

**None of them broke anything, which is the whole problem.** Nothing was red, so the only way any of
them could be found was somebody reading the file and doubting a line that looked fine.

## The check runs the real tool, and asks the vendor its own question

The instrument matters more than the rule here, because a hand-rolled version of either check is a
second implementation of somebody else's resolver, and it is wrong in the direction that matters: it
reports working code as broken, gets a `// this is fine` comment, and stops being read.

**Classes are asked of Tailwind's own design system.** `candidatesToCss` returns `null` for a
candidate that compiles to nothing, which is precisely the question, and it is what Tailwind's
IntelliSense uses to decide whether a class has a hover card. The rejected alternative was building
the stylesheet and matching escaped selectors in it, which needs an escaper agreeing with Tailwind's
character for character on `data-[side=bottom]:slide-in-from-top-2`. The loader is `__unstable__`,
and that is a known cost rather than an oversight: **an unstable API that answers the question beats
a stable one that answers a near-miss of it**, and if it disappears the failure is a missing export
at import time, which is loud.

**What is asked ABOUT is narrow where Tailwind's own extractor is deliberately wide.** The scanner
the build runs pulls candidates from any position in a file and lets the meaningless ones compile to
nothing — right for a build, wrong for this question, because it hands back `use client`, `label`
and every import specifier. So the check reads the three places a class is written here
(`className="…"`, a string in `cn(…)`, a string in `cva(…)`) and drops `cva`'s variant KEYS and its
`defaultVariants` values, which name rows rather than classes. Both exclusions were found by the
check reporting them as broken classes, which is the right way to find them.

**Globs are asked of a glob engine, and Tailwind's was used to check the answer rather than to give
it.** `node:fs`'s `globSync` and `@tailwindcss/oxide` agree on which of the three globs at issue
match nothing, checked on 2026-09-20 against the version the build runs. Asking through a package
Tailwind treats as internal would mean pinning its version in the catalogue beside the `tailwindcss`
that already owns it, to learn the same thing.

## The markers were residue, and the vendor's own CLI says so

This is the half that was got wrong twice before it was got right, and the method is the lesson.

The ticket first assumed the `cn-*` names were a strip shadcn's CLI had failed to finish. A `/verify`
pass then read a five-name `Set` in `shadcn/dist/utils/index.js` and reversed that: shadcn PRESERVES
these, so the choice is to declare the utilities or drop the markers. **Both readings were wrong, and
both were reached by reading minified source.**

Run instead — importing `transformFont`, `transformMenu` and `transformDirection` from
`shadcn/utils` and applying them to this repository's real components with this repository's real
`components.json` and `globals.css` — shadcn 4.21.0 deletes three of the four:

| marker | owned by | the key it reads | ours | result |
| --- | --- | --- | --- | --- |
| `cn-font-heading` | `transformFont` | `--font-heading:` in the project's CSS | absent | stripped |
| `cn-menu-target` | `transformMenu` | `menuColor` | `default` | stripped |
| `cn-menu-translucent` | `transformMenu` | `menuColor` | `default` | stripped |
| `cn-rtl-flip` | `transformDirection` | `rtl` | unset | survives: the transform is a no-op |

That `Set` is not a list of markers the project is expected to define. It marks the markers shadcn
KNOWS, so that its generic stripper — which deletes any UNKNOWN `cn-*` after looking it up in a
style map built from the project's own `.cn-x { @apply … }` rules — leaves them for the
config-driven transforms that own them. `@utility`, which the ticket grepped for and did not find,
defines none of the five and never would have.

**So the levers are `--font-heading:` in the theme and `menuColor` / `menuAccent` / `rtl` in
`components.json`, not a utility declaration.** `--font-heading` is declined: `packages/tokens`
defines colour and radius and no type at all, `globals.css` declares one family, and `layout.tsx`
already records deleting the generator's two font families as a deliberate deletion
([[0053-scaffold-once-then-own-the-output]]). A second typeface is a design decision and the
redesign is a later effort. All four markers go.

**THE GENERAL RULE IS THE ONE TO KEEP: run the vendor's code against your own configuration rather
than reading it.** Two careful readings of the same file reached two different wrong answers in a
day; one execution settled it in a minute.

## The directive is judged on a reason, not on a list

A module may carry `"use client"` when something in it needs a browser: a hook call, a handler it
binds, a browser global.

**There was a second, weaker ground, and CNCORE-276 removed it.** A module was also allowed the
directive when a package it imported marked a client boundary of its own, read off that package's
files rather than assumed from its name. Exactly one module ever passed on it, `dropdown-menu.tsx`,
and this record left open whether that one needed its directive at all. **It did not.** Measured on
2026-09-20 rather than argued: `apps/web` built clean three times and the client bundle came to
930,306 bytes with the directive and 930,306 without, every content-addressed chunk byte-identical.
The two bytes that did move, a chunk id and the `movePlacement` server-action hash, also move
between two builds of IDENTICAL source, so they are the build's nondeterminism. The directive went,
and the limb that was only ever keeping it went with it.

**What decided it was the render graph, which is why the import graph could never have.**
`dropdown-menu.tsx` has one importer here, `apps/web/src/components/mode-toggle.tsx`, which declares
the directive for itself because it calls `useTheme()`. The `onClick` it hands down therefore travels
client to client and crosses no serialization boundary. A server component may RENDER a client
component; what it may not do is PASS it a function, and no server component did either.

**THE RULE IS NOW COMPLETE FOR `packages/ui` AND WOULD FIRE FALSELY OUTSIDE IT**, which is a
boundary rather than an oversight, and the counterexample is named so it is not rediscovered.
`apps/web/src/components/theme-provider.tsx` carries the directive with no hook, no bound handler and
no browser global — the same shape `dropdown-menu.tsx` had, and the opposite answer, because
`layout.tsx` is a server component that reaches `next-themes` through it. Something in that chain
must declare the boundary. What separates the two is not what they import, it is who imports THEM;
CNCORE-283 is open on a check built on the importer graph, and until it lands this one stays where
it is.

## An overridden value gets deleted rather than tokenised

`h-[1.2rem]` was not inert in the sense the others were: it compiled to real CSS. It was inert
because a more specific rule won. The fix is deletion rather than a token, because the Button
already sizes its own icons from the spacing scale, and the `:not([class*='size-'])` in its selector
still matches once the arbitrary values are gone — so the rendered size is unchanged and one fewer
line claims to set it.

**This one gets no check, and that is stated rather than implied.** The only instrument that can see
a value losing to another value is a browser reading computed styles, and this repository's browser
suite builds Next and logs in, so it needs a database. The deletion rests on the specificity
arithmetic and on the measurement in CNCORE-261 instead.

## Why this stays PROPOSED

**Half the mechanism landed, and it is the smaller half.** Both checks run over `packages/ui` and
nothing else. `apps/web` is where most of this application's classes are written and where most of
its `"use client"` modules live, and neither check looks at it.

The two are not the same amount of work. The class check is nearly portable — it needs the app's
modules added to the sweep and `cva` is not used there, so the extractor gets simpler rather than
harder. The directive check is not, and CNCORE-276 CHANGED THE REASON WHY rather than removing it.
This record used to say that pointing the check at `apps/web` would mostly produce passes on the
import-graph ground and report a confidence it had not earned. That ground no longer exists, so the
failure mode is now the opposite one and it is worse: run over `apps/web` today, the check would
report `theme-provider.tsx` as unearned and be WRONG, because that module's reason is the render
graph rather than anything inside the file.

**What would finish it** is the class check extended over `apps/web`, and a directive check whose
ground is the IMPORTER graph — a directive earned by a direct client API, or by the module having an
importer that is itself a server module. That is CNCORE-283. Until both exist, the finding this
record was written for could recur one directory over and nothing would say so.

## Evidence

Every figure above came from running the thing named, on 2026-09-20: the glob counts from
`@tailwindcss/oxide@4.3.3` and `node:fs`, the marker table from shadcn 4.21.0's own exported
transforms, the specificity from Tailwind's compiled output for the two candidates, and the client
chunk from the running install. The stylesheet and computed-style measurements are CNCORE-261's.
