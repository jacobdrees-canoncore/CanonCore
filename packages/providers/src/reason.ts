import { boundedTo, holdsUnshowable, oneLine, unshowable } from "@canoncore/text";
import { z } from "zod";

import { OutboundRefused } from "./boundary";

/**
 * ADR-0123. How much of a reason the Owner reads before it is cut.
 *
 * CHOSEN ABOVE EVERY SENTENCE THIS APP WRITES AND BELOW ANYTHING A PROVIDER
 * COULD FLOOD A PAGE WITH. The longest refusal in `boundary.ts` is 172
 * characters with an ordinary base URL in it, so the sentences the Owner has to
 * act on are nowhere near this and arrive whole. What is stopped is measured
 * rather than imagined: 200 malformed search results is a 151,362-character
 * reason, and `MAX_BODY_BYTES` admits 4 MiB of such records.
 *
 * THE CAP IS ASSERTED AGAINST THE REAL BOUNDARY rather than trusted. A sentence
 * edited past it would be truncated silently and the Owner would lose the half
 * naming the setting, so a test throws the refusal from `assertConfigUrl` and
 * asserts the reason equals it exactly.
 */
export const REASON_MAX_LENGTH = 300;

/**
 * Why nothing could be read from a provider, in a form a page may print (ADR-0123).
 *
 * TWO FIELDS BECAUSE THERE ARE TWO KINDS OF STRING HERE, and until CNCORE-95
 * they travelled as one. A page handed only the text has no way to tell the
 * Owner which of the two it is holding, so it prints a provider's sentence in
 * CanonCore's voice -- and that is the half a cap alone does not buy.
 */
export const failureReason = z.object({
  /**
   * WHOSE SENTENCE THIS IS. `canoncore` is this app telling the Owner about
   * their own configuration: ADR-0034's config boundary refused a URL they
   * typed, and the refusal names the setting to change. `provider` is a third
   * party's text -- undici's, the DNS layer's, or zod's report on a body the
   * provider chose.
   *
   * MEASURED ON ZOD 4.5.4 RATHER THAN ASSUMED, because CNCORE-95 described this
   * as "a zod message that serialises the received value" and it does not. A
   * `ZodError`'s message is the ISSUE LIST as JSON -- `code`, `expected`,
   * `path`, and zod's own sentence -- so the lever is ONE ISSUE PER BAD FIELD
   * and the provider sets the length by how many bad records it sends. Its own
   * strings do reach the message, through `path`. ADR-0123 carries the
   * correction.
   *
   * A PAGE ATTRIBUTES THE SECOND AND NOT THE FIRST. CNCORE-96 binds every new
   * reason surface to it: the Owner reads a provider's text "as a Provider's
   * claim rather than as CanonCore speaking".
   */
  wrote: z.enum(["canoncore", "provider"]),
  /**
   * BOUNDED IN THE CONTRACT AND NOT ONLY IN THE HANDLER, so the ceiling is in
   * the output schema a caller is held to rather than an invariant they have to
   * take on trust from two handlers that each remembered it -- and in the
   * OpenAPI document a caller reads, which `route.test.ts` asserts (CNCORE-212).
   */
  text: z.string().min(1).max(REASON_MAX_LENGTH),
});

export type FailureReason = z.infer<typeof failureReason>;

/**
 * The reason a caller may read, out of whatever was thrown reaching a provider.
 *
 * ONE FUNCTION FOR EVERY REASON SURFACE, which is why it is published from this
 * package rather than written at each procedure. `provider.search` and
 * `provider.container` had the same defect independently because each mapped
 * its own catch (CNCORE-68, then CNCORE-92), and CNCORE-100 and CNCORE-101 add
 * two more surfaces that would have made it four.
 *
 * EVERYTHING IS CAPPED, INCLUDING OUR OWN. The cap is what makes the field
 * bounded at all, and exempting one branch would mean the bound held only while
 * every caller agreed about which branch it was on.
 */
