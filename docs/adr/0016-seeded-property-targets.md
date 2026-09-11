---
status: accepted
---

# `category` takes an item, never a literal

A property's value-kind freezes at creation, and `category` is the escape hatch the model leans on
hardest — novel versus short story, chronology versus container, `fictional: true`, every tag, and
every finer type that deliberately did not become a kind.

Settled against the archive rather than argued. Its categories are themselves categorised:
`Category:26th century human students` sits under BOTH `26th century individuals` AND `Human
students`, and the whole graph is a cyclic DAG 22 levels deep. As literals that structure is lost on
import.

And a rule-derived container matching "everything with category X" would match a STRING, which is
the exact failure recorded against Plex's cross-library collections — they can only appear to span
libraries when the collections carry the same NAME, matched as strings.

As items, categories nest, carry provenance of their own, and can be matched by id.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`. Archive figures measured against `~/tardis-pipeline` directly.
