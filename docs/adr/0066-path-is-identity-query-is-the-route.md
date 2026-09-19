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

**IT REACHES THE READ PATH SINCE CNCORE-129, AND THIS RECORD'S OWN RULE IS WHAT DECIDES WHAT AN
UNKNOWN VALUE MEANS.** The narrowing is a term of the query rather than a filter the surface applies
to the rows ([[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]]), so `placed` is an
input on `item.get` -- typed as a STRING and not as the four source kinds, for the reason `?via=`
and a malformed id already settle here: whether a value names anything is what the ANSWER says. An
origin the Item has nothing from narrows to an empty listing, beside the chips that lead back out of
it. A validated enum would raise a BAD_REQUEST no caller can narrow on, so a stale link would read
as a broken server rather than as the narrowing of nothing it is.

**AND A THIRD, UNDER CNCORE-89: `?after=`**, which walks the Members listing
([[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]]). It identifies nothing either --
it names where a page of that listing carries on from -- and the canonical is unchanged by it, which
is the half this record had to rule on before the cap could be built at all.

**IT IS WRITTEN LAST, AND THAT IS THE DECISION RATHER THAN A DEFAULT.** The fixed order is now
`via`, `placed`, `after`. Alphabetical would have put it first, and the argument against is this
record's own: a fixed spelling order exists so that one narrowed list at one page is ONE URL, and
re-ordering the existing pair would give every link already emitted a second spelling of itself. A
parameter arriving later goes behind the ones that are already out there **wherever writing it
anywhere else would re-spell a link already emitted** -- which is the rule's reason, and where it
does not bind is under CNCORE-179 below, the one parameter so far written ahead of one that came
before it.

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

**THE TWO CURSORS DO NOT MOVE EACH OTHER, and the chips carry one and DROP the other.** Each walk
carries the other listing's cursor through and sets only its own -- asserted in BOTH directions,
which review of CNCORE-125 is why: this sentence claimed both while the Members walk still dropped
`placedAfter`, resetting the other list to its first page. A chip carries `after`
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

## A Group narrows the catalogue -- under CNCORE-179

**ANOTHER NON-IDENTIFYING PARAMETER, AND THE FIRST THAT NARROWS `/`: `?group=<id>`**, the browsing
scope [[0010-groups-scope-never-partition]] decides. `/` already took `?after=`, which says where a
reader is in the catalogue; this says which catalogue. It identifies nothing -- the
catalogue narrowed to Doctor Who is still the catalogue -- and it is a parameter rather than a path
segment for this record's own reason: an Item sits in many Groups, so a Group in any path would give
one thing many addresses. The Rows on a narrowed page link the bare `/items/<id>`, exactly as the
unnarrowed page's do, because nobody arrives at an Item THROUGH a scope in the sense `?via=` means.

**A GROUP NAMING NOTHING NARROWS TO NOTHING, WHERE A CURSOR NAMING NOTHING STARTS OVER**, and both
are this record's rule -- whether a value names anything is what the answer says -- applied to two
different kinds of value. A cursor is a POSITION, and a position that has gone leaves the listing
still standing to be walked from its start. A Group is a QUESTION, and the answer to "what is in a
scope nobody drew" is nothing, with the page saying the scope is not there. A malformed one is a
typo in a link rather than a 500, by the shape guard `findItem` introduced.

**IT IS WRITTEN BEFORE THE CURSOR, `group` THEN `after`, which is why the fixed-order sentence above
now says where it binds.** "A parameter arriving later goes behind the ones that are already out
there" exists so that no link already emitted acquires a second spelling -- and none can here. `/?after=<id>` is
the unnarrowed catalogue and `/?group=<g>&after=<id>` is a narrowed one: two states, not one state
spelled twice, and no link carrying both parameters had been emitted before this. What decides the
order instead is the shape the two other listings already have: what the listing IS, then where in
it the reader stands -- `/search`'s `q` before `after`, and the item page's `placed` before `after`.
It is held by the key order of the object `queryFor` in `apps/web/src/components/listing.tsx`
spreads, which is how `/search`'s `q` then `after` was already held, and which carries the Group
forward on `Next`, on `Back to the start` and on the notice past the end. The item page's four are
held by `IN_FIXED_ORDER` in the same function -- so the order is still written in two shapes, and
stating it once for every surface is CNCORE-181's, as the scope surviving a reload and travelling in
a shared link is.

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

## A REQUEST BODY that cannot be read is the same rule -- under CNCORE-123

