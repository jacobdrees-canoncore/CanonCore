import type { AppRouterClient } from "@canoncore/api/routers";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { describe, expect, inject, it } from "vitest";

import {
  documentFrom,
  logInAt,
  navigatingFormsIn,
  postFormsIn,
  type RenderedForm,
  sectionIn,
  submit,
} from "./document";

/**
 * REMOVING A PROVIDER'S CONTRIBUTIONS, SHOWN BEFORE IT HAPPENS (CNCORE-69).
 *
 * ADR-0046 puts counts in front of a permanent delete, and a purge is the delete
 * where that matters most: the one an owner runs under time pressure, after a
 * termination notice, against a provider whose content they can no longer
 * inspect. The counts are the only description of it they are going to get.
 *
 * THE PAGE-OVER-HTTP SEAM AND NO BROWSER, which the ticket names and ADR-0103
 * governs. Everything this surface renders is in the HTML the server returns,
 * and the confirmation is a form replayed exactly as a browser with JavaScript
 * switched off submits it.
 *
 * ITS OWN SERVER, AND THAT IS THE POINT OF THE FIXTURE. A purge deletes; the
 * seeded instance every other file here reads would lose its fixtures mid-run.
 */
const baseUrl = inject("purgeableBaseUrl");
const purgeable = inject("purgeable");
/**
 * THE OWNER, LOGGED IN, and every request in this file carries the cookie.
 *
 * THE WHOLE SURFACE IS THEIRS, not only the button at the end of it. A preview
 * is not a read: it runs the purge traversal and rolls it back (ADR-0046), so it
 * costs a real delete's work and write locks -- which is why `previewPurge` is an
 * `ownerProcedure` alongside `purge` itself (CNCORE-109), and why the page
 * renders no provider list to a visitor rather than a list of 401s.
 */
const owner = await logInAt(baseUrl, inject("ownerPassword"));

/**
 * The router, asked directly, as the owner too -- `previewPurge` is theirs for
 * the reason above, and this file asks it for the numbers the PAGE is then held
 * to. `catalogue.list` beside it is an open read and does not need the cookie;
 * one client for the file beats two that differ in a way no assertion is about.
 */
const client: AppRouterClient = createORPCClient(
  new RPCLink({ url: `${baseUrl}/api/rpc`, headers: { cookie: owner } }),
);

/** A provider named for purging, as the page's own form puts it in the URL. */
function purging(provider: string): string {
  return `/import?purge=${encodeURIComponent(provider)}`;
}

/**
 * What the confirmation says a purge would REMOVE, by the noun it counts.
 *
 * BY THE NOUN RATHER THAN BY POSITION, because the numbers are the whole content
 * of this surface and a test that took the first `\d+` it found would pass while
 * the page reported the statements under the items' label -- which is the exact
 * defect an owner cannot detect and cannot undo.
 *
 * READ FROM THE LIST OF REMOVALS AND NOT THE WHOLE SECTION, which is what keeps
 * "3 items" and "2 items stay" apart. Those two numbers mean opposite things, and
 * a pattern loose enough to find either would report whichever the page happened
 * to print first -- so a page that swapped them would go on passing.
 *
 * THE PLURAL IS OPTIONAL IN THE PATTERN AND NOT COMPUTED BY THE TEST. Matching
 * `statements?` reads whichever the page wrote; rebuilding the page's own
 * pluralisation here would be the test recomputing the code and agreeing with
 * itself however wrong both were.
 */
function removing(confirmation: string, noun: string): number {
  const removals = /<ul\b[^>]*>.*?<\/ul>/s.exec(confirmation)?.[0];
  if (!removals) throw new Error(`the confirmation lists no removals:\n${confirmation}`);
  const found = new RegExp(`(\\d+)\\s+${noun}s?\\b`).exec(removals);
  if (!found) throw new Error(`the confirmation counted no ${noun}s:\n${removals}`);
  return Number(found[1]);
}

/**
 * And what it says would STAY, which is the other half of what a purge does.
 *
 * AN ITEM A PROVIDER WROTE AND THE OWNER ALSO CLAIMS SURVIVES, stripped of the
 * provider's words (ADR-0046). A preview that counted only removals would answer
 * "1 item" about a provider that touched five and sound like the whole answer.
 */
function staying(confirmation: string): number {
  const found = /(\d+)\s+items?\s+stay/.exec(confirmation);
  if (!found) throw new Error(`the confirmation says nothing about what stays:\n${confirmation}`);
  return Number(found[1]);
}

