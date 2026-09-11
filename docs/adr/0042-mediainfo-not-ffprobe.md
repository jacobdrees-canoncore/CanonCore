---
status: proposed
---

# MediaInfo, not ffprobe, for the scan-time analysis pass

Probing is not transcoding, so reading a file's own properties sits outside the ffmpeg ban. The
pass writes duration, container, codecs, resolution, bitrate and chapters onto the file row.

MediaInfo over ffprobe because it contains NO ENCODER, which makes "direct play only" structurally
true rather than policy-enforced, and because it is a smaller install, which matters on a NAS. Plex
runs a distinct analysis pass storing exactly these fields and ships MediaInfo alongside its own
transcoder. Accepted cost: marginally worse coverage of exotic containers.

Letting the client be the only source of duration is refused, though not for the reason first
given. Jellyfin's `PlaybackProgressInfo` genuinely carries no duration field. Plex's does: `POST
/:/timeline` accepts `duration`, "The total duration of the item in ms", sent on every progress
report. So the channel exists in one of the two, and what Plex does with the value is undocumented.

The real objection is timing rather than plumbing: a client cannot answer BEFORE playback starts,
and "say so plainly" has to work at the moment someone presses play.

## Why these are columns rather than statements

Because they are MEASURED OFF THE BYTES rather than claimed by anybody. Re-measuring the same file
gives the same answer, so there is nothing to disagree about and nothing to give provenance to.

That is the first question ADR-0012 makes an implementer ask of any field
that is not a statement, and it is answered here rather than left as an inconsistency.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-products.md`.
