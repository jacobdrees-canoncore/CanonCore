import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { Database } from "./index";
import { theOwnerId } from "./placements";
import { sessions } from "./schema";

/**
 * What a device says about itself when it logs in (ADR-0043).
 *
 * EVERY FIELD OPTIONAL, because the only surface that logs in today declares
 * none of them: a browser on the web UI, which `CONTEXT.md` is explicit is not
 * a Client. A client declaring all five is what these columns are for, and it
 * arrives with the clients.
 */
export interface DeclaredDevice {
  clientName?: string;
  deviceName?: string;
  deviceId?: string;
  clientVersion?: string;
  capabilities?: Record<string, unknown>;
}

/** A session as anything holding a token reads it. */
export interface OwnerSession extends DeclaredDevice {
  id: string;
  ownerId: string;
  lastSeenAt: Date;
}

/**
 * The token a session is held by: 32 random bytes, which is the whole secret.
 *
 * IT IS THE ONLY THING A CALLER PRESENTS, so its entropy is the entire strength
 * of the write path. `randomBytes` is the CSPRNG rather than `Math.random`, and
 * 256 bits is far past guessing — the row stores only its hash, so a token is
 * unrecoverable from the database once it has been handed over.
 */
function mintToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * HOW LONG A SESSION LASTS, whatever it does (ADR-0043, CNCORE-116).
 *
 * THIRTY DAYS FROM THE LOGIN THAT MINTED IT, which is the same thirty days the
 * cookie carries as its `Max-Age` -- and the web app reads this constant for it
 * rather than writing the number down a second time. The two were already the
 * same length by coincidence; they are the same VALUE now, so a session cannot
 * outlive the browser's copy of its token or the reverse.
 */
export const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;

/**
 * HOW LONG A SESSION SURVIVES BEING UNUSED (ADR-0043, CNCORE-116).
 *
 * SEVEN DAYS SINCE THE DEVICE WAS LAST SEEN, which is the limit the lifetime
 * above cannot express: a device the owner stopped using in week one holds a
 * live token for the three weeks left on its lifetime, and a machine somebody
 * stopped using is precisely where a copied token comes from. A week is long
 * enough that an owner who opens their catalogue on Sundays never meets it.
 *
 * IT COSTS NO COLUMN. `last_seen_at` is one of ADR-0043's seven, stamped by
 * `seeSession` on every request the owner makes, so the policy reads what the
 * row already carried rather than a rung on the ladder.
 */
export const SESSION_IDLE_LIMIT_SECONDS = 60 * 60 * 24 * 7;

/**
 * A session is live if it has not been ended and has not lapsed.
 *
 * WRITTEN ONCE AND SHARED, because every question about a session asks it: the
 * lookup the whole write path rests on, and the list the owner reads when
 * deciding which device to log out. A list that showed a session the write path
 * would refuse is a list offering to end something already over.
 *
 * THE CLOCK IS POSTGRES'S. ADR-0043 records what happens when it is not: the
 * application's clock against the database's default `now()` read BACKWARDS by
 * 60ms on this machine, which is a comparison this policy cannot afford to get
 * wrong in either direction.
 */
function isLive() {
  return and(
    isNull(sessions.deletedAt),
    sql`${sessions.createdAt} > ${nowLess(SESSION_LIFETIME_SECONDS)}`,
    sql`${sessions.lastSeenAt} > ${nowLess(SESSION_IDLE_LIMIT_SECONDS)}`,
  );
}

/**
 * A moment in the past, by the DATABASE'S clock -- `now()` less that many
 * seconds.
 *
 * WRITTEN ONCE BECAUSE TWO STATEMENTS COMPARE AGAINST IT IN OPPOSITE
 * DIRECTIONS. `isLive` asks which sessions are inside the window and
 * `sweepSessions` deletes the rows outside it, so the same cutoff appearing
 * twice is two places to change and one of them forgotten -- and the failure it
 * would produce is the sweep deleting rows the write path still honours, which
 * is an owner logged out of a device they were using. Found in review.
 *
 * `make_interval` TAKES THE SECONDS AS A PARAMETER, and the only values reaching
 * it are the two module constants above.
 */
function nowLess(seconds: number) {
  return sql`now() - make_interval(secs => ${seconds})`;
}

