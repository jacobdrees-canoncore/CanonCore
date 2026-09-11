---
status: proposed
---

# Direct play only

No transcoding, no quality ladders, no ffmpeg. This is the single largest scope constraint in the
product, and it makes client codec coverage load-bearing in exchange.

When a file will not play, the refusal NAMES THE PROPERTY THAT FAILED: playability is the file's
probed properties checked against the device's declared capabilities. Both incumbents compute it
this way. Jellyfin's `TranscodeReason` enum has 28 values at v12.0 (27 at v10.11), and MOST are a
comparison against a profile the client sent — four are not: two are dead values set nowhere,
`AudioIsExternal` is a property of the media alone, and `DirectPlayError` is the fallback set when
the comparison produced nothing. Two named, closed lists compared at play time gives the same sentence with none of
the transcoding machinery.

THERE IS NO FORCE-COMPLETE RULE, and refusing it is this record's job because it is a playback rule.
An earlier one completed by DURATION rather than by position, so thirty seconds into a four-minute
trailer marked it watched — a fabricated true, which this model forbids.

How completion is computed at all is [[0085-completion-branches-on-the-locator]]'s, the branch on
the locator included. An earlier version of this paragraph asserted that branch as though it were
decided here.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-jellyfin.md`.

## OPEN: this record does not name remux, and the silence is a gap rather than a decision

**Before this section, `remux` appeared nowhere in `docs/adr/`, `CONTEXT.md` or `CLAUDE.md`**
(checked 2026-09-11). This record is the first place the word is written down in the decisions at
all, and it remains absent from `CONTEXT.md` and `CLAUDE.md`.
Remuxing is banned here only by side effect — it is neither transcoding, nor a quality ladder, and
it does not require ffmpeg in the sense this record refuses.

The competitor sweep asked for exactly two edits to this record and **neither landed**: name remux
in the refusal, and state the cost being accepted. It rated the silence HIGH twice:

> Remuxing is cheap, lossless and near-free in CPU, and it is the difference between an MKV playing
> in a browser and not playing at all ... **Either answer is fine; the silence is not.**

**This is not answered here, deliberately.** It is a playback decision and the playback half is not
built; answering it now would be deciding a mechanism ahead of the slice that needs it, which
[[0051-grow-in-vertical-slices]] refuses. It is MARKED here so the gap survives to the spec that
owns it, because a finding that lives only in a research file is a finding nobody acts on.

**The first client is a browser**, so this is the first thing a playback slice meets rather than an
edge case. One further constraint the same sweep supplies, and it changes where the difficulty is:
**subtitles rather than codecs are where direct-play-only actually breaks** — on PlayStation "any
subtitle at all disqualifies direct play", and image-based PGS and VOBSUB effectively cannot be
offered at all. A remux answer that considers only video and audio codecs will not have answered it.
