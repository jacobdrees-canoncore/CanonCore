import { describe, expect, it } from "vitest";

import { assertConfigUrl, parseAllowlist, REASON_MAX_LENGTH, reasonFor } from "./index";

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
   * A THIRD PARTY'S TEXT IS SAID TO BE THEIRS, which is the half a cap alone
   * does not buy. CNCORE-96 binds every new reason surface to both: capped, and
   * attributed, "so the Owner reads it as a Provider's claim rather than as
   * CanonCore speaking".
   */
  it("says a provider's own text is the provider's", () => {
    expect(reasonFor(new Error("results[0].title: expected string")).wrote).toBe("provider");
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
    for (const silent of [new Error(""), "", undefined]) {
      const { wrote, text } = reasonFor(silent);

      expect(text.length).toBeGreaterThan(0);
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
