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

**BUILT UNDER CNCORE-358: the store, the bytes, and the refusal.** An import fetches the pictures
its provider's `per_role_limit` lets through ([[0033-search-lookup-required-browse-optional]]) and
writes their bytes to the `artwork` table ([[0038-artwork-is-a-table]]); the Item page shows them
from `/artwork/<id>`, and the page is never handed the provider's URL at all. Hotlinking is refused
structurally rather than by a rule somebody remembers. The fetch crosses ADR-0034's CONTENT
boundary from its first hop, because the provider wrote that URL and the Owner did not, and it
admits only raster types, since the bytes are served back from the instance's own origin and an SVG
there could carry script. The seeded `image` Property, a URL held as a Statement, was deleted by
migration 25: it was the arrangement this record's first sentence replaces, and nothing ever wrote it.

**THE BYTES STAY INSIDE THE INSTANCE THAT FETCHED THEM.** They live in the catalogue's own
database, and the route serves them `Cross-Origin-Resource-Policy: same-origin`, so no other site,
another instance included, can point an `<img>` at one; `Cache-Control: private, no-cache` keeps a
shared cache from holding a copy and makes a browser ask again before reusing its own. That is what [[0057-the-archive-stays-outside-the-repo]]'s personal
permission and [[0089-provider-distribution-tiers]]'s tier 3 require of anything built from the
wiki's pictures.

**BUT NO WIKI PICTURE CAN REACH THE STORE YET, and that is measured rather than deferred.**
tardis.wiki answers every picture URL `provider-wiki` sends with Cloudflare's challenge, `403`, to
any client without the session only the Provider holds (ADR-0122). Measured 2026-09-26, while the
same code fetched TMDB's poster and backdrop for `movie:603`. Every way past it reverses or amends a
record, so CNCORE-427 carries it rather than this one.

**BUILT TOO: expiry on read, pulled forward from CNCORE-372.** Landing on TMDB's pictures rather
than the wiki's made it due at once, since TMDB forbids keeping them past six months
([[0036-tmdb-licence-constraints]]). It is CNCORE-360's rule and not a second one: a picture
carries the `observed_at` it was fetched at, and `findArtworkOfItem` and `readArtwork` refuse it
once that is further back than its source's `sources.max_cache_age`, the same comparison a claim
is held to. One predicate serves both readers, so past it a picture is neither laid out nor
served, and a Provider that shortens its ceiling shortens it for pictures already stored. Nothing
sweeps, and nothing needs to: licence correctness does not depend on a job having run. The BYTES go
too, because bytes kept unseen are still kept and TMDB's ceiling is on keeping: every import deletes
every picture past its ceiling, whoever's it is, since an import is the write that happens anyway.
What that leaves is an instance nobody imports into holding expired bytes it will never show.

**NOT BUILT: the quality floor.** `quality_floor` is declared and unread, so a picture narrower than
its source's floor is stored anyway. It is the deferred artwork ticket's (CNCORE-372), and it is why
this record stays `proposed`.
