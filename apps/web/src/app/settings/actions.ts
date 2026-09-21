"use server";

import { appRouter } from "@canoncore/api/routers";
import type { WhySettingNotRead } from "@canoncore/providers";
import { call } from "@orpc/server";
import { redirect } from "next/navigation";
import { z } from "zod";

import { whatTheProcedureAnswered } from "@/answer";
import { whatTheFormCarries } from "@/form";
import { callerContext } from "@/session";

import { REFUSED, REFUSED_SAVING_THE_ALLOWLIST, REFUSED_SAVING_THE_PROVIDERS } from "./refusal";

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
 * The Providers setting, replaced wholesale with the text the Owner wrote.
 *
 * NO `.min(1)`, AND HERE IT IS THE REPAIR RATHER THAN A COURTESY. An empty box
 * clears a stored setting that will not parse outright, which is the exit an
 * Owner needs most when nothing else on the page will answer them.
 */
const theProvidersWritten = z.object({ providers: z.string() });

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
  /*
   * THE FOURTH THE PROCEDURE RAISES, WHICH IS ABOUT THE SETTING AND NOT THE
   * ENTRY (CNCORE-326). `nameProvider` parses the stored string before it
   * parses what was typed, so a row that no longer reads refuses an entry that
   * was fine; `NOT_A_SETTING` declares that as `BAD_REQUEST` and the page
   * writes a sentence naming the setting rather than the entry.
   *
   * THE ENTRY STILL TRAVELS, THOUGH THIS REFUSAL IS NOT ABOUT IT. The page
   * names what the Owner typed and then says the fault was elsewhere --
   * "<entry> was not named, because this instance cannot read the Providers it
   * already has" -- which is the one shape that does not leave them checking an
   * entry that was fine.
   */
  if (refused.code === "BAD_REQUEST") {
    redirect(`/settings?refused=${entry}&because=${REFUSED.unreadable}`);
  }
  /*
   * AND EVERY OTHER REFUSAL, NAMED AS ONE THIS PAGE CANNOT NAME (CNCORE-326).
   *
   * A FALL-THROUGH AND NOT A FIFTH `if`, which is the whole difference. Four
   * branches with no fall-through is what this action shipped with, and a
   * refusal matching none of them simply returned: the page re-rendered
   * unchanged with nothing said, which is the silence this file's own docstring
   * forbids. ADR-0156 asks for this branch before it asks for anything else.
   *
   * AND IT MUST NOT BORROW THE SENTENCE ABOVE, which is the correction review
   * caught on this ticket's own first pass. This redirect carried
   * `REFUSED.unreadable` unconditionally, and `ownerProcedure` raises
   * `ORPCError("UNAUTHORIZED")` -- status 401, which `answer.ts` reads as a
   * refusal like any under 500 -- so an Owner whose session expired between the
   * GET and the POST was sent to an address asserting that this instance cannot
   * read its Providers. False, and it hides the remedy. A catch-all that names
   * a cause is not a catch-all; `REFUSED.unexplained` names none.
   */
  redirect(`/settings?refused=${entry}&because=${REFUSED.unexplained}`);
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

/**
 * Replaces ADR-0034's allowlist with what the owner wrote.
 *
 * A REFUSED SAVE SAYS SO, AND UNTIL CNCORE-329 IT SAID NOTHING AT ALL. This
 * dropped what the procedure answered on the floor -- it did not even bind
 * `refused` -- so an Owner who typed a wildcard got the page back with the
 * STORED allowlist in the box and their edit gone, with no sentence about
 * either. That is worse than the eleven call sites ADR-0156 lists under "not
 * built": those end `if (refused) return;` and report through a re-read that
 * SHOWS what happened. A textarea reverting shows the opposite of what
 * happened, which is this file's own docstring being broken by the one control
 * it does not mention.
 */
export async function editAllowlist(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, theAllowlistWritten);
  if (input === undefined) return;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.settings.editAllowlist, input, { context: await callerContext() }),
  );
  if (refused === undefined) return;
  redirect(theAddressAfterARefusedSave(refused, WHEN_THE_ALLOWLIST_IS_REFUSED));
}

/**
 * Replaces the Providers setting with what the Owner wrote (CNCORE-331).
 *
 * THE ONLY WRITE THAT WORKS WHILE THE ROW IS BAD, which is the whole of why it
 * exists. `nameProvider` and `removeProvider` both parse the stored string
 * before they touch the entry, so an instance whose Providers setting will not
 * parse refused every control on this page -- including the one that would
 * have repaired it. The page renders this form INSTEAD of the list it cannot
 * render, so the two never stand together.
 */
export async function editProviders(form: FormData): Promise<void> {
  const input = whatTheFormCarries(form, theProvidersWritten);
  if (input === undefined) return;

  const { refused } = await whatTheProcedureAnswered(
    call(appRouter.settings.editProviders, input, { context: await callerContext() }),
  );
  if (refused === undefined) return;
  redirect(theAddressAfterARefusedSave(refused, WHEN_THE_PROVIDERS_ARE_REFUSED));
}

