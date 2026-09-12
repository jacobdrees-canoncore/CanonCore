import { ORPCError, call, safe } from "@orpc/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createContext } from "../context";
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

  /**
   * AND IT IS REFUSED BEFORE THE PROVIDER IS REACHED, which is what makes this a
   * closed door rather than a slow one. `http://provider.example/` is not on
   * this suite's allowlist (127.0.0.0/8), so a guard that ran after the handler
   * had begun would answer `PROVIDER_REFUSED` -- a refusal, passing the
   * assertions above if they only checked that something was thrown, and
   * reached by making this instance open a socket first.
   */
  it("is refused without the app reaching anything", async () => {
    expect(
      await refusalOf(
        call(appRouter.provider.import, { baseUrl, recordId: "265" }, { context: anyone }),
      ),
    ).not.toBe("PROVIDER_REFUSED");
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

  /**
   * A PURGE PREVIEW READS AND A PURGE WRITES, and the pair is where the line
   * between them is easiest to get wrong: the two take the same input, answer
   * the same shape, and run the same traversal (ADR-0046). One rolls back.
   */
  it("answers previewPurge with no session", async () => {
    await expect(
      call(appRouter.provider.previewPurge, { baseUrl }, { context: anyone }),
    ).resolves.toBeDefined();
  });
});

/**
 * THE PASSWORD THIS SUITE'S INSTANCE IS CONFIGURED WITH, set in
 * `vitest.config.ts` beside the allowlist. An instance that sets none is the
 * demo, and `the demo` below is where that half is asserted.
 */
const OWNER_PASSWORD = "the owner's own password";

describe("logging in", () => {
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
  it("refuses to log anyone in, whatever they offer", async () => {
    vi.stubEnv("OWNER_PASSWORD", undefined);
    vi.resetModules();
    const { session: demo } = await import("./session");

    expect(
      await refusalOf(call(demo.logIn, { password: OWNER_PASSWORD }, { context: anyone })),
    ).toBe("UNAUTHORIZED");
  });
});