describe("/import, previewing a purge", () => {
  it("counts what would be removed before anything is removed", async () => {
    /*
     * THE COUNTS COME FROM THE PROCEDURE rather than being written down here,
     * and that is not laziness about the numbers. In CI these providers are the
     * REAL images: `provider-tmdb` answers four films for the collection this
     * harness browses and the stub answers two, so any literal here would pin
     * the suite to whichever process happened to be answering. What the page
     * owes is that it states what `previewPurge` says -- and `previewPurge` is
     * pinned to the traversal by `packages/db`, at the seam that can see rows.
     *
     * AND THE PREVIEW IS TAKEN FIRST, so a page that removed on sight would be
     * caught by its own numbers: the second call would answer zero.
     */
    const expected = await client.provider.previewPurge({ baseUrl: purgeable.previewed });
    expect(expected.statements).toBeGreaterThan(0);
    const held = await client.catalogue.list({});

    const asked = await documentFrom(baseUrl, purging(purgeable.previewed), owner);

    expect(asked.status).toBe(200);
    const confirmation = sectionIn(asked.text, "purge");
    expect(removing(confirmation, "statement")).toBe(expected.statements);
    expect(removing(confirmation, "placement")).toBe(expected.placements);
    expect(removing(confirmation, "item")).toBe(expected.items);

    // AND NOTHING WENT. Asserted rather than assumed, because this is the whole
    // criterion: a preview that deleted would still have rendered every number
    // above correctly, and an owner reading them would already have paid.
    expect((await client.catalogue.list({})).total).toBe(held.total);
  });

  it("counts the items the owner also claims as STAYING, not as going", async () => {
    /*
     * THE CRITERION IS THAT THEY ARE ACCOUNTED FOR RATHER THAN SILENTLY INCLUDED,
     * and the silence is the part worth being precise about. The traversal has
     * always EXCLUDED them from what it takes -- an item the owner places survives,
     * because the owner's placement is the owner's claim (ADR-0046) -- so a preview
     * reporting only removals was never WRONG. It was incomplete in a way an owner
     * could not see: "1 item" about a provider that touched five reads as the whole
     * answer, and the other four turn up untitled on a page nobody expected to
     * change.
     *
     * SO BOTH HALVES ARE ASSERTED HERE. The number that stays is stated, and it is
     * NOT folded into the number that goes -- which is the difference between a
     * preview that accounts for these items and one that quietly counts them as
     * casualties.
     */
    const expected = await client.provider.previewPurge({ baseUrl: purgeable.previewed });
    expect(expected.keptItems).toBeGreaterThan(0);

    const asked = await documentFrom(baseUrl, purging(purgeable.previewed), owner);

    const confirmation = sectionIn(asked.text, "purge");
    expect(staying(confirmation)).toBe(expected.keptItems);
    expect(removing(confirmation, "item")).toBe(expected.items);
    expect(removing(confirmation, "item")).not.toBe(expected.items + expected.keptItems);

    // AND THE ITEM THE OWNER EDITED IS ONE OF THEM, which is what makes the number
    // a fact about this catalogue rather than an arithmetic identity: it is still
    // reachable, and it is still reachable after a preview that priced its removal.
    const kept = await documentFrom(baseUrl, `/items/${purgeable.keptFromPreviewed}`, owner);
    expect(kept.status).toBe(200);
    expect(kept.text).toContain("the owner's own title for it");
  });
});

/** The one form in the confirmation, which is the one that performs the purge. */
function formIn(confirmation: string): RenderedForm {
  const [form] = postFormsIn(confirmation);
  if (!form) throw new Error(`the confirmation carries no form to submit:\n${confirmation}`);
  return form;
}

