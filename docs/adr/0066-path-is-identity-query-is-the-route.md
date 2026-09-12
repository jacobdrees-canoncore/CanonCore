---
status: proposed
---

# The path is identity; the query is the route

`/items/<id>` is canonical and addresses the item. `?via=<placement-id>` carries the ordering the
reader arrived through and is declared NON-IDENTIFYING, so two routes to one item give the same
canonical URL, the same page and the same record.

RFC 3986 does say the query component "serves to identify a resource" alongside the path — but
calling this a deviation overstated it. RFC 3986 section 6.1 explicitly declines to fix identity:
"there are many application-dependent versions of equivalence". And RFC 6596 describes this exact
case, naming "duplicate pages created with the addition of IRI parameters" as what the canonical link
relation exists for.

So there is a STANDARD MECHANISM for the declaration and we should use it rather than apologise for
it: the canonical URL is emitted as a link relation on both forms, which is one line in Next.js.
Anything less leaves the declaration visible only in a ticket, where no crawler, cache or consumer
can see it.

An earlier rule said the container is "never encoded in it", which overshot. That forced the
container into client memory only — Jellyfin's design — so a page refresh lost the ordering and
next-up either stopped working or silently switched. It also made "here, in story order"
unshareable.

Next is DERIVED, never stored: the next placement in that container by position. No playqueue table,
nothing to expire, and nothing that can disagree with placements when one moves. Plex ships
`playQueueSourceURI` and `playQueueItemID` for the same job; Spotify's API carries `context_uri`
with `offset` beside it.

## An id that cannot BE an identity answers 404

If the path is identity, a path whose id is MALFORMED addresses nothing — exactly as a well-formed
id resolving to no row addresses nothing. Both answer **404**, and a reader should not be able to
tell the two apart.

**400 IS THE TEMPTING ANSWER AND IT IS THE WRONG ONE**, on three grounds. It describes a request that
needs fixing, and there is nothing to fix: `/items/hello` is not a well-formed request carrying a bad
parameter, it is an ADDRESS WITH NOTHING AT IT, exactly as `/items/<a-uuid-nobody-ever-minted>` is.
It answers a question nobody asked, because a reader who followed a broken link is not debugging our
id format, and telling them the request was malformed invites them to think a well-formed one would
have worked. And it splits ONE absence into two answers, which every consumer downstream then has to
handle twice.

The distinction 400 would expose is about our storage format rather than about the catalogue, which
is the clearest sign it does not belong in an address.

**500 was the third answer and it was simply the defect**: a typo in a shared link, a truncated id or
a crawler guessing paths all read as "this server is broken" instead of "no such item", each one
putting a stack trace in the log for something that is not an error. Measured on `main` before
CNCORE-14: `item.get` validated with `z.uuid()`, and the BAD_REQUEST that raised was not one of the
procedure's DEFINED errors, so the page's `NOT_FOUND` guard never saw it and Next served the rethrow
as 500. The 404 test that existed used `crypto.randomUUID()`, so it never reached the path at all.

