/**
 * The two levers ADR-0123 bounds a stranger's text on, in the one place every
 * package that needs them can reach.
 *
 * A LEAF, AND THAT IS THE WHOLE REASON THIS PACKAGE EXISTS (ADR-0163). It
 * depends on nothing -- not a workspace package, not a third-party one -- so
 * reaching for it costs a caller exactly the lines below. ADR-0123 refused the
 * import that would have shared these levers, and it was right about the
 * dependency it was offered: `@canoncore/tasks` and `@canoncore/db` reaching
 * them through `@canoncore/providers` would have taken an HTTP client, two
 * undici dispatchers and ADR-0034's boundaries to get at a string function. The
 * option nobody had put on the table is that the levers do not have to live in
 * that package. Here they cost none of it.
 *
 * THE CEILINGS DO NOT LIVE HERE, which is ADR-0123's rule kept rather than
 * changed. 80 is a fact about a value quoted in a refusal, 300 is a fact about a
 * reason, and each stays beside the sentences it bounds. What is shared is the
 * pair of levers, and this is the one place applying both.
 */

/**
 * The characters that change how the text AROUND them reads, stripped.
 *
 * NOT A WHITESPACE PROBLEM, which is why collapsing `\s+` does not catch them.
 * The bidirectional overrides (U+202A-U+202E, U+2066-U+2069) re-order the glyphs
 * on either side of themselves, so a stranger can make its quoted text run
 * backwards through the sentence CanonCore wrote around it. U+200B-U+200D and
 * U+FEFF are the zero-width family, which splits a word a reader is scanning for
 * without leaving a mark. U+FEFF alone IS matched by `\s`, so stripped after a
 * collapse it becomes a SPACE rather than nothing -- a different wrong answer,
 * not a right one, which is why the strip goes first.
 *
 * THE SAME ARGUMENT AS THE CAP, AT A DIFFERENT LEVER. ADR-0123 bounds how MUCH a
 * stranger may put on a page it does not own; this bounds what that text may do
 * to the page's own words. A cap alone leaves the shorter attack untouched.
 *
 * WRITTEN AS `\u` ESCAPES, AND THAT SPELLING IS PART OF THE RULE. This class was
 * briefly spelled with the literal characters in it, which is invisible in a
 * diff, unreadable in review, and puts an RLO in the source of the very function
 * that exists to strip one -- the Trojan Source hazard, inside its own defence.
 * A reviewer must be able to SEE what is matched, so every member is escaped.
 *
 * STRIPPED RATHER THAN ESCAPED, because there is no legitimate use for one in
 * the values these bound: a reason, a credential's label, a task's detail, a
 * Container id and a catalogue-search query are single sentences or single
 * tokens, not documents with a mixed-direction layout to preserve. The query
 * joined them with CNCORE-291 and is the one a reader TYPED rather than one a
 * Provider or the Owner stored -- which changes who chose it and nothing about
 * its shape, since a search box submits one line.
 */
const CONTROLS = /[\u202a-\u202e\u2066-\u2069\u200b-\u200d\ufeff]/g;

/**
 * What stands in for the part of a string its reader does not get to read.
 *
 * INSIDE THE BOUND RATHER THAN ADDED TO IT, which is what makes the ceiling a
 * ceiling: a caller that asked for at most `max` characters and got `max` plus a
 * marker has been handed a value past the limit it stated.
 */
const MARKER = "…";

/**
 * A stranger's text as ONE LINE, with the controls gone and runs of whitespace
 * collapsed.
 *
 * A SENTENCE ON A PAGE, NOT A DOCUMENT. A `ZodError`'s message is
 * PRETTY-PRINTED JSON -- newlines and six-space indents -- so without this a cap
 * spends most of its characters on the stranger's indentation and the Owner
 * reads a fragment of a stack of braces. Collapsed, the same ceiling carries the
 * codes and paths that say what was actually wrong.
 *
 * IT ALSO MAKES A `min(1)` MEAN SOMETHING. A message of nothing but whitespace
 * trims to empty here and falls through to whatever its caller says about
 * silence, where before it satisfied the schema and rendered as a blank space --
 * a reason the Owner can see is missing, rather than one they cannot see at all.
 */
