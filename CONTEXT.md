# CanonCore

A self-hosted catalogue for collections that do not fit one folder tree. A story belongs to a
season, and to a chronology, and to a character's timeline, and to an adaptation chain; the
vocabulary below exists so all of those can be true at once.

It is domain-general, and it is a media server in its own right rather than a client of one.

## Language

An `_Avoid_` list rejects those words AS NAMES for the term above it: a type, a field, a function, a
SQL alias. It does not ban the word from prose, which is why **Placement** below is free to define
itself as "one item's membership" while rejecting `membership` as a name. Where a term's own entry
settles a different word for what a reader sees, that word is the reader's and is not a second name.

### The catalogue

**Item**:
The abstract thing being catalogued — a story, a person, a character, a place, a container —
existing independently of any file. IFLA LRM and BIBFRAME both use *Item* for the file instead;
ours is deliberately the opposite.
_Avoid_: record, entry, asset

**Work**:
The item kind for stories and for containers. Containers fold into it; there is no separate kind.
_Avoid_: collection, boxset

**Entity**:
An item of any kind other than `work`: a person, character, organisation, place,
time span or concept.

**Container**:
An item that holds other items. Whether an item is one is stored, never inferred from having
members.
_Avoid_: folder, library, bucket

**Chronology**:
An ordered container whose sequence expresses a timeline rather than a release history.

**Group**:
A browsing scope: what a view is narrowed to. Never a partition.
_Avoid_: library, partition, workspace, section

**Continuity**:
The reserved word for a distinct internal timeline, should two ever need telling apart. Not yet a
construct in the model.
_Avoid_: canon

**Work-browsing**:
Any surface answering "what can I watch", as opposed to one answering "what is in this catalogue".
The question a surface asks, not a list of surfaces.

**Catalogue search**:
The surface that searches the owner's own catalogue, across every item kind. Not the CMPP operation
of the same name.
_Avoid_: search, unqualified

**Alias**:
The retained id of a merged-away item, resolving to the item that survived the merge. It is an
identity, never an alternative name.

### Entity kinds

**Person**:
A real human. Never a fictional one, which is what lets a person portray a character.

**Character**:
A fictional individual or group, including species.

**Organisation**:
A body of people, real or fictional. Distinct from the place it occupies.

**Place**:
A location, real or fictional. Distinct from any organisation occupying it.

**Time span**:
A temporal extent with a beginning, an end and a duration.

**Concept**:
An abstract or fictional thing that is none of the above, including physical objects in fiction.

### Ordering

**Placement**:
One item's membership of one container, at one position, carrying every source that
asserted it. THE SAME CONSTRUCT FROM EITHER END: from the item's, an ordering it sits in; from the
container's, something that container holds. Both ends are named Placement in code, because a Repeat
puts one item in one container twice and the placement is the only thing that can tell those two
rows apart. The reader's words are "Also appears in" from the item's end and "Members" from the
container's.
_Avoid_: record, edge, member, membership, link

**Position**:
Where a placement sits in its container's ordering. Two placements may share one, and a placement
may have none.

**Unplaced**:
A member of a container no source has given a position in. It is a PLACEMENT WITH NO POSITION, never
an absent placement: dropping it shrinks the container silently and numbering it last asserts an
order the source never gave. The reader's words are "no position given".
_Avoid_: unordered, unsorted, orphan, missing

**Repeat**:
The same item placed twice in one container, at different positions. A recap at position 1 and the
episode at position 5 are one item, twice, on purpose.
_Avoid_: duplicate

**Multi-placement**:
One item sitting in several orderings at once, each at its own position.
_Avoid_: duplicate, cross-listing

**Placed by**:
Which kind of source put an item into a container, said in the words of the list rather than of the
model: hand-placed, imported, from the files, rule-derived. One list filtered by it, never two lists
split by it. These are the words of "Also appears in", the ITEM's end. From the container's end the
rows name the SOURCES instead, because two providers disagreeing about a position are both
"imported" and the kind cannot tell that from a Repeat.
_Avoid_: manual, automatic, smart

### Renderings

**Edition**:
A rendering of an item: a cut, dub, remaster, release or narration. The same content differently
rendered.
_Avoid_: version, instance, copy

**Extra**:
A trailer, featurette, deleted scene or interview: a work in its own right, related
to the work it accompanies.

**Adaptation**:
New content based on a source item. Always a separate item, never an edition of one.

**Part**:
A file that continues an edition: part 2 of a two-part film, disc 3 of forty.

