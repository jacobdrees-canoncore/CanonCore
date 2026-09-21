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
const packageFile = fileURLToPath(new URL("../package.json", import.meta.url));
const installComposeFile = fileURLToPath(new URL("../../../compose.yaml", import.meta.url));

/**
 * The Compose project a file declares in its top-level `name:`, or `undefined`
 * when it declares none and Compose resolves the project from the DIRECTORY
 * instead (precedence: `-p`, `COMPOSE_PROJECT_NAME`, `name:`, the directory --
 * docs.docker.com, read 2026-09-21).
 *
 * Top-level means column zero. `container_name:` is a different key, a `name:`
 * indented under a volume names that volume, and a commented one names nothing.
 */
function declaredProjectName(compose: string): string | undefined {
  return /^name:[ \t]*["']?([^"'\s#]+)/m.exec(compose)?.[1];
}

/**
 * The top-level named volumes that declare no `name:` of their own, and are
 * therefore PREFIXED WITH THE PROJECT NAME -- so renaming the project points
 * the service at a different, empty volume.
 */
function volumesWithoutPinnedName(compose: string): string[] {
  const block = /^volumes:[ \t]*\n((?:[ \t]+[^\n]*\n?|\n)*)/m.exec(compose)?.[1];
  if (block === undefined) return [];

  const unpinned: string[] = [];
  for (const line of block.split("\n")) {
    const volume = /^[ \t]{1,2}([A-Za-z0-9._-]+):[ \t]*$/.exec(line)?.[1];
    if (volume !== undefined) unpinned.push(volume);
    else if (/^[ \t]{3,}name:/.test(line)) unpinned.pop();
  }
  return unpinned;
}

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

/**
 * The words after `docker compose` (or `docker-compose`) in every command of a
 * script that runs it, one array per command, so that a second command after
 * `&&` or `&` is judged on its own flags. Plain word splitting: a command
 * quoted inside `sh -c "..."` is not read.
 */
function composeCommands(script: string): string[][] {
  return script.split(/&&|\|\||[;&|\n]/).flatMap((command) => {
    const words = command.trim().split(/\s+/);
    const composeAt = words.findIndex(
      (word, i) => word === "docker-compose" || (word === "docker" && words[i + 1] === "compose"),
    );
    if (composeAt === -1) return [];
    return [words.slice(composeAt + (words[composeAt] === "docker" ? 2 : 1))];
  });
}

/** The `scripts` of `packages/db/package.json`, where `db:start` lives. */
async function packageScripts(): Promise<Record<string, string>> {
  const { scripts } = JSON.parse(await readFile(packageFile, "utf8")) as {
    scripts: Record<string, string>;
  };
  return scripts;
}

/**
 * The scripts that run a `docker compose up` able to RECREATE a container that
 * already exists: one without `--no-recreate`, or with `--force-recreate`.
 */
function composeUpsThatCanRecreate(scripts: Record<string, string>): string[] {
  return Object.entries(scripts)
    .filter(([, script]) =>
      composeCommands(script).some(
        (words) =>
          words.includes("up") &&
          (!words.includes("--no-recreate") || words.includes("--force-recreate")),
      ),
    )
    .map(([name]) => name);
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

describe("the development project and the Owner's install", () => {
  it("reads the project name a compose file declares, and only a top-level one", () => {
    // Fixtures rather than the real files, so the CHECK is tested and not just
    // exercised. Three things in these files are `name:` and are not the
    // project's: `container_name:`, a `name:` indented under a volume, and a
    // comment quoting one. This file carries all three.
    expect(declaredProjectName("name: canoncore-dev\n")).toBe("canoncore-dev");
    expect(declaredProjectName('name: "canoncore-dev"\n')).toBe("canoncore-dev");
    expect(declaredProjectName("services:\n  postgres:\n    container_name: canoncore\n")).toBe(
      undefined,
    );
    expect(declaredProjectName("volumes:\n  data:\n    name: canoncore_data\n")).toBe(undefined);
    expect(declaredProjectName("# the route written above `name: canoncore`\n")).toBe(undefined);

    // No `name:` at all is how the install resolves its project from the
    // DIRECTORY, which is the whole reason it can collide with this one.
    expect(declaredProjectName("services:\n  canoncore:\n    image: x\n")).toBe(undefined);
  });

  it("runs as a different Compose project from the install, so neither sees the other's containers", async () => {
    // TWO UNRELATED STACKS RAN AS ONE PROJECT `canoncore` UNTIL CNCORE-250, so
    // each one's ordinary `up` called the other's containers ORPHANS and
    // recommended `--remove-orphans` for them -- the flag that stops and
    // removes the Owner's running instance from here, and this container from
    // there. Measured 2026-09-20: all three carried
    // `com.docker.compose.project=canoncore` from two different directories.
    //
    // The install declares NO `name:` on purpose, so its project is its
    // DIRECTORY, and the README tells a stranger to make one called
    // `canoncore`. That is the name this file must therefore stay off.
    const install = declaredProjectName(await readFile(installComposeFile, "utf8")) ?? "canoncore";
    const development = declaredProjectName(await readFile(composeFile, "utf8"));

    expect(development, "docker-compose.yml declares no project name").toBeDefined();
    expect({ development, install }).not.toStrictEqual({ development: install, install });
  });

  it("recognises a named volume that the project name would move", () => {
    // Fixtures rather than the real file, so the check is tested and not just
    // exercised. A volume with no `name:` of its own is PREFIXED WITH THE
    // PROJECT, so renaming the project points the service at a different
    // volume; one with `name:` "is used as is and is not scoped with the stack
    // name" (docs.docker.com, compose-file/volumes.md, read 2026-09-21).
    expect(volumesWithoutPinnedName("volumes:\n  data:\n")).toStrictEqual(["data"]);
    expect(volumesWithoutPinnedName("volumes:\n  data:\n    name: pinned\n")).toStrictEqual([]);
    expect(volumesWithoutPinnedName("volumes:\n  a:\n    name: x\n  b:\n")).toStrictEqual(["b"]);

    // The block ends at the next column-zero key, so a `name:` belonging to
    // something after it does not count as this volume's.
    expect(volumesWithoutPinnedName("volumes:\n  data:\nname: a-project\n")).toStrictEqual([
      "data",
    ]);
    expect(volumesWithoutPinnedName("services:\n  db:\n    container_name: c\n")).toStrictEqual([]);
  });

  it("pins its volume by name, so the project can be renamed without moving the data", async () => {
    // THE RENAME ABOVE WOULD HAVE DESTROYED EVERY WORKTREE'S DATABASE WITHOUT
    // THIS. Measured 2026-09-21 with `docker compose config`, which resolves
    // volume names the way Compose does: under project `canoncore` this volume
    // read `canoncore_canoncore_postgres_data`, the one that exists and holds
    // every worktree's database; forced to `canoncore-dev` and unpinned it read
    // `canoncore-dev_canoncore_postgres_data`, which is a NEW and EMPTY volume.
    //
    // Pinning is what makes the project name carry no data. It is the same move
    // `compose.yaml` makes for the install's `canoncore_data` and for the same
    // reason, one collision earlier.
    expect(volumesWithoutPinnedName(await readFile(composeFile, "utf8"))).toStrictEqual([]);
  });
});

describe("the scripts every worktree runs against it", () => {
  it("recognises every `up` that can recreate a container", () => {
    // Fixtures rather than the real file, so the check is tested and not just
    // exercised. Global options may sit between `compose` and `up`, and a
    // second command after `&&` is judged on its own flags, not the first's.
    expect(
      composeUpsThatCanRecreate({
        plain: "docker compose up -d",
        attached: "docker compose up",
        forced: "docker compose up -d --force-recreate",
        global: "docker compose -f other.yml up -d",
        chained: "docker compose up -d --no-recreate && docker compose up -d",
        backgrounded: "docker compose up -d --no-recreate & docker compose up -d",
        hyphenated: "docker-compose up -d",
        guarded: "docker compose up -d --no-recreate",
        prefixed: "CANONCORE_DB_PORT=55432 docker compose up -d --no-recreate",
        stop: "docker compose stop",
        test: "vitest run",
      }),
    ).toStrictEqual([
      "plain",
      "attached",
      "forced",
      "global",
      "chained",
      "backgrounded",
      "hyphenated",
    ]);
  });

  it("starts the container without recreating the one every worktree is using", async () => {
    // A plain `up` recreates the container whenever this checkout's copy of the
    // file, or the image `postgres:18` names, differs from what created it
    // (CNCORE-233). `name: canoncore` makes that ONE container for every
    // worktree, so the last worktree to run `db:start` would win, and every
    // other worktree's run would die with it.
    const scripts = await packageScripts();

    const ups = Object.values(scripts)
      .flatMap(composeCommands)
      .filter((words) => words.includes("up"));

    expect(ups.length).toBeGreaterThan(0);
    expect(composeUpsThatCanRecreate(scripts)).toStrictEqual([]);
  });

});
