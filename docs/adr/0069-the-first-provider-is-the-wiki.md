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
silently diverge.

**THE LAST SENTENCE OF THIS PARAGRAPH USED TO READ "In development and CI the backend is the local
archive", AND HALF OF IT IS NO LONGER TRUE.** In CI the backend is the committed fixture and always
will be: the suite runs with the network gated off (`test/setup/network-gate.ts` disables connect
and re-enables loopback only), so a test that reached the wiki would be a test that failed on a
plane. In DEVELOPMENT the provider now serves the live wiki, holding a credential its owner supplies
([[0122-a-provider-declares-the-credential-it-needs]]). The local archive is not a fallback and is
being deleted; a provider that cannot reach its source says so rather than serving something else.

**"DO NOT ROUTE AROUND IT" STILL HOLDS AND IS WORTH SAYING PRECISELY, because it was read too widely
once already.** It forbids defeating the challenge programmatically — a stealth browser, a solver
service, a captcha farm. It does not forbid a HUMAN passing a human-verification check in their own
browser, on a wiki whose operator has granted permission and whose `robots.txt` reads
`User-agent: * / Allow: /`. That is the intended path through the control, not a way around it, and
the distinction is the whole argument: what Cloudflare is asking for is a person, and there is one.

## Evidence

NO ARCHIVE FIGURES ARE CLAIMED HERE. An earlier version of this section promised "archive figures
measured against `~/tardis-pipeline`" and the record has never carried one: it makes no claim
about the archive's contents.

**MEASURED AGAIN 2026-09-12, and the protection has hardened.** The challenge is now an
INTERACTIVE Cloudflare Turnstile ("Verify you are human") rather than the passive JavaScript
challenge of 2026-09-05. A real browser under automation does not clear it: Orca's own browser sat
on the widget through six polls and never passed. A `cf_clearance` captured 2026-09-04 was dead
eight days later while its own `expires` attribute still claimed 2027-09-03, so the cookie's stated
lifetime says nothing about its real one.

**AND THE THING THAT DOES WORK, measured the same day**: a cookie from a person's ordinary browser,
paired with that browser's exact User-Agent, answers from a plain HTTP client. Four endpoints,
all `200` — the article path, `api.php?action=query&meta=siteinfo`, `api.php&list=search`, and
`Special:ExportRDF`. That is what [[0122-a-provider-declares-the-credential-it-needs]] rests on, and
it is why the provider needs no browser inside it.

The original 403 is the other measured claim, and it is given from the command that produced it.
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

NOTHING IN THIS REPOSITORY EVER REACHES `tardis.wiki`, **and that survives the change above rather
than being undone by it.** CanonCore reaches `provider-wiki`; `provider-wiki` reaches the wiki. The
credential lives in the provider and CanonCore never stores it
([[0122-a-provider-declares-the-credential-it-needs]]), so this sentence is true for the same reason
it was before: the provider is a URL answering a contract ([[0031-a-provider-is-a-url]]), and how it
reaches its own upstream is behind that seam. The record's URL field still carries a link that is
stored and never followed -- it is a CONTENT URL, so following it would put it through the deny rule
anyway.
