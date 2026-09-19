"use server";

import { appRouter } from "@canoncore/api/routers";
import { call, isDefinedError } from "@orpc/server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { whatTheProcedureAnswered } from "@/answer";
import { whatTheFormCarries, whatTheFormRepeats } from "@/form";
import { callerContext } from "@/session";

/**
 * CREATING AND EDITING AN ITEM BY HAND, as Server Actions (CNCORE-71).
 *
 * THE PROCEDURE IS WRITTEN ONCE AND EXPOSED TWICE. `item.create` and
 * `item.retitle` carry their own Zod input in the router, and these two actions
 * are a second door onto them -- `/api/rpc` is the first, and it comes free. So
 * the rule about what a write accepts lives in one place, and the no-browser
 * seam this ticket asks for costs nothing extra.
 *
 * NOT `createFormAction`, WHICH THE TICKET NAMED AND WHICH DOES NOT EXIST. The
 * real API is `createServerFormFunction`, it lives in `@orpc/next`, and it is a
 * **v2** API -- this repo is on `@orpc/server`'s 1.x line. Adopting it would
 * mean a new dependency AND a major-version move, for a job the pattern below
 * already does: `import/actions.ts` and `login/actions.ts` are both this
 * shape, and a second way to write an action is a second thing to keep true.
 *
 * THEY NEED NO JAVASCRIPT. React posts a form bound to a server action as an
 * ordinary `multipart/form-data` request when no script has loaded, which is
 * why these surfaces are asserted at the page-over-HTTP seam with no browser.
 *
 * A FORM FIELD IS INPUT, whoever rendered the form, so everything below is read
 * through `whatTheFormCarries` rather than trusted -- which is where `FormData.get` answering
 * `File | string | null` is dealt with, once, for every action in this app
 * (CNCORE-123). An action that cannot read a field it needs writes nothing and
 * lets the page it was posted to render again.
 */

/**
 * What the create form carries.
 *
 * `holds` IS ONE FIELD FOR TWO COLUMNS, and that is the form refusing to
 * compose a request the database would reject. `items_ordered_implies_container`
 * (migration 1) makes three of the four `(isContainer, isOrdered)` combinations
 * legal, so the form offers three radios and this maps them back -- an owner
 * cannot ask for an ordering on something that holds nothing, because there is
 * no control that says it.
 *
 * THE DEFAULT IS `nothing` RATHER THAN A THROW. A radio group always submits
 * one of its values from a browser, but this is `FormData` from anywhere, and
 * an absent field means "no container" far more usefully than it means "fail".
 */
const newItem = z.object({
  kind: z.string().min(1),
  title: z.string(),
  holds: z.enum(["nothing", "unordered", "ordered"]).catch("nothing"),
});

export async function createItem(form: FormData): Promise<void> {
  const carried = whatTheFormCarries(form, newItem);
  if (carried === undefined) return;

  const { holds, ...named } = carried;
  const input = {
    ...named,
    isContainer: holds !== "nothing",
    isOrdered: holds === "ordered",
  };

  const { answered } = await whatTheProcedureAnswered(
    call(appRouter.item.create, input, { context: await callerContext() }),
  );
  if (answered === undefined) return;

  /*
   * TO THE ITEM ITSELF, which is the one thing an owner who has just made one
   * wants. ADR-0066 makes `/items/<id>` the item's identity, so this is its
   * address rather than a view of it.
   *
   * THE ADDRESS IS HAND-BUILT, AND ADR-0109 NAMES THAT CLASS: Next prefixes
   * `<Link>`, `<Form>` and `router.push()` under a `basePath` and `redirect()`
   * measurably does not. No `basePath` is set, so this is correct today; it
   * joins `login/actions.ts`'s two redirects and the item page's canonical as
   * what has to be revisited on the day a host imposes one.
   *
   * IT IS ALSO WHY THIS ACTION NEEDS NO RETURN VALUE. An action's return
   * reaches a page only through `useActionState`, a client hook with nothing to
   * give when no script has loaded -- so post/redirect/get is what reports the
   * outcome here, and it stops a refresh making a second item as well.
   */
  redirect(`/items/${answered.id}`);
}

/** What the edit form carries: which item, and what the owner now calls it. */
const editedTitle = z.object({ id: z.string(), title: z.string() });

