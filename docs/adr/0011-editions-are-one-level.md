---
status: proposed
---

# Editions are one level, following BIBFRAME

An edition collapses IFLA LRM's **Expression** (a translation, a dub, a narration) and
**Manifestation** (a printing, a release, a remaster) into one level. NO STANDARD MAKES THIS
PARTICULAR COLLAPSE, and this record exists to say so plainly.

BIBFRAME is not the precedent, though it was cited as one. It merged **Work and Expression** —
`bf:expressionOf` runs Work to Work — keeping Instance separate, which is the opposite pair. And the
reason attributed to it, that trained cataloguers could not apply the distinction consistently, is
published nowhere by the Library of Congress; the closest is a 2012 report describing "a
reductionist technique to simplify things as much as possible".

## Decision

Keep the collapse, argued from what a catalogue needs rather than from a standard.

*Philosopher's Stone* has 80-plus translations, two texts, three audio narrations, an illustrated
edition and a published screenplay. As one item with many editions there is ONE page for the novel,
progress stays per edition so the German text and the Fry narration are tracked separately, and
"have I read this work" is answerable across all of them. Following BIBFRAME's actual shape would
make each translation a separate ITEM linked by a translation relation — 80 pages for one novel, and
no coherent answer to that question without walking the graph.

The rule that makes the collapse tractable is also ours: an edition exists when it changes what you
would consume or how. One sentence covers a translation and a remaster, which is exactly what
collapsing the two levels requires.

## Consequences

This is a deliberate divergence from the standards and belongs on the list the model already keeps
of them. It also means "what is worth being an edition" carries real weight, since under LRM every
printing is legitimately a Manifestation — that is answered separately, and the collapse itself is
not to be reintroduced.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-standards.md`.
