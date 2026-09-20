# Plex and Jellyfin — full competitive sweep

Started 2026-09-06. This is the consolidation document for a complete pass over both
incumbent products: every documentation page, every website page, and the Jellyfin source
repository, checked against `prompt.md`.

**STATUS: complete.** All 13 shard files read `STATUS: complete` and
`CONSOLIDATED-FINDINGS.md` is the output — 19 corrections owed to `prompt.md`, 13 internal
contradictions, 87 gaps ranked into three tiers, and 13 counter-signals. Read the findings there
rather than here: this file is the plan and the shard map, and the consolidation is the result.

> **WHAT HAPPENED NEXT, kept because it records what the sweep was for.** The findings were
> carried into `docs/research/resolution/`, which the research README records as **complete — all 24
> items**: the 13 internal contradictions above plus the 11 Tier A gaps, each answered with what Plex
> does, what Jellyfin does and what the standards say. That directory is what the ADRs were argued
> from, so the sweep's output reached `docs/adr/` rather than stopping here.
>
> The step below is left as it was agreed, because it is the record of the intent and because
> **nothing in this repository establishes that the grill was run in this form.** The three questions
> were, in this order:
> 1. **What to actually do** with what the sweep found — act, defer, or refuse.
> 2. **How to improve `prompt.md`** — including absorbing the ~30 line-referenced
>    corrections the two verification agents produced.
> 3. **What features to add**, chosen from the ABSENT list rather than invented.
>
> The grill matters more than usual here because the sweep produces a long list of
> things two mature products have and CanonCore does not, and the default failure mode
> is to treat every gap as a requirement. Most are not. The prompt's whole discipline is
> that scope is capped and refusals are decisions, so the grill is what stops this
> research becoming a backlog.

---

## Why this pass exists

Two distinct jobs, deliberately kept separate:

1. **VERIFY.** `prompt.md` makes roughly 32 factual claims about Plex, Jellyfin and Emby.
   Every one of them is load-bearing: each justifies a design decision, and several are
   reproduced as implementation instructions. Because the plan is to delete `decisions.md`
   and the research directory, **the prompt is the only place these reasons will exist.**
   A claim that has rotted silently rots the decision it supports, and there will be
   nothing left to check it against.

2. **FIND GAPS.** Sweep both products exhaustively for things they have a position on that
   `prompt.md` says nothing about. This half must not be filtered by relevance: a keyword
   filter can only surface things we already have words for, and the entire point is to
   find what nobody thought to look for. So every page is read, including the ones that
   look like marketing.

The classification used throughout is deliberately four-valued:

| Verdict | Meaning |
|---|---|
| ADOPTED | CanonCore does the same thing |
| REFUSED | The prompt explicitly rules it out (see WHAT NOT TO BUILD, STANDING RULES) |
| DIVERGENT | The prompt deliberately does something different |
| **ABSENT** | The prompt says nothing at all |

Only ABSENT is a gap. REFUSED is a decision and must not be reported as an oversight —
that distinction is the single most important thing for a reader of this document to hold
onto, because a later reader who mistakes a refusal for an omission will "helpfully" undo
settled work.

---

## Corpus, and how it was enumerated

Nothing here was sampled. The corpus was enumerated from the sites' own sitemaps so that
coverage is provable rather than asserted.

| Source | URLs | How enumerated |
|---|---:|---|
| `support.plex.tv` | 437 | `robots.txt` → `sitemap_index.xml` → `support_articles-sitemap.xml` (376 articles) + `support_article_category-sitemap.xml` (58) + `page-sitemap.xml` |
| `www.plex.tv` | 537 | `sitemap_index.xml` → post, page, category, product_feature_category, product_category sub-sitemaps |
| `jellyfin.org` | 213 | `sitemap.xml` (100 under `/docs/general`, remainder blog, release posts, downloads) |
| **Total pages** | **1,187** | saved to `plex-support-urls.txt`, `plex-www-urls.txt`, `jellyfin-urls.txt` |
| `jellyfin/jellyfin` + `jellyfin-web` | source | GitHub API, swept separately for config surface, API surface, entity model, scheduled tasks, plugin surface, user policy |

Plex has no public server source, so the Plex half is documentation plus API surface only.
That asymmetry is real and worth stating: **Jellyfin can be checked against its code and
Plex cannot**, so Plex claims about internal behaviour rest on documentation, the published
API, `python-plexapi`, and community reproduction. Where that is the case the findings say
so rather than implying equal confidence.

### The fetch recipe, which is not obvious

Recording this because it cost time to find and will cost it again otherwise.

**`support.plex.tv` and `www.plex.tv` block WebFetch and block browser User-Agents, but
answer plain `curl` with no User-Agent header.** This is backwards from the usual pattern,
which is why the first attempts failed with HTTP 403:

