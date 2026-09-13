import { type Catalogue, readCatalogue, readWorks, searchCatalogue } from "@canoncore/db";
import {
  type CatalogueRowPublic,
  type CataloguePublic,
  cataloguePublic,
} from "@canoncore/schemas";
import { z } from "zod";

import { openProcedure } from "../index";
import { A_PAGE, aCursor } from "./listing";

/**
 * What a listing procedure takes: the two questions ADR-0077 names, and the
 * base Catalogue search extends.
 *
 * ONE INPUT FOR ALL THREE, because the cap is a fact about what this app will
 * serve in one answer rather than about which question was asked. Two
 * declarations would be one rule in two places, free to drift into two ceilings
 * that nobody chose.
 */
const listingInput = z.object({
  /**
   * How many rows to answer with. The caller may ask for fewer than the
   * default; it may not ask for more, because the ceiling is what keeps one
   * request's cost bounded by this app rather than by whoever sends the
   * request.
   */
  limit: z.number().int().positive().max(A_PAGE).default(A_PAGE),
  /** ADR-0119's cursor, written once for every listing in `./listing`. */
  after: aCursor,
});

/**
 * What Catalogue search takes: the same ceiling, the same cursor, and the query.
 *
 * EXTENDED FROM `listingInput` RATHER THAN RESTATED, for the reason that
 * declaration gives about itself -- the cap is a fact about what this app will
 * serve in one answer rather than about which question was asked, and a second
 * spelling is how two ceilings nobody chose come about.
 *
 * `after` WAS OMITTED HERE UNTIL CNCORE-88, because search had no cursor to
 * resume from and an input that accepted one and silently did nothing with it
 * would have been a promise the handler does not keep. It keeps it now.
 *
 * AND THE QUERY COMES BACK WITH THE CURSOR, WHICH IS THE WHOLE MECHANISM. This
 * order leads on how close a title is to what the reader typed, so the anchor's
 * place in it cannot be read off the anchor row -- it is RECOMPUTED, against
 * the query this input carries on every page. There is no such thing as a
 * search request without one, so nothing had to be added for the walk: a paged
 * search is `?q=<query>&after=<id>` and the two parameters were already here
 * separately.
 */
const searchInput = listingInput.extend({
  /**
   * What the reader typed, AS TEXT. `LIKE` metacharacters in it are escaped
   * rather than honoured, and that happens in one place below this seam -- a
   * caller cannot opt out of it, and no caller passes a pattern.
   *
   * UNCONSTRAINED IN LENGTH AND SHAPE ON PURPOSE. There is nothing a reader can
   * type that this must refuse: the empty query is answered rather than
   * rejected, and every metacharacter is text.
   */
  query: z.string(),
});

export const catalogue = {
  /**
   * WHAT IS IN THIS CATALOGUE -- every item, of every kind.
   *
   * ADR-0077 phrases its rule around the QUESTION A SURFACE ASKS, and this is
   * the wide one: work-browsing answers "what can I watch" and excludes the
   * entity kinds, and this excludes nothing. A front page that hid People would
   * be answering the other question without saying so -- and the other question
   * is `works` below rather than this one with a flag on it.
   */
  list: openProcedure
    .input(listingInput)
    .output(cataloguePublic)
    .handler(async ({ input, context }) => {
      const listing = await readCatalogue(context.db, {
        limit: input.limit,
        after: input.after,
      });
      return asListing(listing);
    }),

  /**
   * WHAT CAN I WATCH -- ADR-0077's other question, and the first reader
   * `items.holds_work` has ever had.
   *
   * A SECOND PROCEDURE RATHER THAN A FILTER ON THE FIRST, because that record
   * phrases its rule around THE QUESTION A SURFACE ASKS rather than around a
   * list of surfaces: "naming the question lets a surface classify itself". A
   * boolean on `list` would make every future caller classify itself by
   * remembering to pass it, and the default would silently decide for the ones
   * that forgot.
   *
   * THE SAME SHAPE AS `list`, which is the point rather than a coincidence: the
   * two answer different questions about the same catalogue, so a surface
   * swapping one for the other changes what it is asking and nothing else --
   * the cap, the cursor and `continuesAfter` included (ADR-0119).
   */
  works: openProcedure
    .input(listingInput)
    .output(cataloguePublic)
    .handler(async ({ input, context }) => {
      const listing = await readWorks(context.db, {
        limit: input.limit,
        after: input.after,
      });
      return asListing(listing);
    }),

  /**
   * WHERE IS THE THING I AM THINKING OF -- Catalogue search (`CONTEXT.md`).
   *
   * NOT THE CMPP OPERATION OF THE SAME NAME. That one asks a PROVIDER for
   * candidate matches and lives on the `provider` router; `CONTEXT.md` keeps
   * the two apart and forbids `search` unqualified.
   *
   * ACROSS EVERY KIND, which makes this the WIDE question like `list` rather
   * than the narrow one `works` asks: a Character's name has to find the
   * Character, so `holds_work` is deliberately not consulted. What separates it
   * from `list` is not which items it can return but that a reader has said
   * what they are looking for.
   *
   * THE SAME SHAPE AS THE OTHER TWO, AND IT WAS A THIRD ONE UNTIL CNCORE-88.
   * ADR-0119 makes `continuesAfter: null` mean "the listing ends here", so a
   * search that had no cursor could not answer with this shape at all: null
   * would have reported the hundred it returned as all there were, which is
   * the silent cap that record exists to refuse. It walks now, so the field
   * says what it says everywhere and `total` is no longer carrying the cap's
   * honesty alone.
   */
  search: openProcedure
    .input(searchInput)
    .output(cataloguePublic)
    .handler(async ({ input, context }) => {
      const found = await searchCatalogue(context.db, {
        query: input.query,
        limit: input.limit,
        after: input.after,
      });
      return asListing(found);
    }),
};

/**
 * One listing, as the read path emits it.
 *
 * ADR-0045: every field is NAMED, never the query's row with fields removed --
 * so `holds_work`, `owner_id` and the change sequence are absent because no
 * line was written for them rather than because somebody remembered to strip
 * them. Written ONCE for all THREE questions, so they cannot come to disagree
 * about what a listing is.
 */
function asListing({ rows, total, continuesAfter }: Catalogue): CataloguePublic {
  return { rows: rows.map(asRow), total, continuesAfter };
}

/**
 * One row, for all three questions.
 *
 * `asListing` already existed to write this once "so the two cannot come to
 * disagree about what a catalogue row is" (CNCORE-67). Catalogue search is a
 * third reader of the same four facts, so it shares the enumeration rather than
 * adding a copy that would be correct until somebody changed one of them.
 *
 * ADR-0045: every field is NAMED, never the query's row with fields removed --
 * so `holds_work`, `owner_id` and the change sequence are absent because no
 * line was written for them rather than because somebody remembered to strip
 * them.
 */
function asRow(row: Catalogue["rows"][number]): CatalogueRowPublic {
  return {
    id: row.id,
    title: row.title,
    // The LABEL under the name the read path gives it, exactly as `item.get`
    // does: `kind` is the reader's word for it wherever the read path emits
    // one, and the key stays below this seam (ADR-0045).
    kind: row.kindLabel,
    isContainer: row.isContainer,
  };
}
