---
status: accepted
---

# `category` takes an item, never a literal

A property's value-kind freezes at creation, and `category` is the escape hatch the model leans on
hardest — novel versus short story, chronology versus container, `fictional: true`, every tag, and
every finer type that deliberately did not become a kind.

Settled against the wiki rather than argued, and **re-derived from the LIVE wiki on 2026-09-13
(CNCORE-103) after the archive it was first measured against was deleted.** Its categories are
themselves categorised: `Category:26th century human students` still sits under BOTH
`26th century individuals` AND `Human students`, and of the wiki's 28,759 categories, **28,730 are
themselves categorised and 13,229 sit under more than one parent** across 45,569 child-to-parent
edges. The graph is **cyclic** and **22 levels deep** — BFS downward from its 29 roots, 0-based,
which is the same convention the archive-era measurement stated and the same answer it gave. As
literals that structure is lost on import.

THE DEPTH IS MEANINGLESS WITHOUT THAT CONVENTION AND THE RECORD SAYS SO. A longest PATH is not
well defined on a cyclic graph: the archive-era working measured the same graph at 22 under BFS and
48 under a condensation chain. A depth quoted without the walk that produced it is not a
measurement.

And a rule-derived container matching "everything with category X" would match a STRING, which is
the exact failure recorded against Plex's cross-library collections — they can only appear to span
libraries when the collections carry the same NAME, matched as strings.

As items, categories nest, carry provenance of their own, and can be matched by id.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`. **The archive is deleted (ADR-0129) and every figure above was re-derived from the LIVE wiki on 2026-09-13 by `provider-wiki`'s `pnpm measure:live`.** The archive-era working is `docs/research/verify-new-adrs-archive.md`, which stays as the frozen record it is: it describes a corpus taken 2026-09-04, not the wiki.