describe("/import, confirming a purge", () => {
  /**
   * ONE TEST FOR THE WHOLE CONFIRM PATH, and the reason is the fixture rather
   * than the assertions. A purge can only be observed happening ONCE: split
   * across two tests, the second would run against a provider already purged and
   * would pass against a page that did nothing at all. So what a confirmation
   * does -- it performs the delete, the catalogue loses exactly what was promised,
   * the surface stops offering it, and what the owner claims survives -- is
   * asserted in the order those things become observable.
   */
  it("performs it, takes exactly what it promised, and leaves the owner's own", async () => {
    const at = purging(purgeable.purged);
    const before = await client.catalogue.list({});

    const offered = await documentFrom(baseUrl, at, owner);
    const confirmation = sectionIn(offered.text, "purge");
    // WHAT THE OWNER IS SHOWN, which is what the delete is then held to. Read off
    // the page rather than from the procedure, because the number an owner ACTED
    // ON is the page's and the promise under test is the page's.
    const promised = removing(confirmation, "item");
    const kept = staying(confirmation);
    expect(promised).toBeGreaterThan(0);
    expect(kept).toBeGreaterThan(0);

    const done = await submit(baseUrl, at, formIn(confirmation), owner);

    expect(done.status).toBe(200);
    // THE CATALOGUE LOST EXACTLY WHAT THE PAGE SAID IT WOULD. Not merely "fewer
    // items": a purge that took the wrong rows would also leave a smaller
    // catalogue, and the whole point of a preview is that the number is the one
    // an owner was given.
    expect((await client.catalogue.list({})).total).toBe(before.total - promised);

    // AND THE SURFACE REFLECTS IT rather than going on offering the same button.
    // Asking again is the same address, so this is the page reporting the outcome
    // by reading the catalogue -- the only way it can, since an action's return
    // value reaches a page through `useActionState` alone and that is a client
    // hook with nothing to give when no script has loaded (ADR-0109, CNCORE-68).
    expect(sectionIn(done.text, "purge")).toContain("nothing");
    expect(postFormsIn(sectionIn(done.text, "purge"))).toHaveLength(0);

    // AND THE ITEM THE OWNER EDITED IS STILL THERE, WITH THEIR WORDS ON IT, which
    // is the half a count cannot show. It survives STRIPPED of the provider's
    // claims, because the owner's own are the owner's and a provider's licence
    // ending has no bearing on them (ADR-0046). Asserted through the item's own
    // page rather than a row count: a purge that over-reached would answer 404
    // here, and one that took the owner's statements with the provider's would
    // answer 200 with the title gone.
    const survivor = await documentFrom(baseUrl, `/items/${purgeable.keptFromPurged}`, owner);
    expect(survivor.status).toBe(200);
    expect(survivor.text).toContain("the owner's own title for it");
  });
});

/**
 * A navigating form, followed exactly as a browser follows one: the fields
 * become search params on the action's own address.
 *
 * WHICH IS WHY THE CONTROL IS A FORM AND NOT A LINK, and it is worth knowing
 * before somebody simplifies it into one. The address of a preview RUNS THE
 * PURGE TRAVERSAL, taking the write locks of a real delete, so a
 * `<Link href="/import?purge=...">` would put that on an address a reader
 * reaches without asking for numbers.
 *
 * NOT "BECAUSE AN OWNER MOVED THE MOUSE NEAR THE BUTTON", which is what this
 * comment said and what ADR-0161 measured as false on 2026-09-20: this route is
 * dynamic and has no `loading` boundary, so its prefetch is skipped and takes no
 * lock. The form stays because that absence is a property of the CONFIGURATION
 * -- one `prefetch={true}`, one `loading.tsx` or Partial Prefetching restores it
 * -- and because a string-action `<Form>` prefetches its ACTION PATH under all of
 * them, its fields not being known until submission, which here is `/import`
 * carrying no provider and previewing nothing (Next's own `<Form>` reference,
 * read 2026-09-12).
 */
function follow(form: RenderedForm): string {
  const asked = new URLSearchParams(form.fields);
  return `${form.action}?${asked}`;
}

/** The form on `/import` that offers to purge one named provider, if there is one. */
function offerFor(text: string, provider: string): RenderedForm | undefined {
  return navigatingFormsIn(text).find(({ fields }) =>
    fields.some(([name, value]) => name === "purge" && value === provider),
  );
}

describe("reaching a purge", () => {
  it("is offered for every configured provider, without an address being typed", async () => {
    /*
     * A SURFACE NOBODY CAN REACH IS NOT ONE, and the criterion is that an owner
     * CHOOSES to purge a provider. An owner who has to know that `?purge=` exists
     * and paste a base URL into it is in the position this whole ticket exists to
     * get them out of, and it is the position ADR-0046's owner is least able to be
     * in: they are working under a termination notice.
     *
     * EVERY CONFIGURED PROVIDER, not merely the ones with something to take. Which
     * of them contributed anything is what the preview answers, and an owner who
     * is not sure whether they ever imported from one is exactly who is asking.
     */
    const { providers } = await client.provider.configured();
    expect(providers).toContain(purgeable.previewed);

    const { text } = await documentFrom(baseUrl, "/import", owner);

    for (const provider of providers) {
      const offer = offerFor(text, provider);
      expect(offer, `no purge was offered for ${provider}`).toBeDefined();

      // AND FOLLOWING IT ARRIVES AT THE COUNTS. An offer that led anywhere else
      // would satisfy every assertion above and still leave the button unwired.
      const reached = await documentFrom(baseUrl, follow(offer as RenderedForm), owner);
      expect(reached.status).toBe(200);
      expect(sectionIn(reached.text, "purge")).toContain(provider);
    }
  });
});

