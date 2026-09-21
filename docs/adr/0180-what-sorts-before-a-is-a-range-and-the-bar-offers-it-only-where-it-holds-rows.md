---
status: accepted
---

# What sorts before A is a range, and the jump bar offers it only where it holds Rows

The two browsed Listings offer a jump bar of A to Z. The catalogue's order starts BEFORE A, so the
bar could not reach the Rows filed there. On the Owner's own install, measured 2026-09-20 under
CNCORE-242, `/?letter=A` answers **"Showing items 38 to 137 of 8,052"** — **37 Rows sort ahead of
the first letter of the bar**, among them `£436 (short story)`, `1001 Nights (audio story)`,
`42 (TV story)` and the four `14681-14684 UNIT Field Log` webcasts. A reader who jumped to A and
pressed Previous found them; a reader who never left page one saw them by accident. Nothing on the
page said they existed.

**The bar now carries one entry ahead of A, labelled `#`, and it is offered only where such Rows
exist.**

## The predicate is a RANGE, never a character test

`#` means **"sorts before A"** under the catalogue's collation. It does NOT mean "opens with a digit
or a mark", and the two are different questions rather than two spellings of one.

Measured on this repository's own engine on 2026-09-21 — PostgreSQL 18.6 as `compose.yaml` pins it,
`en_US.utf8`, libc provider:

| Sort name | `< 'a'` | Where a character test would put it |
| --- | --- | --- |
| `42 (TV story)` | yes | before A — agrees |
| `1001 Nights (audio story)` | yes | before A — agrees |
| `£436 (short story)` | yes | before A — agrees |
| `!bang` | **no** | before A — **wrong**, the collation files it under B |
| `-dash first` | **no** | before A — **wrong**, the collation files it under D |
| `Дневник` | **no** | before A — **wrong**, the collation files it PAST Z |

The collation ignores punctuation at the first level, so a leading mark decides nothing. A
character test agrees with the range on all 8,052 of today's Items and parts from it on the first
title that opens in punctuation or in a non-Latin script.

**Jellyfin's `#` is the same range**, which is what settled this rather than taste: its
`getAlphaPickerQuery` sends `nameLessThan: 'A'` and the server compares that against SortName, so
its bucket is a comparison and not a class.

So this Listing needed no new kind of predicate. The entry is the Rows BEHIND the Cut that a jump to
A already makes — `theCut` renders the same comparison for both — which is the count that jump
reports as `rowsBefore`. One predicate, read from the two ends, is what keeps the entry the bar
offers and the page it lands on from coming to mean different things.

## The entry is the start of the Listing, and that is the whole address

Everything sorting before A sorts before everything else, so a seek to the foot of the order and the
start of the Listing are one page. The entry links `queryFor(walking, undefined)` — the address
`Back to the start` already links, keeping the Group, the kind and the order the reader chose.

Nothing marks it `aria-current`. The address records no jump, and a page that marked it would mark
it on every unjumped first page too.

## Offered only where it holds Rows: this follows PLEX, and JELLYFIN does the opposite

The two products disagree, so this is a decision rather than a convention.

* **Plex** has no A-Z bar at all. It builds the index server side and returns only the characters
  that HAVE items: `GET /library/sections/{sectionId}/firstCharacters`, whose own 200 example omits
  thirteen letters and heads the list with `{"size":2,"key":"%23","title":"#"}`.
* **Jellyfin** hard-codes a fixed picker — `letters = ['#']` before the A-Z array — and renders `#`
  whether or not anything is filed there.

**Plex is copied.** A control that does nothing is the thing `filedByLetter` already exists to
prevent one row up: that function hides the whole bar in the recently-added order, where a letter
seeks on a key nothing is filed under. An entry that is always there and usually inert would be the
same defect at one twenty-seventh the size.

It is asked of the Listing **in front of the reader** rather than of the catalogue: narrowed to a
Group or to a kind, a Listing holding nothing before A offers no entry. `beforeTheAlphabet` rides on
the same `WHERE` the Rows and the size are drawn from.

## `#` is attested, not coined

`CONTEXT.md` has no word of its own for this and bars none — the banned names are `canon`, `record`,
`edge` and `duplicate`, and none is near it — so the label is whichever the products this one is
built beside use. Both use `#`, read at first-party sources on 2026-09-20 under CNCORE-242: Plex's
own API reference (`developer.plex.tv/pms/`, OpenAPI 3.1, last modified 2026-09-10) and Jellyfin's
own source.

**The convention is not universal, and this record does not pretend it is.** Unicode's ICU, which
owns the concept, calls this the UNDERFLOW bucket and its `AlphabeticIndex` example labels it `…`;
Android's `AlphabetIndexer` uses a leading space; Kodi has no synthetic bucket at all. The claim
that iOS puts `#` last is unattested in Apple's own documentation and is not cited here. Emby is not
independent precedent: it shares the lineage Jellyfin's picker came from.

`#` read aloud is "number sign", which says nothing about what following it does, so the link
carries an `aria-label` that LEADS WITH the visible character and then explains it. Leading with it
is what keeps the accessible name containing the words on screen.

## What is left open: the tail past Z

**A sort name opening with a non-Latin letter belongs to no button, and this record names that
rather than fixing it.** Under this collation `Дневник` sorts PAST Z, so it is outside the range
this entry holds and the bar has no entry of its own for it.

It is nevertheless REACHED, and that is where this product parts from Jellyfin. A letter here is a
SEEK and not a filter, so a jump to Z lands at or before such a Row and the walk carries on into it;
under Jellyfin's filtering picker it is reachable from no button at all. What it lacks is an
ADDRESS that says so, which is a standing request on Jellyfin's own feature site and is left for the
effort that gives this catalogue its non-Latin data.

## Where it is asserted

* The range, and its divergence from a character test, at the **db package's export** — including
  the `!bang` Listing a character test would get wrong, and the non-Latin Row it would claim.
* That each browsed procedure is wired to it and that it survives `.output()`, at the **router**,
  narrowed to a Group so the whole catalogue cannot answer for it.
* The rendered bar at the **page seam**, over HTTP, against a fixture Row that sorts before A: the
  whole bar is read as a list, so the assertion fails if the entry is dropped, if it is appended
  rather than led with, or if the alphabet behind it is disturbed. The pair is one instance narrowed
  two ways, so the difference between "offered" and "not offered" is the narrowing and nothing else.

## Consequences

`cataloguePublic` did not gain a field. The two browsed Listings answer `browsedListingPublic`,
which extends it, because Catalogue search leads on how close a title is to what a reader typed
(ADR-0120) and nothing in a ranking is filed under a letter: a field there would be one the third
procedure could only ever answer falsely.

The question costs one extra statement per browsed page, run beside the page read rather than after
it. It is not in the page's own snapshot, which is a deliberate difference from `total` and
`rowsBefore` (ADR-0133): those are figures printed BESIDE the Rows, where a disagreement reports a
library that is not there. This decides whether a navigation entry is offered, and an entry offered
a moment after the last such Row was deleted lands its reader at the start of the Listing, which is
where it always pointed.
