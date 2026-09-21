import { describe, expect, it } from "vitest";

import {
  assertConfigUrl,
  bounded,
  failureReason,
  OutboundRefused,
  parseAllowlist,
  REASON_MAX_LENGTH,
  reasonFor,
} from "./index";

/**
 * WHAT A FAILED REACH IS ALLOWED TO SAY TO THE OWNER (ADR-0123, CNCORE-95).
 *
 * Two kinds of string arrive at a `catch` on this path and they are not the
 * same kind. One is this app telling the Owner about a setting only they can
 * fix; the other is a third party's text, and a provider that answers with a
 * body `packages/providers` refuses puts a zod message SERIALISING ITS OWN
 * PAYLOAD into it. The second must not choose the length of what lands on the
 * Owner's page.
 */
describe("reasonFor", () => {
  /**
   * THE DEFECT THIS TICKET EXISTS FOR. A provider chooses its own response
   * body, zod's message quotes that body back, and until this the message
   * travelled to a page verbatim -- so the provider chose how much of the
   * Owner's page it occupied.
   */
  it("caps a provider's own text, and says it was cut", () => {
    const flood = "!".repeat(REASON_MAX_LENGTH * 10);

    const { text } = reasonFor(new Error(flood));

    expect(text.length).toBeLessThanOrEqual(REASON_MAX_LENGTH);
    expect(text.endsWith("…")).toBe(true);
  });

  /**
   * AND THE SENTENCE THE OWNER ACTS ON ARRIVES WHOLE, marked as this app's own.
   *
   * ADR-0034's CONFIG boundary refuses a URL the Owner typed, and the refusal
   * names the setting they have to go and change. That is CanonCore talking to
   * the Owner about their own instance, not a third party's text, so it is not
   * cut and the page does not attribute it to the provider.
   *
   * THROWN BY THE REAL BOUNDARY rather than hand-written here, which is the
   * point of the assertion. A sentence edited past the cap would be truncated
   * silently and the Owner would lose the half naming the setting; this fails
   * instead.
   */
  it("hands CanonCore's own refusal to the Owner whole, and says it is CanonCore's", () => {
    const refusal = caught(() =>
      assertConfigUrl(new URL("https://wiki.example.com/"), parseAllowlist("tardis.example.com")),
    );

    const { wrote, text } = reasonFor(refusal);

    expect(wrote).toBe("canoncore");
    expect(text).toBe(refusal.message);
    expect(text).toContain("not an allowlisted host");
  });

  /**
   * AND IT SURVIVES A HOSTNAME LONG ENOUGH TO PUSH IT PAST THE CAP, which is
   * the case the assertion above does NOT reach and the one that was broken.
   *
   * `assertConfigUrl` interpolates the host TWICE, so the refusal grows at twice
   * the rate of the Owner's own base URL: measured, a 147-character hostname --
   * an ordinary AWS load balancer name -- made a 413-character refusal, and the
   * cap took away "is not an allowlisted host" AND the sentence naming the
   * remedy. The Owner was left the name of their own host and no verdict on it.
   *
   * THE VALUE IS BOUNDED WHERE IT ENTERS, so the prose around it is fixed-length
   * and cannot be cut. That is asserted here rather than in the ceiling's
   * arithmetic, because arithmetic is what was wrong.
   */
  it("keeps the remedy when the Owner's own hostname is long enough to blow the cap", () => {
    const host = `${"a".repeat(120)}.eu-west-2.elb.amazonaws.com`;

    const { wrote, text } = reasonFor(
      caught(() => assertConfigUrl(new URL(`https://${host}/`), parseAllowlist("other.test"))),
    );

    expect(wrote).toBe("canoncore");
    expect(text.length).toBeLessThanOrEqual(REASON_MAX_LENGTH);
    // THE VERDICT AND THE REMEDY, which are the two halves the cap removed.
    expect(text).toContain("is not an allowlisted host");
    expect(text).toContain("a parent domain does not cover it");
  });

  /**
   * A THIRD PARTY'S TEXT IS SAID TO BE THEIRS, which is the half a cap alone
   * does not buy. CNCORE-96 binds every new reason surface to both: capped, and
   * attributed, "so the Owner reads it as a Provider's claim rather than as
   * CanonCore speaking".
   */
  it("says a provider's own text is the provider's", () => {
    expect(reasonFor(new Error("results[0].title: expected string")).wrote).toBe("provider");
  });

  /**
   * AND IT SURVIVES BEING WRAPPED, which is the shape EVERY refusal raised
   * below `fetch` arrives in (CNCORE-192).
   *
   * A refusal raised inside the pinned lookup never reaches this function on
   * its own stack: undici has it on a connector callback and rejects with
   * `TypeError: fetch failed`, carrying the refusal on `cause`. So a wrapped
   * one is neither an `OutboundRefused` nor a `config` one, and this function
   * QUOTED CanonCore's own sentence about the Owner's settings as a stranger's
   * claim -- ADR-0123 answering wrongly rather than not at all.
   *
   * THE REFUSAL IS THE REAL BOUNDARY'S, and only the wrapper is written here.
   * `client.test.ts` is where the wrapper itself is proven to be the shape
   * undici really produces; this is where the RULE is, so the sentence under
   * test has to be one the app would actually write.
   */
  it("unwraps a refusal undici wrapped, and still says it is CanonCore's", () => {
    const refusal = caught(() =>
      assertConfigUrl(new URL("https://wiki.example.com/"), parseAllowlist("tardis.example.com")),
    );

    const { wrote, text } = reasonFor(new TypeError("fetch failed", { cause: refusal }));

    expect(wrote).toBe("canoncore");
    expect(text).toBe(refusal.message);
  });

  /**
   * AND THE SAME UNWRAPPING IS WHAT MAKES A THIRD PARTY'S FAILURE READABLE,
   * which is the half of CNCORE-192 the ticket did not count.
   *
   * `fetch failed` is undici saying that something underneath it failed, and it
   * is the same eight words whether the socket was refused, the host does not
   * resolve, or the TLS handshake broke. The fact is one link down, and the
   * Owner was reading the wrapper for all of them. It stays the PROVIDER'S,
   * because nothing here was refused by ADR-0034's config boundary -- what
   * changes is that there is something to read.
   */
  it("unwraps a third party's failure too, and leaves it the provider's", () => {
    const dead = new Error("connect ECONNREFUSED 127.0.0.1:64665");

    const { wrote, text } = reasonFor(new TypeError("fetch failed", { cause: dead }));

    expect(wrote).toBe("provider");
    expect(text).toBe("connect ECONNREFUSED 127.0.0.1:64665");
  });

  /**
   * THE INNERMOST LINK THAT SAID SOMETHING, NOT SIMPLY THE INNERMOST.
   *
   * `makeNetworkError()` called with no argument builds `new Error(undefined)`,
   * whose message is EMPTY, and three sites in undici's fetch reach it -- so a
   * blind walk to the bottom of the chain would report the silence and throw
   * away `fetch failed`, which in that case is genuinely all there is. Keeping
   * the last link with words in it cannot lose information.
   */
  it("keeps the wrapper's words when what it wrapped said nothing", () => {
    const { text } = reasonFor(new TypeError("fetch failed", { cause: new Error("") }));

    expect(text).toBe("fetch failed");
  });

  /**
   * A CHAIN THAT POINTS BACK AT ITSELF IS READ ONCE, not forever.
   *
   * ECMA-262 puts NO restriction on a `cause`: `InstallErrorCause` stores
   * whatever was passed, as a writable property, so a cycle is constructible
   * and nothing in the platform forbids one. Walking it without a visited set
   * is an infinite loop inside a function that runs while rendering the Owner's
   * page -- a hang rather than a reason, which is the failure `pinnedLookup`
   * already carries a comment about at a different seam.
   *
   * IT IS A GUARD RATHER THAN DECORATION: removing `seen` hangs this test until
   * the runner kills it, measured.
   */
  it("does not walk a cause chain that loops back on itself forever", () => {
    const outer = new Error("fetch failed");
    const inner = new Error("the socket went away");
    outer.cause = inner;
    inner.cause = outer;

    const { text } = reasonFor(outer);

    expect(text).toBe("the socket went away");
  });

  /**
   * AND A `cause` THAT IS NOT AN ERROR AT ALL STOPS THE WALK RATHER THAN
   * BECOMING THE REASON.
   *
   * ECMA-262 admits any value there -- a number, a string, `null` -- and undici
   * is not the only thing that can put one on an error this function is handed.
   * The link ABOVE it is the last one that spoke, so that is what the Owner
   * reads; `String(42)` on their settings page would be a reason nobody wrote.
   */
  it("stops at a cause that is not an error", () => {
    const { text } = reasonFor(new TypeError("the provider answered badly", { cause: 42 }));

    expect(text).toBe("the provider answered badly");
  });

  /**
   * `wrote` AND `text` COME FROM THE SAME LINK, ALWAYS. This is the invariant
   * the walk exists to preserve, and it is asserted because the obvious
   * "improvement" breaks it.
   *
   * Raised in review of CNCORE-192: `wrote` is asked of the link the walk
   * LANDED on rather than of any `config` refusal in the chain, so a refusal
   * that ever gained a cause would attribute itself to the provider. True, and
   * the proposed repair -- look for a `config` refusal ANYWHERE and keep the
   * deepest link only for `text` -- is worse than the thing it fixes. It would
   * print the deeper link's text, which is a third party's, in CANONCORE'S
   * VOICE. ADR-0123 ranks those two costs explicitly and that is the one it
   * calls worse; under-attributing our own sentence is the conservative
   * direction and is what this does.
   *
   * AND IT IS A SECOND WALK OF THE SAME CHAIN, so it is a second place to
   * forget the visited set. Written out to check, it forgot, and the suite hung
   * instead of failing -- the hang the test below exists to stop, arriving by
   * the repair for this one.
   *
   * SO THE COUPLING IS THE POINT. `wrote` is a claim ABOUT `text`, and a build
   * that sourced them from two different links would be making that claim about
   * a sentence it did not read.
   */
  it("asks whose the sentence is of the link the sentence came from", () => {
    const refusal = new OutboundRefused("refused https://wiki.test: not allowlisted.", "config");
    // A config refusal cannot carry a cause today: the constructor takes a
    // message and a boundary and has no `cause` parameter at all, so none of
    // its fifteen sites could pass one. Assigned by hand BECAUSE of that --
    // what is pinned is which way this falls the day somebody adds one.
    (refusal as unknown as { cause: unknown }).cause = new Error("the provider's own words");

    const { wrote, text } = reasonFor(refusal);

    expect(text).toBe("the provider's own words");
    // THE PROVIDER'S, because that is whose sentence `text` is holding.
    expect(wrote).toBe("provider");
  });
  /**
   * A THROWN THING WITH NOTHING TO SAY STILL HAS TO SAY SOMETHING.
   *
   * `new Error()` carries an empty message, and so does a thrown `""`. The
   * contract declares `text` as `min(1)`, so an empty one fails OUTPUT
   * validation and becomes the 500 that `provider.container` exists to remove
   * -- a provider must not be able to crash the request that is reading it.
   */
  it("still says something when what was thrown says nothing", () => {
    // WHITESPACE COUNTS AS NOTHING SAID. `"   "` passes `min(1)` and renders as
    // a blank space, which is a reason the Owner cannot see rather than one
    // they can act on -- the same mistake a blank search query is. Nothing was
    // STRIPPED from it, which is what keeps it on this side of the split the
    // test below draws.
    for (const silent of [new Error(), new Error(""), new Error("   "), ""]) {
      const { wrote, text } = reasonFor(silent);

      expect(text).toBe("the provider failed without saying why.");
      expect(wrote).toBe("provider");
    }
  });

  /**
   * A VALUE NOBODY CAN SHOW IS NOT A VALUE NOBODY SENT (ADR-0176, ADR-0179).
   *
   * `bounded` strips the controls and trims, so a message of nothing but them
   * comes back EMPTY and `|| SILENT` fired on it -- reporting a provider that
   * named a reason as one that named none. The two are different facts about
   * different inputs, and CNCORE-92's rule is that a refusal reworded is not a
   * refusal reported.
   */
  it("says a provider's reason could not be shown, rather than that it said none", () => {
    const { wrote, text } = reasonFor(new Error("\u200b\u200b\u200b"));

    expect(wrote).toBe("provider");
    expect(text).toBe("the provider's reason was made only of characters that cannot be shown.");
  });

  /**
   * AND IT DOES NOT DISPLACE WORDS THE CHAIN DID HAVE (ADR-0176).
   *
   * `unwrapped` takes the innermost link that SAID SOMETHING and asks `oneLine`,
   * which strips -- so a cause of nothing but controls is passed over and the
   * wrapper's own words stand. The sentence above is reached only when NO link in
   * the chain had any, which is the right order: `fetch failed` is a thin reason
   * and still more than a sentence about the absence of one.
   */
  it("keeps a wrapper's words over a cause nobody can show", () => {
    const { text } = reasonFor(new Error("fetch failed", { cause: new Error("\u200b") }));

    expect(text).toBe("fetch failed");
  });

  /**
   * NO FALLBACK IS BOUNDED BY ANYTHING BUT THIS ASSERTION (ADR-0176, ADR-0183).
   *
   * `bounded` caps a PROVIDER'S text; a fallback is this app's own sentence and
   * never passes through it. So the contract's `max(REASON_MAX_LENGTH)` is the
   * only thing standing between a sentence edited past the ceiling and a 500 at
   * the output boundary -- which is exactly the failure `SILENT` exists to
   * prevent, arriving through the fix for it.
   *
   * ASSERTED AGAINST THE REAL BOUNDARY rather than by counting characters here,
   * which is ADR-0123's rule for the cap and ADR-0153's for a figure: a number
   * written into a test is a second copy of a ceiling, and `failureReason` is
   * the schema every reason surface is actually held to.
   */
  it("hands every fallback to the contract that has to accept them", () => {
    // THE POPULATION IS ONE PER FALLBACK, and it grew with them: a third
    // sentence added without a third throw here would be a sentence this
    // assertion never reads (ADR-0183).
    for (const thrown of [new Error(), new Error("\u200b\u200b\u200b"), undefined]) {
      expect(() => failureReason.parse(reasonFor(thrown))).not.toThrow();
    }
  });

  /**
   * A THROWN STRING IS THE PROVIDER'S OWN WORDS, AND STAYS VERBATIM (ADR-0183).
   *
   * `String(spoke)` answered for two inputs and was RIGHT about this one:
   * `throw "rate limited"` is a sentence the Provider wrote, and quoting it is
   * what this function is for. CNCORE-307 takes the other input away from it, so
   * this is the half that must not go with it -- a repair that sent every
   * non-`Error` to the new sentence would compile, pass every other assertion
   * here, and quietly stop quoting a Provider that spoke.
   *
   * BOUNDED LIKE ANY OTHER STRANGER'S TEXT, because who threw it changes nothing
   * about ADR-0123's levers: a string is a length a stranger chose.
   */
  it("quotes a thrown string verbatim, and bounds it like any other stranger's text", () => {
    const said = reasonFor("rate limited, retry in 30s");

    expect(said).toStrictEqual({ wrote: "provider", text: "rate limited, retry in 30s" });

    const { text } = reasonFor("!".repeat(REASON_MAX_LENGTH * 10));

    expect(text.length).toBeLessThanOrEqual(REASON_MAX_LENGTH);
    expect(text.endsWith("…")).toBe(true);
  });

  /**
   * A THROWN THING WITH NO WORDS OF ITS OWN IS NOT A PROVIDER SAYING
   * `undefined` (ADR-0183).
   *
   * `String(spoke)` gave CANONCORE'S SPELLING of a value a Provider's voice.
   * Measured on node 24.19.0: `undefined` read `undefined`, `null` read `null`,
   * `{}` read `[object Object]` and `42` read `42` -- and `[]` read `""`, which
   * reached the sentence for a Provider that said nothing. Three of those are
   * words no Provider wrote, and CNCORE-96 binds this surface to the opposite,
   * so a page rendering `undefined` in a Provider's voice says the Provider
   * used that word.
   *
   * REACHABLE RATHER THAN HYPOTHETICAL. `throw undefined` is legal and
   * `Promise.reject()` with no argument rejects with `undefined`; the input is
   * typed `unknown` because this is a `catch` clause, so nothing upstream
   * narrows it.
   *
   * THE SYMBOL IS IN THE POPULATION FOR THE REPAIR RATHER THAN FOR THE DEFECT.
   * A fix that named the value instead of refusing to -- `${spoke}` anywhere on
   * this path -- THROWS on a symbol, which is a `TypeError` raised inside the
   * function whose whole job is to turn a throw into a sentence. `String()` is
   * the one spelling that does not, so the hazard arrives with the obvious
   * improvement and not with what is here.
   */
  it("says a thrown thing that is not a message is not one, rather than spelling it", () => {
    for (const wordless of [undefined, null, {}, 42, [], Symbol("thrown")]) {
      const { wrote, text } = reasonFor(wordless);

      expect(text).toBe("the provider failed with something that is not a message.");
      expect(wrote).toBe("provider");
    }
  });
});

