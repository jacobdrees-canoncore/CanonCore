---
status: accepted
---

# A picker reaches past its own cap through the Listing's own search, not through a second control

> **ACCEPTED 2026-09-20, whole, in one repository.** The placement picker on `/items/<id>` carries a
> search that narrows it through `catalogue.search` -- the procedure `/search` already asks -- and
> the sentence beneath it names that control instead of one that never existed. Five assertions at
> [[0103-tests-bite-at-package-exports-and-the-router]]'s fourth seam
> (`apps/web/e2e/placement-write.test.ts`) hold it: an Item sorting past the picker's first hundred
> is unreachable, then found, then placed; the narrowing survives a refusal; the notice's words are
> followed to a control that exists; a search matching nothing offers no empty picker; and the
> control carries the rest of the address. **No procedure changed** -- `catalogue.search` is asked
> as it stands -- so nothing is owed at the second seam, and no provider repository is touched.

The placement picker offered ONE PAGE of the catalogue by name and told the Owner to place anything
else "from its own page". **An Item's own page has never offered a way to place it into a
Container**, so the remedy named did not exist, and everything past the hundredth Item could not be
placed at all. On the Owner's own install that is **100 reachable of 8,052**
([[0137-the-corpus-is-8052-items-and-that-is-the-size-the-surfaces-are-designed-against]]).

## A sentence can satisfy the rule it was written for and still be false

This string was READ and CLEARED five days before it was filed as a defect.
`docs/research/walking-the-owners-install.md` listed it among six hypotheses it had cleared,
because what was checked was the thing [[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]]
demands: **that the cap is named rather than silent.** It is, correctly, and the page has always
said "Showing 100 of 8,052".

Nobody checked the rest of the sentence. **A cap that is named and a remedy that exists are two
claims, and a notice satisfying the first tells a reader nothing about the second.** That is the
general lesson and the reason this record exists: a rule discharged is not a sentence verified, and
the half nobody wrote a rule for is the half that goes unread.

## The remedy is REACH, and ADR-0061 is untouched

The obvious fix -- a control on the Item's own page, which is what the notice described -- is the
one this refuses. [[0061-containers-own-their-membership]] gives every container its membership
outright, and the picker's own docblock already said placing belongs on the container's page
"rather than on the item's end". **Nothing about where the control LIVES was wrong. What was
missing was a way to reach one Item through it.**

So the container's page keeps the only control that changes this ordering, and gains a way to find
what to put in it. That is a strictly smaller change than moving the control, and it leaves the
mutation's shape -- a Placement, named by the container that owns it -- exactly as that record
decided.

## It asks `catalogue.search`, which is the whole of "not a second answer"

The picker is a reader of the catalogue like any other surface, so it asks the catalogue's own
question. `catalogue.search` brings with it the escaping of `LIKE` metacharacters, the cap, the
count, and the ranking [[0120-catalogue-search-is-a-trigram-ilike-not-full-text-search]] settles --
none of which a picker matching titles its own way would have, and all of which would then be two
sets of rules for one question.

**`catalogue.list` IS STILL THE UNASKED CASE, rather than a search for the empty string.** An
escaped empty query is the pattern `%%`, which matches every TITLED row -- so a picker that searched
for nothing would silently drop the untitled Items the unsearched one offers.

**AND THE COUNT IS `Holding`, WHICH IT WAS NOT.** This section printed its own `Showing {n} of {m}
items` beside the component every other Listing counts itself with: one rule in two places, and the
copy here had no thousands separator, no plural agreement and none of
[[0133-a-listing-says-where-the-reader-is]]'s "items 1 to 100 of 8,052". The second spelling is
gone.

## A search rather than a walk, and the reason is the size

A walk was the other candidate and is refused. Paging a `<select>` through 8,052 Items is **81
pages of a dropdown**, which is a way to reach item 101 and not a way to reach item 4,000; a letter
jump answers "I know roughly where it files" where the Owner curating an ordering knows what the
thing is CALLED. A search answers the question actually being asked, and it is the one control
whose cost does not grow with the catalogue.

**This leaves the picker uncapped in one direction only**, and the notice says so: a search
matching more than a page says to narrow it further, which is the same answer `/search` gives.

## `placing` is LAST in the fixed order, because a form's document order is its address

`inTheFixedOrder` fixes where every parameter sits in an address, and
[[0066-path-is-identity-query-is-the-route]]'s rule is that a new one is appended so no link already
out there is re-spelled. Here that default is also the right position on the merits, and the reason
is the CONTROL rather than the meaning.

**A browser submits a form's fields in the order they stand in the document**, which
`query-params.ts` already names as "the one spelling this list cannot write". The picker's search
carries every parameter the address already had as hidden fields so that searching it moves neither
of the page's two Listings -- and with the query LAST, those fields are one run of
`Object.entries` over `inTheFixedOrder`'s own object. Anywhere else in the list and the hidden
fields would have to be split around a text input to slot the query into the middle.

