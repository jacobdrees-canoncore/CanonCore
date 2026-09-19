import { type Catalogue, readCatalogue, readWorks, searchCatalogue } from "@canoncore/db";
import { type CataloguePublic, type CatalogueRowPublic, cataloguePublic } from "@canoncore/schemas";
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
  /**
   * THE STEP BACK (CNCORE-174): the first Row of the page a reader is on, and
   * the answer is the page that ends short of it. The cursor read from the
   * other end, so the same declaration and the same rule for one naming
   * nothing.
   */
  before: aCursor,
  /**
   * THE GROUP A READER HAS NARROWED THE LISTING TO (ADR-0010), on all three
   * questions: the Catalogue since CNCORE-179, and work-browsing and Catalogue
   * search since CNCORE-180. It was on `list` alone while it was the only
   * handler that kept the promise, for the reason `after` gives below about
   * search; now every handler here does, so it is one declaration rather than
   * three that could come to disagree about what a Group id is.
   *
   * AS A STRING RATHER THAN A `z.uuid()`, which is ADR-0066's rule for a
   * parameter that is not an identity and the one `aCursor` follows for the
   * same reason: whether a value names anything is what the ANSWER says. A
   * Group that names nothing -- deleted since the link was kept, or a typo in
   * one -- narrows to nothing, and the page says so rather than a validator
   * answering a BAD_REQUEST no caller can narrow on.
   *
   * ABSENT IS THE LISTING UNNARROWED, which is what clearing the scope is.
   */
  group: z.string().optional(),
  /**
   * THE KIND A READER HAS NARROWED THE LISTING TO (CNCORE-175, story 25), on
   * all three questions -- so a narrowing means one thing wherever it is
   * offered, which is the argument `group` above makes about a scope.
   *
   * THE READER'S NARROWING, NEVER THE SURFACE'S QUESTION. ADR-0077 decides
   * which kinds a question INCLUDES -- work-browsing excludes the entity kinds,
   * the catalogue and search exclude none -- and that is not a reader's to
   * change. This narrows whichever question was asked, so a narrowed `/works`
   * is still work-browsing and no value here turns `list` into it: what a
   * narrowed catalogue shows is a subset of what it already showed.
   *
   * AS A STRING RATHER THAN AN ENUM OF THE SEVEN, which is ADR-0066's rule for
   * a parameter that is not an identity, and `group` above takes it for the
   * same reason: whether a value names anything is what the ANSWER says. A kind
   * nobody defined narrows to nothing rather than raising a BAD_REQUEST at a
   * reader whose link outlived a migration -- and the seven are the DATABASE's
   * (`item_kinds`, migration 1), so an enum written here would be that closed
   * set spelled a second time in a second language, going stale the day a
   * migration adds an eighth. `item.kinds` is what a surface offers them from.
   *
   * ABSENT IS THE LISTING UNNARROWED, which is what clearing the narrowing is.
   */
  kind: z.string().optional(),
});

/**
 * What the two BROWSED Listings take: everything above, a letter to jump to
 * (CNCORE-174), and the order the reader chose (CNCORE-175).
 *
 * NAMED FOR BROWSING RATHER THAN FOR BEING FILED BY NAME, which it was until
 * CNCORE-175. Being filed by name is what makes a LETTER meaningful, and it
 * stopped describing the input the moment the input could ask for an order
 * these Rows are not filed by -- a name held in step with one of its two
 * members and not the other, which is the arrangement `ENDS_HERE` one package
 * over carries a paragraph about.
 *
 * THE FIRST ROW FILED UNDER IT, or the first after it where nothing is -- a
 * SEEK on the sort key the walk already reads, and no offset: ADR-0119 names
 * the A-Z jump as the navigation that fits a keyset walk, where a numbered
 * page does not. A string rather than one of 26, for `aCursor`'s reason: any
 * value is a place in the alphabet, and a reader typing `?letter=Ma` is asking
 * a question with an answer.
 *
 * NOT ON CATALOGUE SEARCH, which is why this is an extension rather than a
 * line in `listingInput`. A ranking leads on how close a title is to what a
 * reader typed, so nothing in it is FILED under a letter, and a jump there
 * would be a seek on the wrong key.
 */
const browsedInput = listingInput.extend({
  letter: z.string().optional(),
  /**
   * WHICH ORDER THE READER ASKED FOR (CNCORE-175, story 24), so one catalogue
   * has more than one view of itself.
   *
   * ON THE TWO BROWSED LISTINGS AND NOT ON SEARCH, which is why it sits here
   * beside `letter` rather than in `listingInput`. Catalogue search leads on
   * how close a title is to what the reader typed (ADR-0120): an order chosen
   * over that would discard the ranking that IS the answer, which is a
   * different surface rather than this parameter.
   *
   * AN ENUM WHERE `kind` AND `group` ARE STRINGS, and the difference is who
   * owns the set. Those two name rows in tables the Owner and the migrations
   * fill, so any string is a question with an answer; these two are the orders
   * THIS REPOSITORY has written a walk for, the whole set is in `order.ts`, and
   * a third is a change here. A word naming no order is a BAD_REQUEST rather
   * than a silent fall back to the default, because falling back would answer a
   * reader's shared link with a page that is not the one they sent.
   *
   * `name` IS THE DEFAULT AND THE ABSENCE BOTH, so the bare address is the
   * catalogue in its own order and the picker's "By name" link carries no
   * `order` at all -- one address for one page (ADR-0066).
   */
  order: z.enum(["name", "added"]).default("name"),
});

/**
 * What Catalogue search takes: the same ceiling, the same cursor, the same
 * Group, and the query.
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
 * closeness cannot be read off the anchor row -- it is RECOMPUTED, against
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
    .input(browsedInput)
    .output(cataloguePublic)
    .handler(async ({ input, context }) => {
      const listing = await readCatalogue(context.db, {
        limit: input.limit,
        after: input.after,
        before: input.before,
        group: input.group,
        kind: input.kind,
        letter: input.letter,
        order: input.order,
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
    .input(browsedInput)
    .output(cataloguePublic)
    .handler(async ({ input, context }) => {
      const listing = await readWorks(context.db, {
        limit: input.limit,
        after: input.after,
        before: input.before,
        group: input.group,
        kind: input.kind,
        letter: input.letter,
        order: input.order,
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
        before: input.before,
        group: input.group,
        kind: input.kind,
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
function asListing({
  rows,
  total,
  rowsBefore,
  continuesAfter,
  continuesBefore,
}: Catalogue): CataloguePublic {
  return { rows: rows.map(asRow), total, rowsBefore, continuesAfter, continuesBefore };
}

/**
 * One row, for all three questions.
 *
 * `asListing` already existed to write this once "so the two cannot come to
 * disagree about what a catalogue row is" (CNCORE-67). Catalogue search is a
 * third reader of the same facts, so it shares the enumeration rather than
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
    // ADR-0140. The size of this container's own Members listing, read off
    // the Row's own statement rather than asked for again -- so a Row cannot
    // report a figure the container's page would contradict.
    holds: row.holds,
    // CNCORE-184. Named field by field, as `item.get` names the same three on
    // "Also appears in", rather than the query's object handed through.
    sitsIn: {
      first: row.sitsIn.first.map((placement) => ({
        containerId: placement.containerId,
        containerTitle: placement.containerTitle,
        position: placement.position,
      })),
      total: row.sitsIn.total,
    },
  };
}
