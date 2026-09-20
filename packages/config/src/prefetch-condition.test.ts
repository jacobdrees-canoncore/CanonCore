import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot } from "./testing/repo-root";

/**
 * THE THREE THINGS ADR-0161'S MEASUREMENT RESTS ON, held to the tree rather than
 * to a sentence (CNCORE-245, CNCORE-240).
 *
 * That record measured what a prefetch of this app's read surfaces costs and
 * found it to be NOTHING -- a dynamic route with no `loading.js` boundary is not
 * prefetched at all, so no `<Link>` here spends a Provider's time on a reader who
 * merely scrolled. ADR-0046, ADR-0149 and ADR-0151 each spent that cost as an
 * argument for three years' worth of controls being forms, and it was never
 * there.
 *
 * **THE RESULT IS TRUE OF THIS CONFIGURATION RATHER THAN OF NEXT**, which is the
 * whole reason this file exists. Three changes each put the cost back, and each
 * is one line somebody could write for an unrelated reason:
 *
 * - **A `loading.tsx` above a read.** Next prefetches a dynamic route down to the
 *   nearest `loading.js` boundary, and a Server Component ABOVE that boundary
 *   runs when the route is prefetched rather than when it is visited
 *   (`prefetching.md:31,229` in the installed 16.3.5).
 * - **An explicit `prefetch={true}`.** That prefetches the full route for a
 *   dynamic route as well as a static one, uncached content included
 *   (`link.md:303`).
 * - **Partial Prefetching.** `cacheComponents` with `partialPrefetching` renders
 *   a prefetchable route's tree again at prefetch time, at a server invocation
 *   per prefetchable link.
 *
 * SO THE CHECK IS THE CONDITION, NOT THE COST. Nothing here measures a prefetch:
 * ADR-0103's fourth seam does that, at `import-page.test.ts`, where a request
 * carrying Next's own prefetch headers is shown to render nothing. What this
 * holds is the configuration that makes that measurement mean what the records
 * now say it means -- so the person who adds a loading boundary meets the record
 * rather than discovering the cost from a Provider's bill.
 *
 * WHY A CHECK RATHER THAN A SENTENCE. A figure measured once, written into prose
 * and never re-measured is this repository's most common defect (ADR-0153), and
 * the claim this replaces was written into three records and re-measured by
 * none of them. A condition is the same class: true the day it is written.
 *
 * THIS IS NOT IN `tree-figures.test.ts` because every figure that table holds is
 * a POSITIVE count -- it refuses a claim stating zero, deliberately, so that a
 * pattern which has stopped matching cannot pass by finding nothing. All three
 * figures here are zero, which is the shape that table cannot carry.
 *
 * Decided by the DISPATCHER on 2026-09-20, not by the Owner.
 */
const APP = join(repoRoot, "apps", "web", "src", "app");

/** Every source file on a surface a `<Link>` can be written on. */
function surfaceFiles(): string[] {
  return [join(repoRoot, "apps", "web", "src"), join(repoRoot, "packages", "ui", "src")].flatMap(
    (root) =>
      readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
        .map((entry) => join(entry.parentPath, entry.name)),
  );
}

/**
 * A file's code with its comments taken out, which is the whole difficulty here.
 *
 * Every site that CHOSE a form over a link explains itself in the prose above it,
 * and those explanations say the word `prefetch` more often than any JSX does. A
 * reader that counted the raw bytes would find the argument for the rule and
 * report it as a breach of it.
 */
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("the configuration ADR-0161's measurement holds under", () => {
  it("reads surfaces that really carry links, so it cannot pass by finding nothing", () => {
    const files = surfaceFiles();
    expect(files.length).toBeGreaterThan(20);
    expect(files.filter((file) => codeOf(file).includes("<Link")).length).toBeGreaterThan(0);
  });

  it("puts no `loading` boundary above a read, which is what would make a dynamic route prefetchable", () => {
    const boundaries = readdirSync(APP, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /^loading\.(tsx|ts|jsx|js)$/.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name).slice(repoRoot.length + 1));

    expect(boundaries, "ADR-0161: a `loading` boundary puts the prefetch back").toStrictEqual([]);
  });

  it("forces no prefetch on any link, so every one of them takes the automatic default", () => {
    const forced = surfaceFiles()
      .filter((file) => /\bprefetch\s*=/.test(codeOf(file)))
      .map((file) => file.slice(repoRoot.length + 1));

    expect(forced, "ADR-0161: `prefetch={true}` prefetches the whole route").toStrictEqual([]);
  });

  it("enables neither half of Partial Prefetching, which renders a route at prefetch time", () => {
    const config = codeOf(join(repoRoot, "apps", "web", "next.config.ts"));

    expect(/\bcacheComponents\b/.test(config), "ADR-0161: Cache Components").toBe(false);
    expect(/\bpartialPrefetching\b/.test(config), "ADR-0161: Partial Prefetching").toBe(false);
  });
});
