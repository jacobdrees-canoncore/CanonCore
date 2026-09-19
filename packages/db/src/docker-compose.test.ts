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

const bytesPerUnit = { k: 2 ** 10, m: 2 ** 20, g: 2 ** 30 };

/**
 * The `shm_size` this compose file declares, in bytes, or `undefined` when it
 * declares none and Docker's own 64 MB applies. Binary units, because Compose
 * parses a byte value with go-units' `RAMInBytes`; a unit outside the spec's
 * `b`, `k`, `kb`, `m`, `mb`, `g`, `gb` throws rather than being misread.
 */
function declaredShmSize(compose: string): number | undefined {
  const value = /^[ \t]*shm_size:[ \t]*["']?([^"'\s#]+)/m.exec(compose)?.[1];
  if (value === undefined) return undefined;

  const parsed = /^(\d+)(?:([kmg])b?|b)?$/i.exec(value);
  if (!parsed) throw new Error(`shm_size: cannot read ${JSON.stringify(value)}`);
  const unit = parsed[2]?.toLowerCase() as keyof typeof bytesPerUnit | undefined;
  return Number(parsed[1]) * (unit ? bytesPerUnit[unit] : 1);
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

  it("reads shm_size in the units the Compose spec names", () => {
    // The spec's own examples, in binary units: Compose parses a byte value
    // with go-units' RAMInBytes, so `1gb` is 2^30. Docker answered exactly that
    // for `1gb` on the running container, 2026-09-19.
    expect(declaredShmSize("    shm_size: 1gb")).toBe(1073741824);
    expect(declaredShmSize('    shm_size: "300m"')).toBe(314572800);
    expect(declaredShmSize("    shm_size: '2048k'")).toBe(2097152);
    expect(declaredShmSize("    shm_size: 1024kb")).toBe(1048576);
    expect(declaredShmSize("    shm_size: 2b")).toBe(2);
    expect(declaredShmSize("    shm_size: 268435456")).toBe(268435456);

    // Absent is Docker's own 64 MB, which is the value this guards against.
    // Compose accepts more than the spec names, `1tb` among them; this refuses
    // what it was not written to read rather than guessing at it.
    expect(declaredShmSize("    image: postgres:18")).toBeUndefined();
    expect(() => declaredShmSize("    shm_size: 1tb")).toThrow();
  });

  it("gives PostgreSQL more /dev/shm than Docker's 64 MB default", async () => {
    // Absent, the container gets Docker's 64 MB, which 1,090 databases of this
    // schema exhaust (CNCORE-228). The failure lands in whichever suite asks
    // next, as `could not resize shared memory segment`.
    const dockerDefault = 64 * 2 ** 20;
    const declared = declaredShmSize(await readFile(composeFile, "utf8"));

    expect(declared, "docker-compose.yml declares no shm_size").toBeDefined();
    expect(declared).toBeGreaterThan(dockerDefault);
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
