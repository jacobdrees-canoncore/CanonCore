# Verification: every archive figure in the decision log, measured

Every numeric claim the ADRs make about the Tardis Wiki archive, re-measured against the database
that owns it. Nothing here is confirmed from a document; every verdict carries the SQL that
produced it and the raw output of that SQL.

Source: `~/tardis-pipeline/data/db/tardis.duckdb`, opened READ-ONLY. Snapshot taken 2026-09-04
(file mtime). No network request was made; `tardis.wiki` sits behind Cloudflare and returns 403 to
non-browser clients, and everything needed was local.

Run date: 2026-09-10. `duckdb` CLI v1.5.5 (Variegata) d8cdaa33fd. The Python `duckdb` module is
not installed on this machine, so every query below went through the CLI:

```
duckdb -readonly ~/tardis-pipeline/data/db/tardis.duckdb -c "<sql>"
```

**One trap worth recording before the queries.** In DuckDB the `~` operator is
`regexp_full_match`, NOT PostgreSQL's partial match. `'Seven part serials' ~ '^Seven part '` is
`false`; `regexp_matches('Seven part serials','^Seven part ')` is `true`. A partial-match regex
written in Postgres habits silently returns zero rows here. Every regex below is either fully
anchored or uses `regexp_matches`.

---

## 0. The schema, so the mappings below are checkable

```sql
SELECT table_name, table_type FROM information_schema.tables ORDER BY table_name;
```

```
articles        VIEW          namespaces      BASE TABLE    stats           BASE TABLE
backlinks       VIEW          page_categories BASE TABLE    stopwords       BASE TABLE
dict            BASE TABLE    page_links      BASE TABLE    stories         VIEW
docs            BASE TABLE    page_properties BASE TABLE    story_credits   VIEW
fields          BASE TABLE    page_templates  BASE TABLE    story_order     BASE TABLE
                              pages           BASE TABLE    story_summary   VIEW
                              redirects       VIEW          terms           BASE TABLE
```

Column shapes that matter:

- `pages(page_id, ns, title, edited_at, contributor, is_redirect, medium, bytes, text)`
- `page_properties(page, property, value, is_link)` — Semantic MediaWiki triples
- `page_categories(page_id, title, category)`
- `page_links(page_id, title, target)`
- `story_summary(title, medium, released DATE, series, writers VARCHAR[], doctors VARCHAR[], bytes)`

The three views that carry definitions worth knowing:

```sql
SELECT view_name, sql FROM duckdb_views()
WHERE view_name IN ('stories','articles','redirects');
```

```
stories :: CREATE VIEW stories AS SELECT page_id, title, medium, bytes, edited_at, "text"
           FROM pages WHERE ((ns = 0) AND (NOT is_redirect)
           AND regexp_matches("text", '(?i)\{\{\s*infobox[ _]story[ _]smw'));
articles :: CREATE VIEW articles AS SELECT p.*, n."name" AS namespace FROM pages AS p
           LEFT JOIN namespaces AS n USING (ns) WHERE (NOT p.is_redirect);
redirects :: CREATE VIEW redirects AS SELECT title AS alias,
           regexp_extract("text", '(?i)#REDIRECT\s*:?\s*\[\[([^\]|#]+)', 1) AS "target"
           FROM pages WHERE is_redirect;
```

So a "story" is a main-namespace non-redirect page carrying the `infobox story SMW` template.
That is the population every per-story figure below is measured over.

The `is_link` flag on `page_properties` is derived PER ROW, not per property, which is what makes
section 5 non-circular. `~/tardis-pipeline/scripts/build-smw.py:105`:

```python
for prop, resource, literal in PROP.findall(body):
    value = decode(resource) if resource else html.unescape(literal).strip()
    ...
    fh.write(json.dumps({..., "is_link": bool(resource)}) + "\n")
```

`is_link` is true exactly when the RDF triple's object was an `rdf:resource` rather than a
literal. The pipeline never consults the property name when setting it.

---

## 1. Table sizes — ADR-0057

**Claim.** `pages` 373,513 · `stories` 11,285 · `redirects` 36,620 · `page_properties` 518,768 ·
`page_categories` 522,385 · `page_links` 4,500,016 · `story_summary` 11,285.

```sql
SELECT 'pages' t, count(*) n FROM pages
UNION ALL SELECT 'stories', count(*) FROM stories
UNION ALL SELECT 'redirects', count(*) FROM redirects
UNION ALL SELECT 'page_properties', count(*) FROM page_properties
UNION ALL SELECT 'page_categories', count(*) FROM page_categories
UNION ALL SELECT 'page_links', count(*) FROM page_links
UNION ALL SELECT 'story_summary', count(*) FROM story_summary
UNION ALL SELECT 'story_order', count(*) FROM story_order
UNION ALL SELECT 'story_credits', count(*) FROM story_credits
UNION ALL SELECT 'page_templates', count(*) FROM page_templates;
```

