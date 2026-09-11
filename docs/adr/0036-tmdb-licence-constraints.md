---
status: proposed
---

# TMDB's terms are constraints the code cannot show

TMDB forbids caching "for longer than 6 months" — a CEILING, not an obligation to hold one — and it
covers "any information", so a cached poster and a cached runtime are treated identically.

The attribution notice must be verbatim and prominent (checked 2026-09-07): "This [website,
program, service, application, product] uses TMDB and the TMDB APIs but is not endorsed, certified,
or otherwise approved by TMDB." The TMDB logo must be less prominent than ours. TMDB grants no rights in the underlying images —
the studios keep those — which is the posture every product in this space operates under.

Clauses to settle with TMDB before the public demo ships rather than after: using TMDB "as an image
hosting service for banner advertisements, graphics, etc." is prohibited — and the trailing "etc."
makes that BROADER than a narrow ad-banner ban, which supports storing the bytes more strongly than
a narrow reading would — and using it "on or in connection with a 'destination'
website, search engine, or interactive query-response system (including large language model
(LLM), artificial intelligence, or any other machine learning based interactive query-response
systems or chatbots) ... or for driving traffic" counts as commercial use needing a separate written
agreement, judged by TMDB "in its sole discretion".

Our disposition on that second clause, recorded so it is not re-derived: a free read-only demo is
not obviously a destination website, but it is TMDB's call to make and it is better asked than
assumed. ADR-0100 states the non-commercial posture the question is asked from.

AND THERE IS A SECOND, SEPARATE AI CLAUSE WITH NO ESCAPE HATCH, in the paragraph 1.C restrictions
list rather than the commercial-use examples: "Use the TMDB APIs or TMDB Content in connection with,
including for training, a machine learning (ML) or artificial intelligence (AI) based Application."
Unlike the commercial-use clause, no written agreement is offered against it.

Our reading is that it does not bite: CanonCore is a catalogue, not an AI-based application, and
building software with AI tooling is not using TMDB Content in connection with one. That reading is
recorded here deliberately, because a later reader who finds the clause should see it was considered
rather than missed. It was missed once already. Termination requires purging all cached TMDB content,
which `source` on every statement already makes one delete. (It said "every statement and artwork
row", and there is no artwork table: ADR-0038 proposes one and nothing has built it. Corrected here
rather than beside, because the claim is about a cost and half of it was a forward promise.)

## Evidence

TMDB's terms were fetched from themoviedb.org/api-terms-of-use on 2026-09-10 and every clause quoted here was confirmed verbatim. Wider working in `docs/research/verify-adr-products.md`.


## Half built, under CNCORE-16 and CNCORE-8 -- and this record stays PROPOSED

**BUILT: attribution, all three obligations of it.** Paragraph 3 is three requirements and it is
worth counting them, because CNCORE-16 built the third and named the first as a gap in its own
`docs/tmdb-terms.md` — a doc naming a gap is not a gap covered.

1. *"You must use the TMDB logo"* — unconditional, not a rule about logos you chose to use.
   `provider-tmdb` now declares one, and CanonCore renders it.
2. *"less prominent than the logos or marks that primarily describe or identify Your Application"* —
   CanonCore had no such mark at all until this slice; the header was a Home link and a theme
   toggle, so there was nothing for TMDB's to be less prominent THAN. There is a wordmark now, and
   both sizes live in one file and are emitted as explicit sizes in the HTML, so the comparison is in
   the bytes a reader is served and the end-to-end suite reads it back out of them.
3. The notice, verbatim and prominent, rendered unaltered on every page showing that source's claims.

**AND THE MARK TRAVELS AS BYTES, NOT AS A URL**, which is the decision here worth reading twice.
Every other image in CMPP is a URL because CanonCore's SERVER fetches it, and ADR-0034's allowlist is
a promise about what the server may reach. A mark on a page is fetched by the READER'S BROWSER, which
nothing has ever promised can reach a provider on a LAN address or a container network — and the
resulting breach renders as whitespace, with nothing anywhere reporting one. A licence obligation
whose failure mode is invisible has to be the one that cannot half-arrive.

**BUILT: the purge, and it is one delete rather than a feature.** This record's claim about
termination is now exercised: `provider.purge` removes every statement and every placement source
carrying that provider, the placements it was the last claimant of, the items nothing is left
asserting anything about, and the source row itself. No ownership column, no tombstone reconciliation
and no per-table policy, because every row that can carry a claim already names who made it. An item
the owner also placed somewhere survives, untitled — the owner's placement is the owner's claim, and
a provider's licence ending has no bearing on it.

