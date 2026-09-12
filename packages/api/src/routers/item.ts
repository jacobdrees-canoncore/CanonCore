import {
  createItemByHand,
  findAttributionOwed,
  findItem,
  findItemKinds,
  findPlacementsInContainer,
  findPlacementsOfItem,
  findStatementsOfItem,
  ItemRefused,
  retitleItemByHand,
} from "@canoncore/db";
import { itemKindsPublic, itemPublic, itemWritten } from "@canoncore/schemas";
import { z } from "zod";

import { openProcedure, ownerProcedure } from "../index";

/**
 * A title as the catalogue will accept one from the owner's own hand.
 *
 * TRIMMED, AND EMPTY IS REFUSED. `title` declares no validation (ADR-0012) --
 * there is no such thing as a malformed title -- so this is not a content rule
 * arriving through the back door. It is the difference between a value and none
 * at all: an empty string projects onto `items.title` as an item whose heading
 * renders blank, where an item with NO title statement renders "Untitled item"
 * and is an honest state (ADR-0003). A form that submits an untouched field
 * would otherwise turn the second into the first.
 */
const titleByHand = z.string().trim().min(1, "A title cannot be empty.");

export const item = {
  /**
   * ADR-0005's seven kinds, so a create surface can OFFER them.
   *
   * OPEN RATHER THAN THE OWNER'S, because it is a read of a reference table and
   * ADR-0044 leaves reads open -- the demo shows the form's shape to a visitor
   * and the button behind it is what refuses them.
   *
   * READ OFF `item_kinds`, WHICH IS THE WHOLE REASON THIS PROCEDURE EXISTS. The
   * seven and their words are migration 1's and `CONTEXT.md` is binding on them
   * (CNCORE-83), so a list written into the form would be the closed set in a
   * second language -- and the page would go on offering `Time span` after a
   * migration renamed it.
   */
  kinds: openProcedure
    .output(itemKindsPublic)
    .handler(async ({ context }) => ({ kinds: await findItemKinds(context.db) })),

  /**
   * CREATING AN ITEM BY HAND (ADR-0003): no Provider record, no file, and a
   * complete entry.
   *
   * THE OWNER'S, because it writes (CNCORE-109, ADR-0043).
   *
   * `kind` IS `z.string()` AND NOT AN ENUM, which is the same decision `get`
   * makes about `id` one procedure down and for a related reason: the seven are
   * a reference table only a migration changes, so an enum here would be that
   * closed set written a THIRD time -- in SQL, in the form, and in this
   * contract, each free to drift. The database's own foreign key is what
   * decides, and a kind it does not hold is a refusal rather than a row.
   */
  create: ownerProcedure
    .input(
      z.object({
        kind: z.string(),
        title: titleByHand,
        /*
         * ADR-0004, and `CONTEXT.md`'s Container headword: whether an item is
         * one is STORED, never inferred from having members. That is what lets
         * an EMPTY container exist -- which is exactly what an owner makes
         * first, and then fills.
         *
         * NOT ADR-0009, WHICH THIS USED TO CITE. That record is multi-parent
         * membership and per-placement ordering; it says nothing about this
         * column. The same miscitation stood twice in `import.ts` and is
         * corrected there in the same change.
         */
        isContainer: z.boolean().default(false),
        /* ADR-0018: whether its ordering means anything. */
        isOrdered: z.boolean().default(false),
      }),
    )
    .output(itemWritten)
    .errors({
      BAD_REQUEST: { message: "No such kind of item, or an ordering that is not a container." },
    })
    .handler(async ({ input, context, errors }) => {
      /*
       * THE DATABASE DECIDES, AND ONLY ITS REFUSAL IS TRANSLATED HERE. Two
       * rules can refuse this write and both live in the schema: the foreign
       * key on `item_kinds`, and `items_ordered_implies_container` (migration
       * 1). A handler that re-checked either would be a third copy of a rule
       * the database already holds -- and the copy that goes stale.
       *
       * IT IS A BAD_REQUEST BECAUSE IT IS ONE: the caller named a kind that
       * does not exist, or asked for an ordering on something that holds
       * nothing. Left to propagate it is a 500, which tells a reader the server
       * is broken when what happened is that they asked for something.
       *
       * AND ONLY `ItemRefused` IS CAUGHT, WHICH REVIEW FOUND. A bare
       * `catch` here answered BAD_REQUEST for ANYTHING thrown, so a dead
       * connection pool told the owner their kind did not exist -- CNCORE-14's
       * mistake on `item.get` run backwards. `@canoncore/db` decides which
       * SQLSTATEs are the owner's doing, because that is a fact about the
       * schema; this decides what such a refusal is called over the wire.
       */
      try {
        const { itemId } = await createItemByHand(context.db, input);
        return { id: itemId };
      } catch (cause) {
        if (cause instanceof ItemRefused) throw errors.BAD_REQUEST({ cause });
        throw cause;
      }
    }),

  /**
   * EDITING A TITLE, which is the Owner's judgement beating a Provider's
   * ranking (ADR-0025).
   *
   * IT WRITES A STATEMENT, never the column: `items.title` is a projection of
   * whichever title statement wins (ADR-0014), so the owner's edit is a claim
   * with their name on it and the provider's stays standing beside it.
   *
   * NO `kind` HERE, AND THE ABSENCE IS ENFORCED A LAYER DOWN. ADR-0077's
   * `holds_work` is maintained on PLACEMENT write, so a kind changing after an
   * item is placed leaves every container holding it stale -- migration 11
   * refuses the change at the table rather than leaving this input schema as
   * the only thing standing between an owner and a corrupt flag.
   */
  retitle: ownerProcedure
    .input(z.object({ id: z.uuid(), title: titleByHand }))
    .output(itemWritten)
    .errors({ NOT_FOUND: { message: "No item at that id to retitle." } })
    .handler(async ({ input, context, errors }) => {
      const retitled = await retitleItemByHand(context.db, {
        itemId: input.id,
        title: input.title,
      });
      if (!retitled) throw errors.NOT_FOUND();
      return { id: input.id };
    }),

  get: openProcedure
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
