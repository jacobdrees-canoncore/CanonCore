import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  type Database,
  endSession,
  listSessions,
  seeSession,
  startSession,
  sweepSessions,
} from "./index";
import { sessions } from "./schema";
import { connect, theOwner } from "./testing/catalogue";

let db: Database;
let ownerId: string;

beforeAll(async () => {
  db = await connect();
  ownerId = await theOwner(db);
});

/**
 * A row's age, written into the row rather than faked on the clock.
 *
 * BECAUSE THE CLOCK THE EXPIRY IS MEASURED AGAINST IS POSTGRES'S. ADR-0043
 * records what mixing the two costs: `created_at` defaults to the database's
 * `now()`, and this process's clock read 60ms BEHIND it on this machine. A test
 * that stubbed `Date` would move the only clock the policy does not consult.
 *
 * THE AGES PASSED TO IT ARE LITERALS rather than arithmetic on the exported
 * limits. "One second past `SESSION_LIFETIME_SECONDS`" would pass whatever that
 * constant became, which is the policy asserting itself; thirty-one days is the
 * decision written down, and it fails if somebody widens the window.
 */
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/**
 * ADR-0043's row, at the package's own export (ADR-0103's first seam).
 *
 * A SESSION IS THE ONLY THING THAT SAYS A CALLER IS THE OWNER, so what this
 * file asserts is not a table's shape but the two answers that guard the write
 * path: this token is the owner's, and this one is nobody's.
 */
describe("starting a session", () => {
  it("answers the owner for the token it minted", async () => {
    const { token } = await startSession(db, {});

    expect(await seeSession(db, token)).toMatchObject({ ownerId });
  });

  it("answers nobody for a token it never minted", async () => {
    // THE ANSWER THE WHOLE WRITE PATH RESTS ON. A lookup that matched loosely --
    // an empty token against a null column, a prefix, a row whose hash was never
    // set -- would hand the owner's session to a caller who guessed nothing at
    // all, and the procedures above would be refusing an empty set.
    expect(await seeSession(db, "a token nobody minted")).toBeNull();
  });
});

describe("what a device declared", () => {
  it("keeps every field ADR-0043 names, and answers them back", async () => {
    // THE COLUMNS ARE NOT DECORATION, which is that record's own phrase about
    // the capability declaration: direct play (ADR-0041) makes it decisive, and
    // a row that accepted a declaration and dropped it would look identical to
    // one that had never been declared to until something tried to play.
    //
    // ASSERTED WITH A CLIENT'S DECLARATION RATHER THAN THE WEB'S, because the
    // web declares nothing -- a browser is not a Client (`CONTEXT.md`) -- so a
    // test written against the only caller that exists today would exercise five
    // nulls and prove nothing about the five columns.
    const declared = {
      clientName: "CanonCore for tvOS",
      deviceName: "Living room",
      deviceId: "8B6E1F0C-3A5D-4C2E-9F17-2D4A5B6C7E80",
      clientVersion: "0.2.0",
      capabilities: { directPlay: ["h264", "aac"] },
    };
    const { token } = await startSession(db, declared);

    expect(await seeSession(db, token)).toMatchObject(declared);
  });

  it("says a browser declared nothing rather than inventing a declaration", async () => {
    // The web UI is the one surface that logs in today and it is not a Client,
    // so its row holds nulls in all five. A placeholder here -- "web", "unknown"
    // -- would be this app asserting something no device said, in the columns
    // built to hold what the device said.
    const { session } = await startSession(db, {});

    expect(session).toStrictEqual({
      id: session.id,
      ownerId,
      lastSeenAt: session.lastSeenAt,
    });
  });
});

