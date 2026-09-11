---
status: accepted
---

# Drizzle stays on the stable line, and Zod is hand-written

`drizzle-orm` is pinned to the `0.45.2` stable line rather than the `1.0.0` release candidate, and
the Zod schemas in `packages/schemas` are written by hand rather than derived from the Drizzle
tables. The two halves are one decision, because the second follows from the first.

## Why the stable line

Stable has not moved since 2026-03-27 while `1.0.0` sits at `rc.4`, which is a real argument for
moving and was weighed. What settles it the other way is that nothing is downstream of the schema
yet: `packages/db/src/schema/index.ts` is `export {}`, and the migration ladder of ADR-0047 has no
rungs. The cost of moving later is therefore close to zero, and the cost of being wrong now is a
release candidate under every other ticket in version one. Take the cheap option while it is cheap.

## Why the Zod schemas are hand-written

This is not an omission. It was the branch the ticket asked to be decided deliberately, and the
reason the ticket gave has since been overtaken by a better one.

**The standalone `drizzle-zod` package is no longer what Drizzle points at.** `orm.drizzle.team/docs/zod`,
read 2026-09-10, gives the install as `npm i drizzle-orm@rc zod` and the import as
`import { createSelectSchema } from 'drizzle-orm/zod'`. The validators have moved in-tree. The
package exports confirm it: `drizzle-orm@1.0.0-rc.4` publishes `./zod`, `./arktype`, `./typebox` and
`./valibot` subpaths, and `drizzle-orm@0.45.2` publishes none of them.

So on the stable line chosen above, the documented path does not exist, and the only way to derive
Zod from the tables is `drizzle-zod@0.8.3` — a standalone package whose stable release is dated
2025-08-06, whose active development is on `1.0.0-beta.*` tags tracking `drizzle-orm@1.0.0-beta`,
and which the vendor's own documentation has stopped mentioning. Adopting it means taking on a
dependency in order to delete it again at `drizzle-orm` 1.0.

Note it is NOT formally deprecated on npm — `npm view drizzle-zod deprecated` is empty. The case
against it is the documentation and the release cadence, not a deprecation flag.

**The revisit trigger is named, so this does not quietly become permanent.** When `drizzle-orm` 1.0
ships stable, the integration arrives as a subpath of a dependency the project already has, at no
new dependency cost. That is the moment to reopen this, and the moment the argument above expires.

## What is in the package meanwhile

Only what something reads. Today that is the health check's result contract, wired into the
router's `.output()` so it is load-bearing rather than decorative: a handler that stops answering
what the contract promises fails with `Output validation failed`, which was demonstrated rather
than assumed. Domain schemas arrive on the slices that need them, per ADR-0051.

There is also a standing reason to expect hand-written schemas to stay worth their keep. The write
model is the statements-and-properties catalogue of ADR-0012, not a table per concept, so what the
API validates is property-shaped payloads rather than table rows. Derived insert and select schemas
describe the wrong shape for that. This is a judgement rather than a measured finding, and it is
recorded as one.

## Evidence

`orm.drizzle.team/docs/zod` and the npm registry, both read 2026-09-10. Note that
`docs/research/validate-cncore-3.md` section 2.5 frames this decision as a choice between a stale
stable and a beta, which was the state of the argument before the in-tree move was found; the
paragraph above supersedes it.
