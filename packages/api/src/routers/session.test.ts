import { getDb, sessions } from "@canoncore/db";
import { env } from "@canoncore/env/server";
import { call, ORPCError, safe } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createContext } from "../context";
import { aTokenForTheOwner } from "../testing/the-owner";
import { appRouter } from "./index";

/**
 * WHO MAY CALL WHAT, at ADR-0103's second seam -- the router in the same
 * process, which is where `provider.purge`, `provider.import` and
 * `provider.browse` are already asserted.
 *
 * THE SURFACE WAS WHOLLY OPEN UNTIL CNCORE-109. `packages/api` exported one
 * builder, `publicProcedure`, so every procedure was reachable by anyone who
 * could reach the process -- including the one that deletes a provider's
 * placements. ADR-0044 draws the line these tests assert: the read path is open
 * because the demo is read-only with no login, and everything that WRITES is the
 * owner's.
 */
const anyone = await createContext();

/** A provider identity. Nothing on the purge path makes a request. */
const baseUrl = "http://provider.example/";

async function refusalOf(promise: Promise<unknown>): Promise<string> {
  const { error } = await safe(promise);
  if (!(error instanceof ORPCError)) throw new Error(`expected a refusal, got ${String(error)}`);
  return error.code;
}

describe("a caller with no session", () => {
  it("is refused provider.purge", async () => {
    // THE ONE THIS TICKET WAS FILED OVER. A purge deletes everything one
    // provider ever said, and it was as reachable as a read.
    expect(await refusalOf(call(appRouter.provider.purge, { baseUrl }, { context: anyone }))).toBe(
      "UNAUTHORIZED",
    );
  });

  it("is refused provider.import", async () => {
    expect(
      await refusalOf(
        call(appRouter.provider.import, { baseUrl, recordId: "265" }, { context: anyone }),
      ),
    ).toBe("UNAUTHORIZED");
  });

  it("is refused provider.browse", async () => {
    expect(
      await refusalOf(
        call(appRouter.provider.browse, { baseUrl, containerId: "388305" }, { context: anyone }),
      ),
    ).toBe("UNAUTHORIZED");
  });
});

describe("the read path", () => {
  /**
   * ADR-0044's demo is read-only WITH NO LOGIN, so a visitor with no session
   * reading the catalogue is the surface working rather than a hole in it. These
   * are the reads a page makes: a guard that crept onto one of them would be
   * discovered as a blank demo.
   */
  it("answers a catalogue read with no session", async () => {
    await expect(call(appRouter.catalogue.list, {}, { context: anyone })).resolves.toBeDefined();
  });

  it("answers a search with no session", async () => {
    await expect(
      call(appRouter.catalogue.search, { query: "Dalek" }, { context: anyone }),
    ).resolves.toBeDefined();
  });

  it("answers healthCheck with no session", async () => {
    await expect(call(appRouter.healthCheck, {}, { context: anyone })).resolves.toBe("OK");
  });
});

describe("a purge preview, which is not a read", () => {
  /**
   * THE PAIR WHERE THE LINE IS EASIEST TO GET WRONG, and this branch got it
   * wrong first: `previewPurge` and `purge` take the same input, answer the same
   * shape and run the SAME TRAVERSAL (ADR-0046), which is the whole point of the
   * preview -- one rolls back. So a preview costs the work and the write locks of
   * a real delete, and "preview" naming it does not make it a read.
   *
   * LEFT OPEN IT WOULD BE THE ONE WRITE ANYONE COULD RUN, repeatedly, taking the
   * locks an import queues behind.
   */
  it("is refused without a session, exactly as the purge is", async () => {
    expect(
      await refusalOf(call(appRouter.provider.previewPurge, { baseUrl }, { context: anyone })),
    ).toBe("UNAUTHORIZED");
  });
});

/**
 * THE PASSWORD THIS SUITE'S INSTANCE IS CONFIGURED WITH, read from the
 * environment rather than written down again -- `vitest.config.ts` sets it, and
 * `aTokenForTheOwner` reads it the same way. A copy here would be a second place
 * to change, and the test that would then fail is the one asserting the door
 * opens.
 *
 * A GUARD OF ITS OWN, where a suite that only needs a session takes the
 * helper's. Logging in is what this suite asserts, so it hands `session.logIn`
 * the password itself, and a wrong one on purpose.
 *
 * EVERY USE OF IT SITS IN A CALLBACK WRITTEN AFTER THIS GUARD, which the type
 * checker decided: TypeScript does not carry the narrowing into a hoisted
 * declaration, which could run before the guard does.
 */