describe("last seen", () => {
  it("advances when the session is used", async () => {
    // ADR-0043 names this column, and a column written once at login and never
    // again is `created_at` spelled differently. It is what the owner reads when
    // deciding which device to log out, so a device in daily use that reads as
    // last seen in March is a false signal on the one surface that acts on it.
    // BACK-DATED RATHER THAN RACED AGAINST THE CLOCK. This read
    // `startSession` then `seeSession` and asserted the second was strictly
    // later, which FLAKES: both statements call `now()`, Postgres keeps
    // microseconds, and `getTime()` is milliseconds -- so two statements inside
    // one millisecond are equal and the assertion fails on a fast machine.
    // Observed 2026-09-12, failing in the full suite and passing alone. Moving
    // the stored sighting into the past tests what the column is FOR, which is
    // that using a session advances it, and it cannot be decided by how quickly
    // two queries ran.
    //
    // AND BACK-DATED TO TWO DAYS RATHER THAN TO MARCH, which CNCORE-116 forced
    // and which is the policy arriving rather than the test being weakened: a
    // session last seen six months ago is one the idle limit REFUSES, so the
    // original fixture asserted that a lapsed session still answers. Two days is
    // inside the window, so what it tests is still that using a session advances
    // the column -- against a session that is allowed to be used at all.
    const { token, session } = await startSession(db, {});
    const twoDaysAgo = daysAgo(2);
    await db.update(sessions).set({ lastSeenAt: twoDaysAgo }).where(eq(sessions.id, session.id));

    const seen = await seeSession(db, token);

    expect(seen?.lastSeenAt.getTime()).toBeGreaterThan(twoDaysAgo.getTime());
  });
});

describe("ending a session", () => {
  it("stops the token it was held by from answering", async () => {
    // ADR-0043's per-device logout, which is the whole reason that record
    // refuses a token on the user row: logging one device out has to be possible
    // without logging the others out, and a session ROW is what makes "that
    // one" addressable.
    const { token, session } = await startSession(db, {});
    const other = await startSession(db, {});

    await endSession(db, session.id);

    expect(await seeSession(db, token)).toBeNull();
    expect(await seeSession(db, other.token)).toMatchObject({ id: other.session.id });
  });
});

describe("a session that has lapsed", () => {
  it("refuses a token whose session is older than the lifetime", async () => {
    // THE CASE THIS TICKET WAS FILED OVER: a token copied off a request, out of
    // a backup of a browser profile, or off a machine the owner stopped using.
    // Until CNCORE-116 it opened the write path forever, because `seeSession`
    // read `deleted_at IS NULL` and nothing else.
    const { token, session } = await startSession(db, {});
    await db.update(sessions).set({ createdAt: daysAgo(31) }).where(eq(sessions.id, session.id));

    expect(await seeSession(db, token)).toBeNull();
  });

  it("refuses a token whose session has not been used for longer than the idle limit", async () => {
    // THE OTHER HALF OF THE POLICY, and the one the lifetime cannot cover: a
    // device the owner stopped using in week one is a live token for the
    // remaining three weeks, and the laptop it was left on is exactly where a
    // copy comes from. `last_seen_at` already answers this question on every
    // request (ADR-0043), so the limit reads a column that was already there.
    const { token, session } = await startSession(db, {});
    await db.update(sessions).set({ lastSeenAt: daysAgo(8) }).where(eq(sessions.id, session.id));

    expect(await seeSession(db, token)).toBeNull();
  });

  it("still answers for a session inside both windows", async () => {
    // THE WINDOW HAS TWO SIDES, and without this one it need not: a predicate
    // that refused every session would pass both tests above and lock the owner
    // out of their own catalogue, which is the failure this policy is most
    // likely to arrive as.
    const { token, session } = await startSession(db, {});
    await db
      .update(sessions)
      .set({ createdAt: daysAgo(14), lastSeenAt: daysAgo(1) })
      .where(eq(sessions.id, session.id));

    expect(await seeSession(db, token)).toMatchObject({ id: session.id });
  });
});

