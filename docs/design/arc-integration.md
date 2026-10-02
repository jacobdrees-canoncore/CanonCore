# Arc in an existing Tailwind 4 + shadcn project: what Arc says

1 Oct 2026. Primary sources only, all fetched 1 Oct 2026. Repository files are quoted at
`kuratlielia/arc-library` commit `3f9a1f45d22f0120f4a05153fbb9a44ef170b65a` (2026-10-01T08:35:42Z,
"Sync from source a44341f"). Where a statement is mine rather than Arc's, it is marked **Observation**.

## What Arc says to do

Arc says to install it through the shadcn CLI as an ordinary shadcn registry (`@uiarc`, plus the token-gated
`@uiarc-pro`), into an `arc/` folder under the `components` alias, and to import one stylesheet,
`components/arc/foundation.css`, once at the root. Its components are CSS modules over its own CSS variables, "not
Tailwind classes, so they install cleanly next to Tailwind or without it". That is the whole of its Tailwind story:
coexistence, not integration. It publishes no Tailwind variant, no `@theme` mapping and no conversion guide, and it
never mentions Base UI. Theming is done by overriding Arc's own semantic variables after importing the foundation;
Arc does not read shadcn's variables, it defines its own, several with the same names (`--background`,
`--foreground`, `--border`, `--accent`). Primitives, where used, are Radix (9 packages across 17 of the 123 free
items, corrected 2 Oct; see section 3); everything else is hand-built on Motion. For agents it ships a read-only MCP server, `llms.txt`, a skill and
an `INSTRUCTIONS.md` whose rules include "no Tailwind color classes" and "no focus rings". Pro source may sit in a
public open-source app repository as part of an end product, with the Arc Pro notice kept and a note that those files
are outside the project's licence; the licence page is dated 26 Sep 2026 and marked a draft.

## 1. Coexisting with Tailwind CSS (v4)

Arc documents coexistence in one sentence and requirement-free in two others. Nothing names Tailwind v4.

- Guide "Use shadcn registries with AI coding tools", https://uiarc.dev/guides/shadcn-registry-ai-coding-tools
  ("Updated September 23, 2026"):
  > "Arc components use CSS modules and CSS variables, not Tailwind classes, so they install cleanly next to Tailwind or without it."
- Installation, https://uiarc.dev/docs/installation, Requirements:
  > "A React 19 project with TypeScript and the @/* path alias. Arc components use CSS modules and CSS variables, so they work without Tailwind."
- `README.md` (repo, commit above), Requirements:
  > "No Tailwind is required. Arc styles are CSS modules that read CSS variables."
- https://uiarc.dev/llms.txt, Install:
  > "Components use CSS modules and CSS variables, not Tailwind classes."
