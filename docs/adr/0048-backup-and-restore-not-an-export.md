---
status: proposed
---

# Build backup and restore, scoped so it is not an export

Placements, statements, favourites and the whole provenance record exist nowhere but the database,
and a forward-only ladder makes restore the only way back from a bad upgrade — the exact consequence
Jellyfin documents for its own users.

An earlier version drew a contrast with Plex that does not hold: Plex draws the SAME line we do. Its
scheduled tasks back up the core database every three days, described as "the database that holds
your media viewstate and other critical information", and warn that "this is only a backup of your
core database; it is not a backup of all of your metadata content". Metadata is re-derivable by
rescanning; viewstate is not, and Plex protects it on a rotation. The conclusion needs no contrast —
it stands on what our own data is.

Scoped as Jellyfin scoped 10.11: a backup "can only restore systems on which the backup was
originally made". That is what stops it becoming cross-instance interchange by the back door.
**THE SYSTEM IS THE OWNER ID**, which ADR-0044 as built already generates per install; the section
below says why that sentence needed an identity naming it, and what forced the question.

The dump is a documented dump of our own schema stamped with its migration-ladder version, NOT a
designed interchange format, so it creates no compatibility promise. Rejected: a versioned
interchange format, whose only benefit is third-party implementations that no ecosystem exists to
write; and exporting to `.nfo` or a bibliographic standard, since no existing format expresses
multi-placement and the export would silently drop the product.

## What counts as the same system, and the case that forced the question

**The identity is the owner id.** ADR-0044 as built generates it PER INSTALL rather than fixing it in
source, so it is already the only value distinguishing one instance from another. A restore refuses
unless the dump's owner id and the target's are the same.

That answers a question this record could not previously answer without weakening itself. A test
environment is FORCED rather than chosen: ADR-0047 says of its own CI gate that it "proves the ladder
composes from nothing; it says nothing about what an existing database will do", and a forward-only
ladder whose released rungs are frozen makes restore the only way back. So somewhere to run a
migration against a POPULATED database first is a requirement — and seeding that somewhere from the
owner's real backup is, on the sentence above as it stood, a restore onto a system the backup was not
made on. The product would have refused the one restore it most needs to allow.

Under the owner id it is the SAME SYSTEM, because it is the same owner, and the rule holds with no
carve-out. Someone else's install generated a different id, so instance-to-instance interchange stays
refused BY CONSTRUCTION rather than by a flag.

**Two alternatives rejected.** An explicit test-restore exception is a flag whose only job is to
weaken a guarantee, and that kind gets set in the wrong place eventually. Seeding the test
environment from the archive (ADR-0057) or from synthetic data leaves this record untouched but
proves less, because the migration is then tested against a database not shaped like the one it will
meet in anger.

**What the restore path must therefore implement**, named now because it is cheapest before this
record ships and impossible to change quietly after. A test instance is not a fresh install that
later receives a dump; it is created FROM the dump and inherits the owner id rather than generating
one. A restore into an instance that already exists refuses unless the ids already match. Both routes
preserve the same property, and naming both stops the check being bolted onto only one of them.

## Supersedes

An earlier decision read "no fork, no export, no import", broadly enough to refuse backup itself.
That was the most convergent finding of the competitor sweep — ten of eleven independent agents
raised it — and the refusal was NARROWED rather than dropped: instance-to-instance interchange is
still refused.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-jellyfin.md`.
