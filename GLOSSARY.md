# CanonCore

A self-hosted Library and player for any medium, built schema-first: an Admin imports a strict schema from the Providers they choose, media Versions are matched to it, and any Item can sit in many Orderings at once.

## Language

### The Library

**Library**:
Everything imported into an install of CanonCore, owned or not.
_Avoid_: catalogue, collection, database

**Item**:
One thing in the Library: a film, show, season, story, episode, part, book, issue, track, work, audio drama or extra. It exists whether or not any media for it exists.
_Avoid_: record, entry, title, media item

**Edition**:
One cut of an Item, with its own runtime and watched state: broadcast, remastered, extended, a reconstruction. Every Item has a default Edition.
_Avoid_: cut, release (for a cut), version (for a cut)

**Version**:
One copy of an Edition, such as 1080p, 4K, PAL or NTSC.
_Avoid_: file (for the concept), copy, edition (for a quality)

**Segment**:
A time span of one media file that backs a Version, where the file covers several Items, such as an omnibus or a multi-episode file.
_Avoid_: chapter (for this), clip, merged item

**Extra**:
An Item owned by another Item that supplements it, such as a trailer, featurette or deleted scene.
_Avoid_: bonus, special feature, attachment

**Missing**:
An Item known to exist but lost, with no Version anywhere, such as a wiped broadcast episode.
_Avoid_: lost media, gap, unowned

**Offline**:
A Version whose media file was not found at the last scan.
_Avoid_: deleted, missing (for a file), unavailable

**Download**:
A Version's file saved on a device so it plays without a connection; such a Version is Downloaded on that device.
_Avoid_: offline copy, offline download, saved (for this)

**Unmatched file**:
A media file the scanner has found that has no Match yet.
_Avoid_: orphan, unidentified file, unknown file

### Shape

**Show**:
The top of the fixed TV hierarchy, and of an audio drama range or a podcast, which share its shape.
_Avoid_: series (for Show), container, folder

**Season**:
A numbered group of Episodes in a Show, numbered as the Provider the Show was imported from numbers it.
_Avoid_: series (for Season), container

**Episode**:
One broadcast instalment of a Show, within a Season.
_Avoid_: show (for one Episode), chapter

**Story**:
A multi-part story between Season and Episode (or Part), only where a Show has them; an audio drama's stories are Stories.
_Avoid_: serial (as a term), arc

**Part**:
One broadcast part of a Story, an Episode beneath it.
_Avoid_: instalment, chapter

**Artist**:
The top of the fixed music hierarchy.
_Avoid_: band, performer (as the level)

**Album**:
A release by an Artist, holding Tracks.
_Avoid_: record, release group (as the level)

**Track**:
One recording on an Album, a "recording of" the Work it performs where one is known.
_Avoid_: song (as the level), record

**Work**:
A composition: the song or piece that Tracks perform, credited to its writers. A Work is its own Item, beside the Artist, Album, Track hierarchy rather than in it.
_Avoid_: composition (as the term), song (for this), piece

**Music cue**:
A Track heard in an Item, with its start time, duration and order, sourced like any Statement. It holds a Track or, until it is imported, only the Provider's title and id, shown as song and artist; importing the Track attaches it to the same cue.
_Avoid_: song (for this), sync, needle drop

**Book series**:
The top of the fixed book hierarchy, including audiobooks. "Series" is used only in Book series and Comic series.
_Avoid_: saga, sequence

**Book**:
One book or audiobook, optionally in a Book series.
_Avoid_: volume, title

**Comic series**:
The top of the fixed comics hierarchy.
_Avoid_: run, volume, title

**Issue**:
One comic in a Comic series.
_Avoid_: book (for an Issue), title

**Film**:
A standalone film.
_Avoid_: movie

**Collection**:
A Provider's grouping of related Films.
_Avoid_: box set, franchise (for this), folder

**Franchise**:
A set of Shows, Films and other Items that belong together, imported as a Proposal. A Franchise can contain Franchises.
_Avoid_: universe, group (for this), continuity, folder

### Orderings

**Ordering**:
Any sequence of Items: a Timeline, a broadcast or DVD order, a reading list, a Profile's own list.
_Avoid_: container, chronology, list (for the general concept), folder

**Timeline**:
An Ordering in in-universe order, often owned by an Entity, such as "Rose Tyler's timeline".
_Avoid_: chronology, canon order

**Smart Ordering**:
An Ordering defined by a saved filter plus a sort, filled from the Library rather than by hand.
_Avoid_: smart collection, smart playlist, dynamic list

**Placement**:
An entry in an Ordering, at a Position, holding an Item or, until it is imported, only the Provider's title and id. Importing it attaches the new Item to the same Placement, so its Position never moves. Several Placements of one Item in one Ordering make a Repeat.
_Avoid_: edge, record, membership

**Position**:
A Placement's whole-number place in its Ordering.
_Avoid_: index, rank, order number

**Repeat**:
The same Item placed more than once in one Ordering.
_Avoid_: duplicate

**Prerequisite**:
An Item a Provider says should be seen before another Item, shown as "Watch first" and sourced like any Statement.
_Avoid_: dependency, required viewing, Relationship (for this)

