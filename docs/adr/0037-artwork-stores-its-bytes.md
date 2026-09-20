---
status: proposed
---

# Artwork stores its bytes and expires on read

The provider URL is where it came from; the stored bytes are what is displayed — the same
distinction the model makes for files, where path is location and not identity.

Hotlinking is refused: it is unique in this category, both incumbents proxy, it leaks every demo
visitor to a third party, and the page breaks whenever a provider rotates a path.

Expiry is a read-time check against the provider's declared `max_cache_age`, so licence
correctness never depends on a job having run. A per-role limit and quality floor are fetch-time
policy and cannot wait: a popular title carries images in the low hundreds across many languages, and
fetching the wrong three destroys the chance to choose better.

(An earlier version cited "142 images, 109 posters across 15 languages" as TMDB's own documented
example. That figure is not on any current TMDB page and could not be reproduced; one authenticated
images call would settle it, on data that drifts anyway. The argument does not need the number.)

## Evidence

TMDB's terms were fetched from themoviedb.org/api-terms-of-use on 2026-09-10 and every clause quoted here was confirmed verbatim. Wider working in `docs/research/verify-adr-products.md`.

## As built — and this record stays PROPOSED

**BUILT: nothing of the store, and the two things nearest it are not it.** CMPP declares
`max_cache_age` and an `images` block carrying `per_role_limit` and `quality_floor`, so a provider
can STATE its policy; and migration 1 seeds an `image` property whose datatype is `url`. Both are
references to bytes held elsewhere, which is the arrangement this record's first sentence exists to
replace.

**NOT BUILT: the artwork table, the stored bytes, and all three read-time rules.** No migration
creates an `artwork` table — ADR-0038 is where it arrives. Nothing reads `max_cache_age` outside
the two schema declarations and the fixtures, so the read-time expiry check does not exist and
"licence correctness never depends on a job having run" describes nothing that runs. The per-role
limit and the quality floor are declared fields nothing enforces. The seeded `image` property is
never written.

**AND HOTLINKING IS NOT REFUSED SO MUCH AS UNREACHED.** No artwork is displayed anywhere, so the
failure this record names — a page breaking when a provider rotates a path — cannot happen yet. The
one `<img>` the app renders is a provider's attribution mark loaded from a `data:` URI, which is
the opposite case: bytes already in hand rather than fetched from a third party at render time.
