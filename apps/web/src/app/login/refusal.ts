/**
 * WHICH REFUSAL A REDIRECT IS CARRYING, written once because two ends read it.
 *
 * `logIn` builds the address and the page reads it back, and as one string
 * spelled out in each file a rename on either side COMPILES CLEANLY and renders
 * nothing at all -- a page silently missing the one sentence it exists to say.
 *
 * IT IS DOING A TEST'S JOB, DELIBERATELY. The `TOO_MANY_REQUESTS` half of that
 * pair has no end-to-end test of its own: driving the bound over HTTP would
 * spend an allowance every file in the e2e suite shares, and those files run in
 * parallel against one server. A value both ends import is what holds the pair
 * together in its place.
 */
export const REFUSED = {
  /** The password offered was not the owner's. */
  password: "password",
  /** The password was not looked at at all: too many have been tried (ADR-0125). */
  tooMany: "too-many",
} as const;