/** The verifier stored against a token. See `sessions.tokenHash`. */
function hashOf(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Logs one device in, and answers the token it must present afterwards.
 *
 * IT CHECKS NO PASSWORD, and that is the boundary between this and the caller
 * rather than an omission: what proves the owner is the owner is a secret this
 * package never sees (`OWNER_PASSWORD`, read by `packages/api`), and a database
 * package that read the environment for one would be two places deciding who
 * may log in.
 *
 * THE OWNER IS READ RATHER THAN PASSED, because ADR-0044 makes exactly one, and
 * a caller free to name which owner a session belongs to is a caller free to
 * name the wrong one on the day multi-user arrives.
 */
export async function startSession(
  db: Database,
  declared: DeclaredDevice,
): Promise<{ token: string; session: OwnerSession }> {
  const token = mintToken();
  const [row] = await db
    .insert(sessions)
    .values({ ownerId: await theOwnerId(db), tokenHash: hashOf(token), ...declared })
    .returning();
  if (!row) throw new Error("inserting a session returned no row");
  return { token, session: asSession(row) };
}

/**
 * Whose session a token is, or `null` if it is nobody's -- and the sighting of
 * the device that presented it.
 *
 * IT IS NAMED FOR THE WRITE rather than for the answer, and an earlier draft was
 * not: `sessionFor` read as a lookup and was an `UPDATE`, which is the shape of
 * name this repo renames on sight. Seeing a session IS the sighting
 * (ADR-0043's `last_seen_at`), so a caller cannot ask this question without the
 * device being seen -- and should not, because a device answering requests and
 * reading as last seen in March is a false signal on the one surface that acts
 * on it.
 *
 * `null` COVERS EVERY WAY A TOKEN FAILS — never minted, guessed, logged out, or
 * ended — and that is deliberate: a caller that could tell them apart would be
 * an oracle for which tokens have ever existed.
 *
 * WHAT THE WRITE COSTS, stated because it is not free: every request the owner
 * makes takes a `nextval` from ADR-0075's single global `change_sequence`,
 * through the `sessions_touch` trigger. ADR-0040 needs that sequence's ORDER
 * rather than its density -- `purge.ts` records the same conclusion about the
 * gaps a rolled-back preview leaves -- so this is a fact to know rather than a
 * cost to avoid.
 *
 * AND IT READS THE CLOCK (CNCORE-116). A session lapses thirty days after it was
 * minted and seven days after the device was last seen, so a token copied off a
 * request, out of a backup of a browser profile or off a machine the owner
 * stopped using stops opening anything without anybody having to notice. Until
 * that landed, a copy was good until somebody logged that session out by hand.
 * `isLive` is the predicate and ADR-0043 carries the decision.
 */
export async function seeSession(db: Database, token: string): Promise<OwnerSession | null> {
  // AN UPDATE RATHER THAN A SELECT, because reading a session IS seeing the
  // device (ADR-0043's `last_seen_at`). Written as one statement so the sighting
  // cannot be recorded for a session the same call failed to find, and so the
  // value answered is the one stored rather than a second reading of the clock.
  //
  // THE DATABASE'S CLOCK AND NOT THIS PROCESS'S, which a passing test turned
  // into a decision: `created_at` defaults to Postgres's `now()`, so a sighting
  // stamped with `new Date()` is two clocks compared. Measured here against the
  // container on 55432 (ADR-0104), the skew ran BACKWARDS -- a session last seen
  // 60ms before it was created -- and over a network mount or a VM it is larger.
  const [row] = await db
    .update(sessions)
    .set({ lastSeenAt: sql`now()` })
    .where(and(eq(sessions.tokenHash, hashOf(token)), isLive()))
    .returning();
  return row ? asSession(row) : null;
}

/**
 * Every device the owner is logged in on, most recently seen first.
 *
 * THE SURFACE ADR-0043 SAYS EVERYONE ACTUALLY WANTS. That record refuses a
 * token on the user row because logging ONE device out has to be possible, and
 * `endSession` has taken a session id since CNCORE-109 for exactly this reason.
 * What was missing was a way to find out which ids there are.
 *
 * LIVE ONLY, on the same predicate the write path is guarded by, so the list
 * cannot offer to end a session that is already refused.
 *
 * THE OWNER IS READ RATHER THAN PASSED, for the reason `startSession` gives: a
 * caller free to name an owner is a caller free to name the wrong one on the day
 * multi-user arrives (ADR-0044 makes exactly one today).
 *
 * ORDERED BY THE SIGHTING RATHER THAN BY WHEN THE DEVICE LOGGED IN, because
 * what the owner is looking for is the device they are not holding, and "last
 * seen" is the column that tells them apart. An id they cannot place at the top
 * of the list is the one worth ending.
 */
export async function listSessions(db: Database): Promise<OwnerSession[]> {
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.ownerId, await theOwnerId(db)), isLive()))
    .orderBy(desc(sessions.lastSeenAt));
  return rows.map(asSession);
}

