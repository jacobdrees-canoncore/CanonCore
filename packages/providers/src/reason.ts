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

/** What stands in for the part of a reason the Owner does not get to read. */
const CUT = "…";

/**
 * Why a provider could not be reached, in a form a page may print (ADR-0123).
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
   * the OpenAPI document a caller reads rather than an invariant they have to
   * take on trust from two handlers that each remembered it.
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
  const said = unwrapped(thrown);
  const message = said instanceof Error ? said.message : String(said);
  const ours = said instanceof OutboundRefused && said.boundary === "config";
  return { wrote: ours ? "canoncore" : "provider", text: bounded(message) || SILENT };
}

/**
 * What actually failed, out of a chain of things that wrapped it (ADR-0123).
 *
 * A WRAPPER IS NOT A REASON. `fetch failed` is undici saying that something
 * underneath it failed; the fact is on `cause`, and until CNCORE-192 nothing
 * here read `cause` at all. Measured on undici 8.10.2, which is what this
 * package imports rather than the one Node bundles: `lib/web/fetch/index.js`
 * rejects with `new TypeError('fetch failed', { cause: response.error })`, and
 * `makeNetworkError` passes anything `instanceof Error` through BY IDENTITY --
 * so an `OutboundRefused` raised in the pinned lookup arrives whole, custom
 * `boundary` and all, one link down and unread.
 *
 * IT COSTS EVERY DIAGNOSIS AND NOT ONLY THE REFUSAL, which is what walking the
 * chain rather than looking for one class buys. A dead socket is
 * `connect ECONNREFUSED 127.0.0.1:64665` and an unresolvable host is
 * `getaddrinfo ENOTFOUND nothing.invalid`, both one link down, and the Owner
 * read `fetch failed` for those too.
 *
 * THE INNERMOST LINK THAT SAID SOMETHING, rather than simply the innermost.
 * `makeNetworkError()` with no argument builds `new Error(undefined)`, whose
 * message is EMPTY -- three sites in that file reach it -- so a blind walk to
 * the bottom would report silence where `fetch failed` is genuinely all there
 * is. Keeping the last link with words in it never loses information: the
 * deepest thing that spoke is the most specific thing that spoke.
 *
 * WALKED RATHER THAN READ ONCE, because a chain deeper than one is undici's own
 * shape and not a hypothetical: `response.js` wraps an abort as
 * `fetch failed` -> `DOMException` -> the original error, and `client-h2.js`
 * wraps an HTTP/2 failure in an `InformationalError` before the fetch layer
 * wraps it again.
 *
 * AND NONE OF IT IS PROMISED BY THE STANDARD. The Fetch Standard says only
 * "reject p with a TypeError"; the word `cause` appears nowhere in it. This
 * reads a shape undici chooses, so the walk is written to survive that shape
 * changing -- a chain of one, or of none, answers exactly as it did before.
 *
 * `seen` RATHER THAN A DEPTH LIMIT. ECMA-262 puts no restriction on a `cause`:
 * `InstallErrorCause` stores whatever `Get(options, "cause")` returned, as a
 * WRITABLE property, so a cycle is constructible and nothing forbids one. A
 * depth limit would be a number nobody can defend; a visited set needs none,
 * and the alternative is an infinite loop on the Owner's page.
 */
function unwrapped(thrown: unknown): unknown {
  let said = thrown;
  let at = thrown;
  const seen = new Set<unknown>();
  while (at instanceof Error && !seen.has(at)) {
    seen.add(at);
    if (oneLine(at.message)) said = at;
    at = at.cause;
  }
  return said;
}

/**
 * A provider's text, as one line and no longer than the Owner reads (ADR-0123).
 *
 * PUBLISHED BECAUSE A REASON IS NOT THE ONLY PROSE A PROVIDER PUTS ON A PAGE.
 * CNCORE-101 renders a declared credential's `label`, which the contract bounds
 * only by `min(1)` -- so it is a stranger choosing the length of text on a page
 * it does not own, which is the sentence that record opens with. What made that
 * defect worth a record is that it had two sites already; a second truncation
 * written beside this one would be the third.
 *
 * IT IS THE CAP WITHOUT THE ATTRIBUTION, and that split is deliberate. `wrote`
 * answers "whose sentence is this" by asking WHICH BOUNDARY REFUSED, and a label
 * was refused by nothing -- it is a provider's text on the manifest it chose to
 * send, known to be the provider's without anything having to decide.
 */
export function bounded(text: string): string {
  return cap(oneLine(text));
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
 * The message as ONE LINE, with runs of whitespace collapsed.
 *
 * A REASON IS A SENTENCE ON A PAGE, not a document. A `ZodError`'s message is
 * PRETTY-PRINTED JSON -- newlines and six-space indents -- so without this the
 * cap spends most of its 300 characters on the provider's indentation and the
 * Owner reads a fragment of a stack of braces. Collapsed, the same 300 carries
 * the codes and paths that say what was actually wrong.
 *
 * IT ALSO MAKES `min(1)` MEAN SOMETHING. A message of nothing but whitespace
 * trims to empty here and falls through to `SILENT` below, where before it
 * satisfied the schema and rendered as a blank space -- a reason the Owner can
 * see is missing, rather than one they cannot see at all.
 */
function oneLine(message: string): string {
  return message.replace(CONTROLS, "").replace(/\s+/g, " ").trim();
}

/**
 * The characters that change how the text AROUND them reads, stripped.
 *
 * NOT A WHITESPACE PROBLEM, which is why `\s+` above does not catch them. The
 * bidirectional overrides (U+202A-U+202E, U+2066-U+2069) re-order the glyphs on
 * either side of themselves, so a provider can make its quoted text run backwards
 * through the sentence CanonCore wrote around it -- and on this page that
 * sentence sits beside a link the Owner is about to give a credential to.
 * U+200B-U+200D and U+FEFF are the zero-width family, which splits a word a
 * reader is scanning for without leaving a mark.
 *
 * THE SAME ARGUMENT AS THE CAP, AT A DIFFERENT LEVER. ADR-0123 bounds how MUCH a
 * stranger may put on a page it does not own; this bounds what that text may do
 * to the page's own words. A cap alone leaves the shorter attack untouched.
 *
 * STRIPPED RATHER THAN ESCAPED, because there is no legitimate use for one here:
 * a reason and a credential's label are single sentences of prose, not documents
 * with a mixed-direction layout to preserve.
 */
const CONTROLS = /[\u202a-\u202e\u2066-\u2069\u200b-\u200d\ufeff]/g;

/**
 * The text, cut to `REASON_MAX_LENGTH` INCLUDING the marker that says so.
 *
 * CUT ON A WHOLE CHARACTER. `slice` counts UTF-16 units, so a cut landing
 * between the two halves of an astral character leaves a lone surrogate that
 * renders as a replacement glyph -- and a provider picks the byte offsets here
 * by choosing what it sends. Dropping a trailing high surrogate costs one
 * character of a reason that was being truncated anyway.
 */
function cap(text: string): string {
  if (text.length <= REASON_MAX_LENGTH) return text;
  const kept = text.slice(0, REASON_MAX_LENGTH - CUT.length);
  const last = kept.charCodeAt(kept.length - 1);
  const whole = last >= 0xd800 && last <= 0xdbff ? kept.slice(0, -1) : kept;
  return `${whole}${CUT}`;
}
