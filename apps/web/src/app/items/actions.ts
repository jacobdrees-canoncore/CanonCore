"use server";

import { appRouter } from "@canoncore/api/routers";
import { call } from "@orpc/server";
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
 * A CHECKBOX IS ABSENT WHEN IT IS NOT TICKED, which is HTML's rule and the
 * reason these two are not `z.boolean()`. `form.get()` answers `null` for a
 * box the owner left alone and the string `on` for one they ticked, so the
 * coercion is "did this field arrive at all" rather than a parse of its value
 * -- and the value is deliberately not compared against `"on"`, because that
 * string is a browser default rather than something this app chose.
 */
const newItem = z.object({
  kind: z.string().min(1),
  title: z.string(),
  isContainer: z.boolean(),
  isOrdered: z.boolean(),
});

export async function createItem(form: FormData): Promise<void> {
  const input = newItem.parse({
    kind: form.get("kind"),
    title: form.get("title"),
    isContainer: form.get("isContainer") !== null,
    isOrdered: form.get("isOrdered") !== null,
  });

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
 */
export async function retitleItem(form: FormData): Promise<void> {
  const input = editedTitle.parse({ id: form.get("id"), title: form.get("title") });

  await call(appRouter.item.retitle, input, { context: await callerContext() });
}
