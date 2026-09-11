---
status: proposed
---

# A file is a part or a variant, and those are two relations

A PART continues the edition — part 2 of a two-part film. A VARIANT is the same edition encoded
differently, which under direct play only is the sole way to serve a device whose declared
capabilities reject the primary file.

Jellyfin keeps THREE arrays — `AdditionalParts`, `LocalAlternateVersions` and
`LinkedAlternateVersions`, so the variant side is itself split by provenance — and Plex nests them
separately. Collapsing them loses the difference between "the film continues here" and "the same
film, in H.264". The part ordinal is STORED with
both derived readings, a manual-verification flag and an exclude flag: both incumbents parse it
from the filename and neither can correct a mis-parse, which is why Plex's advice is to go merge
the files — and our scanner is forbidden to rename anything, so that escape hatch is closed.

A multi-part edition is NOT PLAYABLE UNTIL ITS PARTS ARE ORDERED. Progress is one number per
(owner, edition) under ADR-0020, so progress recorded against an unordered three-file edition is
uninterpretable, and deriving the ordinal later never gives that old number meaning. This is a
sequencing constraint across two slices rather than a property of either, which is why it is written
here rather than assumed.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-jellyfin.md`.