/** What a call threw, so an assertion can read the message the app really wrote. */
function caught(run: () => void): Error {
  try {
    run();
  } catch (error) {
    return error as Error;
  }
  throw new Error("nothing was thrown, and the refusal under test is the subject.");
}

/**
 * A PROVIDER CHOOSES WHAT ITS TEXT DOES TO THE PAGE, NOT ONLY HOW MUCH OF IT
 * THERE IS (ADR-0123, found reviewing CNCORE-101).
 *
 * The cap answers the length lever. It does nothing about a bidirectional
 * override, which re-orders the glyphs around itself -- so a provider's quoted
 * reason can run backwards through the sentence this app wrote, on a page whose
 * next control is a link the Owner is about to give a credential to.
 */
describe("text that rewrites the page around it", () => {
  it.each([
    ["‮", "a right-to-left override"],
    ["⁦", "a directional isolate"],
    ["​", "a zero-width space"],
    ["﻿", "a zero-width no-break space"],
  ])("strips %j, which is %s", (control) => {
    const { text } = reasonFor(new Error(`before${control}after`));

    expect(text).toBe("beforeafter");
  });
});

/**
 * THE SAME CUT AS `shortly`'S, ASSERTED AT THE OTHER SEAM (CNCORE-269).
 *
 * The two bound a stranger's string for one reason and cut it through one
 * function, so this is here to catch the day they stop agreeing -- and to hold
 * the ground while they were merged. `slice` counts UTF-16 units, and a
 * provider picks the offsets by choosing what it sends.
 */
describe("a reason shortened where an astral character straddles the bound", () => {
  it("keeps no lone surrogate, at either ceiling", () => {
    // REASON_MAX_LENGTH is 300 and the marker takes the last, so the cut falls
    // at unit 299. A U+1F600 opening at unit 298 straddles it.
    const straddling = `${"a".repeat(298)}\u{1F600}${"b".repeat(10)}`;

    const shortened = bounded(straddling);

    expect(shortened.isWellFormed()).toBe(true);
    expect(shortened).toBe(`${"a".repeat(298)}\u2026`);
    expect(shortened.length).toBeLessThanOrEqual(REASON_MAX_LENGTH);
  });
});
