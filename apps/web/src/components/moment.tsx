/**
 * The one format a past moment is printed in: a long date, a short time, UTC.
 *
 * BUILT ONCE RATHER THAN PER RENDER. A formatter is expensive to construct and
 * carries no state between calls, which is why Intl's own guidance is to keep
 * one -- and three pages rendering a list each would have built one per row.
 */
const inUtc = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

/**
 * A MOMENT, IN UTC AND SAID SO, MARKED AS A TIME (CNCORE-177).
 *
 * THE SERVER CANNOT KNOW THE READER'S TIMEZONE, and these pages are rendered on
 * the server with no script to correct them afterwards. A time printed in
 * whatever zone the server happens to run in, unlabelled, is one an owner
 * cannot compare against "I used my phone this morning" or "I unlocked that
 * last week", which is the entire question each of them is read to answer. A
 * past moment is the same instant everywhere, so UTC is a statement a reader
 * can convert.
 *
 * NOT EVERY TIME ON THESE PAGES IS ONE. `/tasks` prints a SCHEDULE beside this,
 * and a schedule is a wall-clock instruction to this machine: "three in the
 * morning" means three where the machine thinks it is, and printing that in UTC
 * would tell an owner in Sydney their sweep runs at lunchtime when it does not.
 * That sentence stays on that page and does not come through here.
 *
 * `<time>` IS THE HALF THAT HAD DRIFTED. This was written out three times, on
 * `/devices`, `/settings` and `/tasks`, with each docblock citing the others --
 * and `/tasks` printed bare words. The words were right, so nothing a reader
 * saw was wrong; what was missing was the only thing that tells a machine
 * reading the page that the string is a moment at all. The element and the
 * sentence are one thing here, so a surface cannot take the second without the
 * first.
 *
 * IT TAKES A `Date`, WHICH PUTS THE PARSE AT THE ONE CALL SITE THAT HAS A
 * STRING. `/settings` reads `state_changed_at` off a Provider's manifest, where
 * `cmppManifest` has already held it to `z.iso.datetime()`; the other two hold
 * a column. A component that took either would be parsing on behalf of callers
 * that never needed it.
 */
export function Moment({ at }: { at: Date }) {
  return <time dateTime={at.toISOString()}>{`${inUtc.format(at)} UTC`}</time>;
}
