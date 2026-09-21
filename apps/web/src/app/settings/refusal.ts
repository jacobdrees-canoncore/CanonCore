import type { WhyNotNamed } from "@canoncore/providers";
import { quotedTo, unshowable } from "@canoncore/text";

import { oneValue } from "@/components/query-params";

/**
 * WHICH REFUSAL A REDIRECT IS CARRYING, written once because two ends read it
 * -- `/login/refusal.ts`'s arrangement at the other surface that has to report
 * a refusal through an address (CNCORE-262).
 *
 * `nameProvider` builds the address and the settings page reads it back, and as
 * one string spelled out in each file a rename on either side COMPILES CLEANLY
 * and renders nothing at all: a page silently missing the one sentence it
 * exists to say. That is the defect this ticket is fixing, so it is not one to
 * leave a fresh way of reaching.
 *
 * THE NAME IS SHARED WITH CNCORE-255, which reached the same shape
 * independently on `/items/<id>`: `?refused=<what>&because=<code>` reads as the
 * sentence it is, and `CONTEXT.md` binds names in code and UI copy alike. Two
 * parameters meaning one thing on two surfaces is the divergence this wave
 * keeps finding, and a shipped parameter name is hard to take back.
 *
 * THE PAGE'S OWN WORDS AND NOT THE PROCEDURE'S SENTENCE, which is ADR-0156 and
 * is the decision worth reading twice. `?because=` sits in an address the OWNER can edit, so a value
 * copied out of a refusal's message would be a way to put a sentence of
 * somebody else's choosing in front of a reader under CanonCore's own styling
 * -- `/login/page.tsx` already states that rule of its own parameter, and
 * ADR-0123 makes whose words a reader is shown the question this app answers at
 * every seam. A closed set cannot say anything this page did not write, and the
 * page owns every sentence below. There are FIVE of them: the three the Owner's
 * own text can raise, the stored setting that would not parse, and the
 * catch-all for a refusal this page cannot name at all.
 */
export const REFUSED = {
  /** The box held nothing, or nothing but whitespace. */
  nothing: "nothing-named",
  /** More than one entry: a paste of two Providers, named at once. */
  several: "not-one-provider",
  /** One entry, and it is not a URL -- commonly a host with no scheme. */
  notAUrl: "not-a-url",
  /**
   * NOT ABOUT THE ENTRY AT ALL: the Providers already stored would not parse,
   * so there was no list to add one to.
   *
   * IT IS HERE SO THAT NOTHING FALLS THROUGH SILENTLY, AND UNTIL CNCORE-326 IT
   * DID NOT DO THAT. The three above are the refusals the Owner's own
   * text can raise; this is every other refusal the procedure can answer with.
   * `WhyNotNamed` does not carry it, because `@canoncore/providers` never
   * raises it: it is the SURFACE's word for "a refusal that was not about what
   * you typed".
   *
   * THE SENTENCE WAS DECLARED HERE AND RENDERED ON THE PAGE, AND NOTHING EVER
   * WROTE IT. This docblock said an action matching on three codes "would
   * simply return -- rendering the unchanged page that this whole ticket exists
   * to stop", in the present tense, of a fall-through that had never been
   * added: `git show 80b976d -- apps/web/src/app/settings/actions.ts` (the
   * commit that declared this word, 2026-09-20) landed exactly three `if`s, and
   * `git log 80b976d..origin/main` for that file was empty. A tree-wide grep found the declaration, the render and a hand-typed
   * address in one e2e test -- no writer. `actions.ts` carries the fall-through
   * now, and `settings-page.test.ts` reaches it.
   */
  unreadable: "setting-unreadable",
  /**
   * A REFUSAL THIS PAGE CANNOT NAME, which is the only thing a true catch-all
   * may say (CNCORE-326).
   *
   * THE WORD ABOVE LOOKED LIKE THIS ONE AND IS NOT. `setting-unreadable` names
   * a CAUSE -- the stored Providers setting failing to parse -- and the page
   * writes a specific, actionable sentence for it. Taken as the fall-through it
   * asserted that cause of every refusal the procedure can raise, and
   * `ownerProcedure` raises one that is nothing of the kind:
   * `ORPCError("UNAUTHORIZED")`, status 401, which `answer.ts` reads as a
   * refusal like any other under 500. An Owner whose session expired between
   * the GET and the POST would have been told their stored Providers cannot be
   * read, which is false and hides the remedy.
   *
   * SO THE TWO ARE SEPARATED: the code that means the setting gets the sentence
   * about the setting, and everything else gets this, which says only that the
   * entry was not named and that this instance did not say why. ADR-0156 asks
   * for "a branch for a refusal this page cannot name"; a branch that names one
   * is not that branch, and the page owes an Owner no sentence it cannot stand
   * behind (ADR-0123).
   *
   * IT RENDERS NOWHERE FOR THE UNAUTHORIZED CASE, AND IS STILL THE RIGHT WORD.
   * `SettingsPage` answers a caller with no session with `NotLoggedIn` before
   * it reads `?because=` at all, so that Owner sees the login they need rather
   * than either sentence. The address is what was wrong, and an address is what
   * a reload, a Back or a bookmark keeps.
   */
  unexplained: "unexplained",
} as const;

