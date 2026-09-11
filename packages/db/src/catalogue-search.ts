import { and, eq, sql } from "drizzle-orm";

import type { Database } from "./index";
import { type CatalogueEntry, IN_THE_CATALOGUE, SORT_KEY } from "./queries";
import { itemKinds, items } from "./schema";

/**
 * Turns what a reader typed into a `LIKE` pattern that matches it AS TEXT.
 *
 * THE ORDER OF THE THREE REPLACEMENTS IS LOAD-BEARING, and it is the only
 * subtle thing in this file. The backslash goes first. Escaping `%` or `_`
 * first inserts backslashes of its own, and a backslash pass running afterwards
 * doubles those -- which turns the escape back into a literal backslash and the
 * metacharacter back into a wildcard. One transposition, and a reader searching
 * for `100%` matches every row in the catalogue.
 *
 * IT RETURNS THE WHOLE PATTERN rather than an escaped fragment, and that is
 * what makes it THE ONLY PATH TO ONE. A helper that escaped and left the caller
 * to wrap it in `%...%` would put half the rule at every call site, which is
 * where the halves stop agreeing.
 *
 * THERE IS NO BUILT-IN THAT DOES THIS. PostgreSQL's `like_escape()` is not a
 * sanitiser -- it rewrites a pattern from one escape character to another, and
 * takes a pattern as its input. Checked rather than assumed.
 *
 * IT IS CNCORE-24'S RULE FROM `provider-wiki`, matched term for term on
 * purpose, so that the catalogue and the provider escape a reader's query the
 * same way rather than each being locally sensible.
 */
export function likePattern(query: string): string {
  const escaped = query
    // FIRST, ALWAYS. See above.
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  // Wrapped on both sides, because a search box matches ANYWHERE in a title:
  // `yler` has to find "Rose Tyler". That is the capability full-text search
  // cannot offer at all, and the reason this is a trigram index rather than a
  // `tsvector` one.
  return `%${escaped}%`;
}

/**
 * THE MATCH ITSELF, named once so that nothing can test a different one.
 *
 * IT EXISTS BECAUSE OF THE PLAN TEST. `catalogue-search.test.ts` asks
 * PostgreSQL whether the trigram index can serve this predicate, and it can
 * only ask by writing a predicate down. Written out a second time there, the
 * probe and the real query were free to drift -- the probe would go on
 * reporting a healthy index for a `where` clause the search had stopped using,
 * which is precisely the silent failure that test exists to catch.
 *
 * `ilike` RATHER THAN `similarity() >`. Every row this returns CONTAINS the
 * query; the ranking is a separate question, answered by the order rather than
 * by the filter. That is what keeps "did it match" a fact a reader could check
 * for themselves rather than a threshold nobody chose.
 */
export function titleMatches(query: string) {
  return sql`${items.title} ilike ${likePattern(query)}`;
}

/**
 * CATALOGUE SEARCH: the owner's own catalogue, across EVERY item kind.
 *
 * `CONTEXT.md` gives this its name and separates it from the CMPP operation
 * also called Search, which asks a PROVIDER for candidate matches. This asks
 * the catalogue about what is already in it.
 *
 * EVERY KIND, which is ADR-0077's rule read the way that record phrases it --
 * around the QUESTION A SURFACE ASKS. Work-browsing answers "what can I watch"
 * and excludes the entity kinds; this answers "where is the thing I am thinking
 * of", and a Character's name has to find the Character. That is why each entry
 * carries its kind: a Person and a Work sharing a name are two rows here, and
 * the kind is what tells a reader which is which.
 *
 * IT ANSWERS ITS OWN SHAPE RATHER THAN `Catalogue`, AND THAT IS THE DECISION
 * THIS FUNCTION MAKES. The entries are the listing's entries exactly -- a result
 * and a catalogue row carry the same four facts -- but `Catalogue` grew a
 * `continuesAfter` cursor under ADR-0119, and a search that answered with that
 * shape would have to put something in it.
 *
 * `null` WOULD BE A LIE RATHER THAN A GAP. ADR-0119 makes `continuesAfter: null`
 * mean "the listing ends here", so a search over a thousand matches answering
 * null would tell every caller the hundred it returned were all of them --
 * which is precisely the silent cap the front page has a paragraph refusing.
 * Better a shape that cannot say it than a field that says it falsely.
 *
 * TODO(CNCORE-88): so the results ARE capped and the tail is not reachable
 * yet, and `total` is what stops that being silent. Walking them wants
 * ADR-0119's own shape rather than a second one -- but a keyset walk needs its
 * anchor's place in the ORDER, and this order leads on `similarity()`, which is
 * a function of the query rather than a column of the item. That is a real
 * design question about relevance paging and it is CNCORE-66's criteria
 * unasked, so it is filed rather than guessed at here.
 *
 * THE WINNING TITLE ONLY. `items.title` is a projection (ADR-0014), so what is
 * searched is whichever title statement currently wins. Alternative and
 * foreign-language titles are held as statements and are NOT found by this --
 * said here rather than discovered later. Reaching them needs a partial
 * expression index keyed to a property id minted per install, which cannot live
 * in a schema file; it is out of scope for CNCORE-66 on purpose.
 */
