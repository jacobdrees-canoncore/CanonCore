import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  askProviderByHand,
  createGroupByHand,
  type Database,
  deleteGroupByHand,
  findGroups,
  findGroupsOfItem,
  findItem,
  findProvidersAGroupAsks,
  GroupRefused,
  groupItems,
  groupProviders,
  groups,
  items,
  previewGroupDeletion,
  putItemInGroupByHand,
  renameGroupByHand,
  stopAskingProviderByHand,
  takeItemOutOfGroupByHand,
} from "./index";
import { anItem, anItemTitled, connect } from "./testing/catalogue";

/**
 * A GROUP IS A BROWSING SCOPE (ADR-0010, `CONTEXT.md`): what a view is narrowed
 * to, never a partition. This file is the scope's own end -- it exists, it is
 * named, it holds Items -- and every test here reads back through the package's
 * public export rather than through the tables underneath it (ADR-0103).
 */
let db: Database;

beforeAll(async () => {
  db = await connect();
});

describe("createGroupByHand", () => {
  it("makes a Group the Owner has named, which the catalogue then lists", async () => {
    // THE OWNER'S OWN WORDS (ADR-0010, story 31). A Group is never typed by
    // medium and never named for one: what a scope is called is the Owner's
    // judgement about their own collection, so the name is stored as given.
    const id = await createGroupByHand(db, { name: "Doctor Who" });

    expect(await findGroups(db)).toStrictEqual(
      expect.arrayContaining([expect.objectContaining({ id, name: "Doctor Who" })]),
    );
  });
});

describe("findGroups", () => {
  it("answers the Owner's scopes in their own alphabet", async () => {
    // A LIST A READER CHOOSES FROM IS A LIST THEY HAVE TO BE ABLE TO SCAN, and
    // creation order is not an order anybody remembers. Asserted as a
    // SUBSEQUENCE of the whole list rather than as the whole of it, because this
    // suite shares one catalogue and other files' Groups are in it too -- the
    // claim is the relative order, which is what an alphabet is.
    const zygon = await createGroupByHand(db, { name: "zzz Zygon" });
    const auton = await createGroupByHand(db, { name: "zzz Auton" });

    const mine = (await findGroups(db))
      .filter((group) => group.id === zygon || group.id === auton)
      .map((group) => group.name);

    expect(mine).toStrictEqual(["zzz Auton", "zzz Zygon"]);
  });
});

describe("renameGroupByHand", () => {
  it("gives the Group the Owner's new name, and the old one is gone", async () => {
    // Story 32: a name chosen badly is not permanent. ONE NAME AND NOT A SET,
    // which is the difference from a title (ADR-0012): a title is a claim
    // Sources make and disagree about, and a scope's name is the Owner's word
    // for their own view. Nothing else ever says what a Group is called.
    const id = await createGroupByHand(db, { name: "Who" });

    expect(await renameGroupByHand(db, { id, name: "Doctor Who universe" })).toBe(true);

    const found = await findGroups(db);
    expect(found).toStrictEqual(expect.arrayContaining([{ id, name: "Doctor Who universe" }]));
    expect(found).not.toStrictEqual(expect.arrayContaining([{ id, name: "Who" }]));
  });

  it("answers false for an id that names no Group, which is an answer rather than a fault", async () => {
    // ADR-0066's posture, the same one `retitleItemByHand` takes: a stale form
    // is the Owner meeting a row that has gone, not the server breaking.
    expect(await renameGroupByHand(db, { id: crypto.randomUUID(), name: "Nowhere" })).toBe(false);
  });
});