/**
 * WHY A WHOLESALE SAVE OF THE ALLOWLIST WAS REFUSED (CNCORE-329).
 *
 * ITS OWN SET, BECAUSE ITS OWN CONTROL RENDERS IT. `REFUSED` above is what the
 * "Name a Provider" box can be told; these are what the Allowlist textarea can
 * be told, and a page holding one set for both would have to work out which
 * section a word belonged in before it could place the sentence. Two sets ARE
 * that answer, and the placement then cannot be got wrong.
 *
 * TWO WORDS BECAUSE `parseAllowlist` HOLDS TWO RULES WITH OPPOSITE REMEDIES. A
 * wildcard is replaced by the hosts it stood for; a malformed range is
 * corrected in place. One word for both is CNCORE-262's defect, and this page
 * is where that ticket was filed.
 */
export const REFUSED_SAVING_THE_ALLOWLIST = {
  /** ADR-0034 takes exact hosts and CIDRs, and a wildcard is neither. */
  wildcard: "allowlist-wildcard",
  /** An entry with a `/` in it that `ipaddr.js` will not read as a range. */
  notACidr: "allowlist-not-a-cidr",
} as const;

/**
 * WHY A WHOLESALE SAVE OF THE PROVIDERS WAS REFUSED (CNCORE-331).
 *
 * ONE WORD, BECAUSE `parseProviderUrls` HOLDS ONE RULE: an entry is a URL or it
 * is not. The three in `REFUSED` above are about ONE entry typed into a box --
 * nothing typed, several typed -- and neither is a mistake you can make in a
 * textarea that takes a list.
 *
 * NOT `REFUSED.notAUrl`, WHICH IT LOOKS LIKE AND IS NOT. That word's sentence
 * ends "so name IT by its base URL", about the single entry the Owner just
 * typed; this one is about one line among many, and the Owner has to be told
 * WHICH. Sharing the word would put the wrong sentence under the wrong
 * control -- and under a control the other sentence does not even mention.
 */
export const REFUSED_SAVING_THE_PROVIDERS = {
  /** One line of the list is not a URL, and ADR-0031 makes a Provider a URL. */
  notAUrl: "providers-not-a-url",
} as const;

/**
 * THE CLOSED SET, as the page matches what an address carries against it.
 *
 * IT IS READ OFF `REFUSED` AND WAS NEVER THE THREE ITS NAME CLAIMED. This was
 * `THE_THREE` while `Object.values` answered FOUR of them, so the name and the
 * value had disagreed since the catch-all was declared -- harmlessly, because
 * reading the set from the object is what kept `oneBecause` admitting the
 * fourth word the whole time, which is the one half of this mechanism that did
 * work. Named for what it is rather than for how many, so the next word added
 * above does not make a liar of it again (CNCORE-326).
 */
