import { placeItemByHand } from "@canoncore/db";
import { anItemTitled } from "@canoncore/db/testing/catalogue";
import type { TestProject } from "vitest/node";

import { anInstanceServing, OWNER_PASSWORD, theAppBuilt } from "../e2e/instance";

/**
 * ONE INSTANCE, FOR THE ONE THING A BROWSER IS NEEDED FOR (CNCORE-73).
 *
 * ADR-0103 reserved Playwright for "a rendered page, on the slice that first
 * has one", sharpened by CNCORE-4 to "the first slice with real INTERACTIVITY".
 * Dragging a Placement is that slice, and this is where the reservation is
 * spent.
 *
 * ITS OWN VITEST PROJECT AND ITS OWN CI JOB, which is the ticket's first
 * acceptance criterion and was decided against the duplicated setup it costs.
 * What it duplicates is ONE instance rather than the page seam's seven: a
 * browser suite asserting one claim needs one ordering to drag, not a wiki
 * provider, a TMDB provider, a paged catalogue or a fresh install. And what the
 * split buys is that a flake in the most brittle thing in this repository
 * reddens a check called "The page in a browser" instead of the one that says
 * the app serves pages at all.
 *
 * WHAT IT MAY ASSERT IS BOUNDED, and the bound is in ADR-0103 rather than in
 * this comment: that dragging reorders, and that the new order survives a
 * reload. Everything else about reordering -- the arithmetic, the refusals, the
 * write, what a visitor is shown -- is asserted without a browser, because
 * everything else can be.
 *
 * FOUR MEMBERS AT 1, 5 AND 63 AND ONE WITH NO POSITION, which is
 * `aCatalogueSafeToReorder`'s fixture and for its reason: the GAPS are what
 * tell a permutation of asserted positions from a renumbering that happens to
 * agree with it (ADR-0116).
 */
export default async function setup(project: TestProject) {
  /*
   * THIS PROJECT BUILDS ITS OWN APP, which is the duplicated setup the ticket
   * asked to be weighed and is the larger half of what a separate job costs.
   * It is also not optional: `anInstanceServing` only STARTS a build, so a
   * browser project that skipped this would serve whatever `.next` happened to
   * be on disk -- green against code that is not the code under test on a
   * developer's machine, and unable to start at all on a fresh runner. Found by
   * mutating the write and watching this suite pass anyway.
   *
   * THE THREE KEYS THAT DECIDE WHAT THE BUILD IS ARE NAMED, for the reason an
   * instance's are: an omitted key is not an unset one, it is the developer's
   * own `.env` reaching a build that was meant to be without it.
   */
  await theAppBuilt({
    ...process.env,
    OWNER_PASSWORD,
  });

  const instance = await anInstanceServing({
    suffix: "drag",
    ownerPassword: OWNER_PASSWORD,
    // ADR-0034's default: an instance nobody has configured reaches nothing.
    allowlist: "",
    providers: [],
    fill: async (db) => {
      const releaseOrder = await anItemTitled(db, "Release order", {
        isContainer: true,
        isOrdered: true,
      });
      const held = [
        { title: "An Unearthly Child", position: 1 },
        { title: "The Daleks", position: 5 },
        { title: "The Edge of Destruction", position: 63 },
        { title: "Mission to the Unknown", position: null },
      ];
      for (const { title, position } of held) {
        const itemId = await anItemTitled(db, title);
        await placeItemByHand(db, { containerId: releaseOrder, itemId, position });
      }
      return { releaseOrder, inOrder: held.map(({ title }) => title) };
    },
  });

  project.provide("dragBaseUrl", instance.baseUrl);
  project.provide("dragging", instance.fixture);
  project.provide("dragOwnerPassword", OWNER_PASSWORD);

  return async () => {
    await instance.close();
  };
}

declare module "vitest" {
  interface ProvidedContext {
    /** The one instance this project serves, on its own database and its own port. */
    dragBaseUrl: string;
    /** The ordering under the mouse: one container, and its members as rendered. */
    dragging: { releaseOrder: string; inOrder: string[] };
    /** ADR-0044's one password, which every control on that page is behind. */
    dragOwnerPassword: string;
  }
}
