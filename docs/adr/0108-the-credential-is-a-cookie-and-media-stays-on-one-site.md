---
status: proposed
---

# The credential is a cookie, and media stays on one site

One registrable domain. The server serves its own web UI at its own origin; the phone and the TV
take a server URL. **One session cookie authenticates the API, the `<img>`, the `<video>` and
AVPlayer's range requests alike.** No signed URLs, no token in any URL, no CORS.

This is the shape CNCORE-2 already builds: condition 2 is a SERVER-RENDERED page and Seam 1 asserts
the rendered HTML over HTTP against the app.

## The cookie is forced, not preferred

**A browser media element can never carry a header, and this is true by construction rather than by
prohibition.** The WHATWG HTML Standard routes both `<img>` and `<video>` through one algorithm,
"create a potential-CORS request", whose final step returns "a new request whose URL is url,
destination is destination, mode is mode, credentials mode is credentialsMode, and whose
use-URL-credentials flag is set". Referrer policy and fetch priority are the only other knobs either
element exposes. The spec carries no sentence forbidding author headers because there is no hook to
forbid. So the credential is a cookie or it is in the URL, and there is no third option.

**On Apple platforms the cookie is the only DOCUMENTED option, and it reaches the requests that
matter.** `AVURLAssetHTTPCookiesKey` has shipped since iOS 8 and tvOS 9, and its Discussion says
"By default, AVURLAsset only has access to cookies in the client's default cookie storage that apply
to the asset's URL." The same paragraph goes on to cover the many sub-requests a streaming asset
issues — which is exactly where header injection is reported to fail.

`AVURLAssetHTTPHeaderFieldsKey`, which every third-party client reaches for, IS NOT DOCUMENTED. It
does not appear in Apple's "Initialization options" article, which lists twelve keys and not that
one; the string `HTTPHeaderFields` occurs zero times in Apple's complete AVFoundation symbol index;
and its documentation URL returns 404 where a control probe returns 200. An Apple-badged engineer,
October 2024: "AVURLAssetHTTPHeaderFieldsKey is not a supported API, so you should not use it."

**Same-site is what makes the cookie work.** Safari has blocked third-party cookies with no
exceptions since March 2020 and still does — WebKit's tracking-prevention page reads "ITP by default
blocks all third-party cookies. There are no exceptions to this blocking." But it partitions by
SITE, not origin, so `media.<domain>` serving a page on `app.<domain>` is first-party and the
blocking never engages. **The constraint this record imposes is therefore one registrable domain,
not one origin.**

## Signed URLs are rejected, and the rejection is recorded so it is not re-proposed

Neither incumbent has them. Across Plex's own PMS OpenAPI specification as published at
developer.plex.tv: `HMAC` 0, `signed url` 0. Across `jellyfin/jellyfin`: `HMAC` 0, by GitHub code
search on the default branch, in C# and in any language — the method is named because it is a
default-branch search rather than a grep at the v12.0 tag where the endpoint counts below were taken,
and ADR-0092 is this repo's own reminder that a measurement is only as good as the thing it was taken
against.

What Plex actually does is a plain bearer in the query string, blessed by its own API reference —
"These are referred to as headers throughout documentation, but all `X-Plex-` headers can also be
sent as query string arguments". It has since added a JWT in the same `X-Plex-Token` slot which
"expire[s] after 7 days", so the CREDENTIAL gained a lifetime; the URL is still not signed.

An expiring signature is a mechanism nothing in this product reads, which `CLAUDE.md` forbids
adding, and the two conditions that would make it necessary are named below.

## What the incumbents do instead, and why it is not copyable

Jellyfin leaves its stream and image endpoints unauthenticated outright. Its own OpenAPI spec at
v12.0 declares one security scheme, in a HEADER, and 56 of 364 operations carry no security at all —
`GET /Videos/{itemId}/stream`, `GET /Audio/{itemId}/stream` and `GET /Items/{itemId}/Images/{imageType}`
among them, while the neighbouring metadata listing `GET /Items/{itemId}/Images` is authenticated, so
the absence is meaningful rather than a generation artefact. Six `bug, security` issues (#13983-#13988)
were opened on 2025-04-23 by a repo member and all six are still open.

**Swiftfin, the official Jellyfin iOS and tvOS client, sets no headers at all.** It builds
`AVPlayerItem(url: item.url)` — not `AVURLAsset(url:options:)`, so there is nowhere to attach one —
and repo-wide it has zero hits for `AVURLAssetHTTPHeaderFieldsKey`, `httpAdditionalHeaders` and
`resourceLoader`. Direct play carries no credential whatsoever. **The flagship native client of the
incumbent is viable only because of the six open security bugs**, which is why the pattern cannot be
copied even though it is the industry's most-deployed one. The documented cookie path is available to
us and is better than what either incumbent ships.

## The two triggers that reverse this

Both are refused now and either needs a superseding record, because either forces the credential back
into the URL:

1. **Media served from a third party's site** — a CDN on a domain we do not control.
2. **A web client hosted off the owner's domain**, the `app.plex.tv` shape. Plex serves a web app
   both from `plex.tv` and from the server at `:32400/web`, so "both" is a real industry shape rather
   than a contradiction; it is the CROSS-SITE half that costs.

## The honest cost

This forecloses a CDN. At one owner and one read-only demo that buys nothing today — ADR-0041 means
bytes are served exactly as they are, and the measured hosting position is 20 TB of egress included
with roughly GBP 1.03 per TB after. It is a real constraint on a future that does not exist, stated
here rather than discovered later.

## Two things this does NOT change

**ADR-0055's ordering stands.** Web still ships first, phone next, TV last. This record says what web
IS — the server's own face rather than a fourth client pointed at it — and leaves the sequence alone.

**RFC 8628 remains the answer for the TV**, and it is the STANDARDISED version of what both
incumbents built bespoke. Plex's pin API is its own: across its spec, `OAuth` 0, `8628` 0,
`device_code` 0, `grant_type` 0. Jellyfin's Quick Connect is a different arrangement again — the user
types a six-character code into an ALREADY-AUTHENTICATED client rather than into a browser at an
authorization server — and its field names are `Secret`, `Code` and `Authenticated`, none of which
are the RFC's.

## Evidence

Verified against source on 2026-09-10. WHATWG HTML Standard (urls-and-fetching, media, images) and
the Fetch Standard's CORS check; Apple's AVFoundation documentation, its AVFoundation symbol index
and developer.apple.com/forums/thread/20421; WebKit's tracking-prevention page and its 2020-03-24
full-third-party-cookie-blocking post; Plex's own PMS OpenAPI specification and support articles;
Jellyfin's OpenAPI specification and source at the v12.0 tag; `jellyfin/Swiftfin` at `main`.
Background reading in `docs/research/access-layer.md`, whose section 2.4 reached the same conclusion
from the Jellyfin direction alone.