const OWNER_PASSWORD = env.OWNER_PASSWORD;
if (OWNER_PASSWORD === undefined) {
  throw new Error("this suite's vitest.config.ts sets OWNER_PASSWORD, and it is not set");
}

/**
 * One logged-in device: its token, the context a request from it carries, and
 * the id of the row behind both.
 *
 * THE ID COMES OFF THE CONTEXT rather than out of a query, because the context
 * is what the application itself reads -- `createContext` resolves the token to
 * the session, so a test that looked the row up another way could pass against a
 * context pointing somewhere else.
 */
const logInAs = async () => {
  const token = await aTokenForTheOwner();
  const context = await createContext({ sessionToken: token });
  if (context.session === null) throw new Error("the token this suite just minted was refused");
  return { token, context, sessionId: context.session.id };
};

describe("logging in", () => {
  it("says this instance has a password, without saying what it is", async () => {
    await expect(
      call(appRouter.session.configured, {}, { context: anyone }),
    ).resolves.toStrictEqual({ password: true });
  });

  it("mints a token that the write path then accepts", async () => {
    const { token } = await call(
      appRouter.session.logIn,
      { password: OWNER_PASSWORD },
      { context: anyone },
    );

    // THE WHOLE ROUND TRIP, and asserted through a procedure that WRITES rather
    // than by reading the session back. What a token is FOR is the door it
    // opens; one that reads back correctly and opens nothing would pass a
    // narrower test and leave the owner locked out of their own catalogue.
    await expect(
      call(
        appRouter.provider.purge,
        { baseUrl },
        { context: await createContext({ sessionToken: token }) },
      ),
    ).resolves.toBeDefined();
  });

  it("refuses the wrong password", async () => {
    expect(
      await refusalOf(
        call(appRouter.session.logIn, { password: "not the password" }, { context: anyone }),
      ),
    ).toBe("UNAUTHORIZED");
  });
});

describe("logging out", () => {
  it("stops the token it ended from writing anything else", async () => {
    const { token } = await call(
      appRouter.session.logIn,
      { password: OWNER_PASSWORD },
      { context: anyone },
    );
    const loggedIn = await createContext({ sessionToken: token });

    await call(appRouter.session.logOut, {}, { context: loggedIn });

    // A FRESH CONTEXT, because the door is the SESSION rather than the object
    // this process happens to be holding: the caller presents the same token
    // again, which is what a browser with a stale cookie does.
    expect(
      await refusalOf(
        call(
          appRouter.provider.purge,
          { baseUrl },
          { context: await createContext({ sessionToken: token }) },
        ),
      ),
    ).toBe("UNAUTHORIZED");
  });
});

describe("the demo, which is an instance that sets no password", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /**
   * ADR-0044's public demo is read-only WITH NO LOGIN, and this is how that is
   * built: not a mode, not a deployment flag, but `OWNER_PASSWORD` left unset.
   * Every read above still answers; nothing can get a session, so nothing can
   * write.
   *
   * IT RE-IMPORTS THE ROUTER RATHER THAN MOCKING THE ENVIRONMENT, because
   * `@canoncore/env/server` validates at module load -- which is the whole point
   * of it (a bad value stops the server starting rather than 500ing later) and
   * means an instance's configuration is fixed by the time a procedure runs. A
   * second evaluation with the variable removed is the same code reading a
   * different instance's settings, which is exactly what is under test.
   *
   * THE PASSWORD OFFERED IS THE RIGHT ONE, so this cannot pass by accident: if
   * the variable were still set, the login would succeed.
   */
  it("says it has no password, so a surface can say so rather than refuse forever", async () => {
    vi.stubEnv("OWNER_PASSWORD", undefined);
    vi.resetModules();
    const { session: demo } = await import("./session");

    await expect(call(demo.configured, {}, { context: anyone })).resolves.toStrictEqual({
      password: false,
    });
  });

  it("refuses to log anyone in, whatever they offer", async () => {
    vi.stubEnv("OWNER_PASSWORD", undefined);
    vi.resetModules();
    const { session: demo } = await import("./session");

    expect(
      await refusalOf(call(demo.logIn, { password: OWNER_PASSWORD }, { context: anyone })),
    ).toBe("UNAUTHORIZED");
  });
});