```
curl -s "https://support.plex.tv/articles/201273953-collections/"     # HTTP 200, works
curl -s -A "Mozilla/5.0 ... Chrome/131 ..." "<same url>"              # connection refused
```

Three working routes, in order of preference:

1. **Plain `curl -s`, no `-A` flag.** Full HTML. Use when exact verbatim wording is needed
   for a quote.
2. **`curl -s "https://r.jina.ai/<url>"`.** Clean extracted text, ~13x smaller. Best for
   reading. Note: use `curl` on the proxy, not WebFetch, which summarises and drops the
   verbatim wording.
3. **Playwright MCP** (`browser_navigate` + `browser_snapshot`). Works, and renders
   JavaScript, but is slow and returns the whole page inline unless a `filename` argument
   is passed. Reserve for pages the first two cannot handle.

`forums.plex.tv` fails WebFetch outright with a TLS `unable to get local issuer
certificate` error; the `r.jina.ai` proxy handles it.

`jellyfin.org` and the GitHub API need none of this and fetch normally.

---

## Shard map

Thirteen agents, one per row below, and `CONSOLIDATED-FINDINGS.md` calls it "a 13-file
competitive sweep" too. Each writes incrementally to its own file so that a lost transcript costs
nothing — a hard-won lesson from the previous session, where two completed research reports
were destroyed because everything was held for a final report that never arrived.

| Output file | Scope | Count |
|---|---|---:|
| `gaps-jellyfin-docs.md` | Jellyfin docs, thematic sweep + OpenAPI | 114 sources |
| `sweep-jellyfin-repo.md` | Jellyfin source: config, API, entities, scheduled tasks, plugins, user policy | repo |
| `sweep-jellyfin-site-A.md` | `urls/shards/jellyfin-aa` | 107 |
| `sweep-jellyfin-site-B.md` | `urls/shards/jellyfin-ab` | 106 |
| `gaps-plex-docs.md` | Plex, thematic sweep by feature area | — |
| `sweep-plex-support-A.md` | `urls/shards/plex-support-aa` | 110 |
| `sweep-plex-support-B.md` | `urls/shards/plex-support-ab` | 110 |
| `sweep-plex-support-C.md` | `urls/shards/plex-support-ac` | 110 |
| `sweep-plex-support-D.md` | `urls/shards/plex-support-ad` | 107 |
| `sweep-plex-www-A.md` | `urls/shards/plex-www-aa` | 269 |
| `sweep-plex-www-B.md` | `urls/shards/plex-www-ab` | 268 |
| `verify-jellyfin-claims.md` | The ~20 Jellyfin claims in `prompt.md` | 20 |
| `verify-plex-claims.md` | The ~13 Plex + 1 Emby claims in `prompt.md` | 14 |

Shard files are in `urls/shards/`. The two thematic sweeps overlap the page-by-page shards
deliberately: the thematic pass gives structure and the shards give provable coverage, and
where they disagree the shard wins because it is the one that actually read the page.

---

## FINDINGS — claim verification

*Filled in as the two verification agents complete. Each claim gets: verdict
(CONFIRMED / PARTLY CONFIRMED / OUTDATED / WRONG / UNVERIFIABLE), the primary evidence with
a permalink and date, and — the part that matters most — whether the CanonCore decision it
supports is affected.*

**The distinction to preserve throughout: a rotted REASON does not necessarily mean a wrong
DECISION.** Several claims are expected to have aged while the conclusion they support
stands. Those still need rewriting, because the prompt is the only record and a reader who
checks a stated reason and finds it false will distrust everything around it.

### Plex claims

*(pending)*

### Jellyfin claims

*(pending)*

### Emby claim

*(pending)*

---

## FINDINGS — gaps

*Consolidated from all nine sweep agents once complete. Deduplicated, ranked, and split by
whether the gap is cheap or expensive to close later.*

The ranking axis that matters is not importance but **retrofittability**. The prompt
already records that per-field provenance cannot be retrofitted and must exist from the
first migration or it never works. Any gap in that same class — structural, schema-level,
frozen at creation — outranks a larger but additive gap, because the additive one can be
built at any time and the structural one cannot.

### Structural, cannot be retrofitted

*(pending)*

### Operational, additive but absent

*(pending)*

### Deliberately refused, recorded here so they are not re-raised

*(pending)*

---

## Corrections owed to `prompt.md`

*Every claim found OUTDATED or WRONG, with the suggested replacement wording. This section
is the actionable output of the verification half.*

*(pending)*

---

## Method notes for anyone repeating this

- Enumerate from sitemaps, never from navigation. Both products have pages reachable only
  by search or by direct link, and Jellyfin has headline features with no documentation
  page at all.
- Read the refusal lists in `prompt.md` before classifying anything, or REFUSED items get
  reported as gaps and the report becomes actively misleading.
- Rate gaps on retrofittability, not on size.
- Record the fetch recipe. It is the least interesting and most reusable thing here.
