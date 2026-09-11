---
status: accepted
---

# The workspace catalogue is the only place a third-party version is written

Every third-party range lives in the `catalog:` block of `pnpm-workspace.yaml`, and every
`package.json` in the repo refers to it as `"catalog:"`. A range written inline in a manifest is a
defect, not a style choice.

The generator half-did this and the half it left is the argument. Its output catalogued eighteen
packages and left seventeen inline, including `@orpc/tanstack-query ^1.14.12` sitting beside four
other `@orpc/*` packages catalogued at the same `^1.14.12` — one version, expressed twice, one edit
away from disagreeing. That is exactly the drift a catalogue exists to prevent, so the catalogue is
either complete or it is decoration.

## Owning the output includes owning its version pins

ADR-0053 says to own the generated tree and never depend on the generator again. Its version pins
are part of that tree, and inheriting them silently is the opposite of owning them. Checked against
the npm registry on 2026-09-10 and moved deliberately:

- `typescript` `^6.0.3` to `^7.0.2`. `pnpm install` on the generated tree printed
  `typescript 6.0.3 (7.0.2 is available)`.
- `pnpm` `11.20.0` to `12.3.4`, in the `packageManager` field.
- `@orpc/*` `^1.14.12` to `^1.15.0`. A 2.0 line exists at `2.0.0-beta.35` and is not taken.
- `vitest` at `^5.0.0`, published 2026-09-03 and seven days old when adopted. Taken on purpose:
  there was no existing suite for a new major to break, and the frontier ticket is the cheapest
  place in the project's life to absorb one.

`drizzle-orm` is the deliberate exception and has its own record: see [[0102-drizzle-stays-on-the-stable-line]].

## What this does not settle

A catalogue pins one version per package across the whole workspace, so two packages cannot hold
different majors of the same dependency. Nothing here needs that today. If it ever does, pnpm's
named catalogues (`catalog:name`) are the mechanism, and reaching for one is a decision that gets
recorded rather than taken in a manifest.

## Evidence

Registry lookups performed 2026-09-10. The seventeen inline ranges are enumerated in
`docs/research/validate-cncore-3.md` section 4.1.
