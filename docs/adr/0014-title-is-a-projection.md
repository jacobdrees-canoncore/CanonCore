---
status: accepted
---

# `title` and `sort_name` are columns that project statements

The statement is the truth and carries provenance, rank, favourite and language. The column is a
cached copy of whichever statement wins, so reads, sorts and search stay fast.

IT CANNOT BE A POSTGRES GENERATED COLUMN, which is the obvious first reach and does not work: a
generated column "cannot use subqueries or reference anything other than the current row", and
picking the winning statement is a subquery. Tested rather than assumed — `ERROR: cannot use subquery
in column generation expression`. So the projection is trigger-maintained or application-maintained,
and those have materially different failure modes: a trigger cannot be forgotten but runs inside
every write, while application-maintained can be bypassed by anything that writes directly. Pick one
deliberately.

The earlier justification was that these are "the hot, always-present, always-single-valued
fields". The hot half was right. The single-valued half is false everywhere in the field — Plex
carries three title columns, Jellyfin four, schema.org three, BIBFRAME a Title class with six
variant subclasses — and it was the half the column depended on.

## Consequences

This is the one shape that could not be retrofitted: moving title into statements later changes
every read path, sort, search index and public payload. Both incumbents are stuck where we would
have been — Plex concedes a language change "cannot retroactively update" existing titles, and
jellyfin/jellyfin#5236 has been open since 2021.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-standards.md`.

## As built, under CNCORE-4

**The projection is TRIGGER-MAINTAINED.** That was the choice this record and
ADR-0076 both left to the slice that builds it, and this is that slice.

Its failure mode, stated because the other option's is different: the projection
logic lives in PL/pgSQL rather than in the TypeScript codebase, and it runs
inside every statement write, serialising concurrent writes that touch one
item's title.

What settled it against application-maintained was the ticket's own instruction
to SEED ONE ITEM BY HAND. A hand seed is exactly the write path an
application-maintained projection cannot see, and so are the importer, the
scanner and a merge -- none of which exist yet to be taught the rule. A trigger
cannot be forgotten by a writer that never heard of it. `pnpm db:seed` is that
argument run as a check: it writes a `title` statement through raw SQL, never
touches the column, and the page shows a title anyway.

**The winner rule is rank, then the global source order, then the statement id.**
Rank first because the favourite is the lock (ADR-0024); the source order next
because it is global (ADR-0025); the id last as an arbitrary but stable
tiebreak. RECENCY IS THE TERM DELIBERATELY ABSENT. Language is not a term
either: picking by language needs a display-language preference and there is no
such setting yet. When there is, it belongs between rank and source order.

**`release_date` IS NOT PROJECTED YET, and its absence is deliberate.** ADR-0081
defines it as the earliest known release of any EDITION, and `editions` arrives
with its own slice. Projecting it from item statements now would fill the column
with a different definition of the value, which is worse than leaving it empty.
The column ships regardless, because ADR-0073's shape is the hard-to-reverse
part.
