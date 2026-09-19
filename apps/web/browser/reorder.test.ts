import { type Browser, type BrowserContext, chromium, type Locator, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { gatedTo } from "./gate";
import { logIn } from "./log-in";

/**
 * DRAGGING A PLACEMENT TO REORDER A CONTAINER (CNCORE-73), in a real browser,
 * which is where ADR-0103's reserved seam is spent.
 *
 * IT ASSERTS TWO THINGS AND NOTHING ELSE: that dragging reorders, and that the
 * new order survives a reload. Both need a browser and nothing else here does
 * -- the arithmetic is a pure function with its own unit test, the write is
 * asserted at the router, the refusals at the database, and the whole
 * capability is asserted WITHOUT a browser at the page seam, because every row
 * carries Move up and Move down as native forms. A browser test is the most
 * expensive and most brittle thing in this repository, and ADR-0103 bounds what
 * this suite may spend one on: this file's two claims, and since CNCORE-217 a
 * third in `prose-width.test.ts`.
 *
 * THE DRAG IS A MOUSE, NOT `dragTo`. Playwright's `locator.dragTo` moves the
 * pointer in ONE jump, and a single jump routinely fails a pointer sensor's
 * activation constraint -- so the drop does nothing, no exception is raised,
 * and the test passes having reordered nothing. That false green is the
 * failure this file is written against, so it moves in steps, and it ASSERTS
 * THE DRAG ACTUALLY STARTED before releasing.
 */
const baseUrl = inject("browserBaseUrl");
const dragging = inject("dragging");

let browser: Browser;
let context: BrowserContext;
let page: Page;

/** Everything the browser tried to reach that is not the instance under test. */
let reachedOut: string[] = [];

beforeAll(async () => {
  browser = await chromium.launch();
  /*
   * A VIEWPORT TALL ENOUGH TO HOLD TWO ROWS AT ONCE, which a drag needs and the
   * 720px default does not give: an item page carries a header, a values table
   * and a place-an-item form above its Members list, so the ordering starts
   * below the fold. `page.mouse` moves in VIEWPORT coordinates and does not
   * scroll the way `click` does, so a box read below the fold is pressed on the
   * `<html>` element and the drag silently never starts. That cost this file
   * its second run; `visible` below is what turns the next one into a sentence.
   */
  context = await browser.newContext({ viewport: { width: 1280, height: 1600 } });

  reachedOut = await gatedTo(context, baseUrl);

  page = await context.newPage();
  await logIn(page, baseUrl);
});

afterAll(async () => {
  await context?.close();
  await browser?.close();
  expect(reachedOut, "the page reached outside the instance under test").toStrictEqual([]);
});

async function openTheContainer() {
  await page.goto(`${baseUrl}/items/${dragging.releaseOrder}`);
  /*
   * WAIT UNTIL THE LIST IS ACTUALLY DRAGGABLE, WHICH IS NOT WHEN IT IS VISIBLE.
   * The rows are server-rendered, so every handle is on the page and has a
   * bounding box before any script has run -- and a press that lands in that
   * window does nothing at all, silently. This cost the first run of this file:
   * the drag never started and only the guard below said so.
   *
   * `aria-roledescription` IS THE SIGNAL BECAUSE dnd-kit WRITES IT ITSELF.
   * 0.5.0 attaches its ARIA imperatively after hydration rather than rendering
   * it, so the attribute appearing IS the sensor having registered -- which is
   * the thing being waited for, rather than `networkidle` or a sleep standing
   * in for it.
   */
  await page.locator(`${ROWS} [aria-roledescription="draggable"]`).first().waitFor();
  /*
   * TRANSITIONS OFF BEFORE ANYTHING MOVES. A sortable list animates rows into
   * their new places, so a bounding box read mid-flight is a box the row is
   * leaving -- and the drop lands on whatever is under a stale coordinate.
   * dnd-kit's own Playwright fixture does this first and so does this.
   */
  await page.addStyleTag({
    content: "*, *::before, *::after { transition: none !important; animation: none !important; }",
  });
}

/**
 * The Members rows a reader actually sees, which is not every `<li>` in the DOM
 * while a drag is happening.
 *
 * dnd-kit LIFTS THE ROW INTO A POPOVER AND LEAVES AN `inert` PLACEHOLDER where
 * it was, so mid-drag the list holds TWO elements carrying one `data-placement`
 * -- and a locator that matched both failed Playwright's strict mode rather
 * than answering. That error reached this file as `expect.poll` retrying
 * quietly until it timed out, reported as "expected null to be true", which is
 * a message about the wrong thing entirely. The placeholder is `aria-hidden`,
 * so excluding it is also what a reader's own view of the list is.
 */
const ROWS = "li[data-placement]:not([data-dnd-placeholder])";

function titlesOnThePage(): Promise<string[]> {
  return page.locator(`${ROWS} a`).allInnerTexts();
}

/**
 * Drags the row holding `title` onto the row holding `onto`, as a mouse does.
 *
 * THE ACTIVATION CONSTRAINT IS CROSSED DELIBERATELY, then confirmed: a short
 * move, a wait until the source says it is being dragged, and only then the
 * travel to the target. Releasing without that confirmation is how a drag test
 * passes having done nothing at all.
 */
async function drag(title: string, onto: string) {
  const source = page.locator(ROWS, { hasText: title });
  const target = page.locator(ROWS, { hasText: onto });
  const handle = source.getByLabel("Reorder by dragging");

  await source.scrollIntoViewIfNeeded();
  const from = await visible(handle, title);
  const to = await visible(target, onto);

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 6 });
  /*
   * `aria-grabbed` RATHER THAN AN ATTRIBUTE OF OUR OWN, because it is the thing
   * a reader who cannot see the row is told, and a drag that has not announced
   * itself has not started as far as this product is concerned. dnd-kit writes
   * it imperatively once the sensor takes the pointer.
   */
  await expect.poll(() => handle.getAttribute("aria-grabbed")).toBe("true");

  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();
}

