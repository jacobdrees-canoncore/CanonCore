/**
 * How tall a mark is allowed to be, ours and anybody else's.
 *
 * TWO NUMBERS IN ONE FILE BECAUSE THE OBLIGATION IS A COMPARISON, not a size.
 * TMDB's API Terms paragraph 3: "Any use of any TMDB logos in Your Application
 * must be less prominent than the logos or marks that primarily describe or
 * identify Your Application." A number chosen in the header and another chosen in
 * a footer satisfy that by luck, and stop satisfying it the day somebody tunes one
 * of them without knowing the other exists.
 *
 * THEY ARE EMITTED AS EXPLICIT ATTRIBUTES rather than as utility classes, so the
 * comparison is IN THE HTML a reader is served and a test can read it back. A
 * `text-xl` against an `h-4` is the same relationship expressed where nothing can
 * check it.
 */

/**
 * CanonCore's own wordmark, in pixels of type. This is the mark that "primarily
 * describes or identifies" the application, so it is the ceiling every third-party
 * mark sits under.
 */
export const OUR_MARK_PX = 24;

/**
 * Any source's mark, in pixels of height. Comfortably under `OUR_MARK_PX`, and
 * under it by enough that the relationship survives a font whose cap height is
 * less than its point size.
 */
export const SOURCE_MARK_PX = 14;