/**
 * ADR-0049's sweep, which is the half of this that keeps the TABLE honest
 * rather than the write path.
 *
 * A BROWSER THAT FORGETS ITS COOKIE LEAVES A LIVE ROW NOTHING WILL EVER PRESENT
 * AGAIN, and so does every session that lapses: the row goes on being a row. The
 * write path does not depend on this running -- `seeSession` refuses a lapsed
 * session whether or not anything has swept it -- which is why a sweep nobody
 * has scheduled yet is a tidiness problem rather than a hole.
 */
describe("sweeping the rows that can no longer answer", () => {
  it("removes what is past its lifetime and leaves what is not", async () => {
    // SWEPT FIRST, so what the assertion counts is what this test made rather
    // than what the file above it left lying around. Every other test here works
    // in live rows, so after this line nothing in the table is sweepable.
    await sweepSessions(db);
    const { session } = await startSession(db, {});
    await db.update(sessions).set({ createdAt: daysAgo(31) }).where(eq(sessions.id, session.id));
    const live = await startSession(db, {});

    expect(await sweepSessions(db)).toBe(1);

    // AND IT IS GONE RATHER THAN COUNTED. A sweep that reported rows it had not
    // deleted would pass the line above and let the table grow forever, so the
    // second sweep finding nothing is what says the first one wrote.
    expect(await sweepSessions(db)).toBe(0);
    expect(await seeSession(db, live.token)).toMatchObject({ id: live.session.id });
  });
});

/**
 * ADR-0043's per-device logout, which that record calls the thing everyone
 * actually wants -- and which was unreachable until CNCORE-116 because
 * `endSession` names a session and nothing could name one.
 *
 * THE LIST IS THE SURFACE, NOT A CHANGE TO THE MECHANISM. `endSession` already
 * took the session it ends rather than the token the caller holds, precisely so
 * that this would be a page.
 */
describe("listing the owner's devices", () => {
  it("answers the live sessions and not the ones that have been ended", async () => {
    const kept = await startSession(db, { deviceName: "Study laptop" });
    const ended = await startSession(db, { deviceName: "A phone the owner sold" });
    await endSession(db, ended.session.id);

    const listed = (await listSessions(db)).map(({ id }) => id);

    expect(listed).toContain(kept.session.id);
    // A LIST OFFERING TO END SOMETHING ALREADY OVER is worse than a short list:
    // the owner presses it, nothing changes, and the device they meant to reach
    // is the one still logged in.
    expect(listed).not.toContain(ended.session.id);
  });

  it("puts the most recently seen device first", async () => {
    // WHAT THE OWNER IS LOOKING FOR IS THE DEVICE THEY ARE NOT HOLDING, and the
    // one they are holding was seen a moment ago by the request that drew the
    // page. Ordering by the sighting is what puts the stranger somewhere they
    // can find it.
    //
    // SEEDED AGAINST INSERTION ORDER ON PURPOSE: the older sighting is inserted
    // FIRST, so a list that simply answered the rows in the order Postgres
    // happened to hold them would come back the wrong way round.
    const older = await startSession(db, { deviceName: "The one in a drawer" });
    await db.update(sessions).set({ lastSeenAt: daysAgo(3) }).where(eq(sessions.id, older.session.id));
    const newer = await startSession(db, { deviceName: "The one in a hand" });
    await db.update(sessions).set({ lastSeenAt: daysAgo(1) }).where(eq(sessions.id, newer.session.id));

    const listed = (await listSessions(db)).map(({ id }) => id);

    expect(listed.indexOf(newer.session.id)).toBeLessThan(listed.indexOf(older.session.id));
  });

  it("leaves out a session that has lapsed", async () => {
    // THE LIST AND THE WRITE PATH ASK ONE QUESTION. A device whose token the
    // owner's catalogue would refuse is not one they are logged in on, and a row
    // for it here would be an End button against something already over.
    const lapsed = await startSession(db, { deviceName: "A laptop nobody opens" });
    await db.update(sessions).set({ lastSeenAt: daysAgo(8) }).where(eq(sessions.id, lapsed.session.id));

    expect((await listSessions(db)).map(({ id }) => id)).not.toContain(lapsed.session.id);
  });
});
