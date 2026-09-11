import { readCatalogue } from "@canoncore/db";
import { cataloguePublic } from "@canoncore/schemas";
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
 * TODO(CNCORE-82): saying what is not shown is half of it. Nothing yet REACHES
 * items past this ceiling -- there is no cursor here and no next-page link on
 * the page -- so a catalogue larger than a page has a tail nobody can walk.
 * The cap stays whatever that ticket chooses; what it adds is the other half.
 */
const A_PAGE = 100;

export const catalogue = {
  /**
   * WHAT IS IN THIS CATALOGUE -- every item, of every kind.
   *
   * ADR-0077 phrases its rule around the QUESTION A SURFACE ASKS, and this is
   * the wide one: work-browsing answers "what can I watch" and excludes the
   * entity kinds, and this excludes nothing. A front page that hid People would
   * be answering the other question without saying so, and CNCORE-67 is where
   * the other question gets its own surface.
   */
  list: publicProcedure
    .input(
      z.object({
        /**
         * How many entries to answer with. The caller may ask for fewer than
         * the default; it may not ask for more, because the ceiling is what
         * keeps one request's cost bounded by this app rather than by whoever
         * sends the request.
         */
        limit: z.number().int().positive().max(A_PAGE).default(A_PAGE),
      }),
    )
    .output(cataloguePublic)
    .handler(async ({ input, context }) => {
      // ADR-0045: every field the read path emits is NAMED, here as on the item
      // page. Never the query's row with fields removed.
      const { entries, total } = await readCatalogue(context.db, { limit: input.limit });
      return {
        entries: entries.map((entry) => ({
          id: entry.id,
          title: entry.title,
          // The LABEL under the name the read path gives it, exactly as
          // `item.get` does: `kind` is the reader's word for it wherever the
          // read path emits one, and the key stays below this seam (ADR-0045).
          kind: entry.kindLabel,
          isContainer: entry.isContainer,
        })),
        total,
      };
    }),
};
