import {
  movePlacementByHand,
  PlacementRefused,
  placeItemByHand,
  removePlacementByHand,
  restorePlacementByHand,
} from "@canoncore/db";
import { placementWritten } from "@canoncore/schemas";
import { z } from "zod";

import { ownerProcedure } from "../index";

/**
 * THE OWNER'S OWN HAND ON A CONTAINER'S MEMBERSHIP (CNCORE-72), which is
 * what was ADR-0061's explicitly unbuilt half until this ticket built it.
 *
 * EVERY MUTATION HERE NAMES A PLACEMENT, never an item-and-container pair. That
 * is forced by Repeats being allowed (ADR-0009): a recap at position 1 and the
 * episode at position 5 are two placements of one item in one container, and
 * "remove this item from that container" cannot say which the owner meant.
 *
 * NOT `assertPlacement`, WHICH IS THE IMPORT PATH (ADR-0116). That one is
 * find-or-create on `(owner, container, item, position)`, so an owner placing an
 * item where a provider already placed it would get one row with a second source
 * attached -- corroborating the provider rather than making their own claim.
 *
 * ITS OWN ROUTER RATHER THAN MORE OF `item`, because a Placement is its own
 * thing in this model and `CONTEXT.md` is binding on the names: the reader's
 * words are "Members" and "Also appears in", and both are this.
 */