export function reasonFor(thrown: unknown): FailureReason {
  const spoke = unwrapped(thrown);
  const message = wordsOf(spoke);
  const ours = spoke instanceof OutboundRefused && spoke.boundary === "config";
  const said =
    message === undefined ? NOT_A_MESSAGE : boundedOr(message, SILENT, UNSHOWABLE_REASON);
  return { wrote: ours ? "canoncore" : "provider", text: said };
}

/**
 * THE WORDS THE THING THAT SPOKE ACTUALLY HAS, or nothing when it has none
 * (ADR-0183).
 *
 * `String(spoke)` STOOD HERE AND ANSWERED FOR TWO INPUTS. A thrown STRING is the
 * Provider's own words and `String` is right for it: `throw "rate limited"` is
 * quoted verbatim, bounded, and that half is kept. A thrown value that is
 * neither an `Error` nor a string has no sentence of its own, and `String`
 * SUPPLIED one -- measured on node 24.19.0, `undefined` became `"undefined"`,
 * `null` became `"null"` and `{}` became `"[object Object]"`, each handed to the
 * Owner with `wrote: "provider"` on it. CNCORE-96 binds this surface to the
 * opposite.
 *
 * `undefined` RATHER THAN THE EMPTY STRING, because the empty string is a real
 * answer on this path and already has two sentences waiting for it: it is what a
 * silent `Error` and a thrown `""` both give, and `boundedOr` tells those from a
 * value the strip emptied. Returning `""` for a value that never spoke would
 * fold this branch into that question and put ADR-0176's conflation back in a
 * third spelling.
 */
function wordsOf(spoke: unknown): string | undefined {
  if (spoke instanceof Error) return spoke.message;
  return typeof spoke === "string" ? spoke : undefined;
}

/**
 * What actually failed, out of a chain of things that wrapped it (ADR-0123).
 *
 * A WRAPPER IS NOT A REASON. `fetch failed` is undici saying that something
 * underneath it failed; the fact is on `cause`, and until CNCORE-192 nothing
 * here read `cause` at all -- so a refusal raised in the pinned lookup was
 * QUOTED to the Owner as the Provider's words. ADR-0123 carries the measurements
 * under "A wrapper is not a reason, so the `cause` chain is unwrapped"; what a
 * reader of the loop below needs is why each line of it is shaped as it is.
 *
 * THE INNERMOST LINK THAT SAID SOMETHING, rather than simply the innermost,
 * because undici builds an empty `Error` for a network error with no reason and
 * the wrapper's own words are then all there is.
 *
 * WALKED RATHER THAN READ ONCE, because undici wraps two deep on an abort and
 * on HTTP/2, so `cause` read once stops at the middle of the chain.
 *
 * `seen` RATHER THAN A DEPTH LIMIT, because ECMA-262 lets a `cause` be any
 * value and hold a cycle, and the alternative is an infinite loop while the
 * Owner's page renders. A depth limit would be a number nobody could defend.
 */
function unwrapped(thrown: unknown): unknown {
  let spoke = thrown;
  let link = thrown;
  const seen = new Set<Error>();
  while (link instanceof Error && !seen.has(link)) {
    seen.add(link);
    if (oneLine(link.message)) spoke = link;
    link = link.cause;
  }
  return spoke;
}

/**
 * A provider's text, as one line and no longer than the Owner reads (ADR-0123).
 *
 * PUBLISHED BECAUSE A REASON IS NOT THE ONLY PROSE A PROVIDER PUTS ON A PAGE.
 * CNCORE-101 renders a declared credential's `label`, which the contract bounds
 * only by `min(1)` -- so it is a stranger choosing the length of text on a page
 * it does not own, which is the sentence that record opens with. What made that
 * defect worth a record is that it had two sites already; a second truncation
 * written beside this one would be the third. The label reaches it through
 * `boundedProse` below since CNCORE-165, at the manifest field rather than in
 * `asDeclared`.
 *
 * IT IS THE CAP WITHOUT THE ATTRIBUTION, and that split is deliberate. `wrote`
 * answers "whose sentence is this" by asking WHICH BOUNDARY REFUSED, and a label
 * was refused by nothing -- it is a provider's text on the manifest it chose to
 * send, known to be the provider's without anything having to decide.
 */
