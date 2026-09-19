import {
  annotateItemByHand,
  createItemByHand,
  findAttributionOwed,
  findGroupsOfItem,
  findItem,
  findItemKinds,
  findNoteOfItem,
  findPlacementsInContainer,
  findPlacementsOfItem,
  findStatementsOfItem,
  ItemRefused,
  retitleItemByHand,
  sortItemAsByHand,
} from "@canoncore/db";
import { itemKindsPublic, itemPublic, itemWritten, ownerNote } from "@canoncore/schemas";
import { z } from "zod";

import { openProcedure, ownerProcedure } from "../index";
import { A_PAGE, aCursor } from "./listing";

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

/**
 * A note as the catalogue will accept one from the owner's own hand.
 *
 * TRIMMED, AND EMPTY IS ACCEPTED, which is the opposite of `titleByHand` one
 * line up and not an inconsistency. An empty title projects onto `items.title`
 * as a heading that renders blank, where an item with NO title statement
 * renders "Untitled item" -- two different states, so the empty one has to be
 * refused. A note projects onto nothing, so an empty note and an absent one are
 * the same claim: the owner says nothing about this item. That makes `''` the
 * REMOVAL, and it is why removing a note needs no procedure of its own.
 *
 * SO A NOTE OF NOTHING BUT WHITESPACE REMOVES IT TOO, which review asked to
 * have said out loud rather than left to be discovered. The trim is what makes
 * that true, and it is the right answer: a box holding three spaces is a box
 * the owner cleared. It reaches only the ENDS of the value -- the line breaks
 * an owner typed inside a note are theirs, and the page renders them.
 *
 * NO LENGTH CAP. `note` is `text` and declares no validation (ADR-0012) --
 * there is no such thing as a malformed note, and a ceiling nobody asked for is
 * a rule the owner meets by surprise on the one note that matters.
 */
const noteByHand = z.string().trim();

/**
 * A sort name as the catalogue will accept one from the owner's own hand.
 *
 * TRIMMED, AND EMPTY IS ACCEPTED, which puts it with `noteByHand` above rather
 * than with `titleByHand` at the top of this file. The test is what the empty
 * value LEAVES, and it is different in all three cases: an empty title leaves a
 * heading that renders blank where an absent one honestly reads "Untitled
 * item", so it is refused; an empty note and an absent one are the same claim,
 * so it is the removal; and an empty sort name leaves the one
 * `derived:sort-name-v1` computed from the title (CNCORE-173), so it is the
 * owner handing the item back to the computation.
 *
 * SO A FIELD OF NOTHING BUT WHITESPACE HANDS IT BACK TOO, which the trim is
 * what makes true. A box holding three spaces is a box the owner cleared, and
 * a sort name of `"   "` would file the item ahead of the entire catalogue.
 *
 * NO CONTENT RULE AND NO LENGTH CAP. `sort_name` declares no validation
 * (ADR-0012) -- there is no such thing as a malformed one, and the owner's
 * reason for filing something oddly is theirs.
 */
