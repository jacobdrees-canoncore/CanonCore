"use server";

import { appRouter } from "@canoncore/api/routers";
import { call } from "@orpc/server";
import { redirect } from "next/navigation";
import { z } from "zod";

import { whatTheProcedureAnswered } from "@/answer";
import { whatTheFormCarries } from "@/form";
import { callerContext } from "@/session";

/**
 * SAYING WHAT THIS INSTANCE REACHES, as Server Actions (CNCORE-99).
 *
 * NONE OF THEM NEEDS JAVASCRIPT, like every other form in this app: React posts
 * a form bound to a server action as an ordinary `multipart/form-data` request
 * when no script has loaded, which is what lets the settings surface be
 * asserted at the page-over-HTTP seam with no browser.
 *
 * THEY RETURN NOTHING AND THE PAGE REPORTS BY RE-READING, which is the rule
 * `/import`, `/devices` and `/tasks` already take: an action's return value
 * reaches a page only through `useActionState`, a client hook, so reporting
 * through it would make this surface's answer depend on JavaScript. The
 * provider that was not on the list before the POST is on the one after it,
 * which is the whole report.
 *
 * THE ONE THING RE-READING CANNOT REPORT IS A REFUSAL, and that is why
 * `nameProvider` below ends somewhere else. "Your entry was not a URL" and
 * "nothing happened" render identically as an unchanged list, and the owner
 * typed that entry -- so the one control on this page where a person can be
 * wrong says so, through the address rather than through a hook.
 */

/**
 * What the form carries, read as data rather than trusted.
 *
 * `z.string()` RATHER THAN `z.url()`, DELIBERATELY. Whether an entry is a URL is
 * `parseProviderUrls`'s question (ADR-0121) and `settings.nameProvider` asks it
 * there; restating it here would be a second rule, free to drift from the one
 * every read of the setting goes through -- and it would refuse the entry
 * BEFORE the procedure could say which entry was refused. What this schema
 * settles is only that a field arrived as text at all.
 */
const theProviderNamed = z.object({ baseUrl: z.string().min(1) });

/** ADR-0034's allowlist, replaced wholesale with the text the owner wrote. */
const theAllowlistWritten = z.object({ allowlist: z.string() });

/**
 * Names one more Provider for this instance to search.
 *
 * A REFUSAL ENDS AT THE PAGE WITH THE ENTRY NAMED, because this is the field an
 * owner types into. The entry travels in the query rather than the refusal's own
 * sentence: what is wrong with it is one fact this page can state for itself,
 * and a procedure's message copied into an address is a sentence nobody owns.
 */
export async function nameProvider(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, theProviderNamed);
  if (input === undefined) return;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.settings.nameProvider, input, { context: await callerContext() }),
  );
  if (refused) redirect(`/settings?refused=${encodeURIComponent(input.baseUrl)}`);
}

/**
 * Stops this instance naming one Provider.
 *
 * NOT A PURGE (`CONTEXT.md`). Everything this Provider ever claimed stays in the
 * catalogue, attributed to it; the only change is that nothing asks it again.
 * Purging is `/import`'s button and has a confirmation of its own (ADR-0046).
 */
export async function removeProvider(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, theProviderNamed);
  if (input === undefined) return;

  await whatTheProcedureAnswered(
    call(appRouter.settings.removeProvider, input, { context: await callerContext() }),
  );
}

/** Replaces ADR-0034's allowlist with what the owner wrote. */
export async function editAllowlist(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, theAllowlistWritten);
  if (input === undefined) return;

  await whatTheProcedureAnswered(
    call(appRouter.settings.editAllowlist, input, { context: await callerContext() }),
  );
}