**Up Next**:
What plays after the current Item, taken from the Ordering being walked.
_Avoid_: autoplay, queue, next episode (for the concept)

**Also in**:
The list of every Ordering an Item has a Placement in, each with its Positions.
_Avoid_: appears in, related

### Entities

**Entity**:
A Person, Character, Group, Place or Company. It has its own page and appearances, and can own Timelines.
_Avoid_: subject, tag, metadata object

**Person**:
A real human credited on Items.
_Avoid_: actor, creator, contributor (as the kind)

**Character**:
A fictional being who appears in Items, possibly played by many Persons, such as the Doctor.
_Avoid_: role (for the being), persona

**Group**:
A team or organisation in or behind the fiction: the Avengers, Starfleet, UNIT.
_Avoid_: team, faction, organisation (as the kind)

**Place**:
A location in the fiction: Gotham, Hogwarts, Gallifrey.
_Avoid_: location, setting

**Filming site**:
A real-world spot, with coordinates, where an Item was filmed; it may stand in for a Place.
_Avoid_: location, filming location, real place

**Company**:
A real studio, network or publisher.
_Avoid_: studio, network, publisher (as the kind), label

**Credit**:
A Person's contribution to an Item: a role, and optionally the Character and the incarnation they played.
_Avoid_: cast entry, crew entry

**Entity link**:
A typed link between two Entities, such as parent of, member of or located in.
_Avoid_: Relationship (between Entities), relation, association

**Relationship**:
A typed, directed link between two Items: based on, spin-off of, soundtrack of, remake of, version of, crossover with, recording of.
_Avoid_: relation, association, Entity link (between Items), link (for Matches), Prerequisite (for "watch first")

### Providers and provenance

**Provider**:
A source of Library data, or of a Profile's watch history, speaking CMPP.
_Avoid_: agent, scraper, plugin, source (for the installable)

**Local metadata**:
The built-in Provider whose data comes from the Library's own media files: their tags, NFO, ComicInfo and EPUB metadata.
_Avoid_: local provider, NFO reader, embedded metadata (as the Provider)

**CMPP**:
The HTTP protocol a Provider speaks, described by its manifest.
_Avoid_: plugin API, addon protocol

**Store**:
The in-app listing of public Providers that an Admin can install. A private Provider, installed by pasting its manifest URL, sits beside Store installs in the Admin's installed list, never in the Store.
_Avoid_: marketplace, plugin repository

**Proposal**:
What a Provider, or a file an Admin imports, offers to add to or change in the Library structure, imported only when an Admin accepts it.
_Avoid_: suggestion, candidate, sync

**Rejection**:
An Admin's remembered "no" to part of a Proposal.
_Avoid_: ignore list, exclusion, blocklist

**Match**:
The attachment of a media file to an Item's Edition as a Version.
_Avoid_: link, identify, attach

**Statement**:
One value for one field of one Item, from one Source. The shown value is the winning Statement: a Lock, or else the Statement of the Provider ranked first for that field.
_Avoid_: fact, claim, property value

**Source**:
Where a Statement came from: a Provider, a local file, an Admin, or a file the Admin imports, such as a CBL reading list, which records the origin it states and "no licence stated".
_Avoid_: origin, provenance (as the noun for one source)

**Lock**:
An Admin's Statement that always wins for its field.
_Avoid_: pin, override (as the noun), freeze

### People using it

**Account**:
One invited person's sign-in to an install, holding one or more Profiles.
_Avoid_: user (for the record), login

**Profile**:
One viewer under an Account, with its own watch state, Continue Watching and private Orderings.
_Avoid_: user, household member

**Admin**:
An Account allowed to edit the Library, install Providers and invite people.
_Avoid_: owner (as the role), superuser

**Continue Watching**:
A Profile's row of started, unfinished Items, and the next Item after one it finished, taken from the Ordering it was walking.
_Avoid_: on deck, in progress, resume row

**Progress**:
Where a Profile is in an Edition, kept for video and audio as a proportion of the Version's runtime, so switching Versions lands on the same scene.
_Avoid_: resume point

**Invite**:
An Admin's single-use offer that lets one person create an Account on the install.
_Avoid_: invitation code, share (for this)

**Restricted Profile**:
A Profile limited to a maximum content rating that can watch, favourite and use its Watchlist, but not curate or reach Settings.
_Avoid_: kids mode, child account

**Favourite**:
A Profile's mark that it loves something: an Item, Show, Ordering, Franchise or Entity.
_Avoid_: like, heart, star (for this)

**Watchlist**:
A Profile's list of watchable things it means to watch: Items, Shows and Orderings.
_Avoid_: queue, up next (for this), to-watch

**Rating**:
A Profile's own score for an Item, kept apart from any Provider's score.
_Avoid_: review, stars (as the term)

**Stream limit**:
The most playback sessions one Account may run at once, checked when a session starts.
_Avoid_: device limit, seat

**Upload allowance**:
An optional amount of streaming per period that an Admin enters for their host, shown against measured usage.
_Avoid_: bandwidth cap (as the term), quota
