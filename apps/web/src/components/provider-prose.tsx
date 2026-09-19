/**
 * A PROVIDER'S PROSE, AT NO WIDTH THE PROVIDER CHOSE (ADR-0123, CNCORE-217).
 *
 * `cmppManifest` and `reasonFor` bound a Provider's text -- a name, a reason or
 * a label at 300 characters, a licence notice at 1,000 -- which settles how LONG
 * it is on the Owner's page. Three hundred characters with no break in them are
 * still one unbreakable line, so a Provider that sends one would choose how WIDE
 * the page is instead: measured on `/import`, a heading run 1,092 pixels past
 * its own box and the page scrolling sideways.
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
 * column seventeen pixels wide, one letter to a line. A stranger's text breaking
 * mid-word to fit this page is the right trade; this page's own words breaking
 * that way is not, so this puts it on a Provider's text and leaves the page's
 * own words alone.
 *
 * WHAT IT DOES NOT DO is quote, bound or attribute. `Reason` quotes, the
 * contract bounds, and each caller names the Provider in its own sentence; this
 * decides only the width, so it composes with all three.
 */
export function ProviderProse({ children }: { children: string }) {
  return <span className="wrap-anywhere">{children}</span>;
}