export const placement = {
  /**
   * PUTTING AN ITEM IN A CONTAINER, at a position or at none.
   *
   * `position` IS NULLABLE AND THAT IS NOT A CONVENIENCE. A member with no
   * position is still a member (migration 2, CONTEXT.md's Unplaced): the owner
   * can say "this belongs in here" without claiming where, which is the state a
   * sixth of the wiki's stories arrive in.
   */
  place: ownerProcedure
    .input(
      z.object({
        containerId: z.uuid(),
        itemId: z.uuid(),
        /*
         * `.nullable()` WITH A DEFAULT OF NULL, so a caller that says nothing
         * about position is placing an unplaced member rather than failing. An
         * optional-but-not-nullable field could not express the absence at all,
         * which is the one thing this column exists to record.
         */
        position: z.number().int().nullable().default(null),
      }),
    )
    .output(placementWritten)
    .errors({
      BAD_REQUEST: {
        /*
         * EVERY CAUSE THAT REACHES HERE, which is the contract this publishes
         * and the fallback if one ever arrives without a sentence of its own.
         * A CALLER normally reads the MATCHED cause instead -- see the handler.
         * The web surface is not yet such a caller: it renders its own copy and
         * discards this (CNCORE-275).
         */
        message:
          "That item is already in that container at that position, no such item or container, a container cannot hold itself or something it already sits inside, or that position is outside the range the catalogue can store.",
      },
    })
    .handler(async ({ input, context, errors }) => {
      /*
       * THE DATABASE DECIDES, AND ONLY ITS REFUSAL IS TRANSLATED HERE, which is
       * the rule `item.create` records at greater length. FOUR things can refuse
       * this write and all four live in the schema, which is the same list the
       * declared sentence above names (CNCORE-255):
       * `placements_container_item_position` -- the same item, in the same
       * container, at the same position, or with no position twice -- the
       * foreign key to `items`, `refuse_placement_cycle` (migration 15), and a
       * position the 32-bit column cannot hold. An earlier version of this
       * comment said "two", and the declared sentence named those same two.
       *
       * A REPEAT AT ONE POSITION IS THE OWNER ASKING FOR SOMETHING IMPOSSIBLE
       * rather than the server breaking, so it is a BAD_REQUEST. ADR-0009
       * licences a Repeat at DIFFERENT positions and this is where the
       * qualification bites (ADR-0116).
       */
      try {
        return { id: await placeItemByHand(context.db, input) };
      } catch (cause) {
        /*
         * THE MESSAGE IS PASSED, NOT JUST THE CAUSE. `ORPCError.toJSON`
         * serialises `{defined, code, status, message, data}` and NOTHING
         * ELSE, so a `cause` never crosses the wire and the caller would read
         * the declared sentence above -- which names four causes and settles
         * none of them. This is the rule ADR-0154 records after the same defect
         * one constraint over, and it names this procedure as a site still
         * using the dropped-sentence shape; `provider.beginImportRun` and
         * `settings.ts` pass `cause.message` for the same reason. The cause
         * still travels for the server's own chain.
         */
        if (cause instanceof PlacementRefused) {
          throw errors.BAD_REQUEST({ message: cause.message, cause });
        }
        throw cause;
      }
    }),

  /**
   * TAKING A MEMBER OUT OF ONE CONTAINER, leaving every other placement of that
   * item standing (ADR-0061).
   *
   * NO CONFIRMATION BELONGS IN FRONT OF THIS (ADR-0046). Removing a placement is
   * the most frequent editing act in a product built on multi-placement, and a
   * heavyweight dialog on the common action is what teaches people to dismiss
   * the dangerous one unread. It gets `restore` below instead.
   */
  remove: ownerProcedure
    .input(z.object({ id: z.uuid() }))
    .output(placementWritten)
    .errors({ NOT_FOUND: { message: "No placement at that id to remove." } })
    .handler(async ({ input, context, errors }) => {
      if (!(await removePlacementByHand(context.db, input.id))) throw errors.NOT_FOUND();
      return { id: input.id };
    }),

  /**
   * DRAGGING A MEMBER INTO A NEW PLACE (CNCORE-73), which is ADR-0116's own
   * subject and the fourth of the four mutations ADR-0061 left unbuilt.
   *
   * IT TAKES THE DELTA, NOT THE ORDERING. The placement that moved and the
   * siblings whose Position actually changed -- never the rebuilt list. Handing
   * it the whole ordering would rewrite every Placement in the container on
   * every drop, so a position a PROVIDER asserted would come back
   * owner-asserted and the disagreement it might have had would be gone
   * (ADR-0017). The arithmetic that produces the delta is the caller's, and
   * ADR-0116 accepts that cost by name.
   *
   * `containerId` IS THE DESTINATION AND IT MAY DIFFER FROM WHERE THE PLACEMENT
   * SITS. That is ADR-0116's stated shape -- "its new container and its new
   * position" -- and it is what makes a placement cycle expressible at all,
   * which is why migration 15 refuses one in the database rather than leaving
   * it to a drag's drop targets.
   */
  move: ownerProcedure
    .input(
      z.object({
        id: z.uuid(),
        containerId: z.uuid(),
        /* Nullable with a default, for `place`'s reason: an Unplaced member. */
        position: z.number().int().nullable().default(null),
        /**
         * WHO SHIFTED, AND ONLY THEM. Empty is ordinary rather than suspicious:
         * a placement dragged into a gap nothing else occupies moves alone.
         */
        siblings: z
          .array(z.object({ id: z.uuid(), position: z.number().int().nullable() }))
          .default([]),
      }),
    )
    .output(placementWritten)
    .errors({
      NOT_FOUND: { message: "No placement at that id to move." },
      BAD_REQUEST: {
        /*
         * ALL FIVE, which is one more than `place` has: a move can also name a
         * placement outside its destination. Contract and fallback both; a
         * caller normally reads the matched cause -- see the handler.
         */
        message:
          "That item is already in that container at that position, no such item or container, a container cannot hold itself or something it already sits inside, that position is outside the range the catalogue can store, or that move named a placement this container does not hold.",
      },
    })
    .handler(async ({ input, context, errors }) => {
      /*
       * TWO ANSWERS, AND THEY ARE DIFFERENT THINGS. A placement that is not
       * there is NOT_FOUND -- a stale page, a shared link -- and a move the
       * catalogue refuses is BAD_REQUEST. Neither is a fault, and `by-hand.ts`
       * is where that narrowing is argued.
       *
       * FIVE CAUSES REACH THAT BAD_REQUEST, and this list is the same one the
       * declared sentence above names (CNCORE-255): a Repeat landing on a tuple
       * another copy holds (ADR-0009), an item or container that is not there,
       * a cycle (migration 15), a position the 32-bit column cannot hold, and a
       * placement outside the destination container. An earlier version of this
       * comment named the first and third only, which is how the declared
       * sentence came to name one of five and nobody noticed.
       */
      try {
        if (!(await movePlacementByHand(context.db, input))) throw errors.NOT_FOUND();
        return { id: input.id };
      } catch (cause) {
        // THE MESSAGE IS PASSED, NOT JUST THE CAUSE -- `place`'s reason above.
        if (cause instanceof PlacementRefused) {
          throw errors.BAD_REQUEST({ message: cause.message, cause });
        }
        throw cause;
      }
    }),

  /**
   * THE UNDO ADR-0046 REQUIRES, which is what a removal gets in place of a
   * confirmation.
   *
   * THE PLACEMENT COMES BACK WITH ITS POSITION AND ITS ORIGIN, because the
   * removal tombstoned only the placement: `placement_sources` was left
   * standing, so nothing has to be reconstructed here (ADR-0017).
   */
  restore: ownerProcedure
    .input(z.object({ id: z.uuid() }))
    .output(placementWritten)
    .errors({ NOT_FOUND: { message: "No placement at that id to restore." } })
    .handler(async ({ input, context, errors }) => {
      if (!(await restorePlacementByHand(context.db, input.id))) throw errors.NOT_FOUND();
      return { id: input.id };
    }),
};