```
┌─────────────────┬─────────┐
│        t        │    n    │
├─────────────────┼─────────┤
│ pages           │ 373513  │
│ stories         │ 11285   │
│ redirects       │ 36620   │
│ page_properties │ 518768  │
│ page_categories │ 522385  │
│ page_links      │ 4500016 │
│ story_summary   │ 11285   │
│ story_order     │ 11398   │
│ story_credits   │ 75223   │
│ page_templates  │ 1184998 │
└─────────────────┴─────────┘
```

**All seven CONFIRMED to the row.**

### 1a. But `story_summary.released` cannot be read

The claim is that `story_summary` carries "medium, release date, series and writers". The columns
exist and three of the four are readable:

```sql
SELECT count(*) n, count(medium) medium_nn, count(series) series_nn, count(writers) writers_nn
FROM story_summary;
```

```
┌───────┬───────────┬───────────┬────────────┐
│   n   │ medium_nn │ series_nn │ writers_nn │
├───────┼───────────┼───────────┼────────────┤
│ 11285 │ 11174     │ 10462     │ 9272       │
└───────┴───────────┴───────────┴────────────┘
```

The fourth throws on a full scan:

```sql
SELECT count(released) FROM story_summary;
```

```
Conversion Error: invalid date field format: "1976", expected format is (YYYY-MM-DD)
when casting from source column max(CASE WHEN ((property = CAST('Release date' AS VARCHAR)))
THEN (value) ELSE CAST(NULL AS VARCHAR) END)
```

The view does `max(...)::DATE` (`scripts/build-smw.sql`), and the archive's release dates are not
all day-precision. `LIMIT 3` succeeds because DuckDB never reaches a partial value; any full scan
of that column fails. This is the same fact section 6 measures, arriving as a crash rather than a
statistic — and it is a live demonstration of ADR-0073's argument, in the pipeline that produced
the evidence for it.

---

## 2. Multi-placement — ADR-0009 "Scale", ADR-0057

**Claim.** 93.4% of stories sit in more than one container, median 4, maximum 52.

**Mapping used, stated because the figure is meaningless without it.** A *container* is a wiki
CATEGORY; a *placement* is one `page_categories` row joining a story page to a category. The
population is the 11,285 rows of the `stories` view, joined by `page_id`. Nothing here uses
`Series`, `Season` or `story_order`.

```sql
WITH c AS (
  SELECT s.page_id, count(DISTINCT pc.category) n
  FROM stories s LEFT JOIN page_categories pc ON pc.page_id = s.page_id
  GROUP BY s.page_id
)
SELECT count(*) stories, count(*) FILTER (WHERE n>1) multi,
       round(100.0*count(*) FILTER (WHERE n>1)/count(*),2) pct_multi,
       median(n) med, max(n) mx, min(n) mn, avg(n) mean
FROM c;
```

```
┌─────────┬───────┬───────────┬─────┬────┬────┬───────────────────┐
│ stories │ multi │ pct_multi │ med │ mx │ mn │       mean        │
├─────────┼───────┼───────────┼─────┼────┼────┼───────────────────┤
│ 11285   │ 10545 │ 93.44     │ 4.0 │ 52 │ 0  │ 4.586708019494905 │
└─────────┴───────┴───────────┴─────┴────┴────┴───────────────────┘
```

Excluding the three stories with no category at all moves nothing material:

```
┌───────────────────┬───────┬───────────┬─────┬────┐
│ stories_with_cats │ multi │ pct_multi │ med │ mx │
├───────────────────┼───────┼───────────┼─────┼────┤
│ 11282             │ 10545 │ 93.47     │ 4.0 │ 52 │
└───────────────────┴───────┴───────────┴─────┴────┘
```

**CONFIRMED.** 93.44%, median 4, maximum 52. The "story in more than twenty containers" that
ADR-0057 requires as a fixture shape exists (max is 52).

---

## 3. The category graph — ADR-0016, ADR-0057

**Claim.** A cyclic DAG up to 22 levels deep, with 7,236 categories on a cycle.

**Graph built.** Nodes are category names. An edge `child -> parent` exists wherever a page in
namespace 14 (`Category`) is itself categorised. The `Category:` prefix is 9 characters, so the
child name is `substr(title, 10)`; every ns=14 row carries the prefix (checked: 0 rows without).

```sql
COPY (
  SELECT DISTINCT substr(pc.title,10) AS child, pc.category AS parent
  FROM page_categories pc JOIN pages p ON p.page_id = pc.page_id
  WHERE p.ns = 14 AND pc.title LIKE 'Category:%'
) TO 'cat_edges.csv' (HEADER, DELIMITER ',');
```

45,115 distinct edges over 28,898 nodes (45,129 raw rows, so 14 exact repeats). Tarjan's SCC
algorithm and BFS were then run over that CSV in Python (`scratchpad/graph.py`).

