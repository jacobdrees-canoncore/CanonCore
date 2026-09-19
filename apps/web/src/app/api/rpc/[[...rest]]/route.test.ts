import { format } from "node:util";

import type { AppRouterClient } from "@canoncore/api/routers";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { ORPCError, os } from "@orpc/server";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

/**
 * ADR-0103 leaves the catch-all route uncovered, on the grounds that Next
 * documents no unit-testing path for route handlers. The handler is an ordinary
 * function of a Request, though, so it can be driven directly without booting
 * Next -- and it is the longest thing in the generated output to get right.
 */
async function callRoute(
  request: Request,
  handler = request.method === "GET" ? GET : POST,
): Promise<Response> {
  // NextRequest extends Request; the handler only reads url, method and body.
  const { NextRequest } = await import("next/server");
  return handler(new NextRequest(request));
}

/** The OpenAPI document, as the route serves it to a caller. */
function servedDocument(): Promise<Response> {
  return callRoute(new Request("http://localhost/api/rpc/api-reference/spec.json"));
}

const client: AppRouterClient = createORPCClient(
  new RPCLink({
    url: "http://localhost/api/rpc",
    fetch: (_url, init) => callRoute(new Request(_url, init)),
  }),
);

/**
 * The REAL route module, mounted on a router that does the one thing the app's
 * own procedures will not do to order: fail.
 *
 * A STAND-IN ROUTER RATHER THAN A STAND-IN LOG. What is under test is the
 * interceptor this file's other tests reach through the real router, so the
 * route module, both handlers and the interceptor are all the shipped ones --
 * only what they are mounted on is swapped, because a fault has to come from
 * somewhere and no procedure on this surface can be asked for one. Driving a
 * real database into failure would need the database this suite deliberately
 * does without.
 */
async function callRouteMountedOn(faulting: () => never): Promise<Response> {
  vi.resetModules();
  vi.doMock("@canoncore/api/routers", () => ({ appRouter: { boom: os.handler(faulting) } }));
  try {
    const { POST } = await import("./route");
    return await callRoute(
      new Request("http://localhost/api/rpc/boom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"json":{}}',
      }),
      POST,
    );
  } finally {
    vi.doUnmock("@canoncore/api/routers");
    vi.resetModules();
  }
}

describe("the catch-all oRPC route", () => {
  it("answers healthCheck over the RPC protocol", async () => {
    await expect(client.healthCheck()).resolves.toBe("OK");
  });

  it("serves an OpenAPI document naming healthCheck", async () => {
    const response = await servedDocument();
    expect(response.status).toBe(200);
    const spec = (await response.json()) as { paths?: Record<string, unknown> };
    expect(Object.keys(spec.paths ?? {})).toContain("/healthCheck");
  });

  /**
   * THE DOCUMENT STATES THE BOUNDS THE OUTPUT SCHEMA IS HELD TO (CNCORE-212).
   * `failureReason.text` and a Provider's declared name are both capped at 300
   * in the contract (ADR-0123), and the document a caller reads said
   * `{"type":"string"}` for each: the converter read a place zod 4.6 had stopped
   * writing, so every length and format in the API was dropped from it.
   *
   * ASSERTED ON THE SERVED DOCUMENT rather than on the converter, because the
   * converter is the part that was wrong while its own input was right.
   */
  it("states the ceiling on a failure reason and a Provider's name, and that its address is a URL", async () => {
    const spec: unknown = await (await servedDocument()).json();
    const searchAnswerPath = [
      "paths",
      "/provider/search",
      "post",
      "responses",
      "200",
      "content",
      "application/json",
      "schema",
      "properties",
    ];
    const reasonPath = [
      ...searchAnswerPath,
      "failed",
      "items",
      "properties",
      "reason",
      "properties",
    ];
    const providerPath = [
      ...searchAnswerPath,
      "answered",
      "items",
      "properties",
      "provider",
      "properties",
    ];

    expect(spec).toHaveProperty([...reasonPath, "text", "maxLength"], 300);
    expect(spec).toHaveProperty([...providerPath, "name", "maxLength"], 300);
    expect(spec).toHaveProperty([...providerPath, "baseUrl", "format"], "uri");
  });
});