describe("putItemInGroupByHand", () => {
  it("puts one Item in SEVERAL Groups at once, because a crossover belongs to both", async () => {
    // ADR-0010'S ENTIRE DECISION, performed. A column on `items` would make a
    // Group a partition -- this Item in exactly one -- and multi-placement is
    // the product. Measured on the wiki, 2026-09-12: 96.8% of stories sit in
    // more than one category, median 4, maximum 52.
    const doctorWho = await createGroupByHand(db, { name: "Doctor Who" });
    const marvel = await createGroupByHand(db, { name: "Marvel" });
    const crossover = await anItemTitled(db, "Doctor Who and the Avengers");

    await putItemInGroupByHand(db, { groupId: doctorWho, itemId: crossover });
    await putItemInGroupByHand(db, { groupId: marvel, itemId: crossover });

    expect(await findGroupsOfItem(db, crossover)).toStrictEqual([
      { id: doctorWho, name: "Doctor Who" },
      { id: marvel, name: "Marvel" },
    ]);
  });

  it("puts the same Item in one Group once, however many times the Owner asks", async () => {
    // There is no Position here, so ADR-0009's Repeat has nothing to be a
    // repeat OF: an Item named twice in one scope is the same claim twice. A
    // second ask is the claim already standing rather than a refusal, because
    // the Owner asking for what is already true has not made a mistake.
    const group = await createGroupByHand(db, { name: "Sarah Jane" });
    const story = await anItem(db);

    const first = await putItemInGroupByHand(db, { groupId: group, itemId: story });
    const again = await putItemInGroupByHand(db, { groupId: group, itemId: story });

    expect(again).toBe(first);
    expect(await findGroupsOfItem(db, story)).toHaveLength(1);
  });
});

describe("takeItemOutOfGroupByHand", () => {
  it("takes the Item out of one scope and leaves the others it is in", async () => {
    // Story 37: a mistake is correctable, and correcting it in one scope is not
    // correcting it in every scope. The same claim ADR-0061 makes for a
    // Container's membership, one construct over.
    const doctorWho = await createGroupByHand(db, { name: "Doctor Who" });
    const marvel = await createGroupByHand(db, { name: "Marvel" });
    const crossover = await anItem(db);
    await putItemInGroupByHand(db, { groupId: doctorWho, itemId: crossover });
    await putItemInGroupByHand(db, { groupId: marvel, itemId: crossover });

    expect(await takeItemOutOfGroupByHand(db, { groupId: marvel, itemId: crossover })).toBe(true);

    expect(await findGroupsOfItem(db, crossover)).toStrictEqual([
      { id: doctorWho, name: "Doctor Who" },
    ]);
  });

  it("puts an Item back in a scope it was taken out of, under the id it always had", async () => {
    // THE TOMBSTONE GOES ON OCCUPYING ITS TUPLE, so putting the Item back is a
    // resurrection rather than a second row (ADR-0078). Measured against
    // PostgreSQL 18 one file over: `group_items_group_item` carries no
    // `deleted_at` predicate, so an insert of that tuple would fail on a
    // constraint naming a row the Owner cannot see.
    const group = await createGroupByHand(db, { name: "Torchwood" });
    const story = await anItem(db);
    const id = await putItemInGroupByHand(db, { groupId: group, itemId: story });
    await takeItemOutOfGroupByHand(db, { groupId: group, itemId: story });

    expect(await putItemInGroupByHand(db, { groupId: group, itemId: story })).toBe(id);
    expect(await findGroupsOfItem(db, story)).toStrictEqual([{ id: group, name: "Torchwood" }]);
  });

  it("answers false when the Item is not in that Group", async () => {
    // ADR-0066 again: a button on a page that has moved on is an answer.
    const group = await createGroupByHand(db, { name: "Class" });

    expect(await takeItemOutOfGroupByHand(db, { groupId: group, itemId: await anItem(db) })).toBe(
      false,
    );
  });
});