**This section is the DECISION and its reasoning. What implementing it taught is below, under
CNCORE-14**, and the two are kept apart deliberately: a record that decides the same thing twice in
two voices is the defect this pass exists to remove.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-standards.md`.

## As built, under CNCORE-5 -- and this record stays PROPOSED

**BUILT: the declaration, and a mechanism for it.** `?via=<placement-id>` is read on the SERVER, so
it is in the HTML the reader is served rather than filled in afterwards by a script, and the page
marks the ordering it names. The canonical link relation is emitted on every form of the URL, so the
declaration is visible to a crawler, a cache and any other consumer instead of living in a ticket
where none of them can see it.

RELATIVE AND SELF-REFERENTIAL, and RFC 6596 section 3 permits both by name -- the target IRI MAY
"specify a relative IRI" and MAY "be self-referential". Relative because this is self-hosted software
with no build-time hostname: an origin setting would be a value nothing else in the repo reads and
one more thing to get wrong behind a reverse proxy. Next.js leaves a canonical string alone when
`metadataBase` is unset, which was read out of its resolver rather than remembered.

**AND THAT LEAVES EXACTLY ONE THING TO RE-CHECK THE DAY THIS SERVES FROM A PATH.** A canonical Next
leaves alone is a canonical Next does not PREFIX either, so under a `basePath` this line would
advertise `/items/<id>` while the page sits at `/canoncore/items/<id>` -- and a wrong canonical is
worse than an absent one, because RFC 6596 exists to be believed by crawlers and caches. The lever is
`metadataBase`, which Next documents as able to carry base paths and not only origins. Nothing is
added now, for the reason given above: nothing reads it.
[[0109-deployment-is-a-shape-not-a-vendor]] makes `basePath` and `metadataBase` arrive together with
the host that needs them, and names this line as the thing to revisit.

A `via` naming a placement of another item, or none at all, matches nothing and changes nothing.
That is what non-identifying MEANS, and a test holds it: an old link out of a chat window still
serves the item.

**THE COST, ACCEPTED RATHER THAN OVERLOOKED.** `searchParams` is a request-time API in Next.js, so
reading it opts the WHOLE route into dynamic rendering -- the bare canonical URL included, which
carries no query at all. At one hand-seeded item that costs nothing. The escape hatch, when it costs
something, is a Suspense boundary around the strip that reads the query, leaving the rest of the
page a static shell.

**A SECOND NON-IDENTIFYING PARAMETER** now exists: `?placed=` narrows "Also appears in" to one
origin. It identifies nothing either, and the canonical is unchanged by it. Links that carry both
write them in a fixed order -- `via` then `placed` -- so one narrowed list is one URL rather than
two spellings of it.

**AND A THIRD, UNDER CNCORE-89: `?after=`**, which walks the Members listing
([[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]]). It identifies nothing either --
it names where a page of that listing carries on from -- and the canonical is unchanged by it, which
is the half this record had to rule on before the cap could be built at all.

**IT IS WRITTEN LAST, AND THAT IS THE DECISION RATHER THAN A DEFAULT.** The fixed order is now
`via`, `placed`, `after`. Alphabetical would have put it first, and the argument against is this
record's own: a fixed spelling order exists so that one narrowed list at one page is ONE URL, and
re-ordering the existing pair would give every link already emitted a second spelling of itself. A
parameter arriving later goes behind the ones that are already out there.

**AND IT IS THE SAME WORD THE OTHER THREE LISTINGS WALK WITH**, rather than one named for this
surface. `/` and `/works` and `/search` all take `?after=`, so a parameter called `member` or
`holds` here would be a second convention for one question -- on the one surface in the app where a
reader can see all three parameters at once.

**THE MEMBERS LISTING IS WALKED ON `/items/<id>` AND NOWHERE ELSE, which is this record operating
rather than a convenience.** A Container IS an Item ([[0004-containers-are-items]]), so a
`/containers/<id>?after=` -- or a `container.members` procedure answering a listing of its own --
would be one thing at two addresses, which is exactly what the canonical link relation above exists
to collapse. The cursor rides beside the item it is a listing OF, which is what makes this address
carry three parameters where the other three listings' addresses carry one: those surfaces ARE
their listing, and this one is a page that HAS one.

**WHAT COMPOSES WITH IT, said because it is the thing that breaks quietly.** `placed` narrows "Also
appears in" and `after` walks `Members`: two independent listings on one page. So the filter chips
carry the cursor forward rather than dropping it -- a chip that dropped it would send a reader deep
in an ordering back to its first page for touching the other list -- and the order of all three is
held in ONE function rather than in each of the two places that emit a link.

**AND A FOURTH, UNDER CNCORE-125: `?placedAfter=`**, which walks "Also appears in" itself
([[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]]). It identifies nothing either,
the canonical is unchanged by it, and it is written LAST: the order is now `via`, `placed`, `after`,
`placedAfter`, each appended behind the parameters already out there, for the reason this record
gives above about re-spelling links that have already been emitted.

**IT IS THE ONE PARAMETER HERE THAT IS NOT THE SAME WORD THE OTHER LISTINGS USE, AND THE ARGUMENT
FOR `after` ABOVE IS EXACTLY WHY.** That argument is that a parameter named for one surface would be
a second convention for one question -- and it holds until ONE PAGE HAS TO SPELL BOTH CURSORS AT
ONCE. A Container IS an Item ([[0004-containers-are-items]]), so `/items/<id>` is both a container
with Members and an item sitting in orderings; two listings on one address need two cursors, and
spelled alike neither can be read. One of them has to be qualified.

**THE BARE WORD STAYS WITH THE ONE THAT HAS ALREADY EMITTED LINKS**, which is this record's fixed
order applied to a NAME rather than to a position: re-spelling the Members cursor would give every
link CNCORE-89 put into the world a second spelling of itself. The parameter arriving later is the
one that takes a name, exactly as the parameter arriving later is the one written last.

**AND IT IS NAMED FOR ITS PAIR RATHER THAN FOR ITS SURFACE.** `?placed=` already narrows that same
listing, so `placed` and `placedAfter` read as the one listing's pair in a URL carrying all four.
`appearsAfter` was the alternative and names the reader's heading instead -- accurate, and silent
about the parameter standing next to it.

**THE TWO CURSORS DO NOT MOVE EACH OTHER, and the chips carry one and DROP the other.** The "Also
appears in" walk carries `after` through and appends its own behind it. A chip carries `after`
forward, because it has nothing to do with the Members listing; a chip DROPS `placedAfter`, because
it changes what "Also appears in" is ASKING and the old cursor names a place in the listing being
left. The fixed order of all four is held in one function and which cursor a walk appends in one
more, so no surface writes either by hand.

**NOT BUILT: next.** This record also decides that the next item is DERIVED from the placement in
the query rather than stored in a playqueue. Nothing derives one yet, because there is no playback.
The half built here is the half it needs -- the container survives a refresh and a shared link,
because it is in the URL.

**AND THE SECOND REASON THIS PARAGRAPH GAVE HAS EXPIRED, corrected here rather than left standing.**
It read "the container's own ordering has no page until CNCORE-7", which was wrong twice over:
CNCORE-7 built `browse`, which WRITES an ordering and renders nothing, and the page arrived under
CNCORE-67 instead. A container's ordering is now rendered, at `/items/<id>` -- see below.

## The container's own ordering gets a page -- under CNCORE-67

**AND IT IS THE ITEM PAGE, which is this record operating rather than a choice made beside it.** A
Container is an Item ([[0004-containers-are-items]]), so the path that addresses it is the one that
already did: `/items/<id>`. A `/works/<id>` was the tempting alternative and it is the thing this
record forbids -- one Item at two addresses, which is the case RFC 6596's canonical link relation
exists to collapse. The Item page gained a `Members` section instead: the MIRROR of "Also appears
in", which is every ordering an Item sits IN, where this is every Item one ordering HOLDS.

**THIS IS WHERE `?via=` IS FINALLY EMITTED BY SOMETHING.** Until now the parameter was read and
marked but never written: the front page deliberately links without one, because nobody arrives at an
Item "through the catalogue" in the sense a Placement means. A container's member list IS an
ordering, so its links carry `via=<placement-id>` and the Item page marks the row the reader came
through. The round trip is asserted end to end at the page-over-HTTP seam, by FOLLOWING the link the
container emitted rather than by constructing one -- a `via` written in a test would pass against two
surfaces that had both drifted.

**THE ID IS THE PLACEMENT'S AND A REPEAT IS WHY.** The same Item twice in one Container is two rows
sharing one `itemId` ([[0009-multi-parent-membership-with-ordering]]), so the container cannot say
which of the two arrivals a link is and only the Placement can. That is also why the read path emits
`id` beside `itemId` for a member, and why React keys the rows on the Placement: keyed on the Item, a
recap and its episode would be one key twice.

**WHAT IS STILL NOT BUILT IS STILL `next`.** A page that walks an ordering is not a page that derives
the next thing in it, and nothing does. This record stays PROPOSED for that reason and no other --
CNCORE-89 capped and walked that ordering and CNCORE-125 capped and walked the other listing on the
same page, and neither touched it, so the unbuilt half is the same half it has always been.

## What implementing it taught -- under CNCORE-14

The decision above is not restated here. What follows is only what building it turned up.

**THE DECISION LANDS IN `findItem`, NOT AT THE EDGE.** Whether a string can be an identity is a rule
about what an id MEANS, which is where the tombstone (ADR-0075) and the alias (ADR-0040) already
live. Putting it there gives every reader the same answer instead of only the web page, so the API
answers NOT_FOUND for a malformed id too, rather than the page and the API disagreeing about what the
same string addresses.

The consequence, taken deliberately: `item.get` now takes `z.string()` and no longer declares its id
a uuid in the OpenAPI document. That is the contract MOVING rather than loosening -- any string may
be asked about, and the answer says whether it named anything.

**THE GUARD AND THE OUTPUT SCHEMA MUST AGREE ON WHAT AN ID IS.** Both are `z.uuid()`, and that
agreement is the decision rather than a coincidence. `itemPublic` declares `id` a uuid (ADR-0045), so
an id that does not satisfy it can never be answered with -- and a guard LOOSER than the output
schema would find the row, hand it up, and fail validation one layer above, as an output-validation
error that is not a defined error. That is this same 500 moved rather than fixed.

The first draft of this fix got that backwards. It used `z.guid()`, on the reasoning that the guard
must not out-strict the Postgres `uuid` column or a stored row becomes unreachable, and cited
ADR-0040 for the idea that a permanent alias might carry an id minted elsewhere. Both halves were
wrong. ADR-0040's alias is the merged-away LOSER of one of our own merges, not an external id, and
every id here comes from `defaultRandom()`, which is `gen_random_uuid()`. Nothing in this system
mints an id that RFC 9562 rejects, so the row the looser guard protected cannot exist -- while the
500 it introduced was real and measured: a variant-`c` GUID written by hand answered
`INTERNAL_SERVER_ERROR: Output validation failed`. A test at the router seam holds the agreement now.

**WHY THE CHECK IS NEEDED AT ALL, rather than just deleting the validation.** `items.id` is a
Postgres `uuid`, and comparing it against `not-a-uuid` is error 22P02 rather than an empty result.
Dropping `z.uuid()` alone would have moved the 500 from oRPC into the database instead of fixing it.

**THIS RECORD STAYS PROPOSED.** Next is still DERIVED and nothing derives one yet. Addressing was the
half already built.
