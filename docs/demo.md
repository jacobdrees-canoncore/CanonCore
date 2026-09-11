# The public demo

A decision, and it sequences LAST. It is not part of version one and does not jump the queue
ahead of the playback or clients specs — but under ADR-0107 it is a requirement rather than an
appendix, because it is the surface the second audience reads. An earlier version of this line read
"Not a decision", which was true only while the owner was the only reader.

The decisions that bind this surface are ADR-0100 (non-commercial), ADR-0036 (TMDB's terms) and
ADR-0094 (the archive is never on it).

One public read-only instance. It is the only surface where CanonCore is a publisher, so every
licence obligation in the product lands here and nowhere else.

## The four groups, and what each is here to exercise

- **Harry Potter** — text, video and audio in one place; three audiobook readings as three editions
  (Fry, Dale, and the 2025-26 full-cast productions); one book adapted as two films; one character
  played by SIX actors, TWO OF THEM IN THE SAME FILM, and one of the six only by voice.
- **Breaking Bad** — release order and story order interleaving at EPISODE level.
- **Taylor Swift** — Taylor's Version as one work in two editions, with vault tracks so the newer
  edition covers MORE than the original. The only worked example anywhere of an edition covering
  more than the thing it derives from, which is the one direction nothing else exercises.
- **Grey's Anatomy** — crossovers interleaving separate series.

## Four providers, and the stop condition funds two

TMDB is film and television only — its own content policy explicitly bars "Audio-only content
including audiobooks, narrative podcasts, radio dramas" — so the novels' covers, publishers, ISBNs
and publication dates come from neither provider the stop condition names. Harry Potter needs a book
provider; music comes from MusicBrainz and the Cover Art Archive.

Sequencing rather than contradiction: the demo post-dates version one, and the stop condition exists
to prove the contract rather than to fill the demo.

## The licence stack

| Source | Terms |
| --- | --- |
| MusicBrainz core | CC0 |
| Cover Art Archive metadata | **CC BY-NC-SA 3.0** — attribution, non-commercial, share-alike |
| Cover images | Separately copyrighted: "All images are copyrighted by their respective copyright owners" |
| TMDB | Verbatim notice, logo subordinate, six-month cache ceiling (ADR-0036) |
| The archive | **CC BY-SA 3.0 Unported** — and NOT on the demo at all (ADR-0094), images included |

**The CAA metadata licence was recorded as CC0 and is not.** MusicBrainz's download page puts CC0 on
the core dumps only; `mbdump-cover-art-archive.tar.bz2` sits in the Attribution-NonCommercial-ShareAlike
group. The NonCommercial term is satisfied because CanonCore is non-commercial (ADR-0100), which is
the whole reason that record exists.

One gap, stated rather than papered over: neither coverartarchive.org nor its API documentation
states a licence for the **live JSON API** responses. The dump licence is the best available
evidence and points at BY-NC-SA. That is inference, not a stated term.

## Clauses to settle before this ships, not after

1. TMDB — using it "as an image hosting service for banner advertisements, graphics, etc.", where
   the trailing "etc." makes the prohibition broader than a narrow ad-banner ban.
2. TMDB — whether a free read-only demo is a "'destination' website ... or for driving traffic",
   which counts as commercial use needing a separate written agreement, judged by TMDB "in its sole
   discretion". Better asked than assumed.
3. Cover Art Archive — what the live API is licensed under at all.

## What the demo is not

It shows the model's RANGE. The fixture in ADR-0057 is what TESTS it. Harry Potter is clean,
complete and precisely dated, so it exercises the edition axis hard and the playback half not at
all: nothing in it is lost, missing or partially surviving, so edition coverage, the two-figure
rollup, date precision, vocabulary quarantine and category cycles are all untouched by it.