/**
 * WHERE A REFUSED WHOLESALE SAVE SENDS THE OWNER, AND WITH WHICH WORD
 * (CNCORE-329).
 *
 * IT BUILDS THE ADDRESS AND THE CALLER RAISES THE REDIRECT, which is a
 * division worth stating because the obvious shape was to redirect in here.
 * `redirect()` works by THROWING, and `tree-figures.test.ts` counts the call
 * sites that redirect on what a procedure answered BY FUNCTION, splitting the
 * file on its exports -- so a `redirect()` hidden in a helper below them
 * counts against whichever export it happens to follow and against no other.
 * Both of these actions redirect; a figure that saw one of them would make the
 * hazard that shape exists for look rarer than it is.
 *
 * ONE FUNCTION FOR BOTH TEXTAREAS OTHERWISE, because the rest is one shape:
 * read the code, read `why` off its data, and name the ENTRY that broke it
 * beside the SURFACE's word for what is wrong with it. What differs is only
 * the table, which is why the table is the argument.
 *
 * THE TABLE IS TOTAL OVER `why`, WHICH IS THE PROPERTY WORTH HAVING. Each
 * setting's parse can raise only some of the words -- `parseAllowlist` never
 * answers `not-a-url` -- and the impossible ones map to the catch-all rather
 * than being left out, so a fourth rule added in `@canoncore/providers` fails
 * to compile here instead of arriving on the page as whatever the last branch
 * happened to be. That is `ANSWERED_AS`'s argument in the router, at the other
 * end of the same wire.
 *
 * AND THE CATCH-ALL NAMES NO CAUSE, which is ADR-0197's correction kept. Every
 * other refusal these procedures can raise -- `ownerProcedure`'s
 * `UNAUTHORIZED` at status 401 above all, which `answer.ts` reads as a refusal
 * like any under 500 -- reaches it, and an Owner whose session merely expired
 * must not be told their allowlist holds a wildcard.
 */
function theAddressAfterARefusedSave(
  refused: { code: string; data?: unknown },
  words: Record<WhySettingNotRead, string>,
  /*
   * A TEMPLATE LITERAL TYPE AND NOT `string`, because `redirect()` takes a
   * `RouteImpl` under Next's typed routes: the addresses this file builds by
   * hand are checked against the routes that exist (ADR-0109), and a bare
   * `string` returned from here would have thrown that check away for the two
   * call sites it feeds.
   */
): `/settings?${string}` {
  const said = whyTheSettingWasNotRead(refused);
  if (said === undefined) return `/settings?because=${REFUSED.unexplained}`;
  return `/settings?refused=${encodeURIComponent(said.entry)}&because=${words[said.why]}`;
}

/**
 * THE ENTRY AND THE RULE A `SETTING_NOT_READ` CARRIES, or nothing where the
 * refusal was something else.
 *
 * READ AS DATA RATHER THAN TRUSTED, which is `items/actions.ts`' arrangement
 * for the same shape: `refused.data` is typed as the declared map WIDENED to
 * anything throwable, so the narrowing has to be done here rather than assumed
 * from the code alone.
 */
function whyTheSettingWasNotRead(refused: {
  code: string;
  data?: unknown;
}): { entry: string; why: WhySettingNotRead } | undefined {
  if (refused.code !== "SETTING_NOT_READ") return undefined;
  const said = refused.data as { entry?: unknown; why?: unknown } | undefined;
  if (typeof said?.entry !== "string" || typeof said.why !== "string") return undefined;
  return { entry: said.entry, why: said.why as WhySettingNotRead };
}

/**
 * The Allowlist's own word per rule, and the catch-all for the one its parse
 * cannot raise.
 */
const WHEN_THE_ALLOWLIST_IS_REFUSED = {
  wildcard: REFUSED_SAVING_THE_ALLOWLIST.wildcard,
  "not-a-cidr": REFUSED_SAVING_THE_ALLOWLIST.notACidr,
  // `parseAllowlist` never asks whether an entry is a URL; the allowlist holds
  // hosts and ranges. Named as a refusal this page cannot name rather than left
  // out, so the record stays total.
  "not-a-url": REFUSED.unexplained,
} as const satisfies Record<WhySettingNotRead, string>;

/** The Providers' own word, and the catch-all for the two its parse cannot raise. */
const WHEN_THE_PROVIDERS_ARE_REFUSED = {
  "not-a-url": REFUSED_SAVING_THE_PROVIDERS.notAUrl,
  // Neither rule belongs to this setting: a Provider is a URL (ADR-0031), and
  // wildcards and ranges are the allowlist's vocabulary.
  wildcard: REFUSED.unexplained,
  "not-a-cidr": REFUSED.unexplained,
} as const satisfies Record<WhySettingNotRead, string>;
