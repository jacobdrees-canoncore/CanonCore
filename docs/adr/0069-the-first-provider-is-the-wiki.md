---
status: accepted
---

# The first provider is the archive's own wiki, not TMDB

It needs no key, no rate limit, no cache rule and no attribution string, so the contract gets
defined against a source we control rather than against a rate-limited third-party API. A local
database COULD answer `search`, `lookup` AND `browse`. This one ships `search` and `lookup` only
anyway, and `browse` arrives in a later ticket, decided 2026-09-10 in
`docs/research/multi-repo.md` section 9 and carried by CNCORE-15. Until that ticket lands the TMDB
provider declares `browse` and this one does not, and that pair is the only thing in version one
exercising ADR-0033's optionality, so being ABLE to answer all three is not a reason to add
`browse` here.

EXPECT A 403 FROM THE LIVE WIKI AND DO NOT TREAT IT AS A BUG. tardis.wiki sits behind Cloudflare bot
protection, which answers any non-browser client regardless of permission (verified 2026-09-05).
Permission and technical access are separate things and we hold the first, not the second.

Do not route around it, do not scrape it from CI, and do not switch to the Fandom mirror — the
mirror answers a plain request but it is a DIFFERENT wiki, so its data and the test fixture would
silently diverge. In development and CI the backend is the local archive.

## Evidence

NO ARCHIVE FIGURES ARE CLAIMED HERE. An earlier version of this section promised "archive figures
measured against `~/tardis-pipeline`" and the record has never carried one: it makes no claim
about the archive's contents.

The 403 is the one measured claim, and it is given from the command that produced it.
`curl -sI https://tardis.wiki/wiki/Main_Page` returned `HTTP/2 403` carrying the header
`cf-mitigated: challenge` on 2026-09-10, in `docs/research/verify-adr-products.md` section 14.1;
the article path and `/api.php` were both checked the same day and both answered 403, in
`docs/research/validate-cncore-6-7.md` section 5. That header is Cloudflare naming the reason
itself, so the 403 is an unsolved JavaScript challenge rather than a block, which is why no auth
header is missing and none would help. The body's 2026-09-05 is the original check; neither pass
corrected this record.

## As built, under CNCORE-6 and CNCORE-15

The provider exists, CanonCore imports from it over HTTP, and the story reaches a rendered page.

The record's argument held in practice: no key, no rate limit, no cache rule and no attribution
string were needed anywhere on the path, so the CMPP contract got defined against a source we
control. `ship no API keys` (ADR-0035) cost nothing to satisfy here because there was nothing to
ship.

NOTHING IN THIS REPOSITORY EVER REACHES `tardis.wiki`. The archive is the backend in development and
in CI, the live wiki is not fetched, and the record's URL field carries a link that is stored and
never followed -- it is a CONTENT URL, so following it would put it through the deny rule anyway.