```
nodes: 28898 edges: 45114
ON A CYCLE (strict, SCC>1 or self-loop): 28
cycle members: ['48th century decades', 'Belief', 'Comic stories by number of parts',
 'Comics with thirteen or more parts', 'Eight part comics', 'Eleven part comics',
 'Five part comics', 'Four part comics', 'Health', 'Literature by author', 'Medicine',
 'Metaphysics', 'Nine part comics', 'One part comics', 'Personal care', 'Philosophy',
 'Reality', 'Seven part comics', 'Sex and gender', 'Six part comics',
 'Spaces between universes', 'Ten part comics', 'The Void', 'Three part comics',
 'Travel between universes', 'Truth', 'Twelve part comics', 'Two part comics']
nodes reachable DOWNWARD from a cycle node (incl. cycle): 7236
nodes reachable UPWARD from a cycle node (incl. cycle): 108
union up+down: 7274
peeling residue: 70
condensation longest chain (SCC components on a path): 48
root categories (no parent): 268
max BFS depth from roots (roots=level 1): 23
unreachable from any root: 0
max BFS depth from roots (roots=level 0): 22
```

### 3a. Cyclic — CONFIRMED

Four non-trivial strongly connected components (sizes 14, 5, 3, 3) plus three self-loops. The
largest is the comic-part-count ring: `Comic stories by number of parts` ↔ `One part comics`,
`Two part comics`, … . The philosophy ring (`Belief`, `Truth`, `Reality`, `Metaphysics`,
`Philosophy`) is the second. The graph is genuinely not a DAG.

### 3b. 22 levels deep — CONFIRMED, under a stated convention

The number 22 is reproducible as the maximum BFS depth downward from the 268 parentless root
categories, counting roots as level 0. Counting roots as level 1 gives 23. Every node is reachable
from some root. The longest acyclic chain through the SCC condensation is 48 components, which is
the other defensible reading of "deep" and is more than twice the quoted figure. The claim is
sound but only under the BFS-from-roots reading.

### 3c. "7,236 categories on a cycle" — CONTRADICTED

7,236 is a real number in this graph, but it is not the count of categories on a cycle. It is the
count of categories REACHABLE DOWNWARD from a cycle node, cycle included — that is, everything
filed somewhere beneath a cycle. Categories actually on a cycle: **28**.

The figure the claim wants is 28. The figure it quotes is a descendant count 258× larger.

### 3d. ADR-0016's worked example — CONFIRMED

```sql
SELECT title, category FROM page_categories
WHERE title = 'Category:26th century human students';
```

```
┌──────────────────────────────────────┬──────────────────────────┐
│                title                 │         category         │
├──────────────────────────────────────┼──────────────────────────┤
│ Category:26th century human students │ 26th century individuals │
│ Category:26th century human students │ Human students           │
└──────────────────────────────────────┴──────────────────────────┘
```

---

## 4. The property catalogue — ADR-0057

**Claim.** 715 distinct properties, of which only 45 exceed a thousand rows.

```sql
SELECT count(DISTINCT property) AS distinct_properties FROM page_properties;
-- 715

SELECT count(*) AS props_over_1000
FROM (SELECT property FROM page_properties GROUP BY property HAVING count(*) > 1000);
-- 45
```

`>= 1000` also gives 45, so the boundary is not doing any work.

**CONFIRMED.** 715 and 45.

---

## 5. No property is ever both a link and a literal — ADR-0012

This is the load-bearing one: it is what licenses putting value-kind on the property definition
rather than on each of the 518,768 rows.

```sql
SELECT property, count(*) rows_total,
       count(*) FILTER (WHERE is_link) AS link_rows,
       count(*) FILTER (WHERE NOT is_link) AS literal_rows
FROM page_properties
GROUP BY property
HAVING count(*) FILTER (WHERE is_link) > 0 AND count(*) FILTER (WHERE NOT is_link) > 0
ORDER BY rows_total DESC;
```

```
┌──────────┬────────────┬───────────┬──────────────┐
│ property │ rows_total │ link_rows │ literal_rows │
├──────────┼────────────┼───────────┼──────────────┤
└──────────┴────────────┴───────────┴──────────────┘
```

Zero counter-examples. Three checks that the empty result is real rather than an artefact:

**No NULLs hiding the mix.** Every row has a boolean:

```sql
SELECT is_link, count(*) FROM page_properties GROUP BY is_link;
-- false 307039 / true 211729   (sums to 518768)
```

**Not an artefact of case or whitespace in the property name.** Grouping on
`lower(trim(property))` also returns zero rows, and collapses nothing:

```sql
SELECT count(DISTINCT property) raw, count(DISTINCT lower(trim(property))) normalised
FROM page_properties;
-- raw 715, normalised 715
```

**Not circular.** `is_link` is set per row from the RDF export's `rdf:resource`-vs-literal
distinction (see section 0), never from the property name. The partition is an observation about
the corpus, not a restatement of how the loader works.

Spot check on the twenty largest properties, `bool_and` against `bool_or`:

