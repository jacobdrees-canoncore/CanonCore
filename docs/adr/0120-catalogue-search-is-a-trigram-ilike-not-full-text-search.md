---
status: accepted
---

# Catalogue search is a trigram ILIKE, not full-text search

Catalogue search matches with `ILIKE '%…%'` over a `pg_trgm` GIN index on `items.title`. PostgreSQL's
full-text search was the obvious answer and it is the wrong one, for a reason that is not a matter
of taste.

## The measurement

Taken on PostgreSQL 18.6 over 20,003 rows, under CNCORE-66:

| query  | `websearch_to_tsquery` | trigram `ILIKE` |
| ------ | ---------------------- | --------------- |
| `ros`  | 0                      | 1032            |
| `yler` | 0                      | 1009            |

Against "Rose Tyler", full-text search finds nothing for either. It matches **lexemes**: a `tsvector`
holds whole normalised words, so it can match neither a prefix nor an infix of one. A reader who has
typed three letters into a search box is asking for exactly that, so this is disqualifying rather
than a trade — the feature does not work at all, on the commonest input there is.

Trigram `ILIKE` answered in 0.23 ms on the same data, and the same extension supplies `similarity()`,
so relevance ordering costs no second mechanism and no second index.

## What it costs, said rather than discovered

**Trigram matching has no notion of word order.** "Tyler Rose" does not find "Rose Tyler".

The fix when that is wanted is to split the query and AND the escaped terms — one pattern per word,
all served by this same index. **It is never to add a `tsvector` alongside.** Two search mechanisms
is two answers to one question, and the one that cannot infix-match would be answering the half of
the questions it is worst at.

## The escape rule, and its order

A reader's query reaches `LIKE` as text, never as a pattern. `likePattern` replaces **the backslash
first**, then `%`, then `_`, and returns the whole `%…%` pattern rather than an escaped fragment — so
it is the only path to a pattern, rather than half a rule repeated at every call site.

The order is the whole content of the rule. Escaping `%` first inserts backslashes of its own, which
a later backslash pass then doubles: the escape becomes a literal backslash and the metacharacter
goes back to being a wildcard. A reader searching for `100%` matches the entire catalogue, and
nothing errors.

**There is no built-in that does this.** `like_escape()` is not a sanitiser — it rewrites a pattern
from one escape character to another, and takes a pattern as its input. Checked, not assumed.

It is CNCORE-24's rule from `provider-wiki`, matched term for term so that the catalogue and the
provider escape a reader's query the same way rather than each being locally sensible.

## An empty query is answered before the query runs

An escaped empty query is the pattern `%%`, which matches every row with a title. So the accidental
behaviour of a search box somebody pressed Enter on is a full scan of the catalogue **returned as a
result set** — every row it holds, rendered as though a reader had asked for them.

**It is not the most expensive query this surface can run, and an earlier draft of this record said
it was.** See the next section: a one- or two-character query scans just as hard and is not
short-circuited, because unlike the empty query it is a real question with a real answer. What makes
the empty query worth a guard is not its cost alone but that it returns EVERYTHING while answering
nothing anybody asked.

The answer is **nothing**, not everything. The front page already answers "what is in this
catalogue" ([[0077-work-browsing-excludes-entities-by-kind]]'s wide question), so a search falling
back to listing it would be a second surface giving the same reply to a different question.

## The index does nothing below three characters, and that is what "trigram" means

Measured on PostgreSQL 18.6 over 20,000 rows, `EXPLAIN (ANALYZE)`:

| pattern   | plan                    | time     |
| --------- | ----------------------- | -------- |
| `%a%`     | Seq Scan                | 5.185 ms |
| `%ab%`    | Seq Scan                | 5.593 ms |
| `%ros%`   | Bitmap Index Scan       | 1.401 ms |
| `%rose%`  | Bitmap Index Scan       | 1.383 ms |

A wildcard pattern shorter than three characters yields **no trigram to look up**, so there is
nothing for the index to narrow by. Left free to choose, the planner declines the index and scans:
`%ab%` matched **nothing** in that data and still cost more than either indexed query, because it
read all 20,000 rows to find out.

