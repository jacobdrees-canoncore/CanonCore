import { cn } from "@canoncore/ui/lib/utils";
import type * as React from "react";

/**
 * A NATIVE `<select>` WEARING `Input`'s METRICS (CNCORE-177).
 *
 * A BARE ELEMENT RATHER THAN A BASE UI ONE, and the reason is what it RENDERS
 * rather than that it is a client component -- `Input` below wraps a Base UI
 * client component too, and works with no script because what reaches the
 * browser is a real `<input>`. Base UI's Select is not that: it renders a
 * scripted trigger and popup, and posts through a hidden `<input>` whose value
 * comes from React state (`SelectRoot`, `@base-ui/react` 1.8.0, read 2026-09-15).
 * Unhydrated, it cannot be opened and can only ever submit its default. Every
 * form in this app works with no script -- `/new`, `/import` and the form that
 * places an Item in a Container are server-rendered markup a browser posts by
 * itself -- so the element has to be the native one, and what was missing from
 * `packages/ui` was the STYLING rather than the behaviour.
 *
 * WHICH IS WHY THIS EXISTS AT ALL. Three surfaces each wrote that styling out
 * by hand, and each docblock said the same thing: there is no select to import,
 * so the identity is carried by matching its sibling. Three copies matched by
 * hand are three copies that drift, and by CNCORE-177 the third had lost
 * `w-full` and `md:text-xs`.
 *
 * WHAT THAT DRIFT ACTUALLY COST IS SMALL, AND SAYING SO IS THE POINT. An
 * earlier draft of this docblock called it "a control shorter than its
 * neighbour in a different type size"; that was written rather than measured
 * and it is false. The drifted copy kept `h-8` and `text-xs`, so it was neither
 * -- and `md:text-xs` is inert beside an unconditional `text-xs`, residue of
 * stock shadcn's `text-base md:text-sm`. Only `w-full` had any visible effect.
 * The argument for one primitive is therefore NOT that this drift was ugly. It
 * is that three copies drifted at all, in a direction nobody chose, where no
 * assertion about any one page could see it.
 *
 * THE CLASSES ARE `Input`'s, not stock shadcn's. Stock ships `h-9 px-3
 * text-base ring-[3px]`; this app's `Input` is `h-8 px-2.5 text-xs ring-1`, and
 * a select sitting beside one has to be the same control or it sits a step
 * taller and larger than the field next to it. Review caught exactly that on
 * two of the three surfaces, each wearing stock metrics, before this was one
 * thing -- which is the mismatch that DID happen, as against the one above.
 *
 * EVERY CLASS HERE IS ONE `Input` CARRIES, and `e2e/select.test.ts` holds it
 * there: what this wears is asserted to be a SUBSET of what the `Input` above
 * it on `/new` renders, so `Input` moving and this staying is a red test rather
 * than a silent divergence. That is the shape `globals.css.test.ts` already
 * uses for the tokens.
 *
 * WIDTH IS `Input`'s TOO, WHICH MEANS A CALL SITE NARROWS RATHER THAN WIDENS.
 * `w-full` with `min-w-0` is what keeps a long option from blowing out the flex
 * row it sits in; `/import` caps it with `max-w-xs` exactly as the `Input`
 * beside it in that row already does.
 *
 * IT IS A SUBSET RATHER THAN THE WHOLE OF `Input`. The `file:` and
 * `placeholder:` variants describe states a `<select>` does not have, and the
 * `disabled:` and `aria-invalid:` ones describe states no surface here renders
 * a select in -- styling written against a state that does not exist. The
 * subset test above is what stops that becoming a licence to diverge: this may
 * carry LESS than `Input`, never something DIFFERENT.
 */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 md:text-xs dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