**AND THE REFUSAL CARRIES IT.** A refused placement redirects to an address this app builds
([[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]] under CNCORE-255), and one built without
the narrowing would answer the Owner with the picker emptied of the search that found the Item they
were placing -- the defect returning at the one moment they have to choose again. That redirect is
now written through `inTheFixedOrder` rather than by hand, which is also what makes it SAFE: the two
values it carried before were a uuid and a word from a closed set, and neither can hold a `&`, a `#`
or a space. **A query is the Owner's own text, and splicing that into a URL by hand is how a search
for `a&b` becomes two parameters.**

**THAT REDIRECT CARRIED THE NARROWING AND NOT THE TWO CURSORS, WHICH WAS THIS RECORD'S RULE APPLIED
TO ONE POSITION OF THREE -- AND CNCORE-290 HAS SINCE APPLIED IT TO ALL THREE.** As this record
shipped, the POST form submitted what the WRITE needs plus `placing`, so `?via=` and both listings'
positions were not on it to carry; it was pre-existing, since before this a refusal dropped all
three. It was left as **CNCORE-290** with a TODO at the form rather than six more fields on a schema
that already carried one reaching no procedure. **That ticket took those fields**, the TODO is gone,
and the rule for the whole page now lives in
[[0168-a-form-that-can-be-refused-carries-the-address-it-was-submitted-from]] -- which holds it for
all three forms on this page that redirect, the removal and the undo included (CNCORE-293, folded
into the same pass). Said here because the rule above is stated
five times in this diff, and a rule kept selectively without saying so is one the next reader cannot
tell was reasoned. **Naming the half that was kept is what made the rest cheap**: the fix arrived as
a ticket carrying a measurement rather than as a defect rediscovered from a reader's complaint.

## No bound is owed here, and the reason is where the query lands

[[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]] requires a parameter that lands inside a
sentence this app speaks in its own voice to be BOUNDED where it is read -- which is why `/settings`
shortens `?refused=` to 80 characters before printing it.

**`?placing=` never lands in one.** It goes back into the search box as its `defaultValue`, which is
the Owner's own words handed back inside their own form field -- `/import`'s posture on `q` under
[[0151-a-query-beside-a-record-is-a-road-back-not-a-question]] -- and every sentence beside the
picker is this page's own, naming a COUNT. **Quoting the query in one of those sentences is the
change that would owe a bound**, and whoever makes it owes it in the same edit.

`/search` does quote its query, in "Nothing matched <query>", and does not bound it. That is a gap
in that surface rather than a licence for this one, and it is **CNCORE-291** rather than something
copied here.

## The half this does not build: an Item with no title

The reach here is **reach by title**, and an Item that has none is outside it twice over. It sorts
LAST, because the catalogue orders on `coalesce(sort_name, title)` with `nulls last`, so it is off
the picker's page on a catalogue of any size; and no query finds it, because Catalogue search is
`title ilike ...`, which is NULL for a row with no title -- `catalogue-search.ts` says so of itself.

**Measured rather than assumed: ZERO of the Owner's 8,052 Items are untitled** (counted against the
2026-09-20 dump). So nothing on the only install that exists is unreachable this way, and the state
is still constructible -- `aCatalogueLargerThanOnePage` seeds two untitled Items deliberately. It is
**CNCORE-292**, named here because a record that leaves half a mechanism unbuilt and says nothing is
the false signal `CLAUDE.md` is about.

## What the e2e fixture cost, and the server that was NOT started

Asserting this needs an instance that is **writable and larger than one page**, and none existed:
the paged instance is larger than one page several times over -- a catalogue of 253, a container
holding it, and an Item in 210 orderings -- and sets no password by design, and the one that places
had four Items.

**A TWELFTH SERVER WAS REFUSED ON A MEASUREMENT.**
[[0104-one-container-a-database-per-worktree]]'s peak of 67 connections of 288 -- which `CLAUDE.md`
turns into the four-agent ceiling -- was measured **with eleven servers standing**, and
`e2e/global-setup.ts` starts exactly eleven. A twelfth invalidates the figure and the ceiling
derived from it in the same edit, for a fixture that can stand somewhere else.

So the placing instance grew past one page instead. **That is safe there because neither of its two
readers oracles its catalogue as a set**, though they reach that from different directions and the
difference is what the next reader needs: `placement-write.test.ts` replays the form the page
rendered with the fields it wants SET, so what the picker OFFERS is never what it submits, and
`select.test.ts` reads the rendered `<select>`'s CLASS ATTRIBUTE and never its options at all. It is
written into `global-setup.ts` beside the filler, because a test that walks that catalogue, counts
it, or reads the picker's options as an exact list is one the filler breaks.

**AND THE FILLER'S OWN HAZARD IS NAMED THERE TOO.** The 120 stories sort ahead of the four Items
that instance already had, so none of them is offered by the picker any more -- which matters not to
the picker but to the file's ORDER: `placement-write.test.ts` asserts the membership of two
containers EXACTLY, and a later test writing into either survives only by being declared after it.
Reaching past the cap therefore places into a container of its own that nothing else oracles, rather
than adding one more test whose correctness is its position in the file.