/**
 * WHAT BOUNDS THE GUESSING (ADR-0125, CNCORE-117).
 *
 * `logIn` is open by necessity, and until this it answered wrong passwords as
 * fast as the process could hash them -- measured at this very seam, 70,299 a
 * second in sequence and 102,206 a second at a concurrency of 100.
 *
 * EACH TEST TAKES A FRESH INSTANCE, because the allowance is one instance's
 * state and a test that spent it would be handing the next one an instance
 * mid-flood. It is the same re-import the demo above uses, for the same reason:
 * a module evaluated again is a different instance of this server.
 */
async function aFreshInstance() {
  vi.resetModules();
  return (await import("./session")).session;
}

describe("guessing at the owner's password", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("stops checking passwords once the allowance is spent", async () => {
    const instance = await aFreshInstance();

    // FORTY, which is Audiobookshelf's shipped figure restated as an allowance
    // (ADR-0125). Every one of them is looked at and refused on its merits.
    for (let n = 0; n < 40; n++) {
      expect(
        await refusalOf(call(instance.logIn, { password: `guess ${n}` }, { context: anyone })),
      ).toBe("UNAUTHORIZED");
    }

    // AND THE FORTY-FIRST IS NOT LOOKED AT. A different answer from a different
    // reason: "that password was refused" is a fact about the password, and this
    // one is a fact about how often this instance has been asked.
    expect(
      await refusalOf(call(instance.logIn, { password: "guess 40" }, { context: anyone })),
    ).toBe("TOO_MANY_REQUESTS");
  });

  it("gives the whole allowance back to a password that is right", async () => {
    const instance = await aFreshInstance();
    for (let n = 0; n < 39; n++) {
      await refusalOf(call(instance.logIn, { password: `guess ${n}` }, { context: anyone }));
    }

    await expect(
      call(instance.logIn, { password: OWNER_PASSWORD }, { context: anyone }),
    ).resolves.toBeDefined();

    // THE OWNER'S OWN USE DOES NOT SPEND THE GUESSING BUDGET, which is the half
    // of Audiobookshelf's limiter that does not survive one account: it counts
    // ATTEMPTS, success included, so an owner logging in repeatedly exhausts the
    // allowance they would need (ADR-0125). Forty more are looked at here, and
    // it is the forty-first that is not.
    for (let n = 0; n < 40; n++) {
      expect(
        await refusalOf(call(instance.logIn, { password: `after ${n}` }, { context: anyone })),
      ).toBe("UNAUTHORIZED");
    }
  });

  it("lets the owner back in by itself, with nobody lifting anything", async () => {
    // THE ACCEPTANCE CRITERION THIS TICKET TURNS ON. Jellyfin's lockout is
    // lifted by an administrator a single-owner instance has not got, and its
    // own documented remedy is two UPDATEs against `jellyfin.db` (ADR-0125).
    // Nothing here outlives the guessing.
    //
    // ONLY `Date` IS FAKED. The password check and the session insert are real,
    // and a suite that faked every timer would be faking the database driver's.
    vi.useFakeTimers({ toFake: ["Date"] });
    const instance = await aFreshInstance();
    for (let n = 0; n < 40; n++) {
      await refusalOf(call(instance.logIn, { password: `guess ${n}` }, { context: anyone }));
    }

    // SPENT, AND THE OWNER'S OWN PASSWORD IS TURNED AWAY TOO. That is what makes
    // this a bound rather than theatre: if the right password always got through
    // at once, every candidate would still cost exactly one test and a search
    // would not be slowed at all.
    expect(
      await refusalOf(call(instance.logIn, { password: OWNER_PASSWORD }, { context: anyone })),
    ).toBe("TOO_MANY_REQUESTS");

    vi.setSystemTime(Date.now() + 15_000);

    await expect(
      call(instance.logIn, { password: OWNER_PASSWORD }, { context: anyone }),
    ).resolves.toBeDefined();
  });

  it("tells the owner a password was refused, and cannot be made to flood the log", async () => {
    // THE ONLY SURFACE THIS EVENT HAS. All four products studied write a line
    // per refusal and three of them have nothing else (ADR-0125); this instance
    // has no owner dashboard to put a row on.
    const saidSo = vi.spyOn(console, "warn").mockImplementation(() => {});
    const instance = await aFreshInstance();

    for (let n = 0; n < 40; n++) {
      await refusalOf(call(instance.logIn, { password: `guess ${n}` }, { context: anyone }));
    }

    expect(saidSo).toHaveBeenCalledTimes(40);
    expect(String(saidSo.mock.calls[0]?.[0])).toContain("refused");

    // AND NOW THE FLOOD, every one of which is turned away unchecked. A line per
    // ARRIVING request would be a way to fill an owner's disk from the outside,
    // which is what Audiobookshelf's `[RateLimiter] Rate limit exceeded` line is:
    // the log is bounded here by the same allowance that bounds the guessing.
    for (let n = 0; n < 100; n++) {
      await refusalOf(call(instance.logIn, { password: `flood ${n}` }, { context: anyone }));
    }

    expect(saidSo).toHaveBeenCalledTimes(40);
  });

  it("cannot be raced: two hundred simultaneous guesses still spend forty checks", async () => {
    // WHAT A PER-REQUEST SLEEP WOULD FAIL. Nextcloud's `usleep` occupies one
    // worker for its delay, so an attacker holding C connections gets roughly C
    // guesses per period and the bound is per connection rather than aggregate
    // (ADR-0125). Measured at this seam before any of this landed, concurrency
    // took the procedure from 70,299 guesses a second to 102,206.
    //
    // THE CLOCK IS FROZEN so nothing is earned back mid-race, which makes the
    // two counts exact rather than nearly exact.
    vi.useFakeTimers({ toFake: ["Date"] });
    const instance = await aFreshInstance();

    const answers = await Promise.all(
      Array.from({ length: 200 }, (_, n) =>
        refusalOf(call(instance.logIn, { password: `race ${n}` }, { context: anyone })),
      ),
    );

    // EXACTLY THE ALLOWANCE, because the claim is taken before anything yields:
    // `isTheOwner` is synchronous, so testing the allowance and spending it
    // happen in one turn of the event loop and two guesses cannot interleave.
    expect(answers.filter((code) => code === "UNAUTHORIZED")).toHaveLength(40);
    expect(answers.filter((code) => code === "TOO_MANY_REQUESTS")).toHaveLength(160);
  });

  it("does not shut the owner out because the clock stepped backwards", async () => {
    // A WALL CLOCK RUNS BOTH WAYS. What is earned back is worked out from the
    // time since the last attempt, and an NTP correction makes that negative --
    // so an hour's step back would have SPENT four hours of allowance and shut
    // the owner out until it refilled. ADR-0043 already measured this clock
    // running backwards on this very machine, by 60ms, which is why it is a test
    // rather than a note.
    vi.useFakeTimers({ toFake: ["Date"] });
    const instance = await aFreshInstance();
    await refusalOf(call(instance.logIn, { password: "one guess" }, { context: anyone }));

    vi.setSystemTime(Date.now() - 60 * 60 * 1000);

    await expect(
      call(instance.logIn, { password: OWNER_PASSWORD }, { context: anyone }),
    ).resolves.toBeDefined();
  });
});