export function oneLine(text: string): string {
  return text.replace(CONTROLS, "").replace(/\s+/g, " ").trim();
}

/**
 * A stranger's string at no more than `max` characters INCLUDING the marker that
 * says it was cut, ending on a WHOLE CHARACTER.
 *
 * CUT ON A WHOLE CODE POINT. `slice` counts UTF-16 units, so a cut landing
 * between the two halves of an astral character leaves a lone surrogate that
 * renders as a replacement glyph -- and a stranger picks the offsets here by
 * choosing what it sends. Dropping a trailing high surrogate costs one character
 * of a string that was being cut anyway.
 *
 * A CODE POINT AND NOT A GRAPHEME CLUSTER, which is a smaller promise than
 * "whole character" and is the one actually kept. A ZWJ sequence, a flag's two
 * regional indicators or a base and its combining mark can still be parted here.
 * That is left because both halves remain VALID characters and render as
 * themselves; a lone surrogate is not a character at all, which is why it alone
 * is worth the guard.
 *
 * PUBLISHED BESIDE `boundedTo` RATHER THAN HIDDEN BEHIND IT, for one caller:
 * `shortly` in `@canoncore/providers`' `boundary.ts` quotes a URL, a host or an
 * address that has already been through a parser, so there is no prose there for
 * the control strip to act on and it takes the cut alone. A caller quoting a
 * stranger's PROSE wants `boundedTo`, which applies both levers in one call.
 */
export function shortenTo(text: string, max: number): string {
  if (text.length <= max) return text;
  // A CEILING WITH NO ROOM FOR THE MARKER cannot say that anything was cut, so
  // the most it can honestly return is as much of the marker as fits. Said here
  // rather than left to the callers: every ceiling in this repository clears it,
  // and `max - 1` on a ceiling of zero slices from the END -- keeping nearly the
  // whole string and returning it PAST the bound it was given. A bound that
  // holds because of who calls it is the defect this function exists to end, so
  // it does not get to hold that way in the function itself.
  if (max <= MARKER.length) return MARKER.slice(0, Math.max(0, max));
  const kept = text.slice(0, max - MARKER.length);
  const last = kept.charCodeAt(kept.length - 1);
  const whole = last >= 0xd800 && last <= 0xdbff ? kept.slice(0, -1) : kept;
  return `${whole}${MARKER}`;
}

/**
 * A stranger's text on BOTH OF ADR-0123's LEVERS, at a ceiling the caller names.
 *
 * ONE CALL BECAUSE THEY ARE ONE MECHANISM, and that is the whole reason this
 * exists rather than `shortenTo` being left for callers to compose themselves.
 * The cut answers how MUCH a stranger may put on a page it does not own;
 * `CONTROLS` answers what that text may DO to the page's own words. A caller
 * reaching for the cut alone takes half a mechanism and looks finished, which is
 * what CNCORE-274 found in `@canoncore/tasks`' copy, what CNCORE-268 did in the
 * router before review caught it, and what CNCORE-282 found in the repeat's
 * refusal -- three sites, one missing lever, because there were three copies.
 *
 * STRIPPED BEFORE CUT, and the order is load-bearing rather than incidental. A
 * cut applied first can leave a bidirectional override as the last character of
 * what it kept, which then re-orders the marker and every word the caller wrote
 * after it.
 */
export function boundedTo(text: string, max: number): string {
  return shortenTo(oneLine(text), max);
}