**Variant**:
The same edition stored again with a different encoding, for a device that cannot
play the first.

**Medium**:
How an edition is consumed by a renderer: video, audio, text or image. A playback medium, never a
taxonomy of works.

**Edition coverage**:
The set of intervals of a work that one edition actually covers. Never a single figure, and never
the work's own size, which is extent.

**Extent**:
How many parts a work has in total, independent of any edition. Unknown far more often than it is
known.

**File**:
Bytes on disk, attached to an item or an edition. Its identity comes from its content, so its path
is location rather than identity.

**Redundant file**:
Two files holding the same content.
_Avoid_: duplicate

### Claims

**Credited to**:
The stated in-universe author of a work, which may be a character. Distinct from who
actually made it.

**Statement**:
One claim about an item, edition or placement, carrying its property, its value, its source and
its rank. Field values and relationships are both this shape.

**Property**:
A declared field in the catalogue, with its datatype, value-kind, cardinality and validation. Only
the product adds properties.
_Avoid_: field, attribute, custom field

**Qualifier**:
A condition narrowing a statement to a context: in this work, in this place, at this time.

**Rank**:
A statement's standing among the values of its field: preferred, normal or deprecated. A placement's
sources carry one too, and it resolves disagreement about position the same way.

**Favourite**:
The owner's chosen value for a field: the statement they ranked preferred. It is also the lock.
_Avoid_: lock, pin, primary, override

**Language**:
The language of one statement's VALUE, as a BCP 47 tag. Unknown is the value `none`, never an
absent one. Distinct from an edition's own language, which says what language the edition is: a
German edition can carry an English title.
_Avoid_: locale

**Country**:
Where a claim applies, as distinct from what language it is written in. A second axis beside
language, never a synonym for it.

**Date**:
A point or span in time, known only as precisely as it is actually known. A year-only date is a
year, not the 1st of January.

**Note**:
The owner's own free text about an item. Theirs alone: nothing else can assert one.

**Scheme**:
What an identifier is (ISBN, MusicBrainz MBID), as distinct from who asserted it.

**Vocabulary**:
The lookup table backing one property's allowed values. A row in one is a vocabulary VALUE, which
is why the table is `vocabulary_values`.

**Reference table**:
One of the product's own closed sets — the item kinds, the source kinds, the ranks. It holds no
owner data, and a row appearing in one at runtime is a defect. Distinct from a vocabulary, which
takes rows at runtime from imports and quarantines what arrives broken.
_Avoid_: enum, lookup (unqualified)

**Projection**:
A column holding a cached copy of whichever statement currently wins for that field. The statement
is the truth; the column is what reads and sorts are fast against.
_Avoid_: denormalisation, cache, materialised view

**Retired**:
A vocabulary value deliberately deprecated, kept only for the rows already using it.

**Quarantine**:
A value that arrived broken from an import, held apart from the live set. A vocabulary value
(ADR-0030) or a statement whose value its property cannot hold, such as a date that is not EDTF
(ADR-0073). Distinct from a tombstone, which says a source WITHDREW a claim: a quarantined claim
still stands, and what is refused is reading it as good.

### Sources

**Source**:
Who asserted a value. One of four kinds: a provider, the owner, a sidecar, or a
derived computation.

**Derived**:
A value CanonCore computed for itself, sourced to the named computation and the
version of it that ran.

**Confidence**:
What a scorer judged about one statement, between 0 and 1.

**Source order**:
The single global ranking of sources, deciding which value shows before a favourite is set.

**Owner**:
The single user of an instance, and a first-class source sitting first in the source order.

**Provider**:
A URL answering the CMPP contract. Never a plugin, and never code running inside the app.
_Avoid_: plugin, agent, scraper, integration

**Sidecar**:
Metadata that came off the disk rather than from a provider: a file beside the
media, or tags embedded in it. Its own source kind, and not the owner.

**CMPP**:
The CanonCore Metadata Provider Protocol: the HTTP contract every provider answers.
Metadata and URLs, never media bytes.
_Avoid_: Canonical Media Provider Protocol, plugin API, scraper, provider SDK

**Attribution**:
What a source's licence obliges the app to SHOW wherever that source's claims are read: a notice
printed verbatim, and the source's mark. Declared by the provider and stored on the Source row,
never held in CanonCore against a known provider — a notice hardcoded for one source leaves the
next source's obligation nowhere to go. A source that imposes nothing has none, which is the
ordinary case.
_Not_ the attribution string on Artwork below, which is a photo credit for one image and belongs to
that file rather than to the source.
_Avoid_: credit, licence text, disclaimer

