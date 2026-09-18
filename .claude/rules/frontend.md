---
paths:
  - "apps/web/**"
  - "packages/ui/**"
---

# Frontend

**Search before you write.** The `shadcn` MCP reaches `@shadcn` for primitives and `@shadcnblocks`
for ~2,900 composed blocks. `packages/ui` already vendors this project's primitives, so read there
first and import what exists.

Where the registry's version needs script and this app has none, write the primitive here rather
than styling a native element on the page — ADR-0136, which is what three hand-copied selects cost.
A notice or a formatted value is not a primitive: those go in `apps/web/src/components`, beside the
pages that render them.

**Add a primitive with the slice that calls it, never ahead of one.** `packages/config`'s
`ui-callers.test.ts` names any module here that nothing imports, so a component added for a surface
not yet written goes red rather than sitting unread — ADR-0138, which is what 59% of this package
being unreachable cost. Pulling five things from the registry to pick one means deleting four.

The registries are declared in the ROOT `package.json`, not in either `components.json`. The MCP
resolves config from its working directory and the repo root has no `components.json`, so a leaf
declaration leaves the MCP blind to the registry. `SHADCNBLOCKS_API_KEY` lives in a gitignored
`.env.local`; only the `${...}` reference is tracked.

## Tokens carry the identity

Colour, spacing and type come from `packages/tokens`, and `packages/ui/src/styles/globals.css`
mirrors them under a test that fails when the two drift — so a token change is two edits.

Every colour and spacing value resolves to a token. Ported code is where this slips: a reference
component ships CSS Modules carrying its own palette, and porting it means rewriting those values
onto tokens.

## Borrow structure, leave identity

A block is a fast way to get a layout that already works: the grid, the responsive behaviour, the
empty state. Take the STRUCTURE, put it on this project's tokens, and let the design spec settle
palette, type scale and spacing rhythm.

Judge a finished surface by whether it reads as part of this product. ~2,900 designed things are one
request away, so a page that reads as a marketing site for something else is the near miss to watch
for.

## Accessibility ships with the feature

Every keyboard accelerator has a visible path (`CLAUDE.md`). Drag-and-drop is where that bites: a
keyboard sensor makes a surface operable, and explicit move controls beside it make it visible.