describe("what the mount writes to the owner's log", () => {
  /**
   * EVERY LEVEL, NOT JUST `error`. ADR-0125's claim is that a quieter line was
   * never the answer -- anything written once per ARRIVING request is unbounded
   * whatever it is called -- so a spy watching `console.error` alone would pass
   * a change that moved the line to `console.warn` and left the claim false.
   * Each level is captured separately, because `login-bound.ts` writes its own
   * BOUNDED line at `warn` and the whole point is telling the two apart.
   */
  const written: Record<"error" | "warn" | "info" | "log" | "debug", unknown[][]> = {
    error: [],
    warn: [],
    info: [],
    log: [],
    debug: [],
  };
  beforeEach(() => {
    for (const level of Object.keys(written) as (keyof typeof written)[]) {
      written[level] = [];
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        written[level].push(args);
      });
    }
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Everything the mount wrote, at any level, in one list. */
  const everythingWritten = (): unknown[][] => Object.values(written).flat();

  /**
   * THE LINES THAT WOULD REACH THE LOG, which is the only thing CNCORE-122 is
   * about. A spy captures the ARGUMENTS; what an owner reads is what `console`
   * renders from them, and the two differ exactly where this ticket lives -- an
   * `Error` argument is rendered as its stack, message and all. `util.format`
   * is the renderer `console` itself uses, so asserting on its output is
   * asserting on the file.
   */
  const linesWritten = (): string[] =>
    everythingWritten().flatMap((args) => format(...args).split("\n"));

  /** Flush to the left margin, which is where an entry -- and only an entry -- begins. */
  const atTheMargin = (line: string): boolean => /^\S/.test(line);

  /**
   * ADR-0125: a line per ARRIVING request is a way to fill an owner's disk from
   * the outside. `UNAUTHORIZED` is what `ownerProcedure` answers anyone with no
   * session (CNCORE-109), so this is a refusal a stranger can ask for as fast as
   * the process serves.
   */
  it("says nothing when a caller with no session is refused, however often they ask", async () => {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      await expect(
        client.item.create({ kind: "work", title: "A title nobody is allowed to write" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }

    expect(everythingWritten()).toEqual([]);
  });

  /**
   * THE SECOND REFUSAL ADR-0125 NAMES, and the one that shows what the record
   * actually claims: the mount says nothing, and the line an owner DOES get is
   * the one written where the refusal was COUNTED.
   *
   * SO THE ASSERTION IS A RATIO RATHER THAN A COUNT. Every attempt here arrives;
   * only the ones with allowance left are CHECKED, and only a checked refusal
   * writes. Asserting "one line per checked refusal, and fewer lines than
   * arrivals" is the bound itself, and it does not depend on how many attempts
   * the allowance happens to cover on the machine running it.
   */
  it("says nothing when the login bound holds, and leaves that line to the bound", async () => {
    const answers: string[] = [];
    for (let attempt = 0; attempt < 41; attempt += 1) {
      const refusal = await client.session
        .logIn({ password: "not the owner's password" })
        .then(() => "let in")
        .catch((error: unknown) => (error instanceof ORPCError ? error.code : "something else"));
      answers.push(refusal);
    }

    // The bound held: arriving attempts outran checked ones.
    expect(answers).toContain("TOO_MANY_REQUESTS");
    expect(written.error).toEqual([]);
    // One line per CHECKED refusal, and nothing for the attempts turned away.
    expect(written.warn).toHaveLength(answers.filter((code) => code === "UNAUTHORIZED").length);
    expect(written.warn.length).toBeLessThan(answers.length);
  });

  /**
   * THE OTHER HALF, AND WHAT THE INTERCEPTOR IS ACTUALLY FOR. A fault is a fact
   * about this server rather than about what was asked of it, so it is written
   * whole -- and the stack is the part an owner cannot reconstruct from the
   * response, which says only "Internal server error".
   */
  it("logs a thrown error in full, with its stack", async () => {
    const thrown = new Error("the connection pool is dead");

    const response = await callRouteMountedOn(() => {
      throw thrown;
    });

    expect(response.status).toBe(500);
    const [said, ...rest] = linesWritten();
    expect(said).toContain(thrown.message);
    /*
     * THE FRAMES, ON THEIR OWN LINES AND NAMING WHERE IT WAS THROWN. Asserted by
     * what an owner would look for rather than by slicing `thrown.stack` the way
     * the mount does -- that would recompute the answer and agree with any
     * implementation, including one that wrote no frames at all.
     */
    const frames = rest.filter((line) => line.trimStart().startsWith("at "));
    expect(frames.join("\n")).toContain("route.test.ts");
  });

  /**
   * THE LINE THE CALLER TRIED TO WRITE, and it is the one this instance really
   * does write: `login-bound.ts` says exactly this when a password is refused
   * with allowance left (ADR-0125). A fault message carrying it is the whole of
   * CNCORE-122 -- an owner grepping their log for refused logins, or the
   * fail2ban-style tooling ADR-0125 names as the reason the log is the surface,
   * reads a line the caller composed as one this process wrote.
   */
  const forged = "canoncore: a login was refused; 39 more will be checked before the bound holds";

  it("does not let a fault's message forge a line of its own", async () => {
    const response = await callRouteMountedOn(() => {
      throw new Error(`the connection pool is dead\n${forged}`);
    });

    expect(response.status).toBe(500);
    expect(linesWritten()).not.toContain(forged);
  });

  /**
   * A CAUSE IS CALLER TEXT TOO, which the first cut of this missed. `inspect`
   * renders a nested `Error` as its RAW stack, so a cause's message kept its
   * real newlines and only indentation stood between a caller and a forged
   * FRAME -- printed at the same depth as the cause's genuine frames, which is
   * the depth an owner chasing a fault would read and go looking for.
   *
   * It is the live path, not a contrived one: a driver fault wraps the pg error
   * as its cause, and oRPC puts the offending value under one.
   */
  it("does not let a fault's cause forge a frame", async () => {
    const response = await callRouteMountedOn(() => {
      throw new Error("the connection pool is dead", {
        cause: new Error("invalid input syntax\n    at notARealFrame (/app/forged.ts:1:1)"),
      });
    });

    expect(response.status).toBe(500);
    expect(linesWritten().map((line) => line.trim())).not.toContain(
      "at notARealFrame (/app/forged.ts:1:1)",
    );
  });

  /**
   * AND FOLLOWING A CAUSE IS RECURSIVE, so the bound on it is load-bearing: a
   * chain is somebody else's length, and a cycle in one would recurse until the
   * process died -- inside the handler that exists to REPORT a fault, which is
   * the worst place to put a crash.
   */
  it("survives a cause that points back at its own error", async () => {
    const response = await callRouteMountedOn(() => {
      const first = new Error("the connection pool is dead");
      const second = new Error("and the retry failed", { cause: first });
      (first as Error & { cause?: unknown }).cause = second;
      throw first;
    });

    expect(response.status).toBe(500);
    expect(linesWritten().join("\n")).toContain("longer than one entry");
    expect(linesWritten().slice(1).filter(atTheMargin)).toEqual([]);
  });

  /**
   * THE FAULT THIS ACTUALLY HAPPENS TO, and the reason the rule is an INVARIANT
   * rather than "escape the message". A `DrizzleQueryError`'s message is TWO
   * LINES BEFORE ANYBODY ATTACKS IT -- `Failed query: <sql>` then
   * `params: <params>` -- and `params` is what the caller sent, so the driver
   * interpolates caller text into a message that already carries a newline.
   * That is the ticket's "an uncaught driver error quotes the parameters it was
   * given", and it reaches the log through the pg error it wraps as well.
   *
   * SO THE ASSERTION IS THE BOUNDARY ITSELF: an entry begins at column 0 and
   * everything below it is indented. That is the rule an owner reads by and the
   * one a fail2ban-style pattern is written against, it holds whatever a message
   * carries, and it does not depend on this driver's phrasing staying put.
   */
  it("keeps a driver fault's parameters off a line of their own", async () => {
    const response = await callRouteMountedOn(() => {
      throw new DrizzleQueryError(
        "insert into item (title) values ($1)",
        [`a title\n${forged}`],
        new Error(`invalid input syntax for type uuid: "x"\n${forged}`),
      );
    });

    expect(response.status).toBe(500);
    expect(linesWritten()).not.toContain(forged);
    expect(linesWritten().slice(1).filter(atTheMargin)).toEqual([]);
  });

  /**
   * AND WHAT IT DOES WHEN IT CANNOT TELL WHERE THE CALLER'S TEXT ENDS. The mount
   * finds the message by the span V8 pastes atop `stack`, so an error arriving
   * without one -- reassigned, or never captured -- offers nothing to measure
   * against. The safe answer is no frames rather than a guess at which lines
   * came from V8, because guessing wrong is the hole itself: a message can carry
   * a line that reads exactly like a frame.
   */
  it("writes no frames, and still no forged line, when a fault carries no stack", async () => {
    const response = await callRouteMountedOn(() => {
      const thrown = new Error(`the connection pool is dead\n    at somewhereEvil (${forged})`);
      thrown.stack = undefined;
      throw thrown;
    });

    expect(response.status).toBe(500);
    // Quoted inside the message is exactly where it should be; on a line is not.
    expect(linesWritten()).not.toContain(forged);
    expect(linesWritten().filter((line) => line.trimStart().startsWith("at "))).toEqual([]);
  });

  /**
   * AND BEING AN `ORPCError` IS NOT WHAT MAKES SOMETHING AN ANSWER -- the status
   * is. oRPC raises this one itself when a handler answers something its
   * `.output()` does not allow, which is a bug in this app rather than a thing
   * any caller asked for.
   */
  it("logs a fault that arrives as an ORPCError at 500", async () => {
    const thrown = new ORPCError("INTERNAL_SERVER_ERROR");

    const response = await callRouteMountedOn(() => {
      throw thrown;
    });

    expect(response.status).toBe(500);
    /*
     * AND STILL SAYS WHICH FAULT IT WAS. `console.error(error)` wrote the code
     * and the status alongside the stack, and an `ORPCError`'s message is a
     * generic phrase -- "Internal Server Error" -- so the code is the part that
     * tells an output-validation failure apart from a handler that threw.
     * Escaping the message is this ticket; writing less than before is not.
     */
    expect(linesWritten().join("\n")).toContain(thrown.code);
  });
});