```
Modification date#aux 128598  all_link=false any_link=false
Has image              38868  false false
First appearance       30465  true  true
Species                21842  true  true
Display title of       20538  false false
Story info             11341  false false
Pagename               11285  false false
Medium                 11174  false false
Writer                 11111  true  true
Release date#aux       11068  false false
Release date           11068  false false
Imdb                   10792  true  true
Series                 10462  false false
Publisher              10420  true  true
Release end date        9964  false false
Release end date#aux    9964  false false
Main voice actor        7875  true  true
Affiliation             7803  true  true
Job                     7462  true  true
Doctor                  6850  true  true
```

`all_link` and `any_link` agree on every one.

**CONFIRMED, and it survives being attacked.** No property in the archive mixes kinds.

---

## 6. Date precision — ADR-0073

**Claim.** Roughly 12% of real release dates are year-only or year-month.

Raw values carry a trailing `Z` on day-precision dates (`1966-10-08Z`) and none on partial ones
(`1975-09`, `2024`), so the classifier strips `Z` first. DuckDB's `~` is a full match, so these
anchored patterns behave as written.

```sql
SELECT CASE
  WHEN val ~ '^-?[0-9]{1,4}-[0-9]{1,2}-[0-9]{1,2}$' THEN 'day'
  WHEN val ~ '^-?[0-9]{1,4}-[0-9]{1,2}$'            THEN 'year-month'
  WHEN val ~ '^-?[0-9]{1,4}$'                        THEN 'year'
  ELSE 'other' END AS shape,
  count(*) n, round(100.0*count(*)/sum(count(*)) OVER (),2) pct
FROM (SELECT rtrim(value,'Z') AS val FROM page_properties WHERE property='Release date')
GROUP BY 1 ORDER BY n DESC;
```

```
┌────────────┬──────┬───────┐
│   shape    │  n   │  pct  │
├────────────┼──────┼───────┤
│ day        │ 9697 │ 87.61 │
│ year-month │  961 │  8.68 │
│ year       │  410 │  3.70 │
└────────────┴──────┴───────┘
```

The `other` bucket is empty — every one of the 11,068 values classifies — so nothing is being
swept under the rug.

```
┌───────────────────────┬───────┬───────────┬─────────────┐
│         which         │ total │ n_partial │ pct_partial │
├───────────────────────┼───────┼───────────┼─────────────┤
│ ALL Release date rows │ 11068 │ 1371      │ 12.39       │
│ story pages only      │ 11061 │ 1371      │ 12.39       │
│ Release end date      │  9964 │ 1033      │ 10.37       │
└───────────────────────┴───────┴───────────┴─────────────┘
```

**CONFIRMED.** 12.39% partial (1,371 of 11,068), and the same 12.39% restricted to story pages.
`Release end date` is 10.37%, so the pattern is not peculiar to one field.

The "story with two release dates" fixture shape ADR-0057 asks for also exists:

```sql
SELECT count(*) FROM (SELECT page FROM page_properties WHERE property='Release date'
                      GROUP BY page HAVING count(DISTINCT value) > 1);
-- 10
```

---

## 7. Extent — ADR-0060

**Claim.** NO property records a part or episode count for any of the 11,285 stories, and only 22
rows across the whole corpus carry a `Runtime` of any kind.

### 7a. The `Runtime` half — CONFIRMED

```sql
SELECT count(*) FROM page_properties WHERE property='Runtime';                       -- 22
SELECT count(*) FROM page_properties p JOIN stories s ON s.title=p.page
WHERE p.property='Runtime';                                                          -- 0
```

22 rows corpus-wide, none of them on a story page. There is no `Duration` or `Length` property
anywhere in the 715.

### 7b. The "no part or episode count" half — CONTRADICTED

The archive has a property called **`Epcount`**, with 4,111 rows, 3,742 of them on story pages
covering 3,741 distinct stories.

```sql
SELECT 'Epcount total' AS which, count(*) AS n FROM page_properties WHERE property='Epcount';
-- 4111
SELECT count(*) AS n FROM page_properties p JOIN stories s ON s.title=p.page
WHERE p.property='Epcount';
-- 3742
SELECT count(DISTINCT p.page) FROM page_properties p JOIN stories s ON s.title=p.page
WHERE p.property='Epcount';
-- 3741
```

Its values are exactly what the name says:

```
┌───────┬──────┐        ┌───────┬────┐
│ value │  n   │        │ value │ n  │
├───────┼──────┤        ├───────┼────┤
│ 1     │ 2779 │        │ 8     │ 23 │
│ 4     │  528 │        │ 10    │ 10 │
│ 2     │  477 │        │ 12    │  4 │
│ 3     │  117 │        │ 11    │  2 │
│ 6     │   94 │        │ 9     │  2 │
│ 5     │   36 │        │ 13    │  1 │
│ 7     │   36 │        │ 21    │  1 │
└───────┴──────┘        │ 14    │  1 │
                        └───────┴────┘
```

