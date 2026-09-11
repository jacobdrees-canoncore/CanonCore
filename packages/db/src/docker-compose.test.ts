import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A test that reads a config file rather than a package export, for the same
 * reason `packages/ui` parses the stylesheet (ADR-0103): the value is written
 * where TypeScript cannot see it, and nothing else would catch it changing.
 *
 * Worth its keep because the defect it guards is SILENT. A local PostgreSQL
 * shadows the container on 5432 -- Docker binds the 0.0.0.0 wildcard, a local
 * server binds the more specific 127.0.0.1, and the specific bind wins for
 * `localhost`. Nothing errors: `docker compose up` reports success, the
 * container sits there healthy, and every connection goes somewhere else.
 * CNCORE-4 shipped an entire local test run against the wrong PostgreSQL that
 * way, and reported it as passing.
 */
const composeFile = fileURLToPath(new URL("../docker-compose.yml", import.meta.url));

/**
 * The host side of every port this compose file publishes to the container's
 * 5432 -- which is the only side that can collide with a local server.
 */
function hostPortsPublishedTo5432(compose: string): string[] {
  return [...compose.matchAll(/^[ \t]*-[ \t]*"?([^"\n]*?):5432"?[ \t]*$/gm)].flatMap(
    (m) => m[1] ?? [],
  );
}

/** 5432 anywhere in the host expression, including inside a `:-default`. */
function couldBind5432(hostPort: string): boolean {
  return /(^|\D)5432(\D|$)/.test(hostPort);
}

describe("the development database container", () => {
  it("recognises every way 5432 can come back", () => {
    // Fixtures rather than the real file, so the CHECK is tested and not just
    // exercised. The interpolated form is the one that matters: it is the
    // syntax the port actually lives in, and the first version of this test
    // passed it because it only looked at the end of the string.
    expect(hostPortsPublishedTo5432('    - "5432:5432"').map(couldBind5432)).toStrictEqual([true]);
    expect(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: docker-compose's own interpolation syntax, quoted on purpose.
      hostPortsPublishedTo5432('    - "${CANONCORE_DB_PORT:-5432}:5432"').map(couldBind5432),
    ).toStrictEqual([true]);
    expect(hostPortsPublishedTo5432("    - 5432:5432").map(couldBind5432)).toStrictEqual([true]);
    expect(
      hostPortsPublishedTo5432('    - "127.0.0.1:5432:5432"').map(couldBind5432),
    ).toStrictEqual([true]);

    expect(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: docker-compose's own interpolation syntax, quoted on purpose.
      hostPortsPublishedTo5432('    - "${CANONCORE_DB_PORT:-55432}:5432"').map(couldBind5432),
    ).toStrictEqual([false]);
    expect(hostPortsPublishedTo5432('    - "55432:5432"').map(couldBind5432)).toStrictEqual([
      false,
    ]);
  });

  it("does not publish on 5432, where a local PostgreSQL would shadow it", async () => {
    const published = hostPortsPublishedTo5432(await readFile(composeFile, "utf8"));

    expect(published.length).toBeGreaterThan(0);
    for (const hostPort of published) {
      expect({ hostPort, couldBind5432: couldBind5432(hostPort) }).toStrictEqual({
        hostPort,
        couldBind5432: false,
      });
    }
  });
});
