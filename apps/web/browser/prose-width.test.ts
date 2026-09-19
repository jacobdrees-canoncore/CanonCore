import { type Browser, type BrowserContext, chromium, type Locator, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { gatedTo } from "./gate";

/**
 * TEXT THE PAGE DID NOT WRITE, AT THE WIDTH OF THE OWNER'S PAGE (CNCORE-217,
 * ADR-0123; CNCORE-223, ADR-0142).
 *
 * `cmppManifest` bounds a Provider's declared name at 300 characters, and the
 * page seam asserts the bound. Three hundred characters with no break in them
 * are still one unbreakable line, and a Provider that sends one chooses how WIDE
 * the Owner's page is instead of how long -- found by walking CNCORE-165, where
 * the heading ran off the right edge with the length assertion green beside it.
 * A record's fields, an Item's values and a Group's name are bounded in length
 * by nothing at all, and fail the page the same way (CNCORE-223).
 *
 * A BROWSER BECAUSE NOTHING ELSE CAN SEE THIS. ADR-0103's test for a candidate
 * here is "could a `fetch` observe it?", and a `fetch` observes what the
 * document CONTAINS: a wrap is how the document LAYS OUT. A page test asserting
 * the rule is PRESENT would pass with a rule that is present and does not work,
 * which is the case this file exists for -- `overflow-wrap: break-word` wraps a
 * block and does nothing for a flex item, because it leaves the min-content
 * size the flex item may not shrink below at the whole word.
 */
const baseUrl = inject("browserBaseUrl");
/**
 * A run of the Provider's name long enough to find it by and short enough to be
 * inside the 300 characters the page is given.
 */
const aRunOfTheName = inject("floodedName").slice(0, 100);

let browser: Browser;
let context: BrowserContext;
let page: Page;
let reachedOut: string[] = [];

beforeAll(async () => {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  reachedOut = await gatedTo(context, baseUrl);
  page = await context.newPage();
});

afterAll(async () => {
  await context?.close();
  await browser?.close();
  expect(reachedOut, "the page reached outside the instance under test").toStrictEqual([]);
});

/**
 * How far past its own box an element's content runs, and how far past the
 * viewport the whole document does. Both zero is a page that wrapped.
 *
 * BOTH, BECAUSE EITHER ALONE HAS A FALSE GREEN. A block heading keeps its own
 * box at its container's width while its text runs out of it, so the document
 * alone could pass on a page that clips; and a container that GREW to the word
 * holds its text inside a box that is itself off the page, so the element alone
 * passes on exactly the defect as filed.
 */
async function overrun(element: Locator) {
  return {
    element: await element.evaluate((node) => node.scrollWidth - node.clientWidth),
    document: await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  };
}

describe("a Provider's name with no break in it", () => {
  it("wraps inside the heading over its answers on /import", async () => {
    await page.goto(`${baseUrl}/import?q=anything`);
    const heading = page.getByRole("heading", { level: 3 }).filter({ hasText: aRunOfTheName });

    // LISTED, which the next assertion cannot tell from being dropped: a page
    // that left this Provider out would overrun nothing, and pass.
    await expect.poll(() => heading.count()).toBe(1);
    expect(await overrun(heading)).toStrictEqual({ element: 0, document: 0 });
  });

  /*
   * THE WITNESS THAT TELLS THE TWO RULES APART. The heading above is a block,
   * and `overflow-wrap: break-word` passes it. A Values row is flex, and there
   * `break-word` leaves the label's min-content at the whole word, so the label
   * grows to it and the page scrolls -- the row asserted here, rather than the
   * label, because the grown label holds its text perfectly well.
   */
  it("wraps inside the row where an Item's page names it as a source", async () => {
    await page.goto(`${baseUrl}/items/${inject("claimedByTheFlood")}`);
    const row = page.locator("section[aria-labelledby='values'] li").filter({
      hasText: aRunOfTheName,
    });

    await expect.poll(() => row.count()).toBe(1);
    expect(await overrun(row)).toStrictEqual({ element: 0, document: 0 });
  });
});

describe("a record's fields with no break in them", () => {
  const unbroken = inject("unbroken");

  /*
   * A SEARCH RESULT IS A FLEX ROW, so each of these is the witness `break-word`
   * would fail, as the Values row is above: the row asserted rather than the
   * field, because a field that grew to the word holds its text perfectly well.
   *
   * EACH QUERY IS SHORT, so the heading echoing it has no part in the width
   * and each witness is its row's alone. That heading wraps the query too since
   * CNCORE-226, which a query as wide as the field would be witnessing instead.
   */
  it.each([
    { field: "title", query: unbroken.title.slice(0, 10), run: unbroken.title },
    { field: "kind", query: "whose kind", run: unbroken.kind },
    { field: "release date", query: "whose release date", run: unbroken.released },
  ])("wraps a $field inside its row among /import's search results", async ({ query, run }) => {
    await page.goto(`${baseUrl}/import?q=${encodeURIComponent(query)}`);
    const row = page.locator("section[aria-labelledby='results'] li").filter({
      hasText: run.slice(0, 100),
    });

    await expect.poll(() => row.count()).toBe(1);
    expect(await overrun(row)).toStrictEqual({ element: 0, document: 0 });
  });
});

describe("an Item's title with no break in it", () => {
  const title = inject("unbroken").title;

  it("wraps inside the heading on its own Item page", async () => {
    await page.goto(`${baseUrl}/items/${inject("titledUnbroken")}`);
    const heading = page.getByRole("heading", { level: 1 });

    await expect.poll(() => heading.textContent()).toBe(title);
    expect(await overrun(heading)).toStrictEqual({ element: 0, document: 0 });
  });

  /*
   * AND IN THE VALUES ROW BELOW IT, which prints the same title as the claim it
   * projects from (ADR-0014). The heading is a block and the row is flex, so
   * the heading wrapping says nothing about the row: with only the heading
   * wrapped, the page still ran 1,554 pixels past the viewport.
   *
   * THE `Title` ROW, found by its label, because the sort name derived from
   * this title is a row of its own holding the same word. The document half
   * is what answers for that one.
   */
  it("wraps inside the row where its Item page lists it as a value", async () => {
    await page.goto(`${baseUrl}/items/${inject("titledUnbroken")}`);
    const row = page
      .locator("section[aria-labelledby='values'] li")
      .filter({ has: page.getByText("Title", { exact: true }) })
      .filter({ hasText: title.slice(0, 100) });

    await expect.poll(() => row.count()).toBe(1);
    expect(await overrun(row)).toStrictEqual({ element: 0, document: 0 });
  });

  it("wraps inside its row in the catalogue's own list", async () => {
    await page.goto(`${baseUrl}/`);
    const row = page.locator("main li").filter({ hasText: title.slice(0, 100) });

    await expect.poll(() => row.count()).toBe(1);
    expect(await overrun(row)).toStrictEqual({ element: 0, document: 0 });
  });
});

describe("a Group's name with no break in it", () => {
  /*
   * WHERE CNCORE-179 WRAPPED IT FIRST, as a raw class on the chip. The chips
   * are a flex row, so this is the witness `break-word` fails.
   */
  it("wraps inside the row of Groups the catalogue narrows to", async () => {
    await page.goto(`${baseUrl}/`);
    const chips = page.getByRole("navigation", { name: "Narrow to a Group" });

    await expect.poll(() => chips.textContent()).toContain(inject("unbrokenGroup"));
    expect(await overrun(chips)).toStrictEqual({ element: 0, document: 0 });
  });
});

describe("a device's declared name with no break in it", () => {
  /*
   * THE OWNER'S PAGE ALONE, so this logs in, and logs out again after, since
   * every witness above is what a visitor is shown.
   */
  beforeAll(async () => {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel("Password").fill(inject("browserOwnerPassword"));
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  });

  afterAll(async () => {
    await context.clearCookies();
  });

  /*
   * A DEVICE'S ROW IS FLEX: its names beside the button that logs it out, the
   * shape `/settings` gives a Provider's base URL beside its own. The row is
   * asserted rather than the name, for the reason a search result's is.
   */
  it("wraps inside its row on /devices", async () => {
    const name = inject("unbrokenDevice");
    await page.goto(`${baseUrl}/devices`);
    const row = page.locator("main li").filter({ hasText: name.slice(0, 100) });

    await expect.poll(() => row.count()).toBe(1);
    expect(await overrun(row)).toStrictEqual({ element: 0, document: 0 });
  });
});