**NOT BUILT: the six-month ceiling.** `max_cache_age` is declared by `provider-tmdb` at 180 days and
is READ BY NOTHING. There is no image store and no cached value with an age, so there is nothing yet
for a read-time check to check — but "TMDB forbids caching for longer than 6 months" is the first
sentence of this record, and today the app honours it only by not caching. That is compliance by
absence rather than by mechanism, and the day something stores a value or an image is the day it
stops being enough. Whatever does that closes this record.

**AND CNCORE-9 IS THE FIRST THING TO STORE ONE, SO THE CEILING IS NOW LIVE RATHER THAN
HYPOTHETICAL.** That ticket hardcodes TMDB's season and episode numbers as the expected positions of
a test. A COMMITTED EXPECTATION IS A CACHE THAT NEVER EXPIRES: no read-time `max_cache_age` check
will ever reach a number in git, and the six-month ceiling covers "any information" rather than
images alone, so an episode number is inside it however factual it reads.

**WHAT IS ACTUALLY HELD, as built, which is more than this record first named.** It said *New Earth*,
*Doomsday* and *The Christmas Invasion*; `apps/web/e2e/multi-placement.test.ts` holds SIX episode
numbers across THREE containers of `tv/57243`, all read from the API on 2026-09-11:

* season 1 — *Rose* at 1, the agreement row
* season 2 — *New Earth* at 1, *Fear Her* at 11, *Doomsday* at 13
* season 0, `Specials` — *Born Again* at 1, *The Christmas Invasion* at 2

**And TWO CONTAINER IDS are cached TMDB Content too**, which is the half a list of episode numbers
hides: `season:57243:2` and `season:57243:0` are TMDB's own identifiers for its own records, written
into the catalogue as `external_id` statements and into that file as literals. The statements carry
their source and purge normally; the literals do not.

There is no third. TMDB's season 1 holds the same thirteen stories in the same order as the wiki's
series 1, so its claim about *Rose* is recorded against the container the wiki's import already
wrote — agreement on one row with a source each ([[0017-placements-carry-sources-and-rank]]) rather
than a second container. What is held of it is the episode number and nothing else.

**AND THE TWO SEASON NAMES, which an inventory of numbers and ids hides a third time.** `Series 2`
and `Specials` are what TMDB calls those seasons, committed as literals beside the ids and written
into the catalogue as `title` statements. A name is TMDB Content as squarely as a number is, and
this record has now undercounted what is held twice — first at three episode numbers, then at the
ids alone. The count that matters is not the tally but the rule: EVERYTHING IN THAT FILE THAT CAME
FROM TMDB IS CACHED TMDB CONTENT, and purging TMDB means reading the file rather than a list here.

**They are recorded here as cached TMDB Content subject to the purge duty.** That is the answer this
record's termination clause requires, and the alternative was to derive the expectations from a
source without the clause — there is none, because TMDB IS the second source and a second source is
the whole of what CNCORE-9 asserts.

**AND `provider.purge` DOES NOT REACH THEM, WHICH IS THE HALF A READER WILL OTHERWISE ASSUME.** That
procedure is built and it works on ROWS: it removes every statement and placement carrying the
provider, the placements it was the last claimant of, and the items nothing is left asserting
anything about. A number hardcoded in a test file is none of those. So purging TMDB is TWO ACTS
rather than one — the procedure against the database, and a hand edit against version control — and
only the first is mechanised. The rows those numbers are compared against carry their source and are
purged normally; the expectations themselves are a literal in a file that no code path can find.

That asymmetry is the whole reason this is written down rather than inferred. A purge that ran
cleanly and left the expectations in git would report success, and the test would go on asserting
TMDB's numbers after the right to hold them had ended.

WHAT THIS DOES NOT DO IS BUILD THE MECHANISM. A note in a record is not a read-time check, and the
paragraph above stands: this record closes when something honours `max_cache_age` in code. What is
now true is that the first cached value exists and is declared, rather than existing unnoticed —
which is the failure mode a fixture in git was always going to have.

**NOT SETTLED, and unchanged: the two clauses to put to TMDB before a public demo ships.** The
commercial-use question and paragraph 1.C's AI restriction are both dispositions recorded above
rather than answers, and nothing in these two tickets touched either.