/**
 * Editing a title, leaving the page to report it.
 *
 * NO REDIRECT, WHICH IS THE DIFFERENCE FROM `createItem` ABOVE. This form posts
 * to the item's own address, so the response to the POST is that page rendered
 * again -- the new title is in the HTML that comes back, from the same read the
 * page always does. A redirect would be a second request for a page the server
 * is already rendering.
 *
 * `refresh()` IS FOR THE HALF THIS APP'S TEST SEAM CANNOT SEE. With no script
 * loaded the sentence above is the whole story. With script loaded there is a
 * CLIENT router cache holding the page the owner is looking at, and Next's own
 * types say what clears it: `refresh` "allows you to refresh client cache from
 * server actions ... as dynamic data can be cached on the client". The
 * page-over-HTTP seam replays forms as a script-less browser, so it would go on
 * passing while a real browser showed the old title -- which is exactly why the
 * ticket named this call rather than leaving it to be noticed.
 *
 * NOT `revalidatePath` AND NOT `updateTag`: nothing here is cached on the
 * SERVER (ADR-0117 renders per request) and Cache Components are off, so both
 * would be clearing a cache this app does not have.
 */
export async function retitleItem(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, editedTitle);
  if (input === undefined) return;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.item.retitle, input, { context: await callerContext() }),
  );
  if (refused) return;
  refresh();
}

/** What the sort-name form carries: which item, and where the owner files it. */
const editedSortName = z.object({ id: z.string(), sortName: z.string() });

/**
 * Correcting where an item sorts (CNCORE-173), and CLEARING THE BOX HANDS IT
 * BACK to the computation.
 *
 * ONE FORM FOR CORRECTING AND FOR UNDOING, and there is no second button for
 * the undo, because the model has no second operation for one to call -- which
 * is `annotateItem` below's argument reaching a second field. A Reset control
 * would either do exactly what saving an empty box does, or mean something
 * nobody has defined.
 *
 * NO REDIRECT, and `refresh()` for the reason `retitleItem` above gives: this
 * form posts to the item's own address, so the response to the POST is that
 * page rendered again, and the call is what clears the CLIENT router cache the
 * page-over-HTTP seam cannot see.
 */
export async function sortItemAs(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, editedSortName);
  if (input === undefined) return;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.item.sortAs, input, { context: await callerContext() }),
  );
  if (refused) return;
  refresh();
}

/** What the note form carries: which item, and what the owner now says about it. */
const editedNote = z.object({ id: z.string(), note: z.string() });

/**
 * Writing, editing and REMOVING the Owner's note about an item (ADR-0096), on
 * one action, because all three are one claim: what the owner now says about
 * this item.
 *
 * CLEARING THE BOX IS THE REMOVAL, and there is no second button for it,
 * because the model has no second operation for one to call: a Remove control
 * would either do exactly what saving an empty box does, or mean something
 * nobody has defined. ADR-0096 carries why. The owner is offered one control
 * that says what they think, including when that is nothing.
 *
 * NO REDIRECT, and `refresh()` for the same reason `retitleItem` above gives:
 * this form posts to the item's own address, so the response IS the page
 * rendered again, and the call is what clears the CLIENT router cache that the
 * page-over-HTTP seam cannot see.
 */
export async function annotateItem(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, editedNote);
  if (input === undefined) return;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.item.annotate, input, { context: await callerContext() }),
  );
  if (refused) return;
  refresh();
}

/**
 * What the place form carries: which container, which item, and where.
 *
 * `position` IS A STRING THAT MAY BE EMPTY, and that is the form expressing an
 * absence rather than failing to parse one. A member with no position is still a
 * member (migration 2, CONTEXT.md's Unplaced), and an empty number field submits
 * `""` -- so the empty string is how an owner says "in here, I am not saying
 * where", and the procedure is handed `null` for it.
 *
 * ANYTHING ELSE UNPARSEABLE IS ALSO `null` RATHER THAN A THROW, for the reason
 * `newItem` above gives about its radio group: this is `FormData` from anywhere,
 * and `z.coerce.number()` on a non-numeric string yields `NaN`, which is not a
 * position either.
 */