/**
 * ADR-0043's per-device logout, at the seam ADR-0103 names for the router.
 *
 * THE RECORD CALLS IT THE THING EVERYONE ACTUALLY WANTS, and it was unreachable
 * until CNCORE-116: `endSession` has taken a session id since CNCORE-109 --
 * deliberately, so that this would be a page rather than a change to the
 * mechanism -- and nothing could tell the owner what the ids were.
 */
describe("the devices the owner is logged in on", () => {
  it("is refused to a caller with no session", async () => {
    // IT IS NOT A READ, whatever it looks like. ADR-0044 leaves the CATALOGUE
    // open; who is logged in to an instance is the owner's own business, and a
    // list of devices answered to anybody is a list of what to go looking for.
    expect(await refusalOf(call(appRouter.session.list, {}, { context: anyone }))).toBe(
      "UNAUTHORIZED",
    );
  });

  it("marks the session the caller is using, and only that one", async () => {
    // THE WHOLE SAFETY OF THE SURFACE IS THIS FLAG. The one row the owner must
    // not press End on is the one drawing the page, and the page has no other
    // way to know which it is: every session on the list belongs to the same
    // owner and looks alike.
    const mine = await logInAs();
    const other = await logInAs();

    const listed = await call(appRouter.session.list, {}, { context: mine.context });

    expect(listed.filter(({ current }) => current).map(({ id }) => id)).toStrictEqual([
      mine.sessionId,
    ]);
    expect(listed.map(({ id }) => id)).toContain(other.sessionId);
  });
});

