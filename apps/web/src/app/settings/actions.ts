"use server";

import { appRouter } from "@canoncore/api/routers";
import { call } from "@orpc/server";
import { redirect } from "next/navigation";
import { z } from "zod";

import { whatTheProcedureAnswered } from "@/answer";
import { whatTheFormCarries } from "@/form";
import { callerContext } from "@/session";

import { REFUSED } from "./refusal";

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

/**
 * WHAT THE OWNER TYPED INTO THE BOX, INCLUDING NOTHING AT ALL (CNCORE-262).
 *
 * NO `.min(1)`, AND THAT IS THE WHOLE DIFFERENCE FROM THE SCHEMA ABOVE. An
 * empty box is a real thing an Owner submits -- likelier than any other
 * mistake on this page -- and `.min(1)` refused it HERE, so the action returned
 * before the procedure was called and the page rendered unchanged with nothing
 * said. That is the silence this file's own docstring forbids, reached by the
 * one route nobody had looked at.
 *
 * SO AN EMPTY BOX AND A BOX OF SPACES TAKE THE SAME PATH, which is right: they
 * are the same mistake, and `parseProviderUrls` already reads them as the same
 * absence. The procedure answers `NOTHING_NAMED` to both and the page says so.
 *
 * REMOVING STILL TAKES `theProviderNamed`, because its field is HIDDEN: an
 * empty value there is a malformed request rather than a person's mistake, and
 * there is no sentence to say about it.
 */
const theEntryTyped = z.object({ baseUrl: z.string() });

/** ADR-0034's allowlist, replaced wholesale with the text the owner wrote. */
const theAllowlistWritten = z.object({ allowlist: z.string() });

/**
 * Names one more Provider for this instance to search.
 *
 * A REFUSAL ENDS AT THE PAGE WITH THE ENTRY NAMED, because this is the field an
 * owner types into. The entry travels in the query rather than the refusal's own
 * sentence: what is wrong with it is one fact this page can state for itself,
 * and a procedure's message copied into an address is a sentence nobody owns.
 *
 * AND WITH THE REASON BESIDE IT SINCE CNCORE-262, because the entry alone could
 * not carry one. Three mistakes reach here -- nothing typed, several typed, and
 * one entry that is not a URL -- with three opposite remedies, and the page had
 * one sentence for all of them: it told an Owner who had pasted two URLs that
 * theirs "is not a URL" and to add a scheme both of them already had.
 *
 * THE BLANK ENTRY IS WHY THE REASON CANNOT RIDE IN `?refused=`. `oneValue`
 * reads a blank parameter as an ABSENT one -- rightly, for a parameter that
 * asks a question -- so `?refused=%20` rendered nothing whatever, and the
 * silence this file's own docstring forbids arrived by every step behaving
 * correctly. A value the Owner typed can be blank; the word for what was wrong
 * with it cannot, so they are two parameters.
 *
 * READ AS A CODE AND WRITTEN AS THE PAGE'S OWN WORD, never as the message
 * (ADR-0156). The
 * address is the Owner's to edit, so anything copied from a refusal into it
 * could be re-shown as CanonCore's own sentence; `refusal.ts` holds the closed
 * set and the page holds the words. This is `/login`'s arrangement, which reads
 * `refused.code` for the same reason.
 *
 * WRITTEN IN ADR-0066'S FIXED ORDER, which `query-params.ts` asks of any
 * address that grows a second parameter: `refused` names what the page is
 * talking about and `because` qualifies it.
 */
export async function nameProvider(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, theEntryTyped);
  if (input === undefined) return;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.settings.nameProvider, input, { context: await callerContext() }),
  );
  if (refused === undefined) return;

  /*
   * NOTHING TO ECHO WHERE NOTHING WAS TYPED. The entry is whitespace, and a
   * parameter carrying it would be read as absent anyway -- so the page is told
   * only what happened, and its sentence for this one names no entry.
   */
  if (refused.code === "NOTHING_NAMED") redirect(`/settings?because=${REFUSED.nothing}`);
  const entry = encodeURIComponent(input.baseUrl);
  if (refused.code === "NOT_ONE_PROVIDER") {
    redirect(`/settings?refused=${entry}&because=${REFUSED.several}`);
  }
  if (refused.code === "NOT_A_URL")
    redirect(`/settings?refused=${entry}&because=${REFUSED.notAUrl}`);
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