describe("deleteGroupByHand", () => {
  it("tombstones the Group and its memberships, and TOUCHES NO ITEM", async () => {
    // ADR-0010'S PROMISE, and the one a reader has to be able to trust before
    // they will use a scope at all: a Group is not a container that can be
    // emptied by accident (story 34). The Items are asserted BACK THROUGH
    // `findItem` rather than by counting rows, because what the Owner would
    // lose is the catalogue entry rather than a row.
    const group = await createGroupByHand(db, { name: "A scope to delete" });
    const other = await createGroupByHand(db, { name: "A scope that stays" });
    const story = await anItemTitled(db, "The Ark in Space");
    await putItemInGroupByHand(db, { groupId: group, itemId: story });
    await putItemInGroupByHand(db, { groupId: other, itemId: story });

    expect(await deleteGroupByHand(db, group)).toBe(true);

    expect(await findItem(db, story)).toStrictEqual(
      expect.objectContaining({ id: story, title: "The Ark in Space" }),
    );
    expect(await findGroups(db)).not.toStrictEqual(
      expect.arrayContaining([expect.objectContaining({ id: group })]),
    );
    expect(await findGroupsOfItem(db, story)).toStrictEqual([
      { id: other, name: "A scope that stays" },
    ]);
    // TOMBSTONED RATHER THAN MERELY HIDDEN BY A JOIN, which is the half the
    // read path above cannot tell apart. A membership left live under a deleted
    // Group is a row that comes back the day anything reads `group_items`
    // without joining `groups` -- and CNCORE-179's narrowed Listing was such a
    // read until CNCORE-230.
    const rows = await db
      .select({ deletedAt: groupItems.deletedAt })
      .from(groupItems)
      .where(eq(groupItems.groupId, group));
    expect(rows).toStrictEqual([{ deletedAt: expect.any(Date) }]);
  });

  it("answers false for a Group that is already gone", async () => {
    const group = await createGroupByHand(db, { name: "Deleted twice" });
    await deleteGroupByHand(db, group);

    expect(await deleteGroupByHand(db, group)).toBe(false);
  });
});

describe("previewGroupDeletion", () => {
  it("counts what deleting the Group would take, and takes none of it", async () => {
    // ADR-0046's COUNTS SHOWN FIRST, for a Group (CNCORE-210). The numbers
    // are known-good literals from the arrangement rather than read back off
    // the delete, so a preview that counted the wrong rows cannot agree with
    // itself. The Item taken back out is the membership the delete would NOT
    // take, because it is already gone.
    const group = await createGroupByHand(db, { name: "A scope to preview" });
    const stays = await anItemTitled(db, "Genesis of the Daleks");
    const also = await anItemTitled(db, "Revenge of the Cybermen");
    const takenOut = await anItemTitled(db, "Terror of the Zygons");
    for (const itemId of [stays, also, takenOut]) {
      await putItemInGroupByHand(db, { groupId: group, itemId });
    }
    await takeItemOutOfGroupByHand(db, { groupId: group, itemId: takenOut });
    await askProviderByHand(db, { groupId: group, providerIdentity: "http://wiki.test:8080" });

    expect(await previewGroupDeletion(db, group)).toStrictEqual({ memberships: 2, asks: 1 });

    // AND NOTHING WENT, read back through what a reader of the Group sees.
    expect(await findGroups(db)).toStrictEqual(
      expect.arrayContaining([{ id: group, name: "A scope to preview" }]),
    );
    expect(await findGroupsOfItem(db, stays)).toStrictEqual([
      { id: group, name: "A scope to preview" },
    ]);
    expect(await findProvidersAGroupAsks(db, group)).toStrictEqual(["http://wiki.test:8080"]);
  });

  it("answers nothing for a Group that is already gone", async () => {
    const group = await createGroupByHand(db, { name: "Previewed after it went" });
    await deleteGroupByHand(db, group);

    expect(await previewGroupDeletion(db, group)).toBeUndefined();
  });
});