And it is populated on precisely the five serials ADR-0057 names as fixtures — see section 9.

Coverage, which is the figure the decision actually needs:

```sql
SELECT count(*) AS stories_total,
       count(*) FILTER (WHERE has_ep) AS with_epcount,
       count(*) FILTER (WHERE NOT has_ep) AS without_epcount,
       round(100.0*count(*) FILTER (WHERE NOT has_ep)/count(*),2) AS pct_unknown
FROM (SELECT s.title,
        EXISTS(SELECT 1 FROM page_properties p
               WHERE p.page=s.title AND p.property='Epcount') AS has_ep
      FROM stories s);
```

```
┌───────────────┬──────────────┬─────────────────┬─────────────┐
│ stories_total │ with_epcount │ without_epcount │ pct_unknown │
├───────────────┼──────────────┼─────────────────┼─────────────┤
│ 11285         │ 3741         │ 7544            │ 66.85       │
└───────────────┴──────────────┴─────────────────┴─────────────┘
```

**Extent is unrecorded for 66.85% of stories — almost exactly two thirds.** Which is the figure
`SPEC.md:1124-1126` carried before ADR-0060 replaced it with "none at all"
(`docs/research/supersession-check-3.md:812-817` records the swap and calls the ADR's version "the
measured one"). It was the superseded figure that was right.

Extent is also recorded a second way, as categories:

```sql
SELECT count(DISTINCT pc.title) FROM page_categories pc JOIN stories s ON s.title=pc.title
WHERE regexp_matches(pc.category,
  '^(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen) part ');
-- 2887
```

`Four part serials` (85), `Six part serials` (34), `Seven part serials` (6), `One part comics`
(840) and so on: 2,887 stories carry a part count in category form.

The DECISION ADR-0060 makes — extent is a statement, never derived from the maximum part any
edition covers — is untouched by this. Its *supporting* measurement is wrong, and wrong in the
direction that makes the decision look easier than it is: extent is known for a third of the
corpus and must be reconciled between two disagreeing encodings, rather than being universally
absent.

---

## 8. The `medium` field — ADR-0030, ADR-0057

**Claim.** 70 distinct values, 44 appearing exactly once, 50 appearing twice or fewer.

**Mapping used.** The Semantic MediaWiki property `Medium` (11,174 rows), NOT the `medium` column
on `pages` or `stories`. The two are different fields with the same name and wildly different
cardinality:

```sql
SELECT count(DISTINCT medium) FROM pages;    -- 6573
SELECT count(DISTINCT medium) FROM stories;  --  665
```

`pages.medium` and `stories.medium` are parsed out of the page's disambiguator (`Marco Polo (TV
story)` → `TV story`) and are not the field the claim is about.

```sql
SELECT count(*) AS distinct_values,
       count(*) FILTER (WHERE n=1) AS exactly_once,
       count(*) FILTER (WHERE n<=2) AS twice_or_fewer
FROM (SELECT value, count(*) AS n FROM page_properties WHERE property='Medium' GROUP BY value);
```

```
┌─────────────────┬──────────────┬────────────────┐
│ distinct_values │ exactly_once │ twice_or_fewer │
├─────────────────┼──────────────┼────────────────┤
│ 70              │ 44           │ 50             │
└─────────────────┴──────────────┴────────────────┘
```

**CONFIRMED exactly, on the SMW `Medium` property.** The tail is the parse garbage ADR-0057 asks
for as a fixture shape: `and nine=1`, `plus cat=1`, `first draft. editor: paul cornell=1`,
`1957 - viewing notes=1`, `vol. 36,379=1`, `no. 7.=1`, `r=1`, `hm=1`.

The head, for the record: `short story=2978 audio=2508 comic=2037 novel=976 tv=717 game=530
webcast=349 feature=335 video game=181 illustration=112 anthology=104 lit=91 home video=75 poem=63
reference book=24 stage play=18 theatrical film=8 fan work=5 series=4 escape game=3`.

---

## 9. The named fixture rows — ADR-0057, ADR-0060

### 9a. Do the five exist under the exact titles given?

```sql
SELECT title, ns, is_redirect, medium FROM pages
WHERE title IN ('The Tenth Planet','The Ice Warriors','The Daleks'' Master Plan',
                'The Power of the Daleks','Marco Polo');
```

```
┌─────────────────────────┬────┬─────────────┬────────┐
│          title          │ ns │ is_redirect │ medium │
├─────────────────────────┼────┼─────────────┼────────┤
│ Marco Polo              │ 0  │ false       │ NULL   │
│ The Daleks' Master Plan │ 0  │ true        │ NULL   │
│ The Ice Warriors        │ 0  │ true        │ NULL   │
│ The Power of the Daleks │ 0  │ true        │ NULL   │
│ The Tenth Planet        │ 0  │ true        │ NULL   │
└─────────────────────────┴────┴─────────────┴────────┘
```

All five bare titles exist as pages, but **none of them is a story**. Four are redirects; `Marco
Polo` is an in-universe topic page (it covers the historical figure, not the serial). The story
rows are the disambiguated titles, and those are in the `stories` view:

```sql
SELECT title, medium FROM stories WHERE title IN
 ('The Tenth Planet (TV story)','The Ice Warriors (TV story)',
  'The Daleks'' Master Plan (TV story)','The Power of the Daleks (TV story)',
  'Marco Polo (TV story)');
