import {
  createGroupByHand,
  deleteGroupByHand,
  findGroups,
  GroupRefused,
  putItemInGroupByHand,
  renameGroupByHand,
  takeItemOutOfGroupByHand,
} from "@canoncore/db";
import { groupsPublic, groupWritten } from "@canoncore/schemas";
import { z } from "zod";

import { openProcedure, ownerProcedure } from "../index";

/**
 * A name as the catalogue will accept one from the Owner's own hand.
 *
 * TRIMMED, AND EMPTY IS REFUSED, which puts it with `titleByHand` on the item
 * router rather than with the note and the sort name. The test is what the
 * empty value LEAVES: an unnamed Group is a row in a picker with nothing to
 * pick, and there is no honest second state for it to fall back to the way an
 * absent title falls back to "Untitled item" and an absent sort name falls back
 * to the computation. A form submitted with an untouched box is the Owner
 * having chosen nothing, and this is where that is said.
 *
 * NO CONTENT RULE AND NO LENGTH CAP. ADR-0010 makes the name the Owner's own
 * words for their own view, so there is no such thing as a malformed one -- and
 * a ceiling nobody asked for is a rule met by surprise on the one scope that
 * matters.
 */
const nameByHand = z.string().trim().min(1, "A Group needs a name.");

/**
 * THE OWNER'S OWN HAND ON THEIR BROWSING SCOPES (CNCORE-178), which is what
 * ADR-0010 decided and nothing had built.
 *
 * ITS OWN ROUTER RATHER THAN MORE OF `item`, because a Group is its own thing
 * in this model: it is what a view is NARROWED TO, and `CONTEXT.md` is binding
 * on the name. Putting the scope on the item router would make it read as a
 * property of an Item, which is the column ADR-0010 refuses wearing a different
 * coat.
 *
 * READING IS OPEN AND WRITING IS THE OWNER'S (ADR-0044, ADR-0072, CNCORE-109).
 * Which scopes exist is part of the catalogue, so a visitor to the demo sees
 * them and the buttons are what refuse them.
 */
export const group = {
  /**
   * EVERY GROUP THE OWNER CAN NARROW TO, in their own alphabet.
   *
   * THE SURFACE THAT PICKS A SCOPE READS THIS (CNCORE-179), and so does the one
   * that offers an Item a Group to join. Ordered in the db layer rather than
   * here, because an order decided at the caller is an order each caller
   * decides differently.
   */
  list: openProcedure
    .output(groupsPublic)
    .handler(async ({ context }) => ({ groups: await findGroups(context.db) })),

  /**
   * THE OWNER DRAWING A SCOPE, named in their own words (stories 30 and 31).
   *
   * NO `assertGroup` BESIDE IT, which is the difference from a Placement. A
   * Provider asserts membership of a Container and two Providers can agree
   * about one; nobody but the Owner ever says what this catalogue's scopes are,
   * so there is no second Source here and no find-or-create to write (ADR-0010,
   * ADR-0017).
   */
  create: ownerProcedure
    .input(z.object({ name: nameByHand }))
    .output(groupWritten)
    .handler(async ({ input, context }) => ({
      id: await createGroupByHand(context.db, input),
    })),

  /**
   * THE OWNER CORRECTING A NAME THEY CHOSE BADLY (story 32).
   *
   * NOT A STATEMENT, WHICH IS THE DIFFERENCE FROM `item.retitle`. A title is a
   * claim Sources make and disagree about, so editing one is the Owner's Source
   * asserting beside a Provider's and the disagreement stays on the page
   * (ADR-0012, ADR-0017). Nobody but the Owner ever says what a scope is called,
   * so a rename REPLACES rather than out-ranking anything, and the old name is
   * simply gone.
   */
  rename: ownerProcedure
    .input(z.object({ id: z.uuid(), name: nameByHand }))
    .output(groupWritten)
    .errors({ NOT_FOUND: { message: "No Group at that id to rename." } })
    .handler(async ({ input, context, errors }) => {
      if (!(await renameGroupByHand(context.db, input))) throw errors.NOT_FOUND();
      return { id: input.id };
    }),

  /**
   * PUTTING AN ITEM IN A SCOPE (stories 35 and 36), and the same Item in
   * several of them.
   *
   * IT NAMES THE GROUP AND THE ITEM, where every mutation on the placement
   * router names a PLACEMENT instead. That is not an inconsistency: ADR-0009
   * licences a Repeat, so a Container and an Item name one row or two and only
   * the Placement can say which the Owner meant. A Group has no Position, so
   * there is no Repeat and the pair names exactly one row.
   *
   * ASKING TWICE IS NOT AN ERROR. `putItemInGroupByHand` meets the unique
   * constraint rather than raising on it, so a second tab, a double submit and
   * a page that had gone stale all leave the Owner with what they asked for.
   */
  put: ownerProcedure
    .input(z.object({ groupId: z.uuid(), itemId: z.uuid() }))
    .output(groupWritten)
    .errors({
      BAD_REQUEST: { message: "No such Group, or no such Item." },
    })
    .handler(async ({ input, context, errors }) => {
      /*
       * THE DATABASE DECIDES, AND ONLY ITS REFUSAL IS TRANSLATED HERE, which is
       * the rule `item.create` and `placement.place` both record: a Group or an
       * Item that is not there is the Owner asking for something impossible,
       * and everything else goes on being a fault.
       */
      try {
        await putItemInGroupByHand(context.db, input);
        return { id: input.groupId };
      } catch (cause) {
        if (cause instanceof GroupRefused) throw errors.BAD_REQUEST({ cause });
        throw cause;
      }
    }),

  /**
   * TAKING AN ITEM BACK OUT OF ONE SCOPE (story 37), leaving every other scope
   * it sits in standing.
   *
   * NO CONFIRMATION BELONGS IN FRONT OF THIS (ADR-0046), for the reason
   * `placement.remove` gets none: it is an ordinary editing act, and a
   * heavyweight dialog on the common action teaches people to dismiss the
   * dangerous one unread. Putting the Item back is one click and comes to the
   * same row under the same id, which is the undo that record asks for.
   */
  take: ownerProcedure
    .input(z.object({ groupId: z.uuid(), itemId: z.uuid() }))
    .output(groupWritten)
    .errors({ NOT_FOUND: { message: "That Item is not in that Group." } })
    .handler(async ({ input, context, errors }) => {
      if (!(await takeItemOutOfGroupByHand(context.db, input))) throw errors.NOT_FOUND();
      return { id: input.groupId };
    }),

  /**
   * DELETING A SCOPE THE OWNER NO LONGER USES (story 33), WHICH TOUCHES NO ITEM
   * (story 34).
   *
   * THE ONE MUTATION HERE THAT WOULD DESERVE A CONFIRMATION, and ADR-0046 is
   * where that is decided rather than here: a Group is where the Owner's
   * curation of a scope lives, and deleting one is not the frequent act
   * `take` is. What makes it safe rather than merely warned about is that it
   * takes nothing with it -- every Item is exactly where it was, in every
   * Ordering and every other Group.
   */
  delete: ownerProcedure
    .input(z.object({ id: z.uuid() }))
    .output(groupWritten)
    .errors({ NOT_FOUND: { message: "No Group at that id to delete." } })
    .handler(async ({ input, context, errors }) => {
      if (!(await deleteGroupByHand(context.db, input.id))) throw errors.NOT_FOUND();
      return { id: input.id };
    }),
};