**Search**:
The CMPP operation returning candidate matches for a query. Required of every provider.

**Lookup**:
The CMPP operation returning one record by its stable id. Required of every provider.

**Browse**:
The optional CMPP operation returning a container together with its ordering, so it yields
placements directly.

**Credential**:
What a Provider needs to reach its own upstream — a token, a session, whatever that upstream asks
of it. A Provider declares the one it needs; the Owner supplies it; CanonCore forwards it and never
stores it. It belongs to the Provider, not to this catalogue, which is why it is not a Setting.
_Avoid_: token, secret, key, api key

**Unlock**:
Giving a Provider its Credential. A Provider with none stays reachable and answers nothing, saying
so — it is not broken and it is not empty.
_Avoid_: authenticate, connect, log in, authorise

**Purge**:
Removing everything one source ever contributed, in one operation. The word is the OWNER'S as well
as the code's: it is on the button, because ADR-0036's obligation when a licence ends is to purge
cached content rather than to hide it, and "remove" would understate what the owner is authorising.
An item the owner also claims is not removed by one — it stays, stripped of what that source said.
_Avoid_: delete, uninstall, disconnect, unimport

**Enrichment**:
Reaching every connected provider at once to propose values, each matched independently.

**External id**:
The id a provider uses for its own record, held beside an item's own id and sourced to the provider
that claimed it. It identifies THAT PROVIDER'S record rather than the work, so two providers' ids
agreeing is evidence for matching rather than matching itself.
_Avoid_: provider id, source id, guid

**Matching**:
Deciding which external record an item is. A separate operation from applying, with its own
endpoint.

**Applying**:
Deciding which of a matched record's values to take. A separate operation from matching, with its
own endpoint.

**Review queue**:
Where a match lands when its confidence falls between the two thresholds.

**Config URL**:
A URL the owner typed into settings, such as a provider's base URL. Checked
against the allowlist.

**Content URL**:
A URL arriving inside a provider's response or a redirect. Checked against the
deny-list, always, before anything fetches it. One that is only READ — a record's
`url`, rendered to the Owner as a link — is never fetched, so what it is held to
is its scheme: HTTP or HTTPS, because the scheme is what decides whether the
reader's browser treats it as a destination or as a program.

### Consumption

**Direct play**:
Playing a file exactly as it is. The only playback mode CanonCore has.

**Client**:
A surface configured with a server's URL, reaching it over CanonCore's own HTTP API. The phone and
the TV apps are clients. The web UI is NOT one: the server serves it, at the server's own origin.
_Avoid_: frontend, consumer, app (unqualified)

**Session**:
One logged-in device, with the name, id, version and capabilities it declared.

**Capabilities**:
What a device declares it can play, checked against a file's probed properties.

**Progress**:
How far the owner has got through one edition. The grain is the edition, never the
item.

**Progression**:
How far through an edition a position is, from 0 to 1, whatever the medium.

**Locator**:
Where a position actually is, in whatever form the medium uses: a timestamp, a
page, an index.

**Watch event**:
An append-only fact that the owner watched part of an edition, at a time.

**Continue Watching**:
The computed list of editions in progress. Offered, never auto-played.

**Artwork**:
A provider-supplied image with its role, its licence, its attribution string and its extracted
palette.

### Named instances

**The archive**:
The local copy of the independent Tardis Wiki. A stress test and the owner's own library, never a
source of requirements. Held outside every repo.

**The forensic record**:
The account of this product's previous attempts and how each one ended. Evidence, never
instructions: its salvage manifest is superseded. Tracked in the private repository, never published,
and cited by this name rather than by a path that a public tree will not resolve.
_Avoid_: archive

**The fixture**:
The small committed extract of the archive, each row chosen and named for the invariant it proves.
What tests the model. It is committed in the wiki provider's repository, which is what reads the
archive, and never in this one. It is an extract of THE ARCHIVE, so what another source says about
the same work is not in it and cannot be: those are expectations hardcoded where they are asserted.
_Avoid_: sample, seed data

**Version one**:
The effort CNCORE-2 specified, and its four stop conditions. An EFFORT, never a release number: the
release series starts at 0.1.0 and stays 0.x while the playback half is unbuilt, so version one
precedes v0.1.0 rather than following it.
_Avoid_: v1, 1.0, version 1.0

**The demo**:
The one public read-only instance, and the only surface on which CanonCore is a publisher. It shows
the model's range; the fixture is what tests it.