-- all five present, medium = 'TV story'
```

A fixture that names them as *The Tenth Planet* has to carry the `(TV story)` suffix or it will
select a redirect. Note also that `The Power of the Daleks` alone spans six main-namespace pages,
five of them real (`(TV story)`, `(audio story)`, `(game)`, `(novelisation)`, `(script)`) plus the
bare redirect — a useful property for a matching fixture, and a hazard for a naive title lookup.

```sql
SELECT count(*) AS n_pages, count(*) FILTER (WHERE NOT is_redirect) AS non_redirect
FROM pages WHERE ns=0 AND title LIKE 'The Power of the Daleks%';
-- 6, 5
```

### 9b. Part counts

```sql
SELECT page, property, value FROM page_properties
WHERE page IN ('The Tenth Planet (TV story)','The Ice Warriors (TV story)',
  'The Daleks'' Master Plan (TV story)','The Power of the Daleks (TV story)',
  'Marco Polo (TV story)')
AND property IN ('Epcount','Runtime','Medium','Release date','Series','Season')
ORDER BY page, property;
```

| story | `Epcount` | claimed parts | verdict |
|---|---|---|---|
| The Tenth Planet (TV story) | 4 | 4 | CONFIRMED |
| The Ice Warriors (TV story) | 6 | 6 | CONFIRMED |
| The Daleks' Master Plan (TV story) | 12 | 12 | CONFIRMED |
| The Power of the Daleks (TV story) | 6 | 6 | CONFIRMED |
| Marco Polo (TV story) | 7 | 7 | CONFIRMED |

Every one of the five part counts the ADRs quote is present in the archive, as a structured
property, on the exact rows ADR-0060 says carry no such property.

### 9c. Survival and animation status: where it lives

The archive records this at TWO granularities, and only one of them is structured.

**Structured, at whole-story granularity: categories.**

```sql
SELECT category, count(*) AS n_rows,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM stories s WHERE s.title=pc.title)) AS n_stories
FROM page_categories pc
WHERE category IN ('Stories with missing episodes','Animated missing episodes',
                   'Completely missing serials','Doctor Who animated television stories')
GROUP BY category ORDER BY category;
```

```
┌────────────────────────────────────────┬────────┬───────────┐
│                category                │ n_rows │ n_stories │
├────────────────────────────────────────┼────────┼───────────┤
│ Animated missing episodes              │ 16     │ 15        │
│ Completely missing serials             │ 11     │ 11        │
│ Doctor Who animated television stories │ 21     │ 19        │
│ Stories with missing episodes          │ 29     │ 27        │
└────────────────────────────────────────┴────────┴───────────┘
```

**Unstructured, at per-episode granularity: prose in `pages.text`.** WHICH episodes survive, and
how many were animated, exists only as English sentences. There is no property, column or category
that says "3 of 4". Anything wanting per-part survival has to parse prose.

### 9d. The five, checked against categories and prose

**The Tenth Planet** — categories: `Stories with missing episodes`, `Animated missing episodes`,
`Four part serials`. Prose:

> Only episodes one, two and three of this four-part story exist in the [[BBC Archives]] as
> [[Telerecording|16mm black & white film telerecordings]]. Only short clips of footage from the
> missing episode four exist …

> For these releases, a black-and-white animated reconstruction of the missing fourth episode was
> produced by [[Planet 55]].

4 parts, 3 survive, part 4 animated. **CONFIRMED.**

**The Ice Warriors** — categories: `Stories with missing episodes`, `Animated missing episodes`,
`Six part serials`. Prose:

> Episodes two and three currently [[Missing episode|remain missing]] from the [[BBC]] archive.
> They were recreated using animation for the serial's DVD release in 2013.

6 parts, 4 survive, 2 animated. **CONFIRMED.**

**The Power of the Daleks** — categories: `Stories with missing episodes`, `Animated missing
episodes`, `Completely missing serials`, `Six part serials`. Prose:

> While all six episodes are currently missing from the [[BBC]] archives, an animated
> reconstruction based on the surviving audio and video was released on the BBC Store on the 50th
> anniversary … 5 November 2016

6 parts, none survive, all 6 animated. **CONFIRMED.**

**Marco Polo** — categories: `Stories with missing episodes`, `Completely missing serials`, `Seven
part serials`; NOT in any animation category. Prose:

> No episodes of this seven-part story exist in the [[BBC Archives]].

`grep -ci animat` over the whole page returns **0**. 7 parts, none survive, no animation.
**CONFIRMED.**

**The Daleks' Master Plan** — categories: `Stories with missing episodes`, `Serials with eight or
more parts`; NOT in `Animated missing episodes`, NOT in `Doctor Who animated television stories`,
NOT in `Completely missing serials`. `grep -ci animat` over the whole page returns **0**, so "no
animation was ever made" is CONFIRMED.

The survival count is not:

> As of 2026, episodes one, two, three, five and ten exist in the [[BBC Archives]], plus brief
> sequences from episode four.

> The first, second, third, fifth and tenth episodes of this twelve-part story — "The Nightmare
> Begins", "Day of Armageddon", "Devil's Planet", "Counter Plot" and "Escape Switch" — exist in
> the [[BBC Archives]] … "Day of Armageddon" was recovered in 2004 … This was the only recovered
> episode to feature footage of [[Katarina]] until the recovery of "The Nightmare Begins" and
> "Devil's Planet" was announced in 2026.

Cited to `https://www.bbc.com/news/articles/c4g7kwq1k11o`, "Lost Doctor Who episodes found in
'eclectic' collection", 13 March 2026.