- Agent rules forbid Tailwind colour utilities on Arc surfaces. `INSTRUCTIONS.md`
  (https://uiarc.dev/r/skills/arc/INSTRUCTIONS.md), Never:
  > "Raw hex, Tailwind color classes, weights above 500, or arbitrary font sizes."

  and `SKILL.md`: "Raw hex, Tailwind color classes, or arbitrary font sizes on Arc surfaces." `design.md`: "Never the
  `--neutral-*` ramp, raw hex, or Tailwind color classes."

Tailwind variant or registry: none. The registry (https://uiarc.dev/r/registry.json, 124 items) has one namespace and
every UI item ships a `.module.css`. No item uses Tailwind classes (checked in `button.tsx` and `dialog.tsx`).

Converting CSS modules to Tailwind classes: Arc does not say. The opposite direction exists only as a Pro skill,
"Refactor to Arc: Migrate custom, shadcn/ui, MUI, or Chakra UI to Arc with parity checks" (https://uiarc.dev/docs/ai).
The agent rules also say "Compose and wrap Arc components; never fork or restyle their internals"
(`INSTRUCTIONS.md`, Always 2).

Counts: the word "tailwind" appears once in `llms.txt` and once in the 1.4 MB `llms-full.txt` (the same install
line), zero times in `llms-small.txt` and `/r/catalog.json`. `/docs/tailwind` returns 404.

## 2. Theming and `arc-foundation`

`https://uiarc.dev/r/arc-foundation.json` is a `registry:item` (`meta.tier: "free"`, `kind: "foundation"`, no npm
dependencies) with three files:

| Source path | Installs to |
| --- | --- |
| `registry/foundation.css` | `@components/arc/foundation.css` |
| `registry/motion-tokens.ts` | `@components/arc/motion-tokens.ts` |
| `lib/motion-tokens.ts` (re-export) | `@components/arc/lib/motion-tokens.ts` |

Its `docs` field:
> "Import the tokens once in your root layout: import "@/components/arc/foundation.css" (Arc installs into an arc/ folder under your components alias). Set data-theme="dark" on <html> for dark mode and data-accent (violet, blue, green, amber, orange, coral, rose) to change the accent. Arc files import each other with relative paths, so any alias setup works."

What `foundation.css` defines, all on `:root` as plain custom properties (no `@theme`, no `@layer`):

- a neutral ramp `--neutral-0` to `--neutral-11` (oklch);
- semantic colours `--background`, `--surface`, `--surface-raised`, `--surface-muted`, `--foreground`,
  `--text-secondary`, `--text-muted`, `--border`, `--border-subtle`, `--border-strong`, `--accent`,
  `--accent-strong`, `--accent-subtle`, `--accent-foreground`, `--success`, `--warning`, `--danger`;
- `--control-*` for switches, checkboxes, radios and sliders;
- shadows, an `--arc-gradient*` family, `--space-1..24`, `--radius-control` (1.125rem), `--radius-panel`,
  `--radius-surface`, `--radius-pill`, control heights, `--font-display` / `--font-body` (reading `--font-geist`
  and `--font-inter`), a `--text-*` size scale, tracking, leading, easings and durations;
- `:root[data-theme="dark"]` overrides, `:root[data-accent="…"]` for eight accents, and `--series-1..4` chart
  colours derived from `--accent` with relative colour syntax;
- and, last in the file:
  > `/* No focus rings or outlines for any input method (product decision). */`
  > `:is(*:focus, *:focus-visible, *:focus-within) { outline: none !important; }`

  with `--focus-ring: transparent` commented "Product decision: no focus rings anywhere."

How Arc says to theme. Theming page, https://uiarc.dev/docs/theming, "Your own brand":
> "Override roles after importing the foundation. Keep contrast in mind and set dark values separately."

followed by an `app/globals.css` example that `@import`s `../components/arc/foundation.css` and then sets `--accent`,
`--accent-strong`, `--accent-subtle`, `--radius-control` on `:root` and dark values on `:root[data-theme="dark"]`.
The same page: "Components only use semantic roles, never raw colors. Change a role and every component follows, in
both themes." Dark mode is the `data-theme="dark"` attribute on `<html>`, set by an inline script reading
`localStorage` and `prefers-color-scheme`. A Pro skill, "Design system generation: A brand theme on Arc tokens with
contrast checked in both themes", exists behind the paywall.

Mapping Arc tokens onto an existing token set (Tailwind v4 `@theme`, shadcn variables): Arc does not say. Does it
read shadcn's variables (`--primary`, `--card`, `--ring`, `--radius`)? No: `--primary` appears nowhere in
`llms-full.txt`, and the CSS of `button` and `dialog` reads only Arc names (button: `--background`, `--border`,
`--danger`, `--foreground`, `--surface`, `--surface-muted`, `--text-secondary`, `--focus-ring`, `--radius-control`,
`--space-*`, `--control-height-*`, durations and easings; dialog similar, plus `--surface-raised`,
`--shadow-floating`, `--radius-surface`).

**Observation (not Arc's words).** Four Arc names are also shadcn names: `--background`, `--foreground`, `--border`,
`--accent` (plus `--accent-foreground`). Both write them on `:root`, so whichever stylesheet loads later wins for
both libraries. The meanings differ: shadcn's `--accent` is a quiet hover surface, Arc's is the selection and
progress colour. Arc's dark mode keys on `data-theme="dark"`, shadcn's default on a `.dark` class. And the global
`outline: none !important` removes focus outlines from the whole page, shadcn components included. Arc offers no
prefix or scoping option for any of this.

## 3. Primitives

**Correction, 2 Oct 2026.** Re-verified for ADR 0023: Radix in 17 of 123 free items, never Base UI. A
second read of `/r/registry.json` at 13:07 UTC the same day found 128 items, all `tier: "free"`,
with 19 using Radix (button-group and floating-button-group added) and the same nine packages: the
registry grows, so quote a count with its date. The tally below is the 1 Oct snapshot of 124 items; why the 2 Oct verify counted 123 free items was not traced.

Source: https://uiarc.dev/r/registry.json (shadcn `registry.json` schema, name `arc`, 124 items: `arc-foundation`,
`arc-skill`, 100 `registry:ui`, 22 `registry:block`). `/r/index.json` and `/registry.json` return 404. Full tally of
`dependencies` over all 124 items:

| Package | Items |
| --- | --- |
| `motion` | 118 |
| `lucide-react` | 77 |
| `@radix-ui/react-dropdown-menu` | 4 (split-button, dropdown-menu, swipe-actions, page-header) |
| `@radix-ui/react-dialog` | 4 (drawer, dialog, card, bottom-sheet) |
| `@radix-ui/react-popover` | 3 (popover, hover-card, notification-center) |
| `@radix-ui/react-tabs` | 2 (tabs, page-header) |
| `@radix-ui/react-select`, `-checkbox`, `-switch`, `-accordion`, `-tooltip` | 1 each |
| `@base-ui/*` or any other primitive library | 0 |

17 items use a Radix primitive (the table's rows sum to 18, and page-header appears twice; this
line said 15 until the count was re-verified on 2 Oct 2026, against 123 free items); the rest (combobox, context-menu, radio-group, slider, calendar, date-picker,
multi-select, resizable-panels, toast and so on) are Arc's own on Motion. 122 of 124 items ship a `.module.css`
(the two without are `arc-foundation`, which ships `foundation.css`, and `arc-skill`). Every UI item has
`registryDependencies` on `https://uiarc.dev/r/arc-foundation.json`.

Pro (from https://uiarc.dev/r/catalog.json, 101 Pro items, metadata only): `motion` 100, `lucide-react` 87,
`@radix-ui/react-dropdown-menu` 4, `@radix-ui/react-tooltip` 4, `-popover`, `-dialog`, `-select` 1 each. No Base UI.

Repo `package.json` devDependencies pin the same nine Radix packages (for example
`"@radix-ui/react-dialog": "^1.1.23"`), `"motion": "^13.4.0"`, `"react": "^19.3.0"`, `"next": "^16.3.5"`.

What Arc says about primitives: `README.md`, Requirements:
> "Some items also use [lucide-react](https://lucide.dev) or a [Radix UI](https://www.radix-ui.com) primitive; the CLI installs whatever an item needs."

Component docs describe props in Radix terms, for example "Radix Dialog.Close for extra close buttons in the body or
footer" and `` `ComponentPropsWithoutRef<typeof DialogPrimitive.Close>` `` (`llms-full.txt`).

Base UI support or plans: Arc does not say. "base ui" and "base-ui" occur zero times in `llms.txt`,
`llms-full.txt`, `llms-small.txt`, `catalog.json`, the README, CHANGELOG and CONTRIBUTING, and in the repo's issues
(7 issues, none about it).

## 4. Guidance for AI agents

**MCP server.** https://uiarc.dev/docs/ai, "Connect the MCP server":
> "A remote, read only server. No account or key."

Configured as `claude mcp add --transport http arc https://uiarc.dev/api/mcp` ("Add --scope project to share the
server with your team through .mcp.json."). With Pro:
> `claude mcp add --transport http --scope user arc https://uiarc.dev/api/mcp --header "Authorization: Bearer arc_pro_..."`
> "Paste your token in place of arc_pro_... The user scope keeps it out of project files."

Tools, confirmed by a `tools/list` call to the endpoint: `list_components`, `search_components`, `get_component`,
`get_install_command`, `get_skill`, all annotated `readOnlyHint: true`. `get_component`: "With an Arc Pro token
(Authorization header), Pro items also include their full source files in structuredContent.files."
The registry guide (above) also recommends the shadcn MCP server alongside: "Arc's explains what to use and why, and
the shadcn server or the CLI installs it."

**llms files.** https://uiarc.dev/llms.txt (200), https://uiarc.dev/llms-full.txt (200, 1.4 MB, every component's
markdown inlined), https://uiarc.dev/llms-small.txt, per-item markdown at `/components/<id>/markdown`, and
`/r/catalog.json` ("Metadata for every item, including Pro: use cases, keywords, and notes, without source").
`llms.txt` "Rules for agents" includes:
> "Prefer an existing Arc component or block over writing a new one; compose blocks from Arc components."
> "Use the semantic tokens (`--background`, `--surface`, `--foreground`, `--text-secondary`, `--border`, `--accent`, `--success`, `--warning`, `--danger`) instead of raw colors, and check light and dark themes."
> "Sentence case copy, regular and medium weights only, no eyebrow labels, no em dashes, no focus rings, no decorative gradients or glows."
> "Pro items are licensed: never reconstruct their source; point people to the pricing page."

**Skill.** Registry item `arc-skill` (`registry:file`) installs 13 files to `~/.claude/skills/arc/` via
`npx shadcn@latest add https://uiarc.dev/r/arc-skill.json`; raw copies at `https://uiarc.dev/r/skills/arc/<file>`.
Its `docs`: "SKILL.md is the entry point; INSTRUCTIONS.md holds the rules to keep in AGENTS.md or CLAUDE.md."
The repo itself has no AGENTS.md, CLAUDE.md or skill directory (tree at the commit above). What the skill instructs,
relevant here:

- `SKILL.md` triggers "when the project contains components/arc/foundation.css ... or imports from @/components/arc",
  and says "Use Arc before writing UI. Compose components; do not restyle their internals." and "Never rebuild an Arc
  item from scratch, and never reconstruct or imitate Pro source."
- `INSTRUCTIONS.md`, Always 5: "Semantic tokens only: `--background`, `--surface`, ... `--radius-*`, `--text-*`, `--space-*`."
  Always 7: Geist and Inter, "weights 400 and 500 only". Never: "Focus rings, outlines, or `:focus-visible` halos.
  Show keyboard position with the hover and selected fills."
- `accessibility.md`: "Arc draws no focus rings, outlines, or halos for any input method. This is a product decision:
  `--focus-ring` is transparent and a global rule removes outlines. Do not add `outline`, ring `box-shadow`, or
  `:focus-visible` halo styles, and do not report their absence in reviews."
- `checklist.md`: "Only semantic tokens; no raw hex, ramp values, or Tailwind colors".

Pro skills (8, including "Refactor to Arc") are served to signed-in Pro members at `/api/skills` or via `get_skill`
with a Pro token.

## 5. Install guide and requirements

https://uiarc.dev/docs/installation and `README.md`:

- React: "A React 19 project with TypeScript and the @/* path alias." README: "**React 19** with TypeScript".
- Framework: README "**Next.js** (App Router) or **Vite**". The docs page gives both paths, each ending in
  `pnpm dlx shadcn@latest init` ("This creates components.json, which the CLI reads to know where files go."); Vite
  needs the `@/*` alias in `tsconfig.json` and `vite.config.ts`.
- Motion: README "**[motion](https://www.npmjs.com/package/motion)** for animation". No minimum version is stated
  anywhere; the only version is the repo devDependency `"motion": "^13.4.0"`.
- `components.json`:
  > `{ "registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" } }`
  then `pnpm dlx shadcn@latest add @uiarc/button @uiarc/dialog`. Foundation up front with
  `shadcn add @uiarc/arc-foundation`, then `import "@/components/arc/foundation.css";` in `app/layout.tsx` or
  `src/main.tsx`. "Files land in an arc/ folder under the components alias in your components.json ... They import
  each other with relative paths, so any alias setup works."
- Fonts: `SKILL.md` "load Geist and Inter as `--font-geist` and `--font-inter`."
- Manual install keeps "Arc's repository layout (registry/, lib/) and import[s] each other through @/". The README
  troubleshooting still says `import "@/registry/foundation.css";`, the older path; the site and registry say
  `@/components/arc/foundation.css`.

**Pro token.** https://uiarc.dev/docs/ai, "Pro access": create a token at https://uiarc.dev/account#pro-access
("It is shown once"), then:
> `"@uiarc-pro": { "url": "https://uiarc.dev/r/pro/{name}.json", "headers": { "Authorization": "Bearer ${ARC_PRO_TOKEN}" } }`
> `.env.local`: `ARC_PRO_TOKEN=arc_pro_...`
> "The shadcn CLI expands ${ARC_PRO_TOKEN} from your environment or .env.local; never commit the token. Each account can hold 10 active tokens, each allows 120 requests a minute, and a token stops working when you revoke it or Pro ends. Free dependencies come from the public registry and Pro dependencies through @uiarc-pro, so keep both entries."

`llms.txt` says the same: "sets `ARC_PRO_TOKEN` in the environment or `.env.local` (never committed)". Docs/ai adds:
"Pieces that ship photos are copied from their docs page instead."

## 6. Licence

**Free.** Repo `LICENSE` at the commit above: MIT, "Copyright (c) 2026 Elia Kuratli". `package.json` `"license": "MIT"`.

**Pro.** https://uiarc.dev/license: "Last updated September 26, 2026" and
> "Draft, pending review. This text has not been reviewed by a lawyer yet and may change before launch."

On a public open-source app repository:
> "Keep Pro source in private repositories, and in public repositories as part of an end product (see open-source projects)."
> "You may use Pro source in an open-source end product, such as an app you publish on GitHub, as long as the Pro source is only a part of it and your project is not a UI kit, library or template. Keep the Arc Pro notice in those files and note that they are not covered by your project's open-source license. If you are unsure, ask us."

Limits that bear on it:
> "Redistribute, resell, sublicense or share Pro source on its own, modified or not, as source files, a package, a registry, a snippet collection or a download."
> "Use Pro source to build a product whose main value is the components themselves, such as a UI kit, component library, design system, template, theme or page builder that you sell or give away."
> "Offer Pro source through a tool that lets others generate or copy it, such as a public MCP server, code generator or registry."
> "Remove notices that say a file comes from Arc Pro."

"Pro source" is defined as "the source code, styles, docs and assets of every piece marked Pro, however you receive
them: copied from the site, installed through the @uiarc-pro registry, or fetched by an AI tool through the MCP server."

On AI agents and a one-person seat:
> "You may give Pro source to your own AI coding tools, through the MCP server, the registry or by pasting it, to build your projects. You may not use Pro source to train or fine-tune a model that is offered to others, or put it into a shared prompt library, dataset or agent that others can use to reproduce it."
> "One Arc Pro purchase is one seat: one person who can download, install and work with Pro source. Anyone else on your team who works directly with Pro source needs their own seat. People who only use or review the end product, or who work on parts of the code that don't touch Pro source, don't need a seat."
> "Share your account or Pro tokens, or let people outside your seat allowance use your license." (in "What you can't do")

Whether a person's own AI agents count against the seat: the licence does not say in those words; it says only "your
own AI coding tools". Pricing (https://uiarc.dev/pricing): Pro yearly $129, lifetime $199; "Yearly: ... When the plan
ends, the license continues for Pro source you already added to your projects, forever".

## 7. Changelog

Two changelogs, neither mentions Tailwind, Base UI, Radix or shadcn compatibility:

- https://uiarc.dev/docs/changelog, "September 2026": "Install by name with the @uiarc registry namespace." and "An
  MCP server, llms.txt, and a Markdown version of every page." Plus a list of new components and blocks, and "First
  release".
- Repo `CHANGELOG.md`: "## 2026-09-30" (password strength, expanding search, JSON viewer added) and "## Initial
  release" ("97 components and 22 blocks, plus the design tokens (`registry/foundation.css`) and motion presets").

Closed repo issues touching shadcn: #4 "Installed files ignore the project's components.json aliases and --path" and
#5 "Registry: some items list code fragments as npm dependencies, so shadcn add fails" (no dates read).

## What Arc does not say

Looked in: uiarc.dev `/docs/installation`, `/docs/theming`, `/docs/ai`, `/docs/changelog`, `/license`, `/pricing`,
the shadcn-registry guide, `llms.txt`, `llms-small.txt`, `llms-full.txt`, `/r/registry.json`, `/r/catalog.json`,
`/r/arc-foundation.json`, `/r/button.json`, `/r/dialog.json`, the skill files `SKILL.md`, `INSTRUCTIONS.md`,
`design.md`, `accessibility.md`, `checklist.md`, the MCP `tools/list`, and the repo README, CHANGELOG, CONTRIBUTING,
LICENSE, package.json and issues.

- Anything about Tailwind v4 specifically, `@theme`, `@layer`, or cascade order relative to Tailwind's preflight.
- How to map Arc tokens onto shadcn's variables or a Tailwind `@theme`, or the reverse.
- The name collision with shadcn's `--background`, `--foreground`, `--border`, `--accent`, or the
  `data-theme` versus `.dark` difference.
- How to keep focus outlines for non-Arc components while using `foundation.css`.
- A Tailwind variant of any item, or how to convert a `.module.css` to utility classes.
- Base UI: no support, no plan, no mention.
- A minimum Motion or Radix version for consumers.
- Whether an individual's several AI agents working in parallel sit inside one seat.
