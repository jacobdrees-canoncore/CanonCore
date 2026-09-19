import type { FailureReason } from "@canoncore/providers";
import { ProviderProse } from "./provider-prose";

/**
 * A REASON, SAID BY WHOEVER SAID IT (ADR-0123, CNCORE-95).
 *
 * TWO KINDS OF STRING ARRIVE HERE AND THEY ARE NOT THE SAME KIND. CanonCore's
 * own sentence is this app telling the Owner about a setting only they can
 * change -- ADR-0034's config boundary refused a URL they typed -- so it is
 * printed as this catalogue speaking, which is what it is.
 *
 * ANYTHING ELSE IS QUOTED. `<q>` is the whole of the difference and it is
 * enough: CNCORE-96 binds every reason surface to saying which Provider it came
 * from "so the Owner reads it as a Provider's claim rather than as CanonCore
 * speaking", and quotation marks beside a named Provider say exactly that. The
 * LENGTH is not the Provider's to choose either, and that is settled before it
 * arrives -- `reasonFor` caps it at the seam rather than the page truncating
 * what it was handed.
 *
 * IT DOES NOT SAY THE PROVIDER "said" THIS. Not every quoted reason is the
 * Provider's own words: `client.ts` writes sentences ABOUT a Provider -- too
 * many redirects, a body larger than this client reads -- that are CanonCore's
 * prose and are not ADR-0034 config refusals. They belong on this side of the
 * line, because they are not a setting the Owner can go and change, but claiming
 * the Provider uttered them would be a second false attribution.
 *
 * SINCE CNCORE-140 SOME OF THEM ARE THE PROVIDER'S WORDS LITERALLY, and that
 * does not change the sentence above. A failing answer's own reason is read off
 * the body now instead of being drained unread, so what arrives here is
 * sometimes a Provider quoting itself and sometimes this app describing one --
 * and NOTHING HERE CAN TELL WHICH, because `wrote` answers which BOUNDARY
 * refused and neither of these was refused by one. The weaker claim is the one
 * true of both, which is why it is the claim being made.
 *
 * NOT A REWORDING EITHER. CNCORE-92's rule is that a Provider which cannot be
 * reached must never look like one that holds nothing, and a reason replaced by
 * a house sentence would do exactly that -- "a refusal reworded is not a refusal
 * reported". It is marked and left as it is.
 *
 * THE CALLER NAMES THE PROVIDER, in the lead sentence it was already writing.
 * Naming it here too rendered the URL twice in `/import`'s search list.
 *
 * AND WHAT IS QUOTED IS WRAPPED, BECAUSE `wrote` ANSWERED WHOSE SHAPE IT IS TOO
 * (CNCORE-217). Text not refused at the config boundary is not this app's, so
 * three hundred characters of it with no break in them are the Provider's to
 * send and not the Provider's to lay out. CanonCore's own sentence is printed
 * plainly: every value it interpolates is cut at 80 by `shortly`, and it is the
 * Owner's own host.
 *
 * ITS OWN MODULE SINCE CNCORE-101, HAVING BEEN `/import`'s ALONE. The settings
 * surface is the THIRD reason surface, and ADR-0123 exists because this defect
 * already had two sites that each solved it separately. One rule for whose voice
 * a sentence is printed in is the half a shared `reasonFor` does not buy: that
 * function decides WHOSE the text is, and this decides how the page says so.
 */
export function Reason({ reason }: { reason: FailureReason }) {
  if (reason.wrote === "canoncore") return <span>{reason.text}</span>;
  return (
    <q>
      <ProviderProse>{reason.text}</ProviderProse>
    </q>
  );
}
