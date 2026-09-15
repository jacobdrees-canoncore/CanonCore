import { describe, expect, inject, it } from "vitest";

import { documentFrom, logInAt } from "./document";

/**
 * THE ONE CONTROL THIS APP DRAWS ITSELF, over real HTTP (CNCORE-177).
 *
 * ADR-0103's fourth seam, by that record's own test for where an assertion
 * belongs: a `class` attribute is server-rendered markup, so `fetch` observes
 * exactly what a browser would and the fact that a browser COULD also see it is
 * not an argument for one.
 *
 * READ ACROSS THE THREE SURFACES THAT CARRY IT, like `header.test.ts` and for
 * the same reason. The control is a native `<select>` wearing `Input`'s metrics
 * -- a Base UI one is a client component needing script, and every form in this
 * app works without any. That identity was hand-copied onto three pages, and
 * the third had lost two of its classes: a control shorter than its neighbour
 * in a different type size, which `.claude/rules/frontend.md` files under
 * "reads as part of this product" and is the near miss that rule watches for.
 *
 * IT IS `packages/ui`'s `Select` NOW, which is where the drift stops being
 * possible -- and this file is what says the three surfaces actually use it.
 *
 * AN ASSERTION ON ONE PAGE COULD NOT HAVE SEEN IT. Each of the three copies was
 * internally consistent and rendered correctly on its own page; what was wrong
 * was only visible by holding two of them up against each other, which is what
 * this file does and what nothing else was doing.
 */
const baseUrl = inject("baseUrl");
/**
 * THE INSTANCE WHOSE ORDERINGS MAY BE CURATED, because the third select is on
 * the form that places an Item in a Container and every container on the seeded
 * instance is somebody else's fixture. Nothing here writes; this is the
 * instance whose page HAS the form.
 */
const curatableBaseUrl = inject("curatableBaseUrl");
const curatable = inject("curatable");

const ownerOfTheSeeded = await logInAt(baseUrl, inject("ownerPassword"));
const ownerOfTheCuratable = await logInAt(curatableBaseUrl, inject("ownerPassword"));

/**
 * The `class` of the one `<select>` a page renders, or a failure naming what it
 * found instead.
 *
 * IT REFUSES A SECOND ONE RATHER THAN TAKING THE FIRST. Each of these pages
 * carries exactly one select today; the day a page grows a second, a helper
 * that quietly picked the earlier tag would compare the wrong control and pass.
 */
function theSelectClassesOn(text: string): string[] {
  const found = [...text.matchAll(/<select\b[^>]*\bclass="([^"]*)"/g)].map(([, value]) => value);
  if (found.length === 0) throw new Error("that page rendered no select with a class");
  if (found.length > 1) throw new Error(`that page rendered ${found.length} selects, not one`);
  return (found[0] as string).split(/\s+/).filter((utility) => utility !== "");
}

/** The `class` of the named `<input>` on a page, for comparing a row's controls. */
function theInputClassNamed(text: string, name: string): string {
  const found = new RegExp(`<input\\b[^>]*\\bname="${name}"[^>]*>`).exec(text)?.[0];
  if (found === undefined) throw new Error(`that page rendered no input named ${name}`);
  const className = /\bclass="([^"]*)"/.exec(found)?.[1];
  if (className === undefined) throw new Error(`the input named ${name} carries no class`);
  return className;
}

describe("the select this app draws itself", () => {
  it("is the same control on every surface that renders one", async () => {
    /*
     * THE CRITERION, AND IT IS A COMPARISON RATHER THAN A SNAPSHOT. Asserting
     * the literal string here would be hand-copying the fourth copy of the
     * thing this ticket exists to stop there being three of, and it would
     * redden on any future change to the control rather than on a drift.
     */
    const [creating, importing, placing] = await Promise.all([
      documentFrom(baseUrl, "/new", ownerOfTheSeeded),
      documentFrom(baseUrl, "/import"),
      documentFrom(curatableBaseUrl, `/items/${curatable.releaseOrder}`, ownerOfTheCuratable),
    ]);

    /*
     * `/new` PASSES NOTHING IN, so what it renders IS the control -- which is
     * what makes it the thing to read the identity off rather than an arbitrary
     * choice of reference among three.
     */
    const identity = theSelectClassesOn(creating.text);
    // A CONTROL WEARING NOTHING WOULD SATISFY EVERY COMPARISON BELOW, so the
    // thing being compared is checked to be a thing first.
    expect(identity).toContain("h-8");

    /*
     * `/items/<container>` ADDS NOTHING EITHER, so its select is the same
     * string down to the byte and that is the strictest this can be asserted.
     */
    expect(theSelectClassesOn(placing.text)).toStrictEqual(identity);

    /*
     * `/import` NARROWS IT, which is the one thing a surface may do: its select
     * shares a flex row with an `Input` and carries the same `max-w-xs` cap
     * that Input does. So what is asserted there is that the identity survives
     * WHOLE -- which is exactly what had gone wrong, the copy on that page
     * having lost `w-full` and `md:text-xs` where nothing could see it.
     */
    expect(theSelectClassesOn(importing.text)).toEqual(expect.arrayContaining(identity));
  });

  it("wears the metrics of the Input it stands beside", async () => {
    /*
     * WHICH IDENTITY IT IS, which the comparison above cannot say: three
     * surfaces agreeing on the wrong control agree just as well as three
     * agreeing on the right one.
     *
     * THE LIST IS THE ONE THE SURFACES THEMSELVES NAME. Stock shadcn ships
     * `h-9 px-3 text-base ring-[3px]` and a select wearing those sits a step
     * taller and larger than the field beside it -- the mismatch review caught
     * on `/items/<container>` and `/new` records against its Title field. The
     * pair is read off ONE row of ONE page, which is the row those docblocks
     * are written about: the Item select and the Position field beside it.
     */
    const { text } = await documentFrom(
      curatableBaseUrl,
      `/items/${curatable.releaseOrder}`,
      ownerOfTheCuratable,
    );

    const select = theSelectClassesOn(text).join(" ");
    const input = theInputClassNamed(text, "position");
    for (const metric of ["h-8", "px-2.5", "py-1", "text-xs", "md:text-xs", "rounded-none"]) {
      expect(input, `the Input beside it carries ${metric}`).toContain(metric);
      expect(select, `the select carries ${metric}`).toContain(metric);
    }
  });
});