export interface CatalogueSearch {
  entries: CatalogueEntry[];
  /**
   * How many items MATCHED altogether, which is not `entries.length` whenever
   * the cap bit. It is the whole of what keeps the cap from being silent here,
   * because unlike the listing there is no cursor saying there is more.
   */
  total: number;
}

export async function searchCatalogue(
  db: Database,
  { query, limit }: { query: string; limit: number },
): Promise<CatalogueSearch> {
  /*
   * AN EMPTY QUERY IS ANSWERED BEFORE THE QUERY RUNS, and this line is a fix
   * rather than a guard against something that cannot happen.
   *
   * MEASURED: an escaped empty query is the pattern `%%`, which matches every
   * row that has a title at all. So the accidental behaviour of a search box
   * somebody pressed Enter on is the WHOLE CATALOGUE returned as though a
   * reader had asked for it.
   *
   * IT IS NOT GUARDED FOR ITS COST, and this comment used to say it was. A
   * one- or two-character query scans just as hard -- the index does nothing
   * below three characters -- and is deliberately NOT short-circuited, because
   * it is a real question with a real answer. ADR-0120 carries the measurement.
   *
   * WHAT MAKES THIS ONE DIFFERENT is that it answers a question nobody asked.
   * The front page already answers "what is in this catalogue" (ADR-0077's wide
   * question), so a search falling back to listing it would be a second surface
   * giving the same reply to a different question.
   *
   * TRIMMED FIRST, so a reader who hit the space bar has typed nothing too.
   * The trimmed query is then what gets searched, rather than the raw one:
   * trimming for the test and searching the untrimmed string would make ` rose`
   * and `rose` two different searches for no reason a reader could see.
   */
  const wanted = query.trim();
  if (wanted === "") return { entries: [], total: 0 };

  const rows = await db
    .select({
      id: items.id,
      title: items.title,
      kindLabel: itemKinds.label,
      isContainer: items.isContainer,
      /*
       * THE COUNT COMES BACK ON THE ROWS rather than from a second query: a
       * count taken separately is taken at a different moment, so a page could
       * report 41 matches and list 42.
       *
       * A WINDOW COUNT HERE, WHERE `readCatalogue` USES A SCALAR SUBQUERY, and
       * the difference is the cursor rather than an inconsistency. A window
       * count is taken AFTER `where`, which is exactly wrong for a keyset walk
       * -- with the cursor in the predicate it counts the items past the
       * cursor, so page two reports a smaller library than page one, and
       * CNCORE-82 moved that one to an uncorrelated subquery for it. This query
       * has no cursor in its predicate (CNCORE-88), so `where` IS the match
       * set, and counting after it is the number wanted: how many matched.
       *
       * THE DAY A CURSOR ARRIVES HERE, THIS LINE HAS TO MOVE WITH IT, which is
       * why the reason is written down rather than the choice.
       *
       * `count(*)` is a `bigint`, which node-postgres hands over as a STRING
       * because the range does not fit a JavaScript number. `mapWith(Number)`
       * is where that becomes the number the type claims; without it `total`
       * is a string wearing a number's type.
       */
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(items)
    // INNER, because `items.kind` is a foreign key into this table: a row with
    // no kind cannot exist, so there is nothing for a left join to preserve.
    .innerJoin(itemKinds, eq(itemKinds.kind, items.kind))
    .where(
      and(
        // ADR-0075, AND `readCatalogue`'S OWN PREDICATE rather than a second
        // spelling of it. A deleted item is gone to every reader, and a reader
        // who can search their way to one has not been told it is deleted --
        // but the hazard that makes this an import is the day "in the
        // catalogue" gains a term and only one of the two surfaces learns it.
        IN_THE_CATALOGUE,
        titleMatches(wanted),
      ),
    )
    .orderBy(
      // CLOSEST FIRST, which is what the trigram index is for beyond speed:
      // `similarity()` comes from the same `pg_trgm` extension the index needs,
      // so ranking costs no second mechanism. Every row here CONTAINS the query
      // already -- `ilike` decided that -- so what this separates is how much
      // else the title says: a title that is nearly the query outranks one that
      // merely mentions it.
      sql`similarity(${items.title}, ${wanted}) desc`,
      // AND THEN THE CATALOGUE'S OWN ORDER, so two equally close titles come
      // back in the same order twice. `SORT_KEY` is `readCatalogue`'s own, not
      // a second spelling: the catalogue has one order, and a search that broke
      // ties by a different one would list two items in an order no other
      // surface agrees with. `nulls last` is written out for the same reason it
      // is there -- an item with no title at all has no sort key.
      sql`${SORT_KEY} nulls last`,
      items.id,
    )
    .limit(limit);

  return {
    entries: rows.map(({ id, title, kindLabel, isContainer }) => ({
      id,
      title,
      kindLabel,
      isContainer,
    })),
    // No rows means no window count to read, and nothing has been hidden.
    total: rows[0]?.total ?? 0,
  };
}