/**
 * One element's box, ASSERTED TO BE SOMEWHERE THE MOUSE CAN REACH IT.
 *
 * A BOX BELOW THE FOLD IS THE DRAG TEST'S OTHER FALSE GREEN. `boundingBox`
 * answers document-relative coordinates whether or not the element is on
 * screen, and `page.mouse` moves in VIEWPORT coordinates without scrolling --
 * so a press at y=771 in a 720-tall window lands on `<html>`, the sensor never
 * sees it, nothing throws, and the assertion that the drag started is the only
 * thing between that and a green run. This is where it becomes a sentence.
 */
async function visible(locator: Locator, what: string) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${what} has no box: it is not rendered`);
  const viewport = page.viewportSize();
  if (viewport && (box.y < 0 || box.y + box.height > viewport.height)) {
    throw new Error(
      `${what} sits at y=${Math.round(box.y)} in a ${viewport.height}-tall viewport, ` +
        "so a mouse press would land on the page behind it rather than on the row",
    );
  }
  return box;
}

describe("dragging a Placement", () => {
  it("reorders the container, and the new order survives a reload", async () => {
    await openTheContainer();
    const [first, second] = dragging.inOrder;
    if (!first || !second) throw new Error("the fixture seeded an ordering");

    expect(await titlesOnThePage()).toStrictEqual(dragging.inOrder);

    await drag(second, first);

    // THE PAGE MOVED, which is the half only a browser can see.
    await expect.poll(titlesOnThePage).toStrictEqual([second, first, ...dragging.inOrder.slice(2)]);

    /*
     * AND THE CATALOGUE MOVED, which is what a reload asks. A drag that only
     * rearranged the DOM would pass the assertion above and fail this one --
     * which is not hypothetical: it is what this file did before the write was
     * put in a transition.
     *
     * THE WRITE IS WAITED FOR RATHER THAN RACED. The rows move on local state,
     * so the list is in its new order before the POST has been answered, and
     * reloading straight away asks the server a question the server has not
     * been told the answer to yet. There is no DOM signal for "the write
     * landed" -- a successful one changes nothing on the page, because the page
     * already shows it -- so the settling of the network is the honest one.
     */
    await page.waitForLoadState("networkidle");
    await openTheContainer();
    expect(await titlesOnThePage()).toStrictEqual([second, first, ...dragging.inOrder.slice(2)]);
  });
});
