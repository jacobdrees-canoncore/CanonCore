import { beforeAll, describe, expect, it } from "vitest";

import { type Database, endSession, seeSession, startSession } from "./index";
import { connect, theOwner } from "./testing/catalogue";

let db: Database;
let ownerId: string;

beforeAll(async () => {
  db = await connect();
  ownerId = await theOwner(db);
});

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
    const { token, session } = await startSession(db, {});

    const seen = await seeSession(db, token);

    expect(seen?.lastSeenAt.getTime()).toBeGreaterThan(session.lastSeenAt.getTime());
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