**Five of twelve survive in this archive, not three.** The archive was dumped 2026-09-04, six
months after the recovery. "Three of twelve" was true until March 2026.

The fixture still works, and arguably works better: five of twelve with no animation ever made is
the same argument — every release is a fraction of the whole, forever — and the row now also
demonstrates that a survival count is a claim with a date on it, not a constant. But ADR-0057 and
ADR-0060 both state the number as 3, and both are wrong against this source.

### 9e. Corpus-wide survival counts

```sql
SELECT count(*) FROM page_categories WHERE category='Stories with missing episodes';   -- 29
SELECT count(*) FROM page_categories WHERE category='Animated missing episodes';       -- 16
SELECT count(*) FROM page_categories WHERE category='Completely missing serials';      -- 11
```

Filtered to TV-story pages (`title LIKE '%(TV story)'`): 27, 15, 11.

The 29 for missing episodes counts two non-stories: `Category:Completely missing serials` (a
subcategory) and `User:JDPManjoume/Sandbox4` (a user sandbox). The real story count is 27.

The 16 for animation counts `The Wheel in Space: Episode 1 (home video)` — a home video, not a
serial — and `The Web of Fear Teaser (TV story)`. Members of `Animated missing episodes` that are
also in `Stories with missing episodes`: **14**.

| claim | measured |
|---|---|
| 29 stories carry missing episodes | 29 category ROWS; **27** stories |
| 13 have an animated replacement | **16** rows / **15** stories / **14** serials-with-missing-episodes. No mapping gives 13. |
| 11 serials completely missing | **11**, exactly, all of them stories |

Full membership lists:

*Stories with missing episodes* (29 rows): Category:Completely missing serials · Fury from the
Deep · Galaxy 4 · Get Off My Cloud · Marco Polo · Mission to the Unknown · The Abominable Snowmen
· The Celestial Toymaker · The Crusade · The Daleks' Master Plan · The Evil of the Daleks · The
Faceless Ones · The Highlanders · The Ice Warriors · The Invasion · The Macra Terror · The
Massacre · The Moonbase · The Myth Makers · The Power of the Daleks · The Reign of Terror · The
Savages · The Smugglers · The Space Pirates · The Tenth Planet · The Underwater Menace · The Web
of Fear · The Wheel in Space · User:JDPManjoume/Sandbox4

*Animated missing episodes* (16 rows): Fury from the Deep · Galaxy 4 · The Abominable Snowmen ·
The Celestial Toymaker · The Evil of the Daleks · The Faceless Ones · The Ice Warriors · The
Invasion · The Macra Terror · The Moonbase · The Power of the Daleks · The Reign of Terror · The
Tenth Planet · The Web of Fear · The Web of Fear Teaser · The Wheel in Space: Episode 1 (home
video)

*Completely missing serials* (11 rows): Fury from the Deep · Get Off My Cloud · Marco Polo ·
Mission to the Unknown · The Highlanders · The Macra Terror · The Massacre · The Myth Makers · The
Power of the Daleks · The Savages · The Smugglers

Note `The Underwater Menace` sits in `Doctor Who animated television stories` but NOT in `Animated
missing episodes`, and `The Celestial Toymaker` the reverse. The two categories are not
interchangeable, and any fixture derived from them has to say which it used.

---

## 10. The archive's size — ADR-0057

**Claim.** "The 2.3GB DuckDB archive".

```
$ ls -l ~/tardis-pipeline/data/db/
-rw-r--r--  627547317  Sep  4 10:17  pages.jsonl
-rw-r--r--   61447626  Sep  4 10:38  smw.jsonl
-rw-r--r-- 1816932352  Sep  4 11:07  tardis.duckdb

$ du -sh ~/tardis-pipeline/data/db     ->  2.3G
$ du -sh ~/tardis-pipeline/data        ->  3.2G
$ du -sh ~/tardis-pipeline             ->  3.2G
```