**Forcing it does not help, and saying so is the precise version of the claim.** Under
`set enable_seqscan = off` PostgreSQL *will* use the index for `%ab%` — and excludes nothing with it,
rechecking every row on the heap. So the limit is not "the planner refuses the index", which is only
what it does when free; it is that **there is no trigram, so the index cannot exclude anything**.
The first phrasing of this section got that wrong, and the test written to pin it failed and is what
found the error.

**This is a real limit and it is stated rather than left to be discovered**, which is the standard
this repo holds a measurement to. It is not a defect and nothing here guards against it: a
two-character query is a legitimate question with a legitimate answer, and refusing it would break
the feature to protect a scan that costs single-digit milliseconds at twenty thousand rows — well
past the size a self-hosted catalogue is likely to reach. It is recorded because the day this
becomes a complaint, the reason will be the threshold rather than anything anybody wrote.

**It is a measurement in a document rather than an assertion in the suite, and that is a known
weakness rather than an oversight.** The db fixtures hold a few dozen rows, where a sequential scan
is the honest plan for every query and the phenomenon is invisible; forcing the planner hides it the
other way, as above. A test that cannot observe what it claims to check is worse than a number with
its conditions written beside it, so this is the number.

**It also bounds what the empty-query guard is for.** That guard is not about cost, as the section
below now says: it is about a query that answers a question nobody asked.

## Two rungs, and the order between them is load-bearing

`CREATE EXTENSION pg_trgm` is hand-written, because **drizzle-kit does not emit an extension**: it
diffs tables, columns, constraints and indexes, and has no way to know an index needs one. Without
it the index fails outright on `operator class "gin_trgm_ops" does not exist`. `pg_trgm` is a
`trusted` extension, so it needs no superuser — which is what makes it acceptable in software a
stranger self-hosts.

The index itself is declared in the schema as `.using("gin", t.title.op("gin_trgm_ops"))` and
generated from there, so the schema file and the database cannot drift.
`scripts/check-ladder.ts` is what keeps the ordering true on an existing database as well as a
fresh one ([[0047-migrations-are-a-forward-only-ladder]]).

## Only the winning title is searched

`items.title` is a projection ([[0014-title-is-a-projection]]), so what is searched is whichever
title statement currently wins. **Alternative and foreign-language titles held as statements are not
found**, and the surface says so where a search matches nothing rather than leaving a reader to
disbelieve their own memory.

Reaching them needs a partial expression index keyed to a property id that is **minted per install**,
so it cannot be declared in a schema file at all. Out of scope for CNCORE-66 deliberately, and
recorded here so the next reader meets the reason rather than the gap.

## The index is asserted through a query plan, because the failure is silent

An index built with the wrong access method or operator class is still an index. Every result stays
correct and the search sequentially scans the catalogue forever; nothing errors and nothing looks
wrong.

So `packages/db/src/catalogue-search.test.ts` runs `EXPLAIN` under `set local enable_seqscan = off`
and expects the plan to name `items_title_trigram`. The fixtures are small enough that a sequential
scan genuinely is the cheaper plan, so the setting is what turns "would PostgreSQL choose it today"
— a question about table size — into "can PostgreSQL use it for this operator at all", which is the
question about the index being right.

## As built, under CNCORE-66

`packages/db/src/catalogue-search.ts` holds `likePattern` and `searchCatalogue`;
`catalogue.search` on the router answers `catalogueSearchPublic`; `apps/web/src/app/search/page.tsx`
is the surface and `apps/web/src/components/search-box.tsx` puts its box in the shell, on every page.

**Search results are capped and the tail is not reachable yet.** `total` is what keeps that from
being silent. CNCORE-88 carries the walk, and it is not a straight copy of
[[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]]: a keyset walk needs its anchor's
place in the order, and this order leads on `similarity(title, query)`, which is a function of the
QUERY rather than a column of the Item — so the anchor's place is RECOMPUTED from a query the
request resupplies, rather than read off the anchor row. **That is a cost and a design decision, not
a barrier**: the walk is deferred here rather than ruled out.