/**
 * THE WORDS FOR A VALUE THIS FILE'S OWN LEVERS EMPTIED (ADR-0179).
 *
 * `boundedTo` strips the controls, collapses whitespace and trims, so a value
 * made of nothing else comes back as the EMPTY STRING. A sentence interpolating
 * that opens with nothing -- " is listed twice, at positions 1 and 3" -- and a
 * bound that empties a value is not a bound, it is a second defect wearing the
 * first one's fix. It is the UNACTIONABLE case rather than the dangerous one:
 * nothing is re-ordered, because the controls are gone; what is lost is the
 * subject.
 *
 * "MADE ONLY OF" IS LOAD-BEARING AND MUST NOT BE SHORTENED. A value that is
 * PARTLY unshowable -- `249‮643` -- is QUOTED, as `249643`, by the strip
 * alone. These words are reached ONLY when the whole value went, so "an id of
 * characters that cannot be shown" would name a class holding both and tell the
 * reader the wrong thing about which of their lines is at fault. Ten characters
 * against ceilings whose longest sentence measures 120 is the cheap side of the
 * trade. A witness in `index.test.ts` goes red if it is shortened back.
 *
 * ONE PHRASE FOR EVERY CALLER, WHICH IS WHY IT IS HERE RATHER THAN AT EACH.
 * Six sites owe these words and they sit in four packages; each composing its
 * own `boundedTo(...) || "..."` would ship ONE concept in six voices, which is
 * the two-readings defect rather than a matter of taste. The NOUN is the
 * caller's because only it knows what the value is, and the FRAME is the
 * caller's too -- `boundedProse`'s argument that no house sentence fits every
 * field, kept.
 */
const UNSHOWABLE = "made only of characters that cannot be shown";

/**
 * The words naming a value that could not be shown at all, for a caller placing
 * them in a sentence of its own (ADR-0179).
 *
 * PUBLISHED BESIDE `quotedTo` FOR ONE CALLER, on the same argument that
 * publishes `shortenTo` beside `boundedTo`. `@canoncore/tasks` bounds a
 * `detail` that IS the sentence a reader reads rather than a noun quoted inside
 * one, so it needs these words with a capital and a full stop. A caller
 * quoting a value INSIDE its own sentence wants `quotedTo`, which applies the
 * levers and the fallback in one call.
 */
export function unshowable(thing: string): string {
  return `${thing} ${UNSHOWABLE}`;
}

/**
 * A stranger's value AS A SENTENCE QUOTES IT: on both of ADR-0123's levers at a
 * ceiling the caller names, or the words saying why there was nothing left to
 * quote (ADR-0179).
 *
 * ONE CALL BECAUSE THEY ARE ONE MECHANISM, which is the argument `boundedTo`
 * already makes about its two levers, at the lever this one adds. A caller
 * reaching for `boundedTo` alone takes a bound that can empty its own sentence
 * and looks finished -- the same shape ADR-0163 watched drift twice.
 *
 * `reasonFor` IN `@canoncore/providers` WAS THE PRECEDENT AND WAS HALF OF ONE.
 * `bounded(message) || SILENT` is where the shape of this function came from --
 * SILENT reports the silence rather than dressing it up, which is CNCORE-92's
 * rule that a refusal reworded is not a refusal reported. What it did NOT do is
 * tell the two inputs apart, so it answered a provider that said something
 * unshowable with the sentence for one that said nothing. ADR-0176 gave it and
 * the two `boundedProse` fallbacks a second sentence each, reaching
 * `holdsUnshowable` below for the same question this function asks. The line
 * now reads `boundedOr(message, SILENT, UNSHOWABLE_REASON)`, behind the guard
 * ADR-0183 put in front of it: a throw that carried no string at all -- `throw
 * undefined` -- asks none of these three questions, and takes a third fallback
 * sentence of its own. `wordsThrown` below is that guard.
 */
export function quotedTo(text: string, max: number, thing: string): string {
  const quoted = boundedTo(text, max);
  if (quoted !== "") return quoted;
  return holdsUnshowable(text) ? unshowable(thing) : "";
}