export function bounded(text: string): string {
  return boundedTo(text, REASON_MAX_LENGTH);
}

/**
 * A PROVIDER'S PROSE, OR WHICHEVER OF THE TWO THINGS ABOUT ITS ABSENCE IS TRUE
 * (ADR-0176).
 *
 * THERE ARE THREE ANSWERS HERE AND THERE WERE TWO. `bounded` above returns the
 * empty string for a value that said nothing AND for one made of nothing the
 * strip leaves, so `bounded(text) || whenSilent` answered both with the sentence
 * for the first -- telling the Owner that a Provider which named a reason named
 * none. ADR-0179 settled that a value nobody can show is not a value nobody
 * sent.
 *
 * ONE FUNCTION BECAUSE THE TWO CALLERS HAD THE SAME DEFECT SEPARATELY, which is
 * `reasonFor`'s own argument for existing at all: `provider.search` and
 * `provider.container` each mapped its own catch and each got it wrong. This
 * file's own `reasonFor` and `boundedProse` then did the same thing to the same
 * distinction, in two spellings, and a third caller composing it again is how
 * ADR-0163 watched its levers drift twice.
 *
 * BOTH SENTENCES COME FROM THE CALLER AND NEITHER IS DEFAULTED. `boundedProse`'s
 * argument is that no house sentence fits every field, and it holds twice over
 * here: `SILENT` and `UNNAMED` are punctuated differently because one IS a
 * sentence a page prints and the other stands in for a NAME. A default would
 * have to pick, and picking is what makes a field read in two voices.
 *
 * THE QUESTION IS `holdsUnshowable`'S AND NOT `trim()`'S, which is the whole
 * reason this reaches the leaf for it. U+FEFF is whitespace to `trim` AND a
 * member of the zero-width family, so a guard spelled `text.trim() === ""` would
 * answer "nothing there" for exactly the value these words exist to name.
 */
function boundedOr(text: string, whenSilent: string, whenUnshowable: string): string {
  return bounded(text) || (holdsUnshowable(text) ? whenUnshowable : whenSilent);
}

/**
 * A PROSE FIELD A PROVIDER DECLARES ABOUT ITSELF, BOUNDED AT THE FIELD RATHER
 * THAN AT EACH SURFACE THAT PRINTS IT (ADR-0123, CNCORE-165).
 *
 * `bounded` above is the function and this is the SCHEMA that makes a caller use
 * it. The difference is who has to remember: a surface calling `bounded` bounds
 * the copy it holds, and the next surface to read the same field starts again
 * from raw. `cmppManifest` is where a provider's self-description ENTERS this
 * app, so a field declared with this cannot be read unbounded by anything --
 * which is the half that stops a fifth surface repeating the fourth.
 *
 * IT ALSO MAKES THE BOUND VISIBLE IN THE SCHEMA, which CNCORE-165 is about as
 * much as it is about the name. A bounded field and a raw one both read
 * `z.string().min(1)`, so nothing distinguished prose somebody had thought about
 * from prose nobody had; the two spellings differ now.
 *
 * BOTH SENTENCES ARE REQUIRED RATHER THAN DEFAULTED, because there is no house
 * sentence that fits every field: a nameless Provider and a Provider that
 * described its credential in no words need different words. What a caller must
 * not be allowed to do is skip either -- `min(1)` admits a value of a single
 * space, `bounded` collapses that to nothing, and an empty string then fails the
 * `min(1)` the surfaces declare on their own OUTPUT. That is a provider crashing
 * the request that reads it, which is exactly what `SILENT` exists to prevent one
 * seam over.
 *
 * `whenUnshowable` IS THE SECOND, AND IT ARRIVED BECAUSE ONE SENTENCE WAS
 * ANSWERING TWO INPUTS (ADR-0176). Defaulting it to `whenSilent` would have been
 * the compatibility shim that put the defect back: both of this schema's fields
 * had words for a Provider that said NOTHING and used them on a Provider that
 * said something nobody can print. `boundedOr` above carries the question; these
 * two arguments carry the answers, and the punctuation is why neither can be
 * house-supplied -- `UNNAMED` stands in for a NAME and takes no full stop, while
 * `SAID_NOTHING` is a sentence a page prints and takes one.
 *
 * IT REPORTS WHAT HAPPENED RATHER THAN DRESSING IT UP, as everything else here
 * does: CNCORE-92's rule is that a refusal reworded is not a refusal reported,
 * so a provider that said nothing said nothing -- and a provider that said
 * something unshowable said something unshowable.
 */
