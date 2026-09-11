import { defineConfig } from "vitest/config";

/**
 * The FIFTH SEAM: a provider over HTTP, with the app absent (ADR-0103).
 *
 * `test:contract` rather than `test`, so `pnpm test` never needs a provider
 * running. This suite is meaningless without one and would otherwise turn every
 * local run into a docker prerequisite -- and a suite people skip is a suite that
 * rots. CI runs it as its own job, with both images as service containers.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    /**
     * THE GATE, ON THE ONE SUITE WHOSE WHOLE PURPOSE IS EGRESS -- which sounds
     * like a contradiction and is the reason it belongs here most.
     *
     * CNCORE-27 installed it because a test naming the wrong host reaches it,
     * succeeding on the one machine with network access and failing on a runner
     * nobody watches. This suite reaches providers ON PURPOSE, and its carve-out
     * is loopback, where both provider images run as service containers. So the
     * gate is not in its way; what it adds is that a participant pointed at a
     * PUBLIC origin stops being possible by accident. A remote CMPP provider under
     * test would be a deliberate change to this line, with a reason beside it,
     * rather than a URL somebody exported and nobody noticed.
     *
     * The providers' own upstream calls are the CONTAINERS' egress and not this
     * process's, so nothing here constrains `provider-tmdb` reaching TMDB.
     */
    setupFiles: ["@canoncore/config/testing/install-network-gate"],
    // Real sockets and, for the TMDB provider, a real third-party API behind it.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