/**
 * Whether this value holds a character `CONTROLS` takes out.
 *
 * IT ANSWERS ABOUT THE STRIP AND NOT ABOUT EMPTINESS, and the name says so
 * because this is EXPORTED. `holdsUnshowable("249\u202e643")` is `true` and that
 * value is QUOTED, as `249643`, by the strip alone -- so a caller reaching for
 * this as "the value went" would say "made only of" about a value that partly
 * survived, which is the one error `UNSHOWABLE`'s own docblock says must not
 * happen. BOTH CALLERS ASK IT ONLY ONCE THE BOUND HAS COME BACK EMPTY:
 * `quotedTo` below behind `if (quoted !== "")`, and `boundedOr` in
 * `@canoncore/providers` behind `bounded(text) ||`. The guard is what turns this
 * answer into "the strip is why", and it belongs to the caller because only the
 * caller knows its ceiling.
 *
 * NOTHING THERE IS NOT SOMETHING UNSHOWABLE, and answering the first with the
 * second is the defect this file's own words would otherwise commit.
 * `/search` passes "" deliberately -- "the empty string is this page's answer
 * to 'nothing asked'" -- and a task may return one from a run that worked. Both
 * would read as "made only of characters that cannot be shown", stating that
 * something was stripped when nothing was.
 *
 * `trim()` IS THE WRONG TEST AND U+FEFF IS WHY. It is whitespace to
 * `String.prototype.trim` AND a member of the zero-width family, so a guard
 * spelled `text.trim() === ""` would answer "nothing there" for exactly the
 * value these words exist to name. This asks whether `CONTROLS` removed
 * anything, which is the question actually being asked.
 *
 * ORDINARY WHITESPACE IS SHOWABLE, so a value of spaces answers `false` and
 * falls to its caller's own handling of an absent value -- the split
 * `theEntryRefused` keeps by returning `undefined` so `WhichEntry` can say
 * "That entry".
 *
 * PUBLISHED FOR THE CALLERS THAT ALREADY HAVE WORDS FOR BOTH ANSWERS (ADR-0176).
 * `quotedTo` hands back a bare noun phrase or `""`, which is what a caller
 * interpolating a value into a sentence of its own wants. The three fallbacks in
 * `@canoncore/providers` are not that shape: each already carries a whole
 * sentence for the silent case and needs a second one beside it, so what it is
 * short of is the QUESTION rather than either answer. Spelling that question
 * there would put a second copy of `CONTROLS` in the package ADR-0163 moved the
 * levers out of, which is the duplication this file exists to end.
 */
export function holdsUnshowable(text: string): boolean {
  return text.replace(CONTROLS, "") !== text;
}

/**
 * THE WORDS A THROWN THING ACTUALLY HAS, or nothing when it has none
 * (ADR-0183).
 *
 * `thrown instanceof Error ? thrown.message : String(thrown)` STOOD AT TWO
 * `reasonFor`s -- `@canoncore/providers`' and `@canoncore/tasks`' -- and
 * `String` was answering for two inputs that are not the same input. A thrown
 * STRING is words somebody wrote, and `String` is right for it. A thrown value
 * that is neither an `Error` nor a string has no sentence of its own, and
 * `String` SUPPLIED one: measured on node v24.19.0, `undefined` became
 * `"undefined"`, `null` became `"null"`, `{}` became `"[object Object]"` and
 * `[]` became `""`, which reached each caller's sentence for a silence.
 *
 * THE QUESTION IS SHARED AND THE SENTENCES ARE NOT, which is this file's own
 * split kept rather than a new one. `holdsUnshowable` above publishes a
 * QUESTION while every caller keeps its own words for the answer, for the
 * reason `UNSHOWABLE`'s docblock gives: the noun belongs to whoever knows what
 * the value is. The two callers here need different words -- one reports a
 * Provider under ADR-0123's `wrote`, the other is the sentence a run leaves in
 * its history -- and they carry different nouns, ceilings and punctuation.
 *
 * IT LIVES IN THE LEAF BECAUSE THE OTHER PLACE WAS ALREADY REFUSED. The
 * alternative is `@canoncore/tasks` reaching `@canoncore/providers` for a
 * string function, taking an HTTP client, two undici dispatchers and ADR-0034's
 * boundaries with it -- which is the import ADR-0163 turned down, and the
 * reason this package exists.
 *
 * `undefined` RATHER THAN THE EMPTY STRING, because the empty string is a real
 * answer for BOTH callers and each already has a sentence waiting for it. A
 * thrown `""` and an `Error` carrying no message are SILENT, which is a
 * different fact about a different input from a throw that was never a message
 * at all.
 */
export function wordsThrown(thrown: unknown): string | undefined {
  if (thrown instanceof Error) return thrown.message;
  return typeof thrown === "string" ? thrown : undefined;
}
