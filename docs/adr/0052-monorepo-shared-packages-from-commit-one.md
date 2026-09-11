---
status: accepted
---

# A monorepo with shared packages from the first commit

The API contract, the database schema, the Zod schemas and design tokens as plain TypeScript are
workspace packages from commit one, even with one app in it.

They are the only expensive-to-retrofit decision that does not vary with the client choice.

Design tokens are plain TypeScript rather than a Tailwind config. The reason first given — that CSS
custom properties do not cross to React Native — is true of bare React Native and FALSE of the
NativeWind path a Tailwind codebase actually takes, where "the variables flow down the component
tree, just like CSS custom properties". The decision stands on the plainer ground: a TypeScript
object is readable by every consumer without a build step or a framework, and a Tailwind config is
readable by Tailwind.

An appeal to "two independent sources" was also made and neither was named; it is withdrawn rather
than reconstructed.

WHAT THE GENERATOR ACTUALLY PRODUCES, verified by running it: two of these four packages do not
exist in its output. There is no Zod package, and its design tokens are CSS custom properties in
the UI package's stylesheet — the form this record rules out. Both were new work rather than
something to keep.

Counted on the generated file rather than carried forward: `globals.css` holds **102** custom
property declarations, being 32 in `:root` (31 colours and `--radius`), 31 in `.dark`, and 39 in
the `@theme inline` block that re-exports them to Tailwind. An earlier figure of 84 appears in this
record and in `docs/research/`; it does not match the file and is superseded by the recount above.
Only the 63 in `:root` and `.dark` are source tokens; the `@theme inline` block is derived from
them.

## As built, under CNCORE-3

All four packages exist: `packages/api`, `packages/db`, `packages/schemas`, `packages/tokens`.

`packages/tokens` is the source of truth for the 31 colours and the radius, as a plain TypeScript
object. `globals.css` still declares the same values, because a stylesheet cannot import
TypeScript and generating one from the other would put a build step in front of the zero-build
package pattern the rest of the repo relies on. What makes writing them twice safe is a test in
`packages/ui` that parses the stylesheet and fails if the two disagree on a name, a value or the
radius — demonstrated failing on both a changed value and a token added to the CSS alone. See
[[0103-tests-bite-at-package-exports-and-the-router]].

`packages/schemas` holds hand-written Zod rather than schemas derived from the Drizzle tables, for
reasons that belong to the ORM rather than to this record: see
[[0102-drizzle-stays-on-the-stable-line]].