const THE_CLOSED_SET = Object.values(REFUSED);

/**
 * WHICH OF THE CLOSED SET AN ADDRESS NAMES, or nothing at all.
 *
 * ANYTHING ELSE IS NOTHING, which is what keeps `?because=` from being an opening.
 * It is read exactly as `oneValue` reads every other parameter -- a repeated or
 * blank one names nothing -- and then held to the closed set, so a hand-edited
 * address renders the page with no notice rather than a notice of the editor's
 * choosing.
 */
export type WhyItWasRefused = (typeof REFUSED)[keyof typeof REFUSED];

/** What the Allowlist's textarea can be told, as a type the page switches on. */
export type WhyTheAllowlistWasRefused =
  (typeof REFUSED_SAVING_THE_ALLOWLIST)[keyof typeof REFUSED_SAVING_THE_ALLOWLIST];

/** What the Providers' repair textarea can be told. */
export type WhyTheProvidersWereRefused =
  (typeof REFUSED_SAVING_THE_PROVIDERS)[keyof typeof REFUSED_SAVING_THE_PROVIDERS];

/**
 * THE THREE `@canoncore/providers` RAISES, held against its own type, so a
 * fourth added there without a word here fails to compile rather than arriving
 * on the page as whatever the last branch happened to be.
 *
 * THREE HERE AND FOUR ABOVE IS THE POINT RATHER THAN A GAP, which ADR-0156
 * records as the second property this shape produced: the set the SURFACE
 * admits is not the set the PROCEDURE raises, so the two are related by a total
 * function rather than being equal.
 */
const _theProvidersPackageAgrees: Record<WhyNotNamed, WhyItWasRefused> = {
  "nothing-named": REFUSED.nothing,
  "not-one-provider": REFUSED.several,
  "not-a-url": REFUSED.notAUrl,
};
void _theProvidersPackageAgrees;

/**
 * WHICH WORD OF ONE CLOSED SET AN ADDRESS NAMES, or nothing at all.
 *
 * ONE READER FOR THE THREE SETS, because "hold it to the set and answer nothing
 * otherwise" is one rule about all of them -- and written out per set it is
 * three places for the `oneValue` call, or the `find`, to quietly stop
 * agreeing. The SETS differ because three controls render three groups of
 * sentence; the READING does not differ at all.
 */
function theWordIn<Word extends string>(
  words: readonly Word[],
  parameter: string | string[] | undefined,
): Word | undefined {
  const word = oneValue(parameter);
  return words.find((known) => known === word);
}

export function oneBecause(parameter: string | string[] | undefined): WhyItWasRefused | undefined {
  return theWordIn(THE_CLOSED_SET, parameter);
}

/** Which refusal the Allowlist's own save met, held to its own closed set. */
export function oneBecauseSavingTheAllowlist(
  parameter: string | string[] | undefined,
): WhyTheAllowlistWasRefused | undefined {
  return theWordIn(Object.values(REFUSED_SAVING_THE_ALLOWLIST), parameter);
}

/** Which refusal the Providers' own save met, held to its own closed set. */
export function oneBecauseSavingTheProviders(
  parameter: string | string[] | undefined,
): WhyTheProvidersWereRefused | undefined {
  return theWordIn(Object.values(REFUSED_SAVING_THE_PROVIDERS), parameter);
}

/**
 * HOW MUCH OF THE REFUSED ENTRY THE SENTENCE QUOTES BACK.
 *
 * THE SAME 80 `shortly` USES INSIDE `@canoncore/providers`, and decided here
 * rather than imported, which is ADR-0123's own arrangement kept by ADR-0163:
 * the levers are shared, from `@canoncore/text`, and each ceiling sits beside
 * the sentences it bounds. An Owner who typed a
 * long base URL still recognises its opening, and what they cannot do without
 * is the clause saying what to do -- which is exactly what keeping the value
 * short protects.
 */
