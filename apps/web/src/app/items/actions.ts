"use server";

import { appRouter } from "@canoncore/api/routers";
import { call, isDefinedError, safe } from "@orpc/server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

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
 * **v2** API -- this repo pins `@orpc/server@1.15.0`. Adopting it would mean a
 * new dependency AND a major-version move, for a job the pattern below already
 * does: `import/actions.ts` and `login/actions.ts` are both this shape, and a
 * second way to write an action is a second thing to keep true.
 *
 * THEY NEED NO JAVASCRIPT. React posts a form bound to a server action as an
 * ordinary `multipart/form-data` request when no script has loaded, which is
 * why these surfaces are asserted at the page-over-HTTP seam with no browser.
 *
 * A FORM FIELD IS INPUT, whoever rendered the form, so everything below is
 * parsed rather than trusted.
 *
 * TODO(CNCORE-123): `form.get` answers `File | string | null`, and a `z.string()`
 * field handed a `File` throws a `ZodError` nothing catches -- so a request
 * composed by hand gets `Internal Server Error` where CNCORE-14 and ADR-0066
 * both say it should get a refusal. Found by review on CNCORE-74 and left to
 * that ticket, because the shape is the same in all four of this app's actions
 * and predates this one: fixing it here would be one of four, and the rule
 * belongs in one place the next action inherits.
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
  const { holds, ...named } = newItem.parse({
    kind: form.get("kind"),
    title: form.get("title"),
    holds: form.get("holds"),
  });
  const input = {
    ...named,
    isContainer: holds !== "nothing",
    isOrdered: holds === "ordered",
  };

  const { id } = await call(appRouter.item.create, input, { context: await callerContext() });

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
  redirect(`/items/${id}`);
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
  const input = editedTitle.parse({ id: form.get("id"), title: form.get("title") });

  await call(appRouter.item.retitle, input, { context: await callerContext() });
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
  const input = editedNote.parse({ id: form.get("id"), note: form.get("note") });

  await call(appRouter.item.annotate, input, { context: await callerContext() });
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
const placedMember = z.object({
  containerId: z.string(),
  itemId: z.string(),
  position: z
    .string()
    .transform((given) => (given.trim() === "" ? null : Number(given)))
    .transform((given) => (given === null || Number.isInteger(given) ? given : null)),
});

/**
 * The owner putting an item in a container (CNCORE-72).
 *
 * NO REDIRECT, which is `retitleItem`'s reason: this form posts to the
 * container's own address, so the response to the POST is that page rendered
 * again and the new member is in the HTML that comes back.
 */
export async function placeMember(form: FormData): Promise<void> {
  const input = placedMember.parse({
    containerId: form.get("containerId"),
    itemId: form.get("itemId"),
    position: form.get("position"),
  });

  /*
   * `safe` RATHER THAN `try`, because `redirect()` below works by THROWING and a
   * `catch` around it would swallow the redirect as though it were the refusal.
   * oRPC documents `safe` as the way to get the error back as a value instead.
   */
  const { error } = await safe(
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
   * ONLY THE DEFINED REFUSAL, so a real fault stays a fault: the narrowing
   * `by-hand.ts` makes at the bottom of this stack, kept at the top of it.
   */
  if (error) {
    if (isDefinedError(error) && error.code === "BAD_REQUEST") {
      redirect(`/items/${input.containerId}?refused=${input.itemId}`);
    }
    throw error;
  }
  refresh();
}

/** What the remove and undo forms carry: which placement, and where to go back to. */
const namedPlacement = z.object({ id: z.string(), containerId: z.string() });

/**
 * The owner taking a member out of one container, and being offered it back.
 *
 * IT REDIRECTS WHERE `placeMember` ABOVE DOES NOT, and the difference is the
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
 * stale or foreign id offers an undo that restores nothing and answers NOT_FOUND.
 */
export async function removeMember(form: FormData): Promise<void> {
  const { id, containerId } = namedPlacement.parse({
    id: form.get("id"),
    containerId: form.get("containerId"),
  });

  await call(appRouter.placement.remove, { id }, { context: await callerContext() });
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
export async function restoreMember(form: FormData): Promise<void> {
  const { id, containerId } = namedPlacement.parse({
    id: form.get("id"),
    containerId: form.get("containerId"),
  });

  await call(appRouter.placement.restore, { id }, { context: await callerContext() });
  redirect(`/items/${containerId}`);
}