The section above is about an id in a PATH. The same 500 was standing in the request BODY, on every
Server Action in the app: `FormData.get` answers `File | string | null`, a `z.string()` field handed
a `File` throws a `ZodError` nothing catches, and with no script loaded that renders a bare
`Internal Server Error`. Found by review on CNCORE-74 and fixed once rather than four times, because
the shape was identical in all of them and an action written next would have inherited it.

**A CALLER HAS TO COMPOSE THAT REQUEST BY HAND, and it is still worth answering properly.** No
browser sends a text input as a file part. So this is posture rather than a hole -- and posture is
exactly what this record is about: the answer a reader gets should describe what they asked for, not
claim the server is broken.

**THE ANSWER IS "NOTHING WAS WRITTEN, HERE IS THE PAGE AGAIN", AND THAT IS NEXT'S PALETTE RATHER
THAN A PREFERENCE.** A Server Action can end four ways and no more. Read out of the installed
16.3.4 rather than remembered, in `next/dist/server/app-render/action-handler.js`: a redirect error
sets `RedirectStatusCode.SeeOther`; an HTTP access-fallback error sets its own status; anything else
sets 500. `http-access-fallback.js` closes that middle set to exactly three --
`HTTPAccessErrorStatus` is `{ NOT_FOUND: 404, FORBIDDEN: 403, UNAUTHORIZED: 401 }` and `ALLOWED_CODES`
is its values -- and `next/navigation` exports `notFound`, `forbidden`, `unauthorized`, `redirect`,
`permanentRedirect` and nothing else that sets a status. `forbidden` and `unauthorized` additionally
throw unless `experimental.authInterrupts` is on.

**SO THERE IS NO 400 TO REACH FOR, AND THIS TIME 400 WOULD HAVE BEEN THE RIGHT ANSWER.** That is the
difference from the section above and it is worth stating plainly rather than letting this record
read as consistent when it is not: for an id in a path there IS nothing to fix and 400 is the
tempting wrong answer, while for a body sent as the wrong part type there is something to fix and
400 is what says so. It is simply not expressible here. Of what IS expressible, 404 would say the
address holds nothing when the page is right there, 401 and 403 would say the caller lacks
permission when they do not, and 500 is the defect being removed. What is left is the ordinary
outcome the surface already has: the action writes nothing and the page it was posted to renders
again, which is what five of these actions' docstrings already say they do -- "it returns nothing and
the page reports by re-reading".

**IT ALSO COSTS THE READER NOTHING, WHICH IS THE COMPLAINT THE 500 EARNED.** `item-write.test.ts`
had already written the sentence this turns on: a Server Action that throws "costs the reader the
page they were on". A refusal that leaves them on it is the one answer here that does not.

**A `File` AND A `null` ARE ONE ANSWER, WHICH IS "NOT GIVEN"** -- this record's own refusal to split
one absence into two, applied to a field instead of an id. Neither is text, and a surface that told
them apart would be reporting on the shape of the request rather than on what was asked for. What
"not given" MEANS is then the schema's to say, per field: `holds` on the create form carries a
`.catch("nothing")` and reads it as "no container", because an absent radio group means that far
more usefully than it means "fail". Every other field has no reading for it, so the action stops.

**AND IT MUST NEVER BECOME AN EMPTY STRING.** ADR-0096 makes an empty note a REMOVAL -- one control,
and clearing it is how the owner takes their note back -- so coercing an unusable field to `""`
would delete the owner's words on a request nobody made. Nothing given is not the same claim as
nothing said. That is the one substitution this rule is forbidden to make, and it is asserted at the
page-over-HTTP seam rather than left as prose.

**THE RULE IS ONE READER KEYED OFF THE SCHEMA'S OWN FIELD NAMES.** `whatTheFormCarries(form, schema)`
in `apps/web/src/form.ts` reads each key the `z.object` declares, maps a non-string to "not given",
and `safeParse`s. That deleted twenty-three `form.get("...")` literals over thirteen call sites in
five action files -- counted with `git grep -o` rather than by eye, after a first draft of this
paragraph said "nine" and a review caught it. Twenty-three chances for a name here to drift from the
name on the page.

**AND THE INHERITANCE IS NOT HYPOTHETICAL.** Three of those thirteen sites did not exist when this
work started: CNCORE-72's `placeItemInContainer`, `removePlacement` and `restorePlacement` landed on
`main` mid-flight, each written in the old shape. That is the ticket's own sentence -- "the next one
inherits whatever this does" -- observed rather than predicted, four days after it was written.