const sortNameByHand = z.string().trim();

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

  /**
   * CORRECTING WHERE AN ITEM FILES (CNCORE-173), which is `retitle` above
   * applied to the catalogue's other projected column.
   *
   * IT WRITES A STATEMENT, never the column, for `retitle`'s reason: a sort
   * name is a claim with a source on it (ADR-0014, ADR-0071), and the
   * computation's claim stays standing beside the Owner's rather than being
   * overwritten by it.
   *
   * `sortNameByHand` ACCEPTS EMPTY WHERE `titleByHand` REFUSES IT, which is the
   * one asymmetry on this router and is argued at that schema.
   */
  sortAs: ownerProcedure
    .input(z.object({ id: z.uuid(), sortName: sortNameByHand }))
    .output(itemWritten)
    .errors({ NOT_FOUND: { message: "No item at that id to sort." } })
    .handler(async ({ input, context, errors }) => {
      const sorted = await sortItemAsByHand(context.db, {
        itemId: input.id,
        sortName: input.sortName,
      });
      if (!sorted) throw errors.NOT_FOUND();
      return { id: input.id };
    }),

  /**
   * THE OWNER'S OWN WORDS ABOUT AN ITEM (ADR-0096), and the one thing on this
   * router that both writes AND removes through one door.
   *
   * `''` REMOVES IT -- `noteByHand` above is where that is argued, and a second
   * procedure would be a second answer to "what does the owner say about this
   * item".
   *
   * THE OWNER'S, AND THE DATABASE AGREES SEPARATELY. `ownerProcedure` is what
   * stops a visitor reaching this (CNCORE-109), and migration 12 declares the
   * property assertable by a source of kind `owner` -- so a caller who got past
   * this line with a provider's source would still be refused at the table.
   * Neither is redundant: this one decides who may ASK, and that one decides
   * what a claim may be FILED UNDER.
   */
  annotate: ownerProcedure
    .input(z.object({ id: z.uuid(), note: noteByHand }))
    .output(itemWritten)
    .errors({ NOT_FOUND: { message: "No item at that id to annotate." } })
    .handler(async ({ input, context, errors }) => {
      const annotated = await annotateItemByHand(context.db, {
        itemId: input.id,
        note: input.note,
      });
      if (!annotated) throw errors.NOT_FOUND();
      return { id: input.id };
    }),

  /**
   * READING ONE BACK, AND IT IS THE OWNER'S RATHER THAN OPEN -- the only read on
   * this router that is.
   *
   * ADR-0044 leaves reads open and ADR-0072 gives a visitor everything on the
   * page, and ADR-0045 is the sentence that carves this out: the public read
   * path "carries no internal ids, no owner id and NO NOTES". So the note cannot
   * ride on `item.get`, which anyone may call -- a field there would be public
   * by construction, and one emitted only sometimes would make the enumeration
   * that record exists for conditional.
   *
   * `null` FOR AN ITEM WITH NO NOTE, AND FOR A WELL-FORMED ID THAT ADDRESSES
   * NOTHING. That is the posture ADR-0066 gives `findItem` and is right here for
   * a reason of its own: an owner asking for the note on a deleted item and one
   * asking about an item they have said nothing about want the same page, and
   * neither is an error. `item.get` is what answers NOT_FOUND for a missing
   * item, once, where a page can act on it.
   *
   * WELL-FORMED IS THE QUALIFICATION AND IT IS LOAD-BEARING -- review read the
   * unqualified sentence and asked what a malformed id gets. It gets a
   * BAD_REQUEST from the input schema below, which is the right answer here for
   * the reason the next paragraph gives, and is why this sentence says which
   * ids it is about rather than leaving the claim to be tested.
   *
   * `z.uuid()` HERE AND `z.string()` ON `get`, WHICH IS NOT THE INCONSISTENCY IT
   * LOOKS LIKE -- review raised it, and the difference is who does the asking.
   * CNCORE-14's argument is about an id A READER TYPED OR SHARED: `/items/<id>`
   * is reached with whatever is in the URL, so whether a string can be an
   * identity has to be an ANSWER rather than a validation failure. Nothing types
   * an id at this procedure. The page calls it with `item.id` -- the CANONICAL
   * id `item.get` just answered with, an alias already resolved (ADR-0040) --
   * so the only caller that can present a malformed one is an RPC client
   * composing a request by hand, and "that is not an id" is the honest answer to
   * give it. It also matches `annotate` and `retitle`, which take `z.uuid()` for
   * the same reason: `findNoteOfItem` compares against a Postgres `uuid` column,
   * where a non-uuid is error 22P02 rather than an empty result.
   */
  note: ownerProcedure
    .input(z.object({ id: z.uuid() }))
    .output(ownerNote.nullable())
    .handler(async ({ input, context }) => findNoteOfItem(context.db, input.id)),

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
    .input(
      z.object({
        id: z.string(),
        /*
         * THE MEMBERS LISTING'S CURSOR (ADR-0119, CNCORE-89), and the one input
         * on this procedure that is not about which item is being asked for.
         *
         * IT SITS ON `item.get` RATHER THAN ON A LISTING PROCEDURE OF ITS OWN,
         * because a Container IS an Item (ADR-0004) and its page is the Item
         * page: a `container.members` would be one thing at two addresses, which
         * is the case ADR-0066's canonical link relation exists to collapse.
         * The three listings that ARE their surface have the whole query for a
         * cursor; this one and "Also appears in" both ride beside the item they
         * are a listing OF.
         */
        /*
         * WHICH ORIGIN "ALSO APPEARS IN" IS NARROWED TO (ADR-0066, CNCORE-129),
         * and it sits ahead of the two cursors because that is the order the
         * address is spelled in -- `via`, `placed`, `after`, `placedAfter`.
         *
         * IT IS THE QUESTION RATHER THAN A FILTER OVER THE ANSWER, which is the
         * whole of this ticket. `?placed=` reached the surface and ran over the
         * rows the cap had handed it, so the size it reported, the cap it met
         * and the walk it offered were the WHOLE listing's. Asked here they are
         * the narrowing's own.
         *
         * `z.string()` RATHER THAN THE FOUR SOURCE KINDS, for the reason `id`
         * above gives: whether a value names anything is what the ANSWER says.
         * A kind nothing was placed by narrows to an empty listing, which is
         * ADR-0066's rule for a non-identifying parameter that is out of scope
         * -- and a `z.enum` here would make it a BAD_REQUEST this procedure does
         * not declare, so a stale link would read as a broken server.
         */
        placed: z.string().optional(),
        after: aCursor,
        /*
         * THE MEMBERS LISTING'S STEP BACK (CNCORE-174): the first member of the
         * page a reader is on, and the answer is the page before it.
         */
        before: aCursor,
        /*
         * "ALSO APPEARS IN"'S OWN CURSOR (ADR-0119, CNCORE-125), and the second
         * one on this procedure because there are two independent listings on
         * one item page: `after` walks what a container HOLDS, and this walks
         * every ordering the item SITS IN.
         *
         * NAMED FOR THE LISTING RATHER THAN BEING A SECOND `after`, because one
         * page has to spell both at once. `?placed=` already narrows this same
         * list to one origin (ADR-0066), so `placed` and `placedAfter` read as
         * the pair they are -- where a bare second `after` could not be told
         * from the first. The bare word stays with the listing that already
         * emitted it: re-spelling that one would give every link CNCORE-89 has
         * already put into the world a second spelling of itself, which is the
         * one thing ADR-0066's fixed order exists to prevent.
         */
        placedAfter: aCursor,
        /*
         * "ALSO APPEARS IN"'S STEP BACK (CNCORE-174), named for the same pair
         * as its cursor forward and for the same reason: one page spells both
         * Listings' positions at once.
         */
        placedBefore: aCursor,
      }),
    )
    .output(itemPublic)
    .errors({ NOT_FOUND: { message: "No item at that id, and no alias resolving to one." } })
    .handler(async ({ input, context, errors }) => {
      const found = await findItem(context.db, input.id);
      if (!found) throw errors.NOT_FOUND();

      // Read against the CANONICAL id rather than the one asked for, so an
      // alias reaching a merged-away item still answers with the survivor's
      // orderings and values rather than with none (ADR-0040).
      const [placements, holds, groups, statements, attribution] = await Promise.all([
        /*
         * CAPPED AND WALKED SINCE CNCORE-125, and it was the LAST listing in
         * the app that was neither. It answered every live placement, which
         * ADR-0119's first sentence forbids. The cap is `A_PAGE`, the same
         * ceiling the other four serve, and the caller cannot raise it.
         */
        findPlacementsOfItem(context.db, found.id, {
          limit: A_PAGE,
          after: input.placedAfter,
          before: input.placedBefore,
          // NARROWED IN THE QUERY SINCE CNCORE-129, so the cap above is the cap
          // ON THE NARROWING: a reader who has chosen one origin walks that
          // listing rather than the hundred rows the whole one starts with.
          placedBy: input.placed,
        }),
        // ASKED UNCONDITIONALLY rather than only when `is_container`, because
        // the two would be the same question answered twice: nothing can be
        // placed in an item that is not a container, so a non-container's
        // answer is empty either way -- and a branch here would be a second
        // place for "what is a container" to be decided, free to disagree with
        // the column.
        /*
         * CAPPED AND WALKED SINCE CNCORE-89. It answered every live placement,
         * which ADR-0119's first sentence forbids -- and `browse` imports a
         * whole category in one call, which ADR-0077 measures at 1,049 stories.
         * The cap is `A_PAGE`, the same ceiling the other four listings serve,
         * and the caller cannot raise it.
         */
        findPlacementsInContainer(context.db, found.id, {
          limit: A_PAGE,
          after: input.after,
          before: input.before,
        }),
        // WHICH SCOPES THIS ITEM IS IN (ADR-0010, story 38). Uncapped, and
        // deliberately: a Group is a scope the Owner drew by hand, so this list
        // is the number of universes they curate rather than a function of the
        // corpus -- which is the same argument `findGroups` makes for not being
        // a Listing.
        findGroupsOfItem(context.db, found.id),
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
        // THE LISTING AND NOT ONLY ITS ROWS (ADR-0045, ADR-0119), exactly as
        // `holds` below: what this page carries, how many orderings there are,
        // and where to carry on from. The three travel together because a
        // surface handed only the first would report the cap as every ordering
        // the item sits in -- and multi-placement is the product's claim.
        placements: {
          rows: placements.rows.map((placement) => ({
            id: placement.id,
            containerId: placement.containerId,
            containerTitle: placement.containerTitle,
            position: placement.position,
            placedBy: placement.placedBy,
            // WHO SAYS SO, beside what SORT of thing said it (CNCORE-121). The
            // filter over this list reads the kind; telling a Repeat from two
            // providers disagreeing needs the names.
            assertedBy: placement.assertedBy,
          })),
          total: placements.total,
          continuesAfter: placements.continuesAfter,
          continuesBefore: placements.continuesBefore,
          /*
           * WHAT THIS LISTING CAN BE NARROWED TO (CNCORE-129), which the three
           * above cannot answer: they describe the listing as ASKED, and after a
           * narrowing that is one origin wide. A surface deriving its chips from
           * the rows would offer only the origin the reader already chose.
           */
          everyPlacedBy: placements.everyPlacedBy,
        },
        // THE LISTING AND NOT ONLY ITS ROWS (ADR-0045, ADR-0119): what this page
        // carries, how much the container holds, and where it carries on. The
        // three travel together because a surface handed only the first would
        // report the cap as the whole ordering.
        holds: {
          rows: holds.rows.map((placement) => ({
            id: placement.id,
            title: placement.title,
            itemId: placement.itemId,
            position: placement.position,
            assertedBy: placement.assertedBy,
          })),
          total: holds.total,
          continuesAfter: holds.continuesAfter,
          continuesBefore: holds.continuesBefore,
        },
        // ADR-0045 names every field, so the scopes are mapped rather than
        // spread: `findGroupsOfItem` answers exactly `{ id, name }` today and a
        // column added to `groups` later is private until a line is written for
        // it here and in the schema.
        groups: groups.map((group) => ({ id: group.id, name: group.name })),
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
