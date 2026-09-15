import { cn } from "@canoncore/ui/lib/utils";
import type * as React from "react";

/**
 * A NATIVE `<select>` WEARING `Input`'s METRICS (CNCORE-177).
 *
 * A BARE ELEMENT RATHER THAN A BASE UI ONE, and that is what makes this a
 * primitive of this repository's own rather than a vendored component. Base
 * UI's Select is a client component that needs script to open, and every form
 * in this app works with none -- `/new`, `/import` and the form that places an
 * Item in a Container are all server-rendered markup a browser posts without
 * JavaScript. A native select submits its chosen option as an ordinary field,
 * so what is missing from `packages/ui` is the STYLING and not the behaviour.
 *
 * WHICH IS WHY THIS EXISTS AT ALL. Three surfaces each wrote that styling out
 * by hand, and each docblock said the same thing: there is no select to import,
 * so the identity is carried by matching its sibling. Three copies matched by
 * hand are three copies that drift, and by CNCORE-177 the third had lost
 * `w-full` and `md:text-xs` -- a control shorter than its neighbour in a
 * different type size, which is `.claude/rules/frontend.md`'s "reads as part of
 * this product" failing quietly.
 *
 * THE CLASSES ARE `Input`'s, not stock shadcn's. Stock ships `h-9 px-3
 * text-base ring-[3px]`; this app's `Input` is `h-8 px-2.5 text-xs ring-1`, and
 * a select sitting beside one has to be the same control or it sits a step
 * taller and larger than the field next to it. Review caught exactly that on
 * two of the three surfaces before this was one thing.
 *
 * WIDTH IS `Input`'s TOO, WHICH MEANS A CALL SITE NARROWS RATHER THAN WIDENS.
 * `w-full` with `min-w-0` is what keeps a long option from blowing out the flex
 * row it sits in; `/import` caps it with `max-w-xs` exactly as the `Input`
 * beside it in that row already does.
 *
 * NO `disabled:` OR `aria-invalid:` VARIANTS, unlike `Input`. Nothing in this
 * app renders a disabled or invalid select, and a variant no surface can reach
 * is styling written against a state that does not exist.
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