/**
 * A POSITION, AS A FIELD: a number, or an absence.
 *
 * SHARED BY PLACING AND BY REORDERING, because it is one field with one
 * reading and two forms carry it. Written twice it would be two chances for
 * "what an empty position box means" to drift.
 *
 * AN EMPTY STRING IS THE ABSENCE, and that is the form expressing something the
 * model has rather than failing to parse: a member with no position is still a
 * member (migration 2, CONTEXT.md's Unplaced), and an empty number field
 * submits `""`.
 *
 * ANYTHING ELSE UNPARSEABLE IS ALSO `null` RATHER THAN A THROW, for `newItem`'s
 * reason about its radio group: this is `FormData` from anywhere, and
 * `Number("banana")` is `NaN`, which is not a position either.
 *
 * AND A FIELD THAT IS NOT TEXT AT ALL READS AS `null` TOO (CNCORE-123). A part
 * sent with a filename reaches `whatTheFormCarries` as "not given", so refusing
 * the whole write over it would be this field's own rule broken by the shape of
 * the request rather than by its content.
 */
const positionField = z
  .string()
  .transform((typed) => (typed.trim() === "" ? null : Number(typed)))
  .transform((typed) => (typed === null || Number.isInteger(typed) ? typed : null))
  .catch(null);

const placedMember = z.object({
  containerId: z.string(),
  itemId: z.string(),
  position: positionField,
});

/**
 * The owner putting an item in a container (CNCORE-72).
 *
 * NO REDIRECT, which is `retitleItem`'s reason: this form posts to the
 * container's own address, so the response to the POST is that page rendered
 * again and the new member is in the HTML that comes back.
 */
export async function placeItemInContainer(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, placedMember);
  if (input === undefined) return;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.placement.place, input, { context: await callerContext() }),
  );

  /*
   * A REFUSAL COMES BACK AS A SENTENCE, NOT A 500. ADR-0116: "a UI that permits
   * the gesture and then fails the write is worse than one that refuses the
   * gesture." With no script a form cannot know which positions are already
   * taken -- the pair is chosen at submit time -- so refusing the GESTURE is not
   * available to this surface, and the honest version is that the page says what
   * happened and keeps the owner where they were.
   *
   * ONLY THE DEFINED REFUSAL GETS THAT SENTENCE, which is the narrowing
   * `by-hand.ts` makes at the bottom of this stack kept at the top of it: the
   * position being taken is a fact about the CATALOGUE and is worth telling the
   * owner, where a `BAD_REQUEST` raised by the procedure's own `.input()` is a
   * fact about a request no browser composed. Every other refusal takes the
   * ordinary answer this surface already has -- nothing written, and the
   * container's page rendered again (CNCORE-127) -- and a real fault is still a
   * fault, thrown before `whatTheProcedureAnswered` hands anything back.
   *
   * AND THAT NARROWING IS ALSO WHAT MAKES THE ADDRESS BELOW SAFE TO BUILD.
   * `placedMember` declares both ids `z.string()` where `namedPlacement` below
   * declares them `z.uuid()`, and the difference is not an oversight: these two
   * REACH `placement.place`, which declares `containerId: z.uuid()` and
   * `itemId: z.uuid()` itself. A DEFINED `BAD_REQUEST` is raised inside that
   * handler, so reaching this line at all means both values already satisfied
   * `z.uuid()` one layer down and neither can carry the `?`, `#` or `../` that
   * `namedPlacement`'s docstring is about. Restating `z.uuid()` here would be
   * the second copy this ticket exists to refuse; `namedPlacement` has one
   * because its `containerId` reaches NO procedure. Raised by review, which read
   * the two schemas side by side and could not see which of them was checked.
   */
  if (refused) {
    if (isDefinedError(refused) && refused.code === "BAD_REQUEST") {
      redirect(`/items/${input.containerId}?refused=${input.itemId}`);
    }
    return;
  }
  refresh();
}

/**
 * What the remove and undo forms carry: which placement, and where to go back to.
 *
 * BOTH ARE `uuid()`, AND `containerId` IS THE ONE THAT NEEDS SAYING. `id` is
 * checked again downstream -- `placement.remove` declares `z.uuid()` -- but
 * `containerId` reaches NO procedure: it exists only to build the address these
 * actions redirect to. So nothing else was ever going to check it, and a Server
 * Action endpoint accepts whatever `FormData` it is sent. Unchecked, a `?` or a
 * `#` in it lands unescaped beside `?undo=` and a `../` walks out of `/items/`.
 * Found by review.
 */
const namedPlacement = z.object({ id: z.uuid(), containerId: z.uuid() });

