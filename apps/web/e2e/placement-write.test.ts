import { describe, expect, inject, it } from "vitest";

import {
  documentFrom,
  formIn,
  logInAt,
  postFormsIn,
  type RenderedForm,
  sectionIn,
  submit,
  withFields,
} from "./document";

/**
 * PLACING AN ITEM IN A CONTAINER AND TAKING IT OUT AGAIN (CNCORE-72), at
 * ADR-0103's fourth seam.
 *
 * NO BROWSER, WHICH IS THE TICKET'S OWN CRITERION. Every control these surfaces
 * carry is a native `<form>` bound to a Server Action, which React posts as an
 * ordinary `multipart/form-data` request when no script has loaded -- so
 * replaying the form the server just rendered observes exactly what a browser
 * with JavaScript switched off observes.
 *
 * ON AN INSTANCE OF ITS OWN, for `aCatalogueSafeToEdit`'s reason one operation
 * along: these tests CHANGE WHAT CONTAINERS HOLD, and every container on the
 * seeded instance is somebody else's fixture, asserted row by row.
 */
const baseUrl = inject("curatableBaseUrl");
const curatable = inject("curatable");

const owner = await logInAt(baseUrl, inject("ownerPassword"));

function documentAt(path: string, cookie?: string) {
  return documentFrom(baseUrl, path, cookie);
}

/** The container's own page, which is where its membership is curated. */
function containerPage(id: string, cookie?: string) {
  return documentAt(`/items/${id}`, cookie);
}

/**
 * Places an item into a container through the page, as an owner does: the form
 * the container's own page renders, submitted with no script.
 */
async function place(
  container: string,
  { itemId, position }: { itemId: string; position: string },
) {
  const { text } = await containerPage(container, owner);
  const form = withFields(formIn(text, "place-a-member"), { itemId, position });
  return submit(baseUrl, `/items/${container}`, form, owner);
}

/** The Members rows a page is showing, as the reader reads them. */
function membersIn(text: string): string[] {
  return [...sectionIn(text, "members").matchAll(/<li\b[^>]*>(.*?)<\/li>/gs)].map(([, row]) =>
    (row ?? "")
      .replaceAll(/<[^>]*>/g, " ")
      .replaceAll(/\s+/g, " ")
      .trim(),
  );
}

/**
 * The Remove form on ONE member's row, found by what that row says.
 *
 * BY THE ROW RATHER THAN BY POSITION IN THE LIST, because a Repeat puts one
 * title in an ordering twice and the position is what tells the two apart --
 * which is the same fact that makes every mutation name a Placement (ADR-0061).
 */
function rowFor(text: string, title: string, position: string): RenderedForm {
  const rows = [...sectionIn(text, "members").matchAll(/<li\b[^>]*>(.*?)<\/li>/gs)];
  const row = rows.find(
    ([, body]) => (body ?? "").includes(title) && (body ?? "").includes(position),
  );
  if (!row) throw new Error(`no member row for ${title} at ${position}`);
  const [form] = postFormsIn(row[1] ?? "");
  if (!form) throw new Error(`the row for ${title} at ${position} carried no form`);
  return form;
}

describe("placing an item in a container", () => {
  it("puts the item in the container's Members list, at the position the owner gave", async () => {
    const after = await place(curatable.releaseOrder, {
      itemId: curatable.story,
      position: "63",
    });

    expect(after.status).toBe(200);
    expect(membersIn(after.text)).toStrictEqual([expect.stringContaining(curatable.storyTitle)]);
    expect(membersIn(after.text)[0]).toContain("#63");
  });

  it("puts the same item in a SECOND container, and both orderings stand", async () => {
    // THE PRODUCT'S CENTRAL CLAIM, performed by hand at the page seam: one item
    // in two orderings at two positions, both true at once (ADR-0009). The
    // second placement does not disturb the first, because every container owns
    // its membership outright (ADR-0061).
    await place(curatable.releaseOrder, { itemId: curatable.otherStory, position: "1" });

    const after = await place(curatable.storyOrder, {
      itemId: curatable.otherStory,
      position: "9",
    });

    expect(membersIn(after.text)).toStrictEqual([expect.stringContaining(curatable.otherTitle)]);
    expect(membersIn(after.text)[0]).toContain("#9");

    // AND THE FIRST ORDERING IS UNTOUCHED, read back from its own page.
    const release = await containerPage(curatable.releaseOrder, owner);
    expect(
      membersIn(release.text).filter((row) => row.includes(curatable.otherTitle)),
    ).toStrictEqual([expect.stringContaining("#1")]);
  });

  it("places an item with NO position, and the row says so rather than guessing", async () => {
    // CONTEXT.md's Unplaced: a member with no position is still a member, and
    // the reader's words are "no position given". An empty field is how an owner
    // says it.
    const after = await place(curatable.storyOrder, { itemId: curatable.story, position: "" });

    expect(membersIn(after.text).filter((row) => row.includes(curatable.storyTitle))).toStrictEqual(
      [expect.stringContaining("No position given")],
    );
  });
});