const ENTRY_MAX = 80;

/**
 * THE ENTRY A REFUSAL IS ABOUT, AT A LENGTH THIS PAGE CHOSE.
 *
 * BOUNDED AT THE SEAM, WHICH FOR A QUERY PARAMETER IS HERE. `Reason` states the
 * rule -- "the LENGTH is not the Provider's to choose either, and that is
 * settled before it arrives: `reasonFor` caps it at the seam rather than the
 * page truncating what it was handed" -- and a value off the address has no
 * earlier seam than the read. It never passes through the Server Action at all:
 * a hand-typed `/settings?refused=...` reaches this page having touched
 * nothing else, so a bound applied where the redirect is BUILT would guard the
 * one path that was never the problem.
 *
 * AND THAT IS WHY IT IS BOUNDED RATHER THAN LEFT TO `TheirWords`. That
 * component says of itself that it does not "quote, bound or attribute" -- it
 * settles WIDTH, by breaking a long word, and a value of any length still
 * occupies the page. ADR-0142 fixes how somebody else's text is laid out;
 * ADR-0123 fixes how much of it this app repeats, and they are two questions.
 *
 * WITHOUT IT A FORGEABLE ADDRESS PUTS AN UNBOUNDED STRING INSIDE A SENTENCE
 * THIS PAGE SPEAKS IN ITS OWN VOICE, which is the harm the closed set above
 * exists to prevent, arriving through the other parameter. Holding one and not
 * the other would leave the door open beside the lock.
 *
 * BOTH LEVERS, THROUGH ONE CALL (CNCORE-282). This took the CUT alone until
 * review caught it, and a cut alone is the half-mechanism ADR-0123 keeps
 * finding: a bidirectional override in `?refused=` re-orders the sentence
 * written AROUND the entry, at any length, so the ceiling above never touched
 * it. The docblock claimed this file "holds both rules, one per parameter"
 * while it held one and a half. `boundedTo` applies the strip and the cut
 * together, which is why ADR-0163 publishes the pair rather than the cut.
 *
 * AND THE WORDS FOR AN ENTRY THAT STRIP EMPTIES (ADR-0179). An entry made of
 * nothing but stripped characters bounds to "", and `WhichEntry` then renders
 * an empty subject into "<nothing> was not named, because ...". It is
 * reachable here for the same reason the levers are: the address is forgeable,
 * and `trim()` does not remove U+200B, so `oneValue` does not read it as
 * blank.
 *
 * ABSENT AND UNSHOWABLE STAY TWO ANSWERS. `undefined` still travels as
 * `undefined`, because `WhichEntry` says "That entry" for a refusal that named
 * nothing -- a different fact from an entry nobody can print, and CNCORE-92's
 * rule is that the two do not merge into one sentence.
 */
export function theEntryRefused(parameter: string | string[] | undefined): string | undefined {
  const entry = oneValue(parameter);
  return entry === undefined ? undefined : quotedTo(entry, ENTRY_MAX, "an entry");
}

/**
 * WHAT `theEntryRefused` ANSWERS WHEN THE ENTRY CANNOT BE SHOWN, published so
 * the page can tell CanonCore's words from the Owner's (ADR-0179).
 *
 * `WhichEntry` renders a real entry inside `TheirWords` and `font-medium`,
 * which is how that page marks a value as QUOTED. The sentence above is not a
 * quote, it is this app describing the entry, so it must render plainly --
 * ADR-0123's `wrote` distinction, which a page loses at the last inch if it
 * cannot tell the two apart. Compared against rather than re-spelled, so the
 * phrase still lives in exactly one place.
 */
export const UNSHOWABLE_ENTRY = unshowable("an entry");