describe("what the catalogue refuses", () => {
  it("refuses an Item for a Group that is not there, as a refusal rather than a fault", async () => {
    // THE NARROWING `by-hand.ts` ARGUES AT LENGTH: only the rules the Owner can
    // break become a refusal, so a dead pool or a permissions change goes on
    // being a fault instead of reporting "no such Group" to somebody whose
    // server is broken. Here the rule is that the Group is there and live,
    // which `putItemInGroupByHand` checks before it writes anything.
    await expect(
      putItemInGroupByHand(db, { groupId: crypto.randomUUID(), itemId: await anItem(db) }),
    ).rejects.toBeInstanceOf(GroupRefused);
  });

  it("refuses a Group an Item is not in the catalogue for", async () => {
    const group = await createGroupByHand(db, { name: "A scope with nothing in it" });

    await expect(
      putItemInGroupByHand(db, { groupId: group, itemId: crypto.randomUUID() }),
    ).rejects.toBeInstanceOf(GroupRefused);
  });
});

describe("a Group the Owner deleted", () => {
  it("refuses an Item put into it, rather than reporting success and showing nothing", async () => {
    // THE TRAP `renameGroupByHand` CLOSES, ON THE OTHER WRITE. A tombstone
    // never removes the row, so `group_items`' foreign key is perfectly happy
    // to point at a deleted Group -- and `findGroupsOfItem` then filters it
    // out, which is the Owner told it worked while the page shows nothing
    // (ADR-0075, ADR-0066). Reachable from a second tab or a stale form.
    const group = await createGroupByHand(db, { name: "A deleted scope" });
    const story = await anItem(db);
    await deleteGroupByHand(db, group);

    await expect(
      putItemInGroupByHand(db, { groupId: group, itemId: story }),
    ).rejects.toBeInstanceOf(GroupRefused);
    expect(await findGroupsOfItem(db, story)).toStrictEqual([]);
  });

  it("refuses an Item the Owner deleted, which is the same hole at the other end", async () => {
    // BOTH ENDS TOMBSTONE, so both ends need the check. Asserted separately
    // rather than trusted to the one above, because they are two foreign keys
    // and a guard written for one of them looks complete.
    const group = await createGroupByHand(db, { name: "A scope for a gone Item" });
    const story = await anItem(db);
    await db.update(items).set({ deletedAt: sql`now()` }).where(eq(items.id, story));

    await expect(
      putItemInGroupByHand(db, { groupId: group, itemId: story }),
    ).rejects.toBeInstanceOf(GroupRefused);
  });
});

describe("askProviderByHand", () => {
  it("makes a Group ask the Providers the Owner named, and a Group nobody told asks none", async () => {
    // ADR-0025's HALF THAT WAS MISSING (CNCORE-182). A Group picks which
    // Providers are asked on its behalf, which is what delivers "this Group
    // prefers the wiki": a Group that never asks TMDB is never answered by it.
    // So the default is NONE rather than every configured Provider -- a Group
    // the Owner has not told anything asks nobody, and says so.
    const doctorWho = await createGroupByHand(db, { name: "Doctor Who, asked" });
    const marvel = await createGroupByHand(db, { name: "Marvel, never told" });

    await askProviderByHand(db, { groupId: doctorWho, providerIdentity: "http://wiki.test:8080" });
    await askProviderByHand(db, { groupId: doctorWho, providerIdentity: "http://archive.test" });

    // WRITTEN WIKI FIRST AND READ BACK ARCHIVE FIRST, so the order below is
    // the function's and not the order the fixture happened to insert in.
    expect(await findProvidersAGroupAsks(db, doctorWho)).toStrictEqual([
      "http://archive.test",
      "http://wiki.test:8080",
    ]);
    expect(await findProvidersAGroupAsks(db, marvel)).toStrictEqual([]);
  });
});

