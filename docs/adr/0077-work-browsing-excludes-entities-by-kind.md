---
status: proposed
---

# Work-browsing excludes entities by kind, and search answers a different question

Entities must not leak into work-browsing surfaces. Jellyfin's mechanism is a PAIR — people carry no
`TopParentId` and there is an explicit exclude-by-kind list (`_itemByNameKinds`: Person, Genre,
MusicGenre, MusicArtist, Studio) that a surface must name to get them back. The parent half cannot be
copied here, because the case that justified putting entities in the items table at all (ADR-0005)
is an ordered container whose members are entities: "the Doctors, in order", "companions by first
appearance". Those entities do have a container parent, by design. The kind half is where Jellyfin
already is, so excluding by kind has company rather than being our invention.

So exclude BY KIND, and phrase the rule around THE QUESTION A SURFACE ASKS rather than around a list
of surfaces. A surface answering "what can I watch" returns `work` and ignores the entity kinds. A
surface answering "what is in this catalogue" returns everything. Entity containers are reached
deliberately rather than turning up in "latest".

Naming the question rather than the surfaces matters because the surface list is open: a command
palette, a related-items rail and an API endpoint would each otherwise need classifying by hand, by
whoever builds them, with nothing to guide the choice. Naming the question lets a surface classify
itself.

A KIND FILTER ALONE IS NOT ENOUGH, and an earlier version of this record stopped there. Containers
fold into `work` (ADR-0004), so "the Doctors, in order" is itself an item of kind `work` and a kind
filter cannot exclude it — the mechanism failed on the record's own example.

The missing test is what the container HOLDS. `items.holds_work` is a stored boolean, maintained
when a placement is written: does this container hold at least one `work`. Work-browsing is then
`kind = 'work' AND (NOT is_container OR holds_work)`.

Stored rather than derived, for the reason ADR-0005 gives: this answer must be single-valued and
decidable. A read-time membership walk would also make an empty container watchable and then hide it
the moment its first member arrived.

A BOOLEAN RATHER THAN A KIND, because mixed containers are the normal case rather than the edge one.
Measured against the archive on 2026-09-10: 1,842 of its categories hold both stories and
non-stories — 40% of every category containing a story. "Stories set in London" is 1,049 stories and
43 non-stories, and it is exactly the container someone browses for. A rule that demanded one kind
per container would refuse members from 1,842 real containers on import; a rule that hid mixed ones
would hide the most useful containers in the corpus.

SEARCH ANSWERS THE SECOND QUESTION AND RETURNS ALL SEVEN KINDS, grouped by kind with works first.
All three incumbents group search results by kind; the ordering within that is ours, since none of
them documents it. Searching "Rose Tyler" and being shown nothing because a character is an entity
is the failure this rule exists to avoid, not to cause.

This rule is what makes the single-items-table decision survivable, and it is why kind must stay
single-valued and decidable (ADR-0005). Getting it wrong in either direction is
visible immediately: either people flood the browse grid, or the containers that justified the
single-table decision cannot be built.

## As built, under CNCORE-4 — and this record stays PROPOSED

**BUILT: `items.holds_work`.** Stored, and maintained by a trigger on
`placements` rather than walked at read time -- which is what this record asks
for, and for the reason it gives: a read-time walk makes an empty container
watchable and then hides it the moment its first member arrives. A test places a
work into one container and a person into another and asserts only the first
turns the flag on.

**AND MAINTAINED ON PLACEMENT WRITE ONLY.** A member whose `kind` changes after
it is placed leaves every container holding it stale. Nothing can change an
item's kind yet, so this is a gap named rather than a bug shipped, and it
belongs to whatever first lets a kind be edited.

**NOT BUILT: any surface that asks either question.** `kind = 'work' AND (NOT
is_container OR holds_work)` is written down here and nowhere else yet, and
catalogue search does not exist. The column is in migration 1 because the
trigger that maintains it has to see every placement ever written; the rule that
reads it belongs to the first browsing surface.