export function boundedProse(
  whenSilent: string,
  whenUnshowable: string,
): z.ZodType<string, unknown> {
  return z
    .string()
    .min(1)
    .transform((text) => boundedOr(text, whenSilent, whenUnshowable));
}

/**
 * What is said when the thrown thing said nothing.
 *
 * `new Error()` carries an empty message and so does a thrown `""`. The schema
 * above declares `text` as `min(1)`, so an empty one fails OUTPUT validation and
 * becomes exactly the 500 `provider.container` exists to remove -- a provider
 * must not be able to crash the request that is reading it.
 *
 * IT REPORTS THE SILENCE RATHER THAN DRESSING IT UP. CNCORE-92's rule is that a
 * refusal reworded is not a refusal reported, and the honest thing to say about
 * a failure that named no reason is that it named none.
 */
const SILENT = "the provider failed without saying why.";

/**
 * What is said when the thrown thing said something nobody can show (ADR-0176).
 *
 * `SILENT` ABOVE IS ABOUT A DIFFERENT INPUT, and until CNCORE-305 one sentence
 * answered both. `bounded` strips the controls and trims, so a message of
 * nothing but them arrives at the same empty string `new Error()` does -- and the
 * sentence for it asserted that a provider which NAMED a reason named none.
 * ADR-0179 settled that a value nobody can show is not a value nobody sent, and
 * `holdsUnshowable` asks which of the two happened rather than whether the
 * result is empty.
 *
 * THE PHRASE IS `@canoncore/text`'S AND THE FRAME IS THIS FILE'S, which is
 * ADR-0179's split kept. The full stop is here because `SILENT` carries one: this
 * value IS the sentence a page prints, so its two answers have to be punctuated
 * alike or the field reads as two voices.
 */
const UNSHOWABLE_REASON = `${unshowable("the provider's reason was")}.`;

/**
 * What is said when what was thrown is not a message at all (ADR-0183).
 *
 * THE OTHER TWO ARE ABOUT A VALUE THAT HAD WORDS AND LOST THEM. `SILENT` is a
 * failure that named no reason and `UNSHOWABLE_REASON` a reason made of nothing
 * anybody can show; both are reached through a string somebody wrote. This one
 * is reached when nothing on the path ever held a string -- `throw undefined`,
 * or `Promise.reject()` with no argument -- so there is no text to report and
 * saying so is the whole of what is left to say.
 *
 * IT DOES NOT NAME THE VALUE, WHICH IS THE WHOLE OF CNCORE-307. Naming it is
 * what `String(spoke)` did. The three fallbacks travel under `wrote: "provider"`
 * because ADR-0123 decides that by WHICH BOUNDARY refused and no boundary here
 * did -- so each is a sentence ABOUT a Provider, which a page may print in a
 * Provider's voice, and none is a QUOTE of one. `undefined` is not a sentence
 * about anything: it reads as a word the Provider used, which is the line
 * CNCORE-96 draws. A repair reaching for the value again -- `typeof`,
 * `JSON.stringify`, `${spoke}` -- lands on the wrong side of it in a smaller
 * font, and the last of those THROWS on a thrown symbol.
 */
const NOT_A_MESSAGE = "the provider failed with something that is not a message.";
