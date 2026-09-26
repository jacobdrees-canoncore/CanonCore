---
paths:
  - "apps/web/**"
  - "packages/ui/**"
---

# Entity surfaces

**An entity page is drawn against what ENTITIES carry, never against a story page.** The decision
and its reasons are ADR-0204; this file is the census that decision rests on, placed where a page
gets laid out so nobody has to go looking for it.

Every figure below was counted on 2026-09-26 over the live Tardis Wiki's **39,209 entity pages**:
the ns-0, non-redirect pages transcluding one of the eleven entity infoboxes that
`docs/research/tardis-wiki-ns0-census.md` maps onto the six entity kinds. No entity page carries
two of them, so that is both the transclusion count and the page count. "Carry" means at least
one value in `Special:ExportRDF`, counted over the population's own pages and not over the SMW
subobjects the export also returns. That section, "Entity fill, re-measured under CNCORE-377",
holds the method, the negative controls and the long tail under 1%.

## The thin page is the normal case

A median entity page carries **3** of the wiki's SMW properties, housekeeping aside, where a story
page carries 11. 41.9% of entity pages carry two or fewer. So the layout most entity readers meet
is a title, a kind, its Placements and a value or two, and that layout is drawn first and agreed as
the common one: a row for every value the Item carries and for nothing it does not, and an image
where one exists. `apps/web/e2e/item-page.test.ts`, under "an entity carrying a title, a kind and
its Placements, and nothing else", goes red if a page draws a Values row or an image frame the Item
cannot fill. A slot drawn anywhere else on the page is not caught, so this file is the rule there.

## What entities carry, 1% of pages or more

| the wiki's property | entity pages | share |
|---|---|---|
| `First appearance` | 30,470 | 77.7% |
| `Species` | 21,320 | 54.4% |
| `Has image` | 19,128 | 48.8% |
| `Main voice actor` | 7,889 | 20.1% |
| `Job` | 6,619 | 16.9% |
| `Affiliation` | 6,457 | 16.5% |
| `Actor` | 4,657 | 11.9% |
| `Imdb` | 4,358 | 11.1% |
| `First mention` | 3,721 | 9.5% |
| `Spouse` | 1,631 | 4.2% |
| `Twitter` | 1,528 | 3.9% |
| `Has vid` | 1,491 | 3.8% |
| `Child` | 1,459 | 3.7% |
| `Father` | 1,221 | 3.1% |
| `Mother` | 1,081 | 2.8% |
| `Website` | 741 | 1.9% |
| `Main TV actor` | 715 | 1.8% |
| `Instagram` | 644 | 1.6% |
| `Brother` | 627 | 1.6% |
| `Partner` | 514 | 1.3% |
| `Sister` | 484 | 1.2% |

Two housekeeping properties clear 1% and are left out above because no reader is shown them: SMW's
`Modification date#aux` on 39,204 pages and `Display title of` on 1,193.

**Nothing reaches 80%.** A layout may not assume any of these is present, only that it may be.

## What an entity layout may not show

**A property counted on story pages alone.** 479 of the 718 properties across the entity, story and
production populations appear on story pages and nowhere else, on 2026-09-26 as on 2026-09-21. Each
is out of an entity layout: a slot for one is a slot that is empty on every entity page there is. A
layout that wants one has to show the census is wrong first.

## The 20 properties all three populations share

Counted 2026-09-26 over the entity population above, 11,310 story pages and 8,371 production
pages. These are the only SMW properties a surface spanning the whole catalogue can
expect to meet on every kind of page. **Shared is not present:** on entity pages, housekeeping aside,
only `Has image` clears 20%, so a spanning surface still assumes nothing beyond a title, a kind and Placements.

`Conductor`, `Confidential`, `Corresponding Wikipedia link`, `Display title of`, `Featuring`,
`Has image`, `Has vid`, `Imdb`, `Interviewee`, `Modification date#aux`, `Music`, `Network`,
`Release date`, `Release date#aux`, `Release end date`, `Release end date#aux`, `Release status`,
`Spotify`, `Twitter`, `Website`.

Four of them are SMW's bookkeeping rather than content: `Modification date#aux`, `Display title of`
and the two `#aux` date twins.
