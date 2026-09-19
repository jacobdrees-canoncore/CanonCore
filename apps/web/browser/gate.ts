import type { BrowserContext } from "playwright";

/**
 * Every request a browser context makes outside the instance under test,
 * recorded and then refused.
 *
 * THE NODE GATE CANNOT SEE A BROWSER. `install-network-gate` patches undici
 * inside the Vitest process, and a browser is a subprocess making its own
 * requests -- so this suite would be the one place in the repository where a
 * page reaching a public host went unnoticed. `context.route()` is the only
 * thing positioned to see it.
 *
 * RECORDED AND THEN ASSERTED, rather than only aborted. An abort alone would
 * make the page fail in whatever way a blocked request makes it fail, which is
 * a puzzle rather than a message; the list this returns is what turns it into
 * one, and each file asserts it empty when it ends.
 *
 * ONE FUNCTION FOR EVERY FILE HERE (CNCORE-217), where `reorder.test.ts` held it
 * alone while it was the only one: a second copy of a gate is where two files
 * quietly stop agreeing about what the instance's origin is.
 */
export async function gatedTo(context: BrowserContext, baseUrl: string): Promise<string[]> {
  const reachedOut: string[] = [];
  const instance = new URL(baseUrl).origin;
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (new URL(url).origin === instance) return route.continue();
    reachedOut.push(url);
    return route.abort("blockedbyclient");
  });
  return reachedOut;
}
