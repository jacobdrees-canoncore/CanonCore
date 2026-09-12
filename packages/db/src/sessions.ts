import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";

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
 * Whose session a token is, or `null` if it is nobody's.
 *
 * `null` COVERS EVERY WAY A TOKEN FAILS — never minted, guessed, logged out, or
 * ended — and that is deliberate: a caller that could tell them apart would be
 * an oracle for which tokens have ever existed.
 */
export async function sessionFor(db: Database, token: string): Promise<OwnerSession | null> {
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
    .where(and(eq(sessions.tokenHash, hashOf(token)), isNull(sessions.deletedAt)))
    .returning();
  return row ? asSession(row) : null;
}

/**
 * Logs one device out, and answers whether there was anything to log out.
 *
 * A TOMBSTONE RATHER THAN A DELETE (ADR-0075), which every other table here
 * takes and which this one has its own reason for: "the owner logged this device
 * out" and "this device was never logged in" are different facts, and a row
 * removed outright leaves an instance unable to tell them apart afterwards.
 * `sessionFor` reads live rows only, so the token stops answering either way.
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
    .where(and(eq(sessions.id, sessionId), isNull(sessions.deletedAt)))
    .returning({ id: sessions.id });
  return ended.length > 0;
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
