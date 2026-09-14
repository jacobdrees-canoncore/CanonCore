---
status: accepted
---

# A sort name is derived by stripping a leading article, and the computation is a source

Where nobody has said how an Item files, CanonCore works it out: the title with a leading English
article removed, so *The Daleks' Master Plan* files under D. The computed value is a STATEMENT like
any other, asserted by a source of kind `derived` whose identity is `derived:sort-name-v1`.

STRIPPED, NEVER MOVED TO THE END. `Daleks' Master Plan`, not `Daleks' Master Plan, The`. Both
incumbents strip: Plex's `ArticleStrings` preference is documented as words "which are removed in
sort titles" and its own worked example is `title="A Bug's Life" titleSort="Bug's Life"`; Jellyfin's
`SortRemoveWords` sits under the doc-comment "words to be removed from strings to create a sort
name". Libraries reach the same filing by a different mechanism — MARC 21's second indicator on
field 245 counts "the number of character positions associated with a definite or indefinite article
... that are disregarded in sorting and filing processes", which is an OFFSET into the one title
rather than a second string. We store a second string (ADR-0014), and in that shape "disregarded" IS
the string without the article. MusicBrainz is the one owner that reorders — "Beatles, The", and the
same rule for releases through aliases — and it is the model being refused here, because our sort
name is DISPLAYED ("Sorts as ...") and a trailing `, The` is a suffix on every second row that no
reader asked for.

`the`, `a`, `an` — Jellyfin's exact default. Plex's wider list mixes languages in one global set
(`the, das, der, a, an, el, la`) and is refused for a catalogue whose instance declares no language
of its own: `El Dorado` filed under D is a worse answer than the one it fixes.

AND ONLY AS A LEADING TOKEN FOLLOWED BY WHITESPACE. Jellyfin also removes these words from the
MIDDLE and the END of a title, so "The Lord of the Rings" becomes "lord of rings" — its sort key is a
machine key rather than a name, lowercased and digit-padded besides. Ours is shown to a reader, so it
stays a title with one word off the front.

## What the computation may never do

**It may not touch what the Owner said.** Jellyfin runs a hand-written `<sorttitle>` through the same
cleaning as a generated one — `SortName_ForcedSortName_IsCleanedLikeAutoSortName` pins "Spider-Man:
Homecoming" becoming `spiderman: homecoming`, and a migration dated 2026-07-22 recomputes it for
every item already carrying one. Here the Owner's sort name is a statement at `source_order` 0 and
the computed one is a statement behind it; the Owner wins by ORDER, untouched, and both stand.
Clearing the field withdraws the Owner's claim and the computation is what is left — which is why
an empty sort name is accepted where an empty title is refused.

**It may not keep an Item alive.** A derived value exists only as a function of the claims it is
computed from, so once those are gone it is a residue rather than evidence. Purging a provider took
every Item nobody else claimed until this record's first implementation left a `sort_name` on each of
them, and `deleteOrphansAmong`'s "nothing is left saying anything about it" found a row. The clause
is written against the SOURCE KIND rather than against `sort_name`, so the next derived computation
inherits it.

## Trigger-maintained, and a new version is a migration

ADR-0014 chose a trigger over application-maintained for the projection because "a trigger cannot be
forgotten by a writer that never heard of it", and named the writers that would forget: the hand
seed, the importer, the scanner, a merge. Every one of them writes a TITLE, so every one of them has
to leave a sort name behind. `pnpm db:seed` is that argument run as a check — it writes a title
through raw SQL, touches nothing else, and the item files under the right letter anyway.

The cost is stated rather than discovered: the computation lives in PL/pgSQL, and `sort-name-v2` is a
rung of the ladder rather than a deploy. That is also the mechanism ADR-0071 asks for. A new version
is a new function, a new source and a migration that invalidates v1's rows, which is the only
operation that record says is ever performed on a derived claim.

WHERE THE SOURCE SITS IS THE ORDINARY RULE, not a new one: `max + 1`, exactly as a provider's row is
allocated. The Owner is at 0 and cannot be displaced, which is all this record needs. Whether a
PROVIDER's sort name should beat the computed one is deliberately NOT decided — no provider asserts
`sort_name`, so pinning this source permanently last would be a second ordering rule written for a
shape that does not exist.

## Consequences

Every Item with a title now carries two statements rather than one, and the second is CanonCore's
own. That is visible: the claims list on an Item page shows "Sorts as ... CanonCore (sort name v1)"
beside the title it was computed from, which is the provenance ADR-0071 exists to make readable.
Eleven assertions across four packages that read an Item's claims exhaustively had to name it.

The alphabet is real for the first time, which is what CNCORE-174's jump-to-a-letter and CNCORE-175's
choice of order are built on.

## Evidence

Plex, Jellyfin, the Library of Congress and MusicBrainz each read at their own first-party source on
2026-09-14, under CNCORE-173; every quotation above is the owner's own words. The regular expression
and the collation were run against PostgreSQL 18.6, the version `packages/db/docker-compose.yml`
pins, rather than reasoned about: `Theatre of War`, `Andromeda` and `Aliens of London` all open with
an article's letters and none is touched, because none is followed by whitespace.
