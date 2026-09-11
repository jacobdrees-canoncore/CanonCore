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
