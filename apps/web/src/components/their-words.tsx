/**
 * TEXT THIS PAGE DID NOT WRITE, AT NO WIDTH ITS WRITER CHOSE (ADR-0142).
 *
 * A Provider's prose, a record's fields, an Item's values and a Group's name
 * are all somebody else's words -- a Provider's, a sidecar's or the Owner's, or
 * derived from theirs as a sort name is -- and so is what the Owner or the
 * reader typed, and what a device says about itself. Any of them can
 * be one word with no break in it, and one such word is an unbreakable line
 * that decides how WIDE the page is -- measured on `/import`, a Provider's
 * heading ran 1,092 pixels past its own box, and a search result 1,754.
 *
 * `anywhere` RATHER THAN `break-word`, AND ONLY ONE OF THEM WORKS. Both wrap a
 * word that will not fit its line. `break-word` leaves the element's min-content
 * width at the whole word, and a flex item may not shrink below that -- so on
 * the Item page, whose rows are flex, the label's box grew to the word and the
 * page scrolled 933 pixels while its text sat neatly inside the grown box.
 * `anywhere` counts the break when sizing, which is the half a flex row needs.
 *
 * A COMPONENT RATHER THAN ONE RULE ON `body`, and that was measured rather than
 * assumed. On `body` it moves nothing at 1280 pixels; at 375 it lets every flex
 * item shrink below its own longest word, and the header's `CanonCore` became a
 * column seventeen pixels wide, one letter to a line. Somebody else's text
 * breaking mid-word to fit this page is the right trade; this page's own words
 * breaking that way is not, so this goes on the first and leaves the second
 * alone.
 *
 * ONE COMPONENT, WHOEVER WROTE IT. What decides the width is that the page did
 * not choose the text's shape, and a Provider's name and the Owner's title fail
 * the page the same way. A fallback in the page's own words may ride inside it
 * -- `item.title ?? "Untitled item"` -- since `anywhere` breaks only a word that
 * does not fit its line, and no word of the page's own is that wide. So may a
 * sentence of the page's that arrives in one string with the Owner's words
 * inside it, which is `Reason`'s own.
 *
 * WHAT IT DOES NOT DO is quote, bound or attribute. `Reason` quotes, the
 * contract bounds a Provider's prose, and each caller names the writer in its
 * own sentence; this decides only the width, so it composes with all three.
 */
export function TheirWords({ children }: { children: string }) {
  return <span className="wrap-anywhere">{children}</span>;
}
