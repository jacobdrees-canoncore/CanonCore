import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("server env", () => {
  it("refuses to load without DATABASE_URL", async () => {
    delete process.env.DATABASE_URL;

    // next.config.ts imports this module, so throwing here is what turns a
    // missing variable into a failed build instead of a failed request.
    await expect(import("./server")).rejects.toThrow();
  });

  it("refuses an empty DATABASE_URL, rather than treating it as set", async () => {
    process.env.DATABASE_URL = "";

    await expect(import("./server")).rejects.toThrow();
  });

  it("loads when DATABASE_URL is present", async () => {
    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/canoncore";

    const { env } = await import("./server");
    expect(env.DATABASE_URL).toBe("postgresql://postgres:password@localhost:5432/canoncore");
  });
});