The DuckDB file is **1,816,932,352 bytes = 1.69 GiB = 1.82 GB**. No `.wal` alongside it.

2.3G is `du -sh` on the `data/db` DIRECTORY, which also holds the two raw JSONL dumps the database
was built from (689MB of them). Those are inputs, not the archive.

`docs/research/supersession-check-3.md:820-821` already flagged this: "SPEC.md:1496 says 'the
**1.8GB** database'; ADR-0057 and CNCORE-2 both say **2.3GB**." SPEC.md was right.

**CONTRADICTED.** The DuckDB file is 1.8GB. The 2.3GB figure describes a directory, and the
directory is not what "queried, never vendored" applies to.

---

## Summary table

| # | Claim | Measured | Verdict |
|---|---|---|---|
| 1 | `pages` 373,513 | 373,513 | CONFIRMED |
| 2 | `stories` 11,285 | 11,285 | CONFIRMED |
| 3 | `redirects` 36,620 | 36,620 | CONFIRMED |
| 4 | `page_properties` 518,768 | 518,768 | CONFIRMED |
| 5 | `page_categories` 522,385 | 522,385 | CONFIRMED |
| 6 | `page_links` 4,500,016 | 4,500,016 | CONFIRMED |
| 7 | `story_summary` 11,285 with medium/date/series/writers | 11,285; `released` unreadable on full scan | CONFIRMED with caveat |
| 8 | 93.4% multi-container, median 4, max 52 | 93.44%, 4, 52 (container = category) | CONFIRMED |
| 9a | Category graph is cyclic | 4 non-trivial SCCs + 3 self-loops | CONFIRMED |
| 9b | 22 levels deep | 22 (BFS from 268 roots, 0-based); 48 as longest condensation chain | CONFIRMED, convention stated |
| 9c | 7,236 categories on a cycle | **28** on a cycle; 7,236 is the count reachable BELOW a cycle | CONTRADICTED |
| 10 | 715 properties, 45 over 1,000 rows | 715, 45 | CONFIRMED |
| 11 | No property is both link and literal | 0 counter-examples, across 518,768 rows | CONFIRMED |
| 12 | ~12% of release dates partial | 12.39% (1,371 / 11,068) | CONFIRMED |
| 13a | Only 22 `Runtime` rows corpus-wide | 22, none on a story | CONFIRMED |
| 13b | No property records a part/episode count | **`Epcount`: 3,741 stories (33.15%)**; 2,887 more via categories | CONTRADICTED |
| 14 | `medium` 70 distinct / 44 once / 50 ≤2 | 70 / 44 / 50 (SMW `Medium` property) | CONFIRMED |
| 15 | 2.3GB database | 1,816,932,352 bytes = 1.82 GB / 1.69 GiB | CONTRADICTED |
| 16 | Tenth Planet 4 parts, 3 survive, pt 4 animated | 4 / 3 / yes | CONFIRMED |
| 17 | Ice Warriors 6 parts, 4 survive, 2 animated | 6 / 4 / 2 | CONFIRMED |
| 18 | Daleks' Master Plan 12 parts, **3** survive, no animation | 12 / **5** / no animation | CONTRADICTED (survival count) |
| 19 | Power of the Daleks 6 parts, 0 survive, all 6 animated | 6 / 0 / all 6 | CONFIRMED |
| 20 | Marco Polo 7 parts, 0 survive, no animation | 7 / 0 / none | CONFIRMED |
| 21a | 29 stories carry missing episodes | 29 rows, **27** stories | CONTRADICTED (as "stories") |
| 21b | 13 have an animated replacement | **16** rows / 15 stories / 14 serials | CONTRADICTED |
| 21c | 11 serials completely missing | 11 | CONFIRMED |

---

## What follows

Three of these need an ADR edit rather than a footnote.

**ADR-0060's supporting measurement is inverted.** "No property records a part or episode count"
is false; `Epcount` covers a third of the corpus. The decision itself (extent is a statement,
never derived from the maximum part any edition covers) is unaffected and still right, but its
evidence has to be restated: extent is unknown for two thirds of stories, known for a third, and
encoded two incompatible ways (`Epcount` property, `N part serials` category) that a real importer
has to reconcile. That is a stronger case for provenance-on-extent than "it is always absent",
because two encodings that can disagree is exactly what "two sources can legitimately disagree"
means.

**ADR-0057's cycle figure names the wrong set.** 7,236 is a descendant count. 28 categories are on
a cycle. The fixture requirement "a category cycle" is satisfiable from a set of 28 named
categories, which is a far better fixture than a 7,236-row extract.

**The Daleks' Master Plan moved.** Two episodes were recovered in March 2026 and this archive
records five of twelve surviving. The fixture argument survives at 5/12; the number does not
survive at 3/12. Worth recording in the ADR that a survival count carries an `observed_at`, since
that is precisely what ADR-0012's statement model is for.

The size figure and the 29/13 counts are corrections rather than reconsiderations.
