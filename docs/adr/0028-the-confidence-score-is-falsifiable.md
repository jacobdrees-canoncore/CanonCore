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
