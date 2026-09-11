"use server";

import { createContext } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import { call } from "@orpc/server";
import { z } from "zod";

/**
 * TAKING A RECORD INTO THE CATALOGUE, as a Server Action.
 *
 * A SERVER ACTION RATHER THAN A ROUTE THIS PAGE POSTS TO, and that is ADR-0109's
 * rule rather than a framework preference. An import MUST be a POST, and the only
 * ways to make one are a form whose `action` Next writes for us, or a URL we write
 * ourselves -- and a hand-built one is exactly the class the record says never to
 * add to, because Next prefixes `<Link>`, `<Form>` and `router.push()` and nothing
 * else. Measured on 16.3.4 under `basePath: "/canoncore"`: the form Next renders
 * for an action posts to the page's own address, prefix included, while
 * `redirect("/items/abc")` sets `Location: /items/abc` with no prefix at all.
 *
 * IT NEEDS NO JAVASCRIPT. React posts a form bound to a server action as an
 * ordinary `multipart/form-data` request when no script has loaded, which is why
 * this surface can be asserted at the page-over-HTTP seam with no browser:
 * `e2e/document.ts`'s `submit` replays the form the server rendered.
 *
 * IT RETURNS NOTHING, AND THE PAGE REPORTS THE OUTCOME BY READING THE CATALOGUE.
 * An action's return value reaches a page only through `useActionState`, which is
 * a client hook and loses the value entirely when no script is loaded -- so
 * reporting through it would make this surface's answer depend on JavaScript. The
 * page asks `provider.search` which candidates the catalogue already holds
 * instead, so the row that was unheld before the POST names its Item after it.
 * That is also the answer to the question an owner actually has, which is whether
 * they already have this.
 */

/**
 * What the form carries, read as data rather than trusted.
 *
 * A FORM FIELD IS INPUT, whoever rendered the form. These two are hidden fields
 * on a page this instance served, and they are still a request body: `baseUrl`
 * reaches ADR-0034's config boundary, which is what decides whether it may be
 * reached at all, and this is the parse that gets it there as a string rather
 * than as a `File` or as nothing.
 */
const takeRecord = z.object({ baseUrl: z.url(), recordId: z.string().min(1) });

/** Imports one record from one provider, leaving the page to report it. */
export async function importRecord(form: FormData): Promise<void> {
  const { baseUrl, recordId } = takeRecord.parse({
    baseUrl: form.get("baseUrl"),
    recordId: form.get("recordId"),
  });

  await call(appRouter.provider.import, { baseUrl, recordId }, { context: await createContext() });
}