describe("stopAskingProviderByHand", () => {
  it("stops the Group asking one Provider and leaves the others it asks", async () => {
    const group = await createGroupByHand(db, { name: "Doctor Who, narrowed" });
    await askProviderByHand(db, { groupId: group, providerIdentity: "http://wiki.test:8080" });
    await askProviderByHand(db, { groupId: group, providerIdentity: "http://tmdb.test" });

    expect(
      await stopAskingProviderByHand(db, { groupId: group, providerIdentity: "http://tmdb.test" }),
    ).toBe(true);

    expect(await findProvidersAGroupAsks(db, group)).toStrictEqual(["http://wiki.test:8080"]);
  });

  it("asks a Provider again under the id it always had", async () => {
    // A TOMBSTONE RATHER THAN A DELETE (ADR-0075), which is what lets asking
    // again come back to the same row -- the undo `takeItemOutOfGroupByHand`
    // offers, one relation over.
    const group = await createGroupByHand(db, { name: "Asked, stopped, asked" });
    const provider = { groupId: group, providerIdentity: "http://wiki.test:8080" };
    const first = await askProviderByHand(db, provider);
    await stopAskingProviderByHand(db, provider);

    expect(await askProviderByHand(db, provider)).toBe(first);
    expect(await findProvidersAGroupAsks(db, group)).toStrictEqual(["http://wiki.test:8080"]);
  });

  it("answers false for a Provider the Group does not ask", async () => {
    const group = await createGroupByHand(db, { name: "Asks nobody" });

    expect(
      await stopAskingProviderByHand(db, { groupId: group, providerIdentity: "http://wiki.test" }),
    ).toBe(false);
  });
});

describe("a Group the Owner deleted asks nobody", () => {
  it("stops asking every Provider with the Group, in the same deletion", async () => {
    // BOTH TOMBSTONES IN ONE TRANSACTION, for `deleteGroupByHand`'s reason.
    const group = await createGroupByHand(db, { name: "A scope that asked the wiki" });
    await askProviderByHand(db, { groupId: group, providerIdentity: "http://wiki.test:8080" });

    await deleteGroupByHand(db, group);

    expect(await findProvidersAGroupAsks(db, group)).toStrictEqual([]);
    // TOMBSTONED RATHER THAN MERELY HIDDEN BY A JOIN, read off the table for
    // the reason the membership test above gives: `findProvidersAGroupAsks`
    // reads through `groups`, so the answer above holds whether or not the
    // deletion reached this row, and only the row can say which.
    const rows = await db
      .select({ deletedAt: groupProviders.deletedAt })
      .from(groupProviders)
      .where(eq(groupProviders.groupId, group));
    expect(rows).toStrictEqual([{ deletedAt: expect.any(Date) }]);
  });

  it("asks nobody even where a Provider row outlived the Group, which is what a race leaves", async () => {
    // THE STATE A DELETION RACING AN ASK LEAVES BEHIND: the ask read the Group
    // live, the deletion tombstoned it and its rows, and the ask's insert landed
    // after. A tombstone is not a DELETE, so no foreign key refuses that insert.
    // Built here by tombstoning the Group alone, because the interleaving itself
    // cannot be scheduled from a test.
    const group = await createGroupByHand(db, { name: "A scope deleted mid-ask" });
    await askProviderByHand(db, { groupId: group, providerIdentity: "http://wiki.test:8080" });
    await db.update(groups).set({ deletedAt: sql`now()` }).where(eq(groups.id, group));

    expect(await findProvidersAGroupAsks(db, group)).toStrictEqual([]);
  });

  it("refuses a Provider asked for it, rather than reporting success and asking nobody", async () => {
    const group = await createGroupByHand(db, { name: "A deleted scope, asked" });
    await deleteGroupByHand(db, group);

    await expect(
      askProviderByHand(db, { groupId: group, providerIdentity: "http://wiki.test:8080" }),
    ).rejects.toBeInstanceOf(GroupRefused);
  });

  it("refuses a Provider asked for a Group that was never drawn", async () => {
    await expect(
      askProviderByHand(db, {
        groupId: crypto.randomUUID(),
        providerIdentity: "http://wiki.test:8080",
      }),
    ).rejects.toBeInstanceOf(GroupRefused);
  });
});
