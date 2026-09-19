import { type Browser, type BrowserContext, chromium, type Locator, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { gatedTo } from "./gate";

/**
 * A PROVIDER'S PROSE, AT THE WIDTH OF THE OWNER'S PAGE (CNCORE-217, ADR-0123).
 *
 * `cmppManifest` bounds a Provider's declared name at 300 characters, and the
 * page seam asserts the bound. Three hundred characters with no break in them
 * are still one unbreakable line, and a Provider that sends one chooses how WIDE
 * the Owner's page is instead of how long -- found by walking CNCORE-165, where
 * the heading ran off the right edge with the length assertion green beside it.
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
const floodedName = inject("floodedName");

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
    const heading = page.getByRole("heading", { level: 3 }).filter({
      hasText: floodedName.slice(0, 100),
    });

    // LISTED, which the next assertion cannot tell from being dropped: a page
    // that left this Provider out would overrun nothing, and pass.
    await expect.poll(() => heading.count()).toBe(1);
    expect(await overrun(heading)).toStrictEqual({ element: 0, document: 0 });
  });
});