/**
 * The owner taking a member out of one container, and being offered it back.
 *
 * IT REDIRECTS WHERE `placeItemInContainer` ABOVE DOES NOT, and the difference is the
 * undo. ADR-0046 gives a removal no confirmation at all and an undo instead --
 * "removing a placement is the most frequent editing act in a product built on
 * multi-placement", and a heavyweight dialog on the common action is what
 * teaches people to dismiss the dangerous one unread.
 *
 * WITH NO SCRIPT, AN OFFER HAS TO BE IN THE URL. A Server Action's return value
 * reaches a page only through `useActionState`, a client hook with nothing to
 * give when nothing has loaded -- so post/redirect/get is what carries "you just
 * removed this" to the page that offers it back. `?undo=` names the placement,
 * LAST of the parameters this page takes: ADR-0066's fixed spelling order is
 * `via` then `placed`, CNCORE-89 appended `after`, and this appends rather than
 * inserts for the same reason.
 *
 * IT IDENTIFIES NOTHING, which is what keeps it ADR-0066-shaped: the path is the
 * container's identity and the query is how the reader got to this view of it. A
 * stale or foreign id offers an undo the catalogue then declines, which
 * `restorePlacement` below turns back into the plain container page.
 */
export async function removePlacement(form: FormData): Promise<void> {
  const named = whatTheFormCarries(form, namedPlacement);
  if (named === undefined) return;
  const { id, containerId } = named;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.placement.remove, { id }, { context: await callerContext() }),
  );
  if (refused) return;

  redirect(`/items/${containerId}?undo=${id}`);
}

/**
 * The undo itself: the placement comes back with its position and its origin.
 *
 * IT REDIRECTS TO THE CONTAINER WITHOUT `?undo=`, so the offer is spent. Leaving
 * it on would re-offer an undo of a removal that has already been taken back,
 * and a reader refreshing would meet a button that reads as though nothing had
 * happened.
 */
export async function restorePlacement(form: FormData): Promise<void> {
  const named = whatTheFormCarries(form, namedPlacement);
  if (named === undefined) return;
  const { id, containerId } = named;

  /*
   * A DECLINED UNDO IS THE PLAIN CONTAINER PAGE, not a 500. `?undo=` is a
   * transient offer carried in a URL, so it can be stale, shared, or pointed at
   * a placement this owner may not bring back -- one a PROVIDER withdrew, which
   * `restorePlacementByHand` refuses (ADR-0017). All three answer NOT_FOUND, and
   * none of them is a fault: the honest response is the container as it stands,
   * with the spent offer dropped. Found by review, which caught this reaching
   * the reader as an error page.
   *
   * IT NAMES NO CODE ANY MORE, AND THAT IS THE SHARED RULE ARRIVING
   * (CNCORE-127). This used to let NOT_FOUND past and throw everything else,
   * which made a hand-composed id answer 500 on the one surface whose whole
   * subject is an id that may be stale. `whatTheProcedureAnswered` reads every
   * refusal the same way, so the sentence above is now true of all of them
   * rather than of the one that had been met.
   */
  await whatTheProcedureAnswered(
    call(appRouter.placement.restore, { id }, { context: await callerContext() }),
  );

  redirect(`/items/${containerId}`);
}

/**
 * What a Move form carries: the delta, spelled out as fields.
 *
 * THE FORM CARRIES THE DELTA RATHER THAN THE GESTURE, which is ADR-0116's
 * decision about the mutation reaching down here. A reorder writes the
 * placement that moved and the siblings whose Position actually changed, never
 * the rebuilt ordering -- and the page knows both, because it rendered the
 * ordering and `reorderedTo` computed the consequence of this one button.
 *
 * AN ACTION THAT RE-READ THE ORDERING WOULD BE A DIFFERENT MUTATION. It would
 * take "move this up" and work out the rest, which is the shape that record
 * refuses: the delta is the caller's to compute, and this is the caller.
 */
const movedPlacement = z.object({
  id: z.uuid(),
  containerId: z.uuid(),
  position: positionField,
});