describe("what the owner is refused", () => {
  it("says the item is already there rather than failing, for a Repeat at ONE position", async () => {
    // ADR-0116: "A UI that permits the gesture and then fails the write is worse
    // than one that refuses the gesture." With no script a form cannot know
    // which positions are taken, so the honest version is that the refusal comes
    // back as a SENTENCE on the page rather than as a 500.
    const twice = { itemId: curatable.story, position: "40" };
    await place(curatable.releaseOrder, twice);

    const after = await place(curatable.releaseOrder, twice);

    expect(after.status).toBe(200);
    expect(sectionIn(after.text, "place-a-member")).toContain("already");
  });
});

describe("taking a member out again", () => {
  it("removes it from this container, leaves its other placements, and offers an undo", async () => {
    // ADR-0061 and ADR-0046 in one gesture: the member goes from THIS ordering
    // and stays in the other, and what the owner is offered is an undo rather
    // than a confirmation they had to dismiss before the removal happened.
    const inBoth = curatable.otherStory;
    await place(curatable.releaseOrder, { itemId: inBoth, position: "77" });
    await place(curatable.storyOrder, { itemId: inBoth, position: "78" });

    const { text } = await containerPage(curatable.releaseOrder, owner);
    const row = rowFor(text, curatable.otherTitle, "#77");
    const after = await submit(baseUrl, `/items/${curatable.releaseOrder}`, row, owner);

    expect(membersIn(after.text).filter((r) => r.includes("#77"))).toStrictEqual([]);
    expect(after.text).toContain("Removed from this container");

    const storyOrder = await containerPage(curatable.storyOrder, owner);
    expect(membersIn(storyOrder.text).filter((r) => r.includes("#78"))).toHaveLength(1);
  });

  it("undoes the removal, and the member returns with its position and its origin", async () => {
    await place(curatable.storyOrder, { itemId: curatable.story, position: "12" });
    const { text } = await containerPage(curatable.storyOrder, owner);
    const removed = await submit(
      baseUrl,
      `/items/${curatable.storyOrder}`,
      rowFor(text, curatable.storyTitle, "#12"),
      owner,
    );

    const undo = formIn(removed.text, "place-a-member");
    const after = await submit(baseUrl, `/items/${curatable.storyOrder}`, undo, owner);

    // WITH ITS ORIGIN, which is the half a bare "the row is back" would miss:
    // the removal left `placement_sources` standing, so the member returns
    // claimed by the Owner rather than as a claim nobody made (ADR-0017).
    expect(membersIn(after.text).filter((r) => r.includes("#12"))).toStrictEqual([
      expect.stringContaining("Owner"),
    ]);
  });
});

describe("what a visitor is shown", () => {
  it("offers a visitor no way to change what a container holds", async () => {
    // ADR-0044 makes the demo READ-ONLY, and this asserts it about the PAGE
    // rather than about the router underneath it: a visitor is shown the whole
    // ordering and no control that would change it.
    await place(curatable.releaseOrder, { itemId: curatable.story, position: "55" });

    const { text } = await documentAt(`/items/${curatable.releaseOrder}`);

    expect(text).toContain(curatable.storyTitle);
    expect(() => sectionIn(text, "place-a-member")).toThrow();
    expect(membersIn(text).join(" ")).not.toContain("Remove");
  });
});