**THE COST, ACCEPTED RATHER THAN OVERLOOKED.** `safeParse` refuses everything the schema refuses, not
only a wrong part type -- a missing field, or a value that schema declines such as `takeRecord`'s
`z.url()` -- and all of them now do nothing QUIETLY where they used to answer 500 LOUDLY. A field
renamed on a page and not in its schema is the case that bites. What catches it is the
page-over-HTTP suite, which submits the form the server actually rendered and asserts the write
happened, so a name that drifts fails a test rather than a reader.

**WHAT DID NOT LAND UNDER CNCORE-123, AND LANDED UNDER CNCORE-127.** That change closed the 500 for
a field that is not TEXT and left it standing for a field that IS text, which the ACTION's schema
accepts and the ROUTER's refuses. `editedTitle` declares `id: z.string()` where `item.retitle`
demands `z.uuid()`, so a hand-composed id passed the reader and raised `BAD_REQUEST` inside `call()`
-- uncaught, and the same bare `Internal Server Error`. MEASURED at the page-over-HTTP seam on
2026-09-12: `id=not-a-uuid` and an empty `title` both answered `500 Internal Server Error`.
`theDeviceNamed` and `namedPlacement` were the two that were already closed, because they declare
`z.uuid()` on both sides -- which is why the `/devices` assertion passed and was not evidence about
the others.

**AND THE FIX WAS NOT TO RESTATE THE ROUTER'S SCHEMA IN THE ACTION**, which is the obvious move and
the wrong one: `items/actions.ts` says "the rule about what a write accepts lives in one place", and
a second copy is a second place for the two to disagree. What was left was to treat an `ORPCError`
under 500 as the ANSWER it is, which `/api/rpc` already does one layer over. That is
`whatTheProcedureAnswered` in `apps/web/src/answer.ts`, and it is ONE reader for the same reason
`whatTheFormCarries` is: written per action, the site nobody remembered would be the site that 500s,
which is exactly how this survived CNCORE-123.

**THE THREE ACTIONS THAT SAY MORE THAN "NOTHING WAS WRITTEN" STILL DO, and that is what the shared
reader had to leave room for.** `/login` tells a mistyped password from a bound that is holding
(ADR-0125), `placeItemInContainer` tells the owner a position is taken, and `logOut` stops on a
refusal rather than carrying on -- its next line clears the cookie, and a refusal would mean the row
it names is still there, which is exactly the half-logout ADR-0043 refuses. Each reads the refusal
the shared rule handed it; none of them classifies one for itself.

**`logOut`'S BRANCH IS UNREACHABLE TODAY, said because the sentence above reads as a live
distinction and is not one.** `session.logOut` declares no input to refuse, and the only sub-500
error `ownerProcedure` raises is `UNAUTHORIZED` for a caller with no session -- which that action
has already established there is. It is a guard on an ordering, kept because the day the procedure
learns a refusal is the day the guard's absence becomes a silent half-logout, and written down here
because an unfalsifiable claim in a record is worse than a stated one. Found by review, which
reached the branch and could not enter it.

**AND THE SAME RULE NOW ANSWERS THE REFUSAL THAT IS NOT ABOUT A FIELD AT ALL.** `ownerProcedure`
throws `UNAUTHORIZED` for a caller with no session (CNCORE-109), which is 401 and therefore under
500, so a visitor composing a write this app never offered them gets the page rather than the 500.
That is wider than the ticket asked for and is the shared rule rather than a second decision: a
reader that classified by CODE would need adding to for every refusal a procedure learns, and the
one nobody remembered would be the 500. It is asserted at the page-over-HTTP seam alongside the two
fields. `/tasks`, `/devices` and the owner's half of `/import` render `NotLoggedIn` for a visitor
anyway, so what comes back says Log in rather than resembling a write that worked.

**AND `restorePlacement` LOST A NARROWING RATHER THAN GAINING ONE.** It let `NOT_FOUND` past and
threw everything else, which made a hand-composed id answer 500 on the one surface whose whole
subject is an id that may be stale. Every refusal now takes the same answer it already gave that
one: the container as it stands, with the spent offer dropped.

**ASSERTED AT THE PAGE-OVER-HTTP SEAM, on both fields measured above and on a second ACTION** --
`newItem` declares `title: z.string()` against the same `titleByHand` `item.create` demands, so a
fix written into `retitleItem` alone would have passed every assertion about the first one.

**THIS RECORD STILL STAYS PROPOSED, and for the same reason as before.** Next is DERIVED and nothing
derives one. This section widened what "a refusal" means on the write path; it did not touch the
half that is unbuilt.