/**
 * And who shifted for it, which is the one thing on this page that is a LIST.
 *
 * TWO PARALLEL FIELDS RATHER THAN ONE ENCODED ONE. `FormData` keeps repeated
 * names in document order, so `siblingId` and `siblingPosition` zip by index --
 * ordinary HTML rather than a private format this file would then own the
 * parser for. The drag builds the same two fields, so both doors post the
 * identical request.
 *
 * NOT `whatTheFormCarries`, AND THE REASON IS THE SHAPE RATHER THAN THE RULE.
 * That helper reads ONE value per field name, which is every other field in
 * this app; a list needs `getAll`, and a pair of parallel lists cannot be
 * derived from a schema's keys. `whatTheFormRepeats` applies the SAME reading
 * to each value -- a part that is not text is "not given" -- so this is an
 * extension of that rule rather than a second one.
 */
const movedSiblings = z.array(z.object({ id: z.uuid(), position: positionField }));

/**
 * The owner reordering a container (CNCORE-73), from either door.
 *
 * ONE ACTION FOR THE BUTTON AND THE DRAG, because they are one gesture. A page
 * where the mouse and the keyboard disagreed about what a reorder means would
 * be two products, and `CLAUDE.md` requires the visible path to exist at all --
 * so the drag is the accelerator and Move up is the path, over one rule.
 */
export async function movePlacement(form: FormData): Promise<void> {
  const named = whatTheFormCarries(form, movedPlacement);
  if (named === undefined) return;

  const ids = whatTheFormRepeats(form, "siblingId");
  const positions = whatTheFormRepeats(form, "siblingPosition");
  /*
   * TWO LISTS OF DIFFERENT LENGTHS IS A MALFORMED REQUEST, not a short one.
   * `positionField` reads a missing value as `null`, which for a position
   * MEANS unplaced -- so zipping a short list would quietly unplace whatever
   * ran off the end. No form this page renders can produce it, and refusing is
   * the reading that cannot be mistaken for a claim.
   */
  if (ids.length !== positions.length) return;
  const shifted = movedSiblings.safeParse(
    ids.map((id, index) => ({ id, position: positions[index] })),
  );
  if (!shifted.success) return;

  /*
   * A REFUSAL IS AN ANSWER (CNCORE-127), and this action has nothing to add to
   * either of the two it can meet, so what comes back is not read. NOT_FOUND is
   * a stale page -- the placement was removed in another tab, or the link was
   * shared -- and BAD_REQUEST is the catalogue refusing the move itself, which today is a container asked to
   * hold something it already sits inside (migration 15). Neither is a fault,
   * and the container AS IT STANDS is the honest answer to both.
   */
  await whatTheProcedureAnswered(
    call(
      appRouter.placement.move,
      { ...named, siblings: shifted.data },
      { context: await callerContext() },
    ),
  );

  /*
   * `refresh()` ON BOTH OUTCOMES, and the refusal is the one that needs it.
   * With no script the page re-renders anyway, because this form posts to the
   * container's own address. With script the DRAG has already moved the row on
   * local state, so a refused move that cleared no client cache would leave the
   * page showing a reorder that never happened -- the refresh is what hands the
   * component the server's ordering back and puts the row where it belongs.
   */
  refresh();
}

/** What the put form carries: which scope, and which Item. */
const scopedItem = z.object({ groupId: z.string(), itemId: z.string() });

/**
 * PUTTING AN ITEM IN A BROWSING SCOPE, and TAKING IT BACK OUT (CNCORE-178,
 * ADR-0010).
 *
 * TWO ACTIONS OVER ONE SHAPE, where the note and the sort name each got ONE
 * action for writing and clearing. The difference is what the empty value
 * means: clearing a note is a claim the Owner is making ("I say nothing"), so
 * one control can carry both. A scope has no empty value to submit -- the Owner
 * names the Group they mean, both ways -- so a single action would need a
 * second field saying which direction it was, which is a control that says what
 * it does written as a field that does not.
 *
 * THEY LIVE HERE RATHER THAN IN `groups/actions.ts`, beside the page that
 * renders them, which is where every other action in this app sits. `/groups`
 * keeps the scopes; the Item page is where an Item joins one.
 *
 * NO REDIRECT, and `refresh()` for the reason `retitleItem` above gives: both
 * forms post to the Item's own address, so the response IS that page rendered
 * again with its scopes as they now stand.
 */
export async function putItemInGroup(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, scopedItem);
  if (input === undefined) return;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.group.put, input, { context: await callerContext() }),
  );
  if (refused) return;
  refresh();
}

export async function takeItemOutOfGroup(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, scopedItem);
  if (input === undefined) return;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.group.take, input, { context: await callerContext() }),
  );
  if (refused) return;
  refresh();
}