/** Where the confirmation's own Cancel goes. */
function cancelIn(confirmation: string): string {
  const found = /href="([^"]*)"/.exec(confirmation)?.[1];
  if (!found) throw new Error(`the confirmation offers no way out:\n${confirmation}`);
  return found;
}

describe("/import, declining a purge", () => {
  it("removes nothing, and leaves the catalogue exactly as it was", async () => {
    /*
     * CANCEL IS HALF OF ADR-0046's DIALOGUE, and the half that has to be free.
     * The record refuses a confirmation "dismissible by accident" -- never a
     * drawer, never a swipe-away sheet -- which cuts both ways: the way OUT must
     * cost an owner nothing, or the only safe move on a page they opened by
     * mistake is closing the tab.
     *
     * THE PROVIDER HERE IS THE ONE NOTHING EVER PURGES, so this test cannot be
     * made to pass by a run order in which everything was already gone. It has
     * something to lose throughout.
     */
    const before = await client.catalogue.list({});
    const offered = await documentFrom(baseUrl, purging(purgeable.previewed), owner);
    const confirmation = sectionIn(offered.text, "purge");
    expect(removing(confirmation, "statement")).toBeGreaterThan(0);

    const declined = await documentFrom(baseUrl, cancelIn(confirmation), owner);

    expect(declined.status).toBe(200);
    // THE CONFIRMATION IS GONE, which is what declining means from here: the page
    // stops asking. Not merely a different page -- this one, without the question.
    expect(() => sectionIn(declined.text, "purge")).toThrow();
    // AND EVERY ROW IS WHERE IT WAS.
    expect((await client.catalogue.list({})).total).toBe(before.total);
    const kept = await documentFrom(baseUrl, `/items/${purgeable.keptFromPreviewed}`, owner);
    expect(kept.status).toBe(200);
  });
});

describe("/import, a purge with nothing to take", () => {
  it("says so rather than offering to permanently delete nothing", async () => {
    /*
     * A DIALOGUE OFFERING TO PERMANENTLY DELETE "0 statements, 0 placements, 0
     * items" IS WORSE THAN NO DIALOGUE. It teaches an owner that this button is
     * harmless, and the next one they meet is the one that is not -- which is the
     * habit ADR-0046 cites NN/g to avoid building, from the other direction.
     *
     * AND IT IS AN ORDINARY QUESTION RATHER THAN AN EDGE. An owner who is not sure
     * whether they ever imported from a provider asks by looking, and "nothing
     * came from here" is the answer. This instance is configured with a provider
     * it can never reach and never imported from, which is both halves at once:
     * unreachable costs nothing here, because a purge makes no request.
     */
    const asked = await documentFrom(baseUrl, purging(purgeable.neverImported), owner);

    expect(asked.status).toBe(200);
    const answer = sectionIn(asked.text, "purge");
    expect(answer.toLowerCase()).toContain("nothing to purge");
    // NO BUTTON, which is the "rather than" half of the criterion. A page that
    // said the words and still rendered the confirmation would satisfy the
    // sentence above and none of the point of it.
    expect(postFormsIn(answer)).toHaveLength(0);
  });
});

describe("/import, asked to purge something it is not configured with", () => {
  it("answers rather than crashing, whatever the address carries", async () => {
    /*
     * NOTHING THAT ARRIVES IN AN ADDRESS SHOULD BE ABLE TO CRASH THE PAGE IT
     * ADDRESSES, which is the rule `/items/<id>` already applies to an id it
     * cannot use (CNCORE-14, ADR-0066). `previewPurge` takes a `z.url()`, so a
     * `?purge=` the page passed through unchecked would meet that and throw --
     * and the likely way to arrive with one is a link kept past a change to
     * this instance's own settings, which is the case where a working page
     * matters most.
     *
     * THE PROVIDER LIST IS STILL THERE, and that is the answer rather than a
     * silence: it names every provider this instance can purge, which is exactly
     * what an owner holding a stale link needs to read.
     */
    for (const named of ["http://somewhere.else.test", "not a url at all", ""]) {
      const { status, text } = await documentFrom(baseUrl, purging(named), owner);

      expect(status).toBe(200);
      expect(() => sectionIn(text, "purge")).toThrow();
      expect(sectionIn(text, "providers")).toContain(purgeable.previewed);
    }
  });
});
