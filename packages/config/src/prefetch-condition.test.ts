import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot } from "./testing/repo-root";
import { withoutComments } from "./testing/without-comments";

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

/**
 * Every file under one directory whose name the pattern accepts, as a path
 * relative to the repository root.
 *
 * ONE WALK FOR BOTH QUESTIONS BELOW, which look for different names under
 * different roots and were otherwise the same six lines twice.
 */
function filesUnder(root: string, named: RegExp): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && named.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name).slice(repoRoot.length + 1));
}

/**
 * Every TypeScript source in the two trees this app's components live in.
 *
 * THOSE TWO AND NOT THE REPOSITORY, because they are where a rendered `<Link>`
 * can be: `apps/web/src` holds the pages and their components, `packages/ui/src`
 * the primitives they build from. The word `<Link>` appears elsewhere -- in this
 * suite's own prose, in a router's comment -- and none of those render.
 */
function appAndUiSources(): string[] {
  return [join(repoRoot, "apps", "web", "src"), join(repoRoot, "packages", "ui", "src")].flatMap(
    (root) => filesUnder(root, /\.tsx?$/),
  );
}

/**
 * A file's code with its comments taken out, which is the whole difficulty here.
 *
 * Every site that CHOSE a form over a link explains itself in the prose above it,
 * and those explanations say the word `prefetch` more often than any JSX does. A
 * reader that counted the raw bytes would find the argument for the rule and
 * report it as a breach of it.
 *
 * THE STRIPPING IS `without-comments.ts` SINCE CNCORE-300, where the reason it
 * cannot be a regular expression is written down: the two lines that stood here
 * read a `/*` inside a string as opening a comment, and took a `//` only at a
 * line start, so a trailing `// prefetch` survived into a count of `prefetch`.
 */
function codeOf(path: string): string {
  return withoutComments(readFileSync(join(repoRoot, path), "utf8"));
}

describe("the configuration ADR-0161's measurement holds under", () => {
  it("reads pages and links that are really there, so nothing below passes by finding nothing", () => {
    const sources = appAndUiSources();
    expect(sources.length).toBeGreaterThan(20);
    expect(sources.filter((file) => codeOf(file).includes("<Link")).length).toBeGreaterThan(0);
    // AND THE ROUTE TREE, which the `loading` question reads and this one does
    // not: an empty or moved `app/` would satisfy "no boundaries" by having no
    // pages, which is the hazard this file's docblock names.
    expect(filesUnder(APP, /^page\.tsx$/).length).toBeGreaterThan(5);
  });

  it("puts no `loading` boundary above a read, which is what would make a dynamic route prefetchable", () => {
    const boundaries = filesUnder(APP, /^loading\.(tsx|ts|jsx|js)$/);

    expect(boundaries, "ADR-0161: a `loading` boundary puts the prefetch back").toStrictEqual([]);
  });

  it("sets `prefetch` on no link at all, so every one of them takes the automatic default", () => {
    const set = appAndUiSources().filter((file) => /\bprefetch\s*=/.test(codeOf(file)));

    /*
     * ANY VALUE, NOT ONLY `true`. `prefetch={true}` is what puts the cost back;
     * `prefetch={false}` is strictly safer and would still fail here, and that
     * is deliberate rather than a miss. A regular expression cannot read
     * `prefetch={someVariable}`, and ADR-0161's measurement is of the AUTOMATIC
     * default -- so any hand-set value is a departure from what was measured
     * and belongs in front of the record before it lands.
     */
    expect(set, "ADR-0161: this measured the automatic default, not a set one").toStrictEqual([]);
  });

  it("enables neither half of Partial Prefetching, which renders a route at prefetch time", () => {
    const config = codeOf(join("apps", "web", "next.config.ts"));

    expect(/\bcacheComponents\b/.test(config), "ADR-0161: Cache Components").toBe(false);
    expect(/\bpartialPrefetching\b/.test(config), "ADR-0161: Partial Prefetching").toBe(false);
  });
});