describe("ending another device's session", () => {
  it("ends the one it names and leaves the caller's own working", async () => {
    // THE OPERATION ADR-0043 EXISTS FOR. A token on the user row cannot do this
    // -- ending one device would end them all -- which is that record's whole
    // argument for a session ROW, and Audiobookshelf's 52 files and 3,168 lines
    // are what it cost to acquire one afterwards.
    const mine = await logInAs();
    const other = await logInAs();

    await call(appRouter.session.end, { id: other.sessionId }, { context: mine.context });

    // A FRESH CONTEXT FOR EACH, because what is under test is the SESSION rather
    // than the object this process is holding: both tokens are presented again,
    // which is what two browsers with cookies do.
    expect(
      await refusalOf(
        call(
          appRouter.provider.purge,
          { baseUrl },
          { context: await createContext({ sessionToken: other.token }) },
        ),
      ),
    ).toBe("UNAUTHORIZED");
    await expect(
      call(
        appRouter.provider.purge,
        { baseUrl },
        { context: await createContext({ sessionToken: mine.token }) },
      ),
    ).resolves.toBeDefined();
  });
});

describe("ending the session the caller is using, which is not this operation", () => {
  it("is refused, and the caller is still logged in afterwards", async () => {
    // TWO HALVES, AND THIS ONE ONLY HAS THE FIRST. Logging THIS browser out is
    // the row AND the cookie (`logOut`, and the action behind it); ending the row
    // alone would leave a browser holding a token that opens nothing, on a page
    // that still says it is logged in, with no button left to fix it.
    const mine = await logInAs();

    expect(
      await refusalOf(
        call(appRouter.session.end, { id: mine.sessionId }, { context: mine.context }),
      ),
    ).toBe("BAD_REQUEST");

    // AND IT WAS REFUSED BEFORE IT WROTE, which is the half that matters: a
    // guard that ended the row and then complained would have locked the owner
    // out while telling them it had not.
    await expect(
      call(
        appRouter.provider.purge,
        { baseUrl },
        { context: await createContext({ sessionToken: mine.token }) },
      ),
    ).resolves.toBeDefined();
  });
});

/**
 * CNCORE-116's first acceptance criterion, at the seam ADR-0103 names for the
 * router.
 *
 * IT PASSED THE MOMENT IT WAS WRITTEN, and that is worth saying rather than
 * hiding: the refusal is enforced in `seeSession`, which landed first, so this
 * file did not drive it. What it is here for is the JOIN -- `createContext`
 * resolves a token and `ownerProcedure` reads the result, and either could stop
 * consulting the clock without a single test in `packages/db` noticing.
 *
 * BACK-DATED ROWS RATHER THAN A FAKE CLOCK, for the reason `packages/db`'s own
 * suite gives: the clock this policy is measured against is Postgres's.
 */
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

describe("a session that has lapsed", () => {
  it("is refused the write path, exactly as no session at all is", async () => {
    const mine = await logInAs();
    await getDb()
      .update(sessions)
      .set({ createdAt: daysAgo(31) })
      .where(eq(sessions.id, mine.sessionId));

    expect(
      await refusalOf(
        call(
          appRouter.provider.purge,
          { baseUrl },
          { context: await createContext({ sessionToken: mine.token }) },
        ),
      ),
    ).toBe("UNAUTHORIZED");
  });

  it("is refused when the device has simply stopped being used", async () => {
    const mine = await logInAs();
    await getDb()
      .update(sessions)
      .set({ lastSeenAt: daysAgo(8) })
      .where(eq(sessions.id, mine.sessionId));

    expect(
      await refusalOf(
        call(
          appRouter.provider.purge,
          { baseUrl },
          { context: await createContext({ sessionToken: mine.token }) },
        ),
      ),
    ).toBe("UNAUTHORIZED");
  });

  it("is gone from the owner's device list as well as from the write path", async () => {
    // ONE QUESTION, ASKED IN TWO PLACES. A list that went on offering a session
    // the write path refuses would have the owner pressing End on something
    // already over while the device they meant to reach stayed logged in.
    const mine = await logInAs();
    const lapsed = await logInAs();
    await getDb()
      .update(sessions)
      .set({ lastSeenAt: daysAgo(8) })
      .where(eq(sessions.id, lapsed.sessionId));

    const listed = await call(appRouter.session.list, {}, { context: mine.context });

    expect(listed.map(({ id }) => id)).not.toContain(lapsed.sessionId);
  });
});
