"use server";

import { appRouter } from "@canoncore/api/routers";
import { call } from "@orpc/server";
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
 * because the model has no second operation for one to call. `assertClaims`
 * makes what a source holds EQUAL to what it now claims, so a source claiming
 * nothing withdraws what it said -- which means a Remove control would either
 * do exactly what saving an empty box does, or have to mean something else
 * nobody has defined. The owner is offered one control that says what they
 * think, including when that is nothing.
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
