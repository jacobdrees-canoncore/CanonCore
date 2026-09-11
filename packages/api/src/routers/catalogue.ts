import {
  type Catalogue,
  type CatalogueSearch,
  readCatalogue,
  readWorks,
  searchCatalogue,
} from "@canoncore/db";
import {
  type CatalogueEntryPublic,
  type CataloguePublic,
  type CatalogueSearchPublic,
  cataloguePublic,
  catalogueSearchPublic,
} from "@canoncore/schemas";
import { z } from "zod";

import { publicProcedure } from "../index";

/**
 * HOW MANY ITEMS ONE ANSWER CARRIES, when the caller does not say.
 *
 * A CAP RATHER THAN THE WHOLE CATALOGUE, because the front page is the surface
 * every reader opens first and an uncapped listing makes its cost a function of
 * the library behind it. The number is arbitrary in the way a first page always
 * is: enough that a small catalogue arrives whole, small enough that a large one
 * does not arrive at all.
 *
 * AND THE CAP IS NEVER SILENT. `total` comes back beside the entries precisely
 * so a surface can say what it is not showing; a listing that reported only what
 * it returned would present the first hundred as the library.
 *
 * AND THE OTHER HALF IS `after`, which is what REACHES the items past this
 * ceiling (ADR-0119). The cap is unchanged by it: one answer still costs one
 * page, and a reader walks as many as they care to.
 */
const A_PAGE = 100;

/**
 * What a listing procedure takes, shared by the two questions ADR-0077 names.
 *
 * ONE INPUT FOR BOTH, because the cap is a fact about what this app will serve
 * in one answer rather than about which question was asked. Two declarations
 * would be one rule in two places, free to drift into two ceilings that nobody
 * chose.
 */
const listingInput = z.object({
  /**
   * How many entries to answer with. The caller may ask for fewer than the
   * default; it may not ask for more, because the ceiling is what keeps one
   * request's cost bounded by this app rather than by whoever sends the
   * request.
   */
  limit: z.number().int().positive().max(A_PAGE).default(A_PAGE),
  /**
   * WHERE TO CARRY ON FROM: the id of the last entry the page before this one
   * carried, which `continuesAfter` handed over (ADR-0119).
   *
   * `z.string()` RATHER THAN `z.uuid()`, which is ADR-0066's rule for a
   * parameter that is not an identity: any string may be asked about, and the
   * answer says whether it named anything. One that names no item names no
   * position either, so the walk starts at the beginning rather than raising --
   * and a reader whose bookmark outlived the item it was cut at gets the
   * catalogue rather than an error page.
   */
  after: z.string().optional(),
});

/**
 * What Catalogue search takes: the same ceiling, and no cursor.
 *
 * DERIVED FROM `listingInput` RATHER THAN RESTATED, for the reason that
 * declaration gives about itself -- the cap is a fact about what this app will
 * serve in one answer rather than about which question was asked, and a second
 * spelling is how two ceilings nobody chose come about.
 *
 * `after` IS OMITTED RATHER THAN IGNORED. Search has no cursor to resume from
 * (CNCORE-88), and an input that accepted one and silently did nothing with it
 * would be a promise the handler does not keep.
 */
const searchInput = listingInput.omit({ after: true }).extend({
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
  list: publicProcedure
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
  works: publicProcedure
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
   * A THIRD SHAPE, AND THE ONLY ONE OF THE THREE WITHOUT A CURSOR. ADR-0119
   * makes `continuesAfter: null` mean "the listing ends here", so a search over
   * a thousand matches answering null would report the hundred it returned as
   * all there were. The field is absent rather than present and false, and
   * `total` is the whole of what keeps the cap honest until CNCORE-88 lands.
   */
  search: publicProcedure
    .input(searchInput)
    .output(catalogueSearchPublic)
    .handler(async ({ input, context }) => {
      const found = await searchCatalogue(context.db, {
        query: input.query,
        limit: input.limit,
      });
      return asSearch(found);
    }),
};

/**
 * One listing, as the read path emits it.
 *
 * ADR-0045: every field is NAMED, never the query's row with fields removed --
 * so `holds_work`, `owner_id` and the change sequence are absent because no
 * line was written for them rather than because somebody remembered to strip
 * them. Written ONCE for both questions, so the two cannot come to disagree
 * about what a catalogue entry is.
 */
function asListing({ entries, total, continuesAfter }: Catalogue): CataloguePublic {
  return { entries: entries.map(asEntry), total, continuesAfter };
}

/**
 * One Catalogue search answer, as the read path emits it.
 *
 * THE SAME ENTRIES AS A LISTING AND NO CURSOR, which is the difference between
 * the two shapes and the whole of it. See `catalogue.search` above for why the
 * field is absent rather than null.
 */
function asSearch({ entries, total }: CatalogueSearch): CatalogueSearchPublic {
  return { entries: entries.map(asEntry), total };
}

/**
 * One entry, for all THREE questions rather than two.
 *
 * `asListing` already existed to write this once "so the two cannot come to
 * disagree about what a catalogue entry is" (CNCORE-67). Catalogue search is a
 * third reader of the same four facts, so it shares the enumeration rather than
 * adding a copy that would be correct until somebody changed one of them.
 *
 * ADR-0045: every field is NAMED, never the query's row with fields removed --
 * so `holds_work`, `owner_id` and the change sequence are absent because no
 * line was written for them rather than because somebody remembered to strip
 * them.
 */
function asEntry(entry: Catalogue["entries"][number]): CatalogueEntryPublic {
  return {
    id: entry.id,
    title: entry.title,
    // The LABEL under the name the read path gives it, exactly as `item.get`
    // does: `kind` is the reader's word for it wherever the read path emits
    // one, and the key stays below this seam (ADR-0045).
    kind: entry.kindLabel,
    isContainer: entry.isContainer,
  };
}
