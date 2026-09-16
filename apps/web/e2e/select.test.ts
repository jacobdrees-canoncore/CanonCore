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
 * -- a Base UI one posts through a hidden field driven by React state, so
 * unhydrated it can only submit its default, and every form in this app works
 * with no script. That identity was hand-copied onto three pages and the third
 * had lost `w-full` and `md:text-xs`.
 *
 * WHAT THAT COST WAS THE WIDTH AND NOTHING ELSE, which is worth saying here
 * because a test written against a symptom nobody measured is a test aimed at
 * the wrong thing. The drifted copy kept `h-8` and `text-xs`, and `md:text-xs`
 * is inert beside an unconditional `text-xs`. So this file does not assert that
 * the control LOOKS right; it asserts that the three cannot differ, which is
 * the property that was actually broken.
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

/** The classes of the named `<input>` on a page, for comparing a form's controls. */
function theInputClassesNamed(text: string, name: string): string[] {
  const found = new RegExp(`<input\\b[^>]*\\bname="${name}"[^>]*>`).exec(text)?.[0];
  if (found === undefined) throw new Error(`that page rendered no input named ${name}`);
  const className = /\bclass="([^"]*)"/.exec(found)?.[1];
  if (className === undefined) throw new Error(`the input named ${name} carries no class`);
  return className.split(/\s+/).filter((utility) => utility !== "");
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

  it("wears nothing the Input beside it does not", async () => {
    /*
     * WHICH IDENTITY IT IS, which the comparison above cannot say: three
     * surfaces agreeing on the wrong control agree just as well as three
     * agreeing on the right one.
     *
     * A SUBSET OF `Input`, WHICH IS THE WHOLE CLAIM AND NOT A LIST OF METRICS.
     * An earlier version of this named six utilities by hand, which is a fourth
     * copy of the thing this ticket exists to stop there being three of -- and
     * it would have passed while `Input` moved underneath it. `Select` takes
     * `Input`'s metrics and leaves out the variants a `<select>` has no states
     * for, so "carries less, never something other" is the exact relation, and
     * `Input` changing without `Select` following is what reddens this.
     *
     * READ OFF `/new`, WHICH IS THE ONLY PAGE WHERE BOTH ARE UNCAPPED. The
     * Title field there passes no `className`, so it renders `Input` whole --
     * whereas the Position field on `/items/<container>` narrows to `w-28` and
     * `tailwind-merge` drops the `w-full` this would then look for.
     */
    const { text } = await documentFrom(baseUrl, "/new", ownerOfTheSeeded);

    const select = theSelectClassesOn(text);
    const input = theInputClassesNamed(text, "title");
    expect(input).toEqual(expect.arrayContaining(select));
    /*
     * AND `Input` IS STILL THE RICHER OF THE TWO, so the assertion above is a
     * subset rather than an equality that happens to hold: the day somebody
     * makes them identical, the reason this is worded as a subset is gone and
     * the comment should go with it.
     */
    expect(input.length).toBeGreaterThan(select.length);
  });
});
