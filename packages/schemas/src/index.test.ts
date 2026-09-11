import { describe, expect, it } from "vitest";

import { healthCheckResult } from "./index";

describe("healthCheckResult", () => {
  it("accepts the value the health check returns", () => {
    expect(healthCheckResult.parse("OK")).toBe("OK");
  });

  it("rejects any other body", () => {
    // The contract is what the OpenAPI document publishes, so it has to be
    // narrow enough to be worth publishing.
    expect(() => healthCheckResult.parse("ok")).toThrow();
    expect(() => healthCheckResult.parse("")).toThrow();
    expect(() => healthCheckResult.parse(200)).toThrow();
    expect(() => healthCheckResult.parse(undefined)).toThrow();
  });
});
