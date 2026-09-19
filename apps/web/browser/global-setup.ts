import { createGroupByHand, placeItemByHand } from "@canoncore/db";
import { anItemTitled, aProvider, aStatement } from "@canoncore/db/testing/catalogue";
import { bounded } from "@canoncore/providers";
import type { TestProject } from "vitest/node";

import { anInstanceServing, OWNER_PASSWORD, theAppBuilt } from "../e2e/instance";
import {
  aProviderThatFloodsItsName,
  aProviderThatFloodsItsRecord,
  FLOOD,
  UNBROKEN,
} from "../e2e/stubs";

/**
 * ONE INSTANCE, FOR THE THINGS A BROWSER IS NEEDED FOR (CNCORE-73, CNCORE-217).
 *
 * ADR-0103 reserved Playwright for "a rendered page, on the slice that first
 * has one", sharpened by CNCORE-4 to "the first slice with real INTERACTIVITY".
 * Dragging a Placement is that slice, and this is where the reservation is
 * spent.
 *
 * ITS OWN VITEST PROJECT AND ITS OWN CI JOB, which is the ticket's first
 * acceptance criterion and was decided against the duplicated setup it costs.
 * What it duplicates is ONE instance rather than the page seam's seven: a
 * browser suite needs one ordering to drag and one Provider that floods its
 * name, not a wiki provider, a TMDB provider, a paged catalogue or a fresh
 * install. And what the
 * split buys is that a flake in the most brittle thing in this repository
 * reddens a check called "The page in a browser" instead of the one that says
 * the app serves pages at all.
 *
 * WHAT IT MAY ASSERT IS BOUNDED, and the bound is in ADR-0103 rather than in
 * this comment: that dragging reorders, that the new order survives a reload,
 * and since CNCORE-217 that a Provider's prose wraps inside the page -- which is
 * layout, and no `fetch` can observe layout. Everything else about reordering --
 * the arithmetic, the refusals, the write, what a visitor is shown -- is
 * asserted without a browser, because everything else can be.
 *
 * FOUR MEMBERS AT 1, 5 AND 63 AND ONE WITH NO POSITION, which is
 * `aCatalogueSafeToReorder`'s fixture and for its reason: the GAPS are what
 * tell a permutation of asserted positions from a renumbering that happens to
 * agree with it (ADR-0116).
 */
/** A Group's name, a word repeated for the reason `UNBROKEN`'s fields are. */
const UNBROKEN_GROUP = "group".repeat(100);

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

  const floodsItsName = await aProviderThatFloodsItsName();
  const floodsItsRecord = await aProviderThatFloodsItsRecord();

  const instance = await anInstanceServing({
    suffix: "drag",
    ownerPassword: OWNER_PASSWORD,
    /*
     * TWO PROVIDERS, EACH SENDING TEXT AS WIDE AS IT IS LONG: one its prose
     * (CNCORE-217) and one its record (CNCORE-223). Loopback is admitted BY
     * NAME, which is the config boundary's whole job (ADR-0034); nothing else
     * here reaches out.
     */
    allowlist: "127.0.0.0/8",
    providers: [floodsItsName.url, floodsItsRecord.url],
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

      /*
       * AN ITEM THAT PROVIDER CLAIMS A VALUE ABOUT, so its name is printed
       * where the Item page prints a source (CNCORE-217). The label is the name
       * as an import writes it -- `bounded` is the cut `cmppManifest` makes --
       * and it is written here rather than imported because the ROW is not what
       * this suite asserts: the page seam's row test already does.
       */
      const flooding = await aProvider(db, floodsItsName.url, bounded(FLOOD));
      const claimed = await anItemTitled(db, "Claimed by a Provider that floods its name");
      await aStatement(db, {
        subjectItemId: claimed,
        property: "title",
        valueLiteral: "Claimed by a Provider that floods its name",
        sourceId: flooding,
      });

      /*
       * AN ITEM TITLED AS THAT RECORD IS (CNCORE-223), which is the title an
       * import of it would write. Written by hand for the reason the one above
       * is: what this suite asserts is how the page lays the title out, not how
       * it arrived.
       */
      const unbrokenTitle = await anItemTitled(db, UNBROKEN.title);

      /*
       * AND A GROUP NAMED WITH NO BREAK IN IT, which is the Owner's words where
       * those are the Provider's: `group.create` bounds neither.
       */
      await createGroupByHand(db, { name: UNBROKEN_GROUP });

      return {
        dragging: { releaseOrder, inOrder: held.map(({ title }) => title) },
        claimed,
        unbrokenTitle,
      };
    },
  });

  project.provide("browserBaseUrl", instance.baseUrl);
  project.provide("dragging", instance.fixture.dragging);
  project.provide("claimedByTheFlood", instance.fixture.claimed);
  project.provide("browserOwnerPassword", OWNER_PASSWORD);
  project.provide("floodedName", FLOOD);
  project.provide("unbroken", UNBROKEN);
  project.provide("titledUnbroken", instance.fixture.unbrokenTitle);
  project.provide("unbrokenGroup", UNBROKEN_GROUP);

  return async () => {
    await instance.close();
    await floodsItsName.close();
    await floodsItsRecord.close();
  };
}

declare module "vitest" {
  interface ProvidedContext {
    /** The one instance this project serves, on its own database and its own port. */
    browserBaseUrl: string;
    /** The ordering under the mouse: one container, and its members as rendered. */
    dragging: { releaseOrder: string; inOrder: string[] };
    /** ADR-0044's one password, which every control on that page is behind. */
    browserOwnerPassword: string;
    /** The name the one Provider declares, before this app bounded it. */
    floodedName: string;
    /** An Item carrying a value that Provider claims, so its name is on the page. */
    claimedByTheFlood: string;
    /** A record's fields as the second Provider sends them, before this app read them. */
    unbroken: typeof UNBROKEN;
    /** An Item whose title is that record's, with no break in it. */
    titledUnbroken: string;
    /** The name of a Group the Owner drew, with no break in it. */
    unbrokenGroup: string;
  }
}