/**
 * Logs one device out, and answers whether there was anything to log out.
 *
 * A TOMBSTONE RATHER THAN A DELETE (ADR-0075), which every other table here
 * takes and which this one has its own reason for: "the owner logged this device
 * out" and "this device was never logged in" are different facts, and a row
 * removed outright leaves an instance unable to tell them apart afterwards.
 * `seeSession` reads live rows only, so the token stops answering either way.
 *
 * IT ENDS ONE SESSION AND NOT THE OWNER'S OTHERS, which is ADR-0043's per-device
 * logout and the thing that record says a token on the user row cannot do.
 *
 * IT NAMES THE SESSION RATHER THAN PRESENTING ITS TOKEN, because "log THAT
 * device out" is the operation that record is about, and the owner reading a
 * list of their devices holds no token but their own.
 */
export async function endSession(db: Database, sessionId: string): Promise<boolean> {
  const ended = await db
    .update(sessions)
    .set({ deletedAt: sql`now()` })
    .where(
      and(
        eq(sessions.id, sessionId),
        // THE OWNER'S OWN, WHICH THIS DID NOT SAY UNTIL CNCORE-116. `listSessions`
        // and `startSession` both read the single owner rather than trusting a
        // caller, and this one took an id alone -- so the two halves of one
        // surface disagreed about whose session it was. Nothing could exploit
        // that under ADR-0044, which makes exactly one owner row: the guard was
        // "only one owner exists" rather than anything in the code, and the
        // first thing multi-user does is drop the index that makes it true.
        // Found in review.
        eq(sessions.ownerId, await theOwnerId(db)),
        isNull(sessions.deletedAt),
      ),
    )
    .returning({ id: sessions.id });
  return ended.length > 0;
}

/**
 * Removes the sessions that can never answer again, and says how many went.
 *
 * ONE RULE: A ROW GOES WHEN IT IS PAST ITS LIFETIME, whatever happened to it on
 * the way. Thirty days after it was minted a session is refused by every
 * question this module answers -- ended, idle or simply old -- so the row holds
 * nothing but a fact about a device that stopped mattering a month ago.
 *
 * WHICH IS WHY IT IS NOT "DELETE EVERYTHING `seeSession` REFUSES". A tombstone
 * that vanished the moment `endSession` wrote it would cost the distinction that
 * function exists to keep -- "the owner logged this device out" against "this
 * device was never logged in" -- and cost it for every row rather than after a
 * month.
 *
 * A HARD DELETE, WHICH IS ADR-0075's TOMBSTONE COMPACTION rather than an
 * exception to it: the tombstone has already been written and has already
 * outlived the question it answers. Compaction is on ADR-0049's own list of what
 * the task registry is for.
 *
 * NOTHING'S SECURITY RESTS ON THIS RUNNING. `seeSession` refuses a lapsed
 * session whether or not it has been swept, so a sweep nobody has run is a table
 * that grew rather than a door left open. One owner logging in monthly leaves a
 * dozen rows a year.
 *
 * ITS RUNNER IS ADR-0049'S REGISTRY (CNCORE-119), and this stays a plain
 * function that takes a database. `sweep-sessions` in `@canoncore/tasks` is the
 * task that calls it, on a daily trigger, with a run history the owner reads --
 * so the sweep is scheduled without this package knowing anything about
 * schedules. It was uncalled until that registry existed rather than attached
 * to an event that happened to be nearby (a login, a page render, the
 * container's boot), because each of those is the hidden timer that record
 * refuses.
 */
export async function sweepSessions(db: Database): Promise<number> {
  const swept = await db
    .delete(sessions)
    .where(sql`${sessions.createdAt} <= ${nowLess(SESSION_LIFETIME_SECONDS)}`)
    .returning({ id: sessions.id });
  return swept.length;
}

type SessionRow = typeof sessions.$inferSelect;

/**
 * The row as a session, with the columns nothing outside this package should
 * read left behind -- `tokenHash` above all, which is the one thing a response
 * must never carry back out.
 */
function asSession(row: SessionRow): OwnerSession {
  return {
    id: row.id,
    ownerId: row.ownerId,
    lastSeenAt: row.lastSeenAt,
    ...(row.clientName === null ? {} : { clientName: row.clientName }),
    ...(row.deviceName === null ? {} : { deviceName: row.deviceName }),
    ...(row.deviceId === null ? {} : { deviceId: row.deviceId }),
    ...(row.clientVersion === null ? {} : { clientVersion: row.clientVersion }),
    ...(row.capabilities === null ? {} : { capabilities: row.capabilities }),
  };
}
