---
status: proposed
---

# The confidence score must be capable of failing, and a test is what makes that true

A committed test asserts PRECISION AND RECALL — never accuracy, which Splink documents as gameable
by guessing the majority class — over a labelled subset of the fixture that MUST include rows whose
correct answer is "no match".

Without those rows PRECISION is never exercised. On a set containing only true matches a false
positive is impossible, so precision is pinned at 1.0 however bad the scorer is; recall still varies,
because a scorer that misses things scores badly on it. An earlier version of this record named the
wrong metric, which matters: an implementer could add the no-match rows, gate on recall alone, and
pass the defective scorer anyway.

Assert BOTH, and note that Splink itself warns "a model cannot be meaningfully summarised by just one
of these performance measures" and suggests a composite. Both is a sound gate here because the two
degenerate scorers fail on opposite metrics — say-yes-to-everything dies on precision,
say-no-to-everything dies on recall. Jellyfin ships the defect today: `TmdbUtils.FindBestMatch` opens with `bestScore = 0`
and `best = results[0]`, so a candidate matching nothing still wins and there is no "no good match"
return path. The statement records the named component signals, not only the total, because 0.8
cannot say which signal fired.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-standards.md`.

## Half built for Works, under CNCORE-361 -- and this record stays PROPOSED

**THE GATE EXISTS**: `packages/db/src/works-match.test.ts`, over `packages/db/src/testing/works-labelled.json`.
It asserts precision and recall, never accuracy, each as a one-sided 95% Wilson lower bound of at
least 0.90 rather than as a point estimate. The bound is the choice because CNCORE-368's finding
(`docs/research/episode-groups-and-a-scoreable-match.md`, section 3.5) shows a point estimate cannot
tell 95% from 86% below about fifty rows.

**THE SET, AND WHERE ITS LABELS COME FROM.** The population is candidate pairs of a tardis.wiki story
and a TMDB episode, taken 2026-09-26. On the wiki side that is `Category:Doctor Who (1963)` and
`(2005) television stories`, ns 0, 159 and 184 pages. On the TMDB side it is `tv/121`, seasons 1 and
up, and `tv/57243`, every season. A pair is kept where the two share a release date or a loosely
normalised title, or where its label is MATCH. The labels come from evidence the scorer never reads:
Wikidata's `P361` and its serial's part count for a 1963 part, the `P6262` tardis: id a 2005
episode's IMDb id reaches, and the wiki's `Epcount`, which overrules either to NO MATCH. **751 rows,
159 MATCH and 592 NO MATCH**, of which 589 are 1963 parts scored against their own stories: the hard
negatives the finding named. 98 pairs had no such evidence and were left out rather than guessed. The
file says which.

**WHAT IT MEASURED, 2026-09-26**: precision 158 of 163 applied (lower bound 0.938) and recall 158 of
159 (lower bound 0.972). The five false positives are the 1963 first-three-seasons stories whose
parts TMDB titles one by one (ADR-0026 names them). The one miss is `Smith and Jones`, which TMDB
dates a day after the wiki does.

**CHECKED BY PUTTING THE DEFECT BACK.** Removing the instalments veto turns the precision test red. So does
halving the title-and-date score, and that also turns the recall test red.
**IGNORING THE DATE ENTIRELY DOES NOT**, and that is a finding about the set rather than a pass: it
holds only a handful of same-title, different-date NO MATCH rows (the finding's section 3.2 found
three such titles). So the date signal is barely tested here. A set built to test it needs those rows
in quantity.

**NO ROW OF THE SET FALLS BETWEEN THE BARS**, so the gate measures the high bar and never the low
one. What the band does is asserted at the router alone, in `provider.test.ts`, on stand-in answers
(`Children in Need: Born Again`), and in `multi-placement.test.ts` on the same story as TMDB really
serves it. A set that measures the band needs rows the scorer puts there, and there are only two
shapes it can (ADR-0027).

**THE SET IS TMDB CONTENT** (ADR-0036), so it carries the date it was taken, and a test in the same file
goes red 180 days after that date. That is TMDB's ceiling, enforced rather than remembered.

**THE SIGNALS TRAVEL BESIDE THE TOTAL, BUT ONLY WHERE A MATCH IS OFFERED.** `scoreWorkMatch` answers
`{ title, released, instalments }` with every score, a candidate pair stores the title and date signals
beside its score, and the Item page prints them on an offered row.

**NOT BUILT, AND IT IS WHY THIS RECORD STAYS `proposed`: a match APPLIED above the high bar keeps
neither its score nor its signals.** The arriving record's claims are written onto the matched Item,
each sourced, and nothing records that a scorer put them there or which signal carried it. So an
applied match "cannot say which signal fired", which is this record's last sentence, unmet. That half is CNCORE-430.

People are CNCORE-362's, on their own set. The same gate is to be pointed at them.
