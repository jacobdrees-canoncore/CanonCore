import { describe, expect, inject, it } from "vitest";

import { documentFrom, logInAt, postFormsIn, sectionIn, submit } from "./document";

/**
 * REORDERING A CONTAINER WITHOUT A BROWSER (CNCORE-73), at ADR-0103's fourth
 * seam.
 *
 * THIS IS THE HALF A BROWSER IS NOT NEEDED FOR, and the split is the ticket's
 * own: the browser suite asserts that DRAGGING reorders, because nothing else
 * can, and everything else about reordering is asserted here -- what the write
 * does to the ordering, what it leaves alone, and what the owner is refused.
 * A browser test is the most expensive and most brittle thing in this
 * repository, so it is spent on the one claim that needs it.
 *
 * THE CONTROLS UNDER TEST ARE THE VISIBLE ONES. `CLAUDE.md` requires every
 * keyboard accelerator to have an equivalent visible UI path, so the drag is not
 * the only way to reorder: each row carries Move up and Move down as native
 * forms bound to a Server Action, which React posts as an ordinary
 * `multipart/form-data` request when no script has loaded. Replaying the form
 * the server just rendered observes exactly what a reader with JavaScript
 * switched off observes.
 *
 * ON AN INSTANCE OF ITS OWN, because a reorder moves the positions every other
 * assertion in this suite is written against.
 */
const baseUrl = inject("reorderableBaseUrl");
const reorderable = inject("reorderable");

const owner = await logInAt(baseUrl, inject("ownerPassword"));

function containerPage(id: string, cookie?: string) {
  return documentFrom(baseUrl, `/items/${id}`, cookie);
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
 * Just the titles, in the order the ordering puts them.
 *
 * READ OFF THE LINK RATHER THAN BY STRIPPING THE REST OF THE ROW. A row also
 * carries its sources, its position and up to three buttons, and a subtraction
 * that has to know all of them is one that goes quietly wrong the day a fourth
 * is added. The link IS the title (ADR-0066 makes `/items/<id>` its address).
 */
function titlesIn(text: string): string[] {
  return rowsIn(text).map(
    (row) =>
      /<a\b[^>]*>(.*?)<\/a>/s
        .exec(row)?.[1]
        ?.replaceAll(/<[^>]*>/g, "")
        .trim() ?? "",
  );
}

/** Each Members row's raw HTML, in the order the ordering puts them. */
function rowsIn(text: string): string[] {
  return [...sectionIn(text, "members").matchAll(/<li\b[^>]*>(.*?)<\/li>/gs)].map(
    ([, body]) => body ?? "",
  );
}

/**
 * The Move form on ONE row, named by the title in it and the direction asked
 * for.
 *
 * BY THE ROW RATHER THAN BY INDEX, which is `placement-write.test.ts`'s rule:
 * a Repeat puts one title in an ordering twice and only the placement tells the
 * two apart (ADR-0061).
 */
function moveFormFor(text: string, title: string, direction: "up" | "down") {
  const row = rowsIn(text).find((body) => body.includes(title));
  if (!row) throw new Error(`no member row for ${title}`);
  const label = direction === "up" ? "Move up" : "Move down";
  /*
   * THE BUTTON'S LABEL IS WHAT TELLS THE TWO FORMS APART, and it is not a
   * submitted field -- so the row's own HTML is cut at the `<form>` that carries
   * it before `postFormsIn` reads that one. The alternative was a hidden
   * `direction` field the action does not need, which is a test asking the
   * product for a handle rather than using the one a reader already has.
   */
  const carrying = [...row.matchAll(/<form\b[^>]*>.*?<\/form>/gis)]
    .map(([whole]) => whole)
    .find((form) => form.includes(label));
  if (!carrying) throw new Error(`the row for ${title} carried no ${label}`);
  const [form] = postFormsIn(carrying);
  if (!form) throw new Error(`the ${label} on ${title} did not parse as a form`);
  return form;
}

async function move(container: string, title: string, direction: "up" | "down") {
  const { text } = await containerPage(container, owner);
  return submit(baseUrl, `/items/${container}`, moveFormFor(text, title, direction), owner);
}

describe("reordering a container with no script", () => {
  it("moves a member up, and it takes the position of the one it passed", async () => {
    // POSITIONS ARE SLOTS AND THE PLACEMENTS PERMUTE AMONG THEM (ADR-0116). The
    // fixture is 1, 5, 63 with gaps ON PURPOSE: an ordering of 1, 2, 3 could not
    // tell a permutation from a renumbering that happened to agree with it.
    const after = await move(reorderable.releaseOrder, reorderable.second, "up");

    expect(after.status).toBe(200);
    expect(titlesIn(after.text).slice(0, 2)).toStrictEqual([reorderable.second, reorderable.first]);
    expect(membersIn(after.text)[0]).toContain("#1");
    expect(membersIn(after.text)[1]).toContain("#5");
  });

  it("survives a reload, because the ordering is what changed and not the page", async () => {
    await move(reorderable.releaseOrder, reorderable.third, "up");

    const reloaded = await containerPage(reorderable.releaseOrder, owner);

    expect(titlesIn(reloaded.text)).toContain(reorderable.third);
    expect(titlesIn(reloaded.text).indexOf(reorderable.third)).toBeLessThan(
      titlesIn(reloaded.text).length - 1,
    );
  });

  it("leaves the item's position in every OTHER ordering alone", async () => {
    // The ticket's third criterion and ADR-0061's rule: a container owns its
    // membership outright, so rearranging one says nothing about another.
    await move(reorderable.releaseOrder, reorderable.second, "down");

    const elsewhere = await containerPage(reorderable.storyOrder, owner);

    expect(membersIn(elsewhere.text)).toStrictEqual([
      expect.stringContaining(`#${reorderable.secondPositionElsewhere}`),
    ]);
  });
});

describe("what the ends of the ordering do", () => {
  it("offers no Move up on the first row and no Move down on the last", async () => {
    // A control that cannot do anything is worse than no control: it reads as
    // broken rather than as the end of the list.
    const { text } = await containerPage(reorderable.releaseOrder, owner);
    const rows = rowsIn(text);
    const first = rows[0] ?? "";
    const last = rows[rows.length - 1] ?? "";

    expect(first).not.toContain("Move up");
    expect(last).not.toContain("Move down");
  });
});

describe("what a visitor is shown", () => {
  it("offers a visitor no way to reorder what a container holds", async () => {
    // ADR-0044 makes the demo READ-ONLY, asserted about the PAGE rather than
    // about the router underneath it.
    const { text } = await containerPage(reorderable.releaseOrder);

    expect(membersIn(text).join(" ")).not.toContain("Move up");
    expect(membersIn(text).join(" ")).not.toContain("Move down");
  });
});
