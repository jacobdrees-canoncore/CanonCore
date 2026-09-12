import {
  findAttributionOwed,
  findItem,
  findPlacementsInContainer,
  findPlacementsOfItem,
  findStatementsOfItem,
} from "@canoncore/db";
import { itemPublic } from "@canoncore/schemas";
import { z } from "zod";

import { publicProcedure } from "../index";

export const item = {
  get: publicProcedure
    /*
     * `z.string()` rather than `z.uuid()`, which is not a loosening of the
     * contract but a statement of where the contract lives. ANY string may be
     * asked about; whether it names anything is what the answer says, and
     * `findItem` is what decides -- alongside the tombstone and the alias, the
     * other two rules about what an id MEANS.
     *
     * `z.uuid()` here made the shape of an id a VALIDATION concern, and a
     * validation failure raises a BAD_REQUEST that is not among the errors
     * declared below. No caller can narrow on it, and the page rethrew it as a
     * 500 -- so a typo in a shared link read as a broken server rather than as
     * the missing item it is (CNCORE-14, ADR-0066).
     */
    .input(z.object({ id: z.string() }))
    .output(itemPublic)
    .errors({ NOT_FOUND: { message: "No item at that id, and no alias resolving to one." } })
    .handler(async ({ input, context, errors }) => {
      const found = await findItem(context.db, input.id);
      if (!found) throw errors.NOT_FOUND();

      // Read against the CANONICAL id rather than the one asked for, so an
      // alias reaching a merged-away item still answers with the survivor's
      // orderings and values rather than with none (ADR-0040).
      const [placements, holds, statements, attribution] = await Promise.all([
        findPlacementsOfItem(context.db, found.id),
        // ASKED UNCONDITIONALLY rather than only when `is_container`, because
        // the two would be the same question answered twice: nothing can be
        // placed in an item that is not a container, so a non-container's
        // answer is empty either way -- and a branch here would be a second
        // place for "what is a container" to be decided, free to disagree with
        // the column.
        findPlacementsInContainer(context.db, found.id),
        findStatementsOfItem(context.db, found.id),
        findAttributionOwed(context.db, found.id),
      ]);

      // ADR-0045: every field the read path emits is NAMED here. It is never
      // the stored row with fields removed, because a strip-list works until
      // someone adds a field and forgets -- so a column added to `items` later
      // is private until a line is written for it above and here.
      return {
        id: found.id,
        // THE LABEL RATHER THAN THE KEY, which is what `kind` means everywhere
        // the read path emits one: the catalogue listing answers in these words
        // too, and `CONTEXT.md` is binding on UI copy (CNCORE-83). The words are
        // read off `item_kinds` rather than mapped in TypeScript, so the
        // migration that owns them is the only place they are written.
        kind: found.kindLabel,
        title: found.title,
        sortName: found.sortName,
        releaseDate: found.releaseDate,
        isContainer: found.isContainer,
        isOrdered: found.isOrdered,
        placements: placements.map((placement) => ({
          id: placement.id,
          containerId: placement.containerId,
          containerTitle: placement.containerTitle,
          position: placement.position,
          placedBy: placement.placedBy,
        })),
        holds: holds.map((placement) => ({
          id: placement.id,
          title: placement.title,
          itemId: placement.itemId,
          position: placement.position,
        })),
        statements: statements.map((statement) => ({
          property: statement.property,
          value: statement.value,
          sourceKind: statement.sourceKind,
          sourceLabel: statement.sourceLabel,
        })),
        // Named field by field like the rest (ADR-0045). The source's own id and
        // the URL an owner typed for it are deliberately not among them.
        attribution: attribution.map((owed) => ({
          sourceLabel: owed.sourceLabel,
          notice: owed.notice,
          logo: owed.logo,
        })),
      };
    }),
};
