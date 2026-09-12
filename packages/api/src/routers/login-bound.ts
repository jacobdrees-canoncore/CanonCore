/**
 * WHAT BOUNDS THE GUESSING AT THE OWNER'S ONE PASSWORD (ADR-0125).
 *
 * A burst of refusals, and then one password check every so often. The
 * allowance is spent only when a password is WRONG, so an owner typing theirs
 * into an instance nobody is guessing at never meets this.
 *
 * THEY DO MEET IT WHILE SOMEBODY IS, and that is not a defect: a bound that let
 * the right password through at once would leave every candidate costing exactly
 * one test, which is no bound at all. What ADR-0125 refuses is a state that
 * OUTLIVES the guessing, and nothing here is one.
 */

/**
 * How many wrong passwords are looked at before the bound starts holding.
 *
 * FORTY, WHICH IS AUDIOBOOKSHELF'S SHIPPED FIGURE (40 requests per 600,000ms on
 * its login route) restated as an allowance. A number a comparable self-hosted
 * product ships and its users live with is worth more than one invented here.
 */
const A_BURST_OF = 40;

/** How often one more check is earned back. Ten minutes over the burst above. */
const ONE_CHECK_EVERY_MS = 15_000;

/** Checks left to spend, and the moment that was last worked out. */
let allowance = A_BURST_OF;
let countedAt = Date.now();

/**
 * Earns back whatever time has passed since this was last asked.
 *
 * NAMED FOR THE WRITE, as `seeSession` is one package over: it reads as a sum
 * and is an assignment to both of this module's values.
 *
 * CONTINUOUS RATHER THAN A WINDOW THAT RESETS, which is the one place this
 * departs from Audiobookshelf's shape without a single-owner reason: a fixed
 * window hands back the whole allowance on a boundary and nothing at all a
 * moment before it, so an owner's wait for their next attempt depends on when
 * the flood happened to start. Earning one back every fifteen seconds means the
 * wait is always at most fifteen seconds.
 */
function earnBack(): void {
  const now = Date.now();
  // NEVER LESS THAN NOTHING, BECAUSE A WALL CLOCK RUNS BOTH WAYS. `Date.now()`
  // is corrected by NTP, and a step BACKWARDS makes this term negative -- so an
  // hour's correction would have spent four hours of allowance and shut the
  // owner out until it refilled, which is the one state this mechanism is not
  // allowed to have. ADR-0043 measured this clock running backwards on this
  // machine already, by 60ms against the container on 55432.
  const earned = Math.max(0, now - countedAt) / ONE_CHECK_EVERY_MS;
  allowance = Math.min(A_BURST_OF, allowance + earned);
  countedAt = now;
}

/**
 * What became of one attempt. NOT EXPORTED: nothing outside needs to name it,
 * and `packages/api` publishes an enumerated `exports` map (ADR-0103) that this
 * file is deliberately not in.
 */
type Verdict = "the owner" | "not the owner" | "too many attempts";

/**
 * Runs a password check, if this instance has an attempt left to spend on one.
 *
 * IT TAKES THE CHECK RATHER THAN ANSWERING WHETHER ONE IS ALLOWED, so a caller
 * cannot ask whether it may check and then forget to spend the allowance -- and,
 * more to the point, cannot put an `await` between the asking and the spending.
 * The callback is SYNCHRONOUS by signature, which is what holds this together
 * under concurrency: refilling, testing, spending and comparing all complete in
 * one turn of the event loop, so simultaneous guesses cannot interleave.
 */
export function checkWithinTheBound(check: () => boolean): Verdict {
  earnBack();
  if (allowance < 1) return "too many attempts";
  if (check()) {
    // THE WHOLE ALLOWANCE BACK, which is what Jellyfin and Nextcloud both do on
    // a success and what Audiobookshelf's limiter cannot do: it counts requests
    // rather than refusals, so an owner's own logins spend the budget their next
    // one needs. Somebody who has just proved they are the owner has not been
    // guessing.
    allowance = A_BURST_OF;
    return "the owner";
  }
  allowance -= 1;
  sayItWasRefused();
  return "not the owner";
}

/**
 * The one place a refused attempt is visible to the owner (ADR-0125).
 *
 * ONLY A CHECKED REFUSAL IS WRITTEN. An attempt turned away with no allowance
 * left writes nothing, so the log is bounded by the same allowance the guessing
 * is -- four lines a minute at worst. A line per ARRIVING request is a way to
 * fill an owner's disk from the outside, which is what Audiobookshelf's
 * `[RateLimiter] Rate limit exceeded` line is.
 *
 * IT NAMES NO ADDRESS AND NO USERNAME, unlike all four of the products that log
 * this, because this instance has neither to name: one owner, and no trustworthy
 * source address on the path the login form actually posts to. What it knows is
 * how much of the allowance is left, so that is what it says.
 */
function sayItWasRefused(): void {
  const left = Math.floor(allowance);
  console.warn(
    left > 0
      ? `canoncore: a login was refused; ${left} more will be checked before the bound holds`
      : "canoncore: a login was refused, and the bound is now holding -- " +
          `one password will be checked every ${ONE_CHECK_EVERY_MS / 1000}s`,
  );
}
