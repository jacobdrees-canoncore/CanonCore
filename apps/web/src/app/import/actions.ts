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

/**
 * What the browse form carries. `containerId` is the one field on this page the
 * owner TYPES, so it is the one that can be wrong -- and a provider answering "no
 * container at that id" is an answer rather than a failure (ADR-0066), which the
 * procedure already declares as an error of its own.
 */
const takeOrdering = z.object({ baseUrl: z.url(), containerId: z.string().min(1) });

/**
 * Imports a container AND its ordering, in one operation.
 *
 * ONE CALL RATHER THAN SIXTY, which is why `browse` exists (ADR-0033): the
 * container and its ordering arrive together, so the members are placed rather
 * than left for the owner to place by hand.
 */
export async function browseOrdering(form: FormData): Promise<void> {
  const { baseUrl, containerId } = takeOrdering.parse({
    baseUrl: form.get("baseUrl"),
    containerId: form.get("containerId"),
  });

  await call(
    appRouter.provider.browse,
    { baseUrl, containerId },
    { context: await createContext() },
  );
}

/**
 * Which provider to purge. `baseUrl` here is an IDENTITY rather than an address:
 * these are the catalogue's own rows, and nothing on this path makes a request.
 */
const purgeTarget = z.object({ baseUrl: z.url() });

/**
 * Removes everything one provider ever contributed, having shown the owner what
 * that is (ADR-0046).
 *
 * COUNTS-FIRST IS THE PAGE'S SHAPE RATHER THAN THIS ACTION'S GUARANTEE, and the
 * difference is worth stating because the two read alike. The page renders no
 * button until `previewPurge` has answered and none at all when the answer is
 * nothing, so an owner moving through the product cannot meet the POST before the
 * consequences. Nothing here ENFORCES that, and nothing can: this instance ships
 * no login (ADR-0107's single owner), so `provider.purge` is a `publicProcedure`
 * anything reaching the app can call directly at `/api/rpc`. A check added here
 * would bound the form and not the operation, which is the appearance of a
 * boundary rather than one. The enforcement arrives with authentication.
 *
 * AND IT IS DELIBERATELY NOT NARROWED TO `PROVIDER_URLS` the way the PREVIEW is.
 * That narrowing exists because the page can only offer what it can list; making
 * it a rule here would refuse the case ADR-0046 is written for, an owner purging
 * a provider whose licence has ended -- which is exactly the provider they are
 * most likely to have already taken out of their configuration.
 *
 * NO ALLOWLIST STANDS IN FRONT OF IT, AND THAT IS ADR-0034 OBEYED RATHER THAN
 * SKIPPED. That boundary checks URLs the app is about to FETCH, and this fetches
 * nothing: the rows are this catalogue's, found by the identity the source row
 * carries. A provider whose licence has just ended is precisely the one nothing
 * should be calling and the one an owner most needs to purge, so a check here
 * would fail exactly when the operation is wanted.
 *
 * IT RETURNS NOTHING, AND THE PAGE REPORTS THE OUTCOME BY READING THE CATALOGUE,
 * for the reason `importRecord` above gives: an action's return value reaches a
 * page through `useActionState` alone, which is a client hook and loses the value
 * when no script has loaded. The page asks `previewPurge` again at the same
 * address, and a provider with nothing left to take is what a completed purge
 * looks like from there.
 */
export async function purgeProvider(form: FormData): Promise<void> {
  const { baseUrl } = purgeTarget.parse({ baseUrl: form.get("baseUrl") });

  await call(appRouter.provider.purge, { baseUrl }, { context: await createContext() });
}
