import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { repoRoot } from "./testing/repo-root";

/**
 * A test that reads every Vitest config in the repository, for the same reason
 * `ci-workflow.test.ts` reads `.github/workflows/ci.yml`: the gate is only a
 * control where a suite installs it, and nothing else would notice a suite
 * quietly dropping it.
 *
 * The gate's own test proves it FIRES. It proves that in ONE suite -- the one
 * it happens to live in -- and would go on passing with the other ten open.
 * This is the half that makes "unexpected egress from a test throws" a claim
 * about the repository rather than about `packages/config`.
 */

/** Exactly what a suite must list, and the reason it is a bare specifier. */
const GATE = "@canoncore/config/testing/install-network-gate";

/**
 * And what a suite with a `globalSetup` must list FIRST, which is a second
 * module for a reason rather than by accident: the one above registers a
 * `beforeEach`, and `vitest`'s hooks reach for worker state that the main
 * process does not have.
 */
const GATE_IN_GLOBAL_SETUP = "@canoncore/config/testing/gate-global-setup";

type Manifest = { name?: string; scripts?: Record<string, string> };

// Only the `<name>/*` shape this repo uses. A pattern of any other shape is not
// quietly ignored -- it would take packages out of the sweep below, which is the
// one failure this test cannot afford. Checked as a WHOLE rather than by its
// second segment: `apps/*/nested` has `*` there too and sweeps somewhere other
// than where the pattern says.
//
// A first segment of ONLY dots is refused ahead of the rest, because `[\w.-]+`
// matches `..` and `.` -- so `../*` swept the repository's parent and `./*` its
// root, the two places a sweep most obviously should not go, while the sentence
// above claimed the whole-shape check caught them (CNCORE-46).
function isWorkspacePattern(pattern: string): boolean {
  const [parent, ...rest] = pattern.split("/");
  return rest.length === 1 && rest[0] === "*" && /^(?!\.+$)[\w.-]+$/.test(parent as string);
}

/** Every directory `pnpm-workspace.yaml` calls a package, read from the file. */
function workspaceDirectories(): string[] {
  const { packages } = parse(readFileSync(join(repoRoot, "pnpm-workspace.yaml"), "utf8")) as {
    packages?: string[];
  };
  return (packages ?? []).flatMap((pattern) => {
    expect(isWorkspacePattern(pattern), `unsupported workspace pattern ${pattern}`).toBe(true);
    const [parent] = pattern.split("/");
    return readdirSync(join(repoRoot, parent as string), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(parent as string, entry.name));
  });
}

// A script that RUNS a suite rather than watching one, in either spelling Vitest
// documents for it. The sweep is named after the COMMAND rather than after a
// list of script names, because a list is what left `packages/contract`'s
// `test:contract` outside it with nobody deciding that it should be (CNCORE-46).
//
// BARE `vitest` IS NEITHER, and not because of what it is called: `watch`
// defaults to `!process.env.CI && process.stdin.isTTY`, so it watches on a
// laptop and runs once in CI. A command whose meaning depends on where it runs
// is the one thing a suite's command must not be.
function runsASuite(command: string): boolean {
  return /^vitest run\b/.test(command) || /^vitest\b.*\s--run\b/.test(command);
}

// And WHICH config that command runs, in every spelling Vitest accepts, or
// `undefined` where it names none and Vitest falls back to the package's own
// `vitest.config.ts`.
//
// FOUR SPELLINGS, NOT THE ONE THIS READ FIRST. Vitest documents the option as
// `-c, --config <path>` (`docs/guide/cli-generated.md`, read 2026-09-11), and
// its parser takes `=` for the short flag as well as the long one. Measured
// against this repo's vitest 5.0.0, all four carry the path to the config
// loader: `--config nope.ts`, `--config=nope.ts`, `-c nope.ts`, `-c=nope.ts`.
// Only the first was read here, so a script written any other way read as
// naming NO config -- the sweep then claimed the package's default
// `vitest.config.ts` and asserted against the wrong file, and where the
// mis-spelled config WAS that default, asserted twice about one file and never
// noticed (CNCORE-51).
//
// THE FLAG MUST START A WORD AND END AT `=` OR A SPACE, and the two halves hold
// out different things, which is worth saying because the rows below pinned only
// one of them until review asked which half did the work.
//
// ENDING AT `=` OR A SPACE is what keeps `--configLoader` -- a real Vitest flag
// (`'bundle' | 'runner' | 'native'`) naming no path -- and the `-c` inside
// `--coverage` out. A rule looking for either flag anywhere reads those as the
// configs `Loader` and `overage`.
//
// STARTING A WORD is what keeps out a flag's VALUE that ends in `-c`, which
// nothing about the separator catches: `--project app-c src/foo.test.ts` reads
// without it as naming the config `src/foo.test.ts`. All of them are rows below.
//
// AND ONLY THE FIRST COMMAND IS VITEST'S, which is the half widening to `-c`
// made necessary: `-c` is another program's flag far more often than `--config`
// is, so `vitest run && playwright test -c playwright.config.ts` read the
// PLAYWRIGHT config as the one this suite runs. Rows below for `&&` and `;`.
//
// A path is taken to the first space, so a QUOTED one with a space in it comes
// back with its quotes attached and resolves to a file that is not there. No
// config in this repo is named that way. Which assertion it fails depends on
// the name: `is installed by every suite` for the suite now pointed at nothing,
// and `sweeps every Vitest config` as well when the real config is one of the
// `vitest.*.config.ts` files that sweep reads off the disk.
//
// WHAT IS TRUSTED HERE, since the value travels: this is a script string out of
// a workspace `package.json`, and `testConfig` below IMPORTS what it resolves
// to, which is execution rather than a read. `isInside` is asserted on the way
// and constrains the DIRECTORY, not the filename, so a script naming any file
// inside its own package has that file imported. That is the same trust the
// repo already extends to these manifests -- CI runs their scripts -- and the
// import is ADR-0103's deliberate choice, since a commented-out gate still
// reads as present to a text search.
function namedConfig(command: string): string | undefined {
  const [vitests] = command.split(/[;&|]/);
  return (vitests as string).match(/(?:^|\s)(?:--config|-c)(?:=|\s+)(\S+)/)?.[1];
}

// And a script whose NAME says it is a suite, which is the half the rule above
// cannot do: `"test": "jest"` would simply not match it, and would drop out of
// the sweep in silence. Whether that name is the one this repo would reach for
// is not the question -- what it must not do is leave without being noticed.
function isTestScriptName(name: string): boolean {
  return /^test(:|$)/.test(name);
}

// The one exception to that, and it is ADR-0103's rather than this file's:
// Turborepo's Vitest shape gives every package a `test:watch`, uncached and
// persistent, which is the only script here MEANT to run Vitest without running
// it once. It is out of the sweep because it runs the config its `run` twin
// already puts under assertion.
function isWatchScriptName(name: string): boolean {
  return /:watch$/.test(name);
}

// And whether a resolved config is a file the package actually owns. `--config`
// is a path and a path can climb: `--config ../../elsewhere.ts` would put every
// assertion in this file on a config the package does not own, and ADR-0103
// refuses a shared base config precisely so that no package here has one. The
// same rule as `isWorkspacePattern`, at the other end of the same sweep.
function isInside(directory: string, file: string): boolean {
  const from = relative(directory, file);
  return from !== "" && !from.startsWith("..");
}

/** One suite: a package, one of its test scripts, and the config that runs it. */
type Suite = { package: string; script: string; config: string };

function suites(): Suite[] {
  return workspaceDirectories().flatMap((directory) => {
    const manifest = join(repoRoot, directory, "package.json");
    // A directory under `apps/` or `packages/` with no manifest is NOT A
    // PACKAGE, which is how pnpm reads it too. Skipped rather than read, or a
    // stray directory takes the whole sweep down with an ENOENT that says
    // nothing about the gate.
    if (!existsSync(manifest)) return [];
    const parsed = JSON.parse(readFileSync(manifest, "utf8")) as Manifest;
    return Object.entries(parsed.scripts ?? {}).flatMap(([name, command]) => {
      // Asserted, not assumed, and it is the half the filter below cannot do:
      // `"test": "jest"` and `"test": "vitest"` alike match no command that runs
      // a suite, so they do not FAIL that filter -- they fall out of it, and the
      // package leaves the sweep without anybody deciding that it should. Two
      // assertions rather than one, because a watch script is held to the first
      // and is the one script here exempt from the second.
      if (isTestScriptName(name)) {
        expect(/^vitest\b/.test(command), `${directory} runs ${name} as \`${command}\``).toBe(true);
        if (!isWatchScriptName(name)) {
          expect(
            runsASuite(command),
            `${directory} runs ${name} without running a suite: \`${command}\``,
          ).toBe(true);
        }
      }
      if (!runsASuite(command)) return [];
      const namedPath = namedConfig(command);
      const config = join(repoRoot, directory, namedPath ?? "vitest.config.ts");
      expect(
        isInside(join(repoRoot, directory), config),
        `${directory} runs ${name} against a config outside the package: ${namedPath}`,
      ).toBe(true);
      return [{ package: parsed.name ?? directory, script: name, config }];
    });
  });
}

/**
 * Every Vitest config FILE under the directories the workspace names, found by
 * reading the disk rather than by asking the manifests. That is the whole point
 * of it: the sweep above learns what exists from `scripts`, so it cannot be the
 * thing that notices a config no script it recognises runs.
 */
//
// WHAT IT LOOKS AT IS ONE LEVEL AND ONE FILENAME SHAPE: `vitest.*.config.ts`
// directly inside a package, which is every config this repo has. A `.mts` one,
// a `test` block in a `vite.config.ts`, or one nested deeper is not seen, and
// the assertion below is worth only what this sentence says.
function configFilesOnDisk(): string[] {
  return workspaceDirectories().flatMap((directory) =>
    readdirSync(join(repoRoot, directory), { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^vitest\..*config\.ts$/.test(entry.name))
      .map((entry) => join(repoRoot, directory, entry.name)),
  );
}

/**
 * A config's `test` block as it actually resolves, read by IMPORTING the config
 * rather than by matching specifiers in its text. A commented-out line still
 * reads as present to a text search, and that is the exact state this test
 * exists to catch. Both things asked below -- `setupFiles` and `globalSetup` --
 * come off this one object.
 *
 * A config that is not there resolves to none, which is what a package with no
 * Vitest config of its own has. Absence is reported by the caller as a suite
 * standing open, never as a crash -- it is the ordinary way to be ungated.
 */
async function testConfig(suite: Suite): Promise<{
  setupFiles?: string | string[];
  globalSetup?: string | string[];
}> {
  if (!existsSync(suite.config)) return {};
  const loaded = (await import(pathToFileURL(suite.config).href)) as {
    default?: { test?: { setupFiles?: string | string[]; globalSetup?: string | string[] } };
  };
  return loaded.default?.test ?? {};
}

function asList(declared: string | string[] | undefined): string[] {
  if (declared === undefined) return [];
  return typeof declared === "string" ? [declared] : declared;
}

/**
 * THE ONE SUITE THAT MUST REACH THE REAL INTERNET, NAMED HERE SO IT IS AN EXCEPTION
 * RATHER THAN A HOLE (CNCORE-103).
 *
 * `apps/web`'s `test:live` stands CanonCore up against the REAL `provider-wiki` talking to
 * the REAL tardis.wiki, which is the only way the live import path gets proven at all: the
 * e2e suite's provider is a stub, and CI's real-provider job never reached one
 * (CNCORE-143). A gate over it would refuse the single request the suite exists to make.
 *
 * IT IS A LIST OF ONE AND IT IS CHECKED, which is the difference between an exception and a
 * hole. The test below asserts that every excused suite still EXISTS, so deleting or
 * renaming `test:live` fails here rather than leaving a permanent excuse for a suite nobody
 * runs -- and any OTHER suite dropping the gate still fails, because it is not on this list.
 *
 * IT CANNOT RUN IN CI ANYWAY. `test:live` needs the Owner's Credential (ADR-0122), so it is
 * not in `test:e2e` and no CI job invokes it; the gate is protecting CI from an accident
 * this suite cannot have there.
 */
const MAY_REACH_THE_INTERNET = ["web: test:live"];

describe("the network gate's wiring", () => {
  /**
   * WHAT MAKES THE TWO ASSERTIONS BELOW REACH THE REPOSITORY, and CNCORE-46's
   * first half. They ask about every suite the sweep finds, and a suite the
   * sweep does not find is not a suite they report as ungated -- it is one they
   * never mention. `packages/contract` was in exactly that position: its
   * `test:contract` was outside a filter that listed `test` and `test:e2e` by
   * name, so the one suite whose whole purpose is outbound HTTP sat outside
   * both, and nothing would have noticed it dropping the gate.
   *
   * A config is the unit because a config is what holds the gate. So the claim
   * is that no Vitest config in this repository goes unrun by a swept script,
   * which fails for the NEXT suite to leave the sweep as well as for that one.
   */
  it("sweeps every Vitest config in the repository", () => {
    const onDisk = configFilesOnDisk();

    // Vacuous otherwise, in the same way the counts below are: an empty disk
    // read is claimed by the empty set. Twelve configs today: one in each of the
    // nine packages, and three in `apps/web` -- its own, the end-to-end run's,
    // and the live run's (CNCORE-151).
    expect(onDisk.length).toBeGreaterThanOrEqual(12);

    const claimed = new Set(suites().map((suite) => suite.config));
    const unrun = onDisk.filter((file) => !claimed.has(file));
    expect(unrun.map((file) => relative(repoRoot, file))).toStrictEqual([]);
  });

  it("is installed by every suite in the repository", async () => {
    const found = suites();

    // Without this the whole test is vacuous: a workspace file that failed to
    // parse into packages produces an empty list and passes having asked
    // nothing. Twelve suites today: nine `test` scripts, `apps/web`'s end-to-end
    // run, `packages/contract`'s contract run -- which joined the sweep under
    // CNCORE-46 -- and `apps/web`'s live run, which `MAY_REACH_THE_INTERNET`
    // excuses and the test below holds to existing.
    expect(found.length).toBeGreaterThanOrEqual(12);

    const open = [];
    for (const suite of found) {
      const name = `${suite.package}: ${suite.script}`;
      if (MAY_REACH_THE_INTERNET.includes(name)) continue;
      const declared = asList((await testConfig(suite)).setupFiles);
      if (!declared.includes(GATE)) open.push(name);
    }
    expect(open).toStrictEqual([]);
  });

  /**
   * THE EXCUSE LIST IS ITSELF SWEPT, which is what stops it rotting into a hole. An entry
   * naming a suite that no longer exists is an excuse nothing is using and nobody would
   * notice -- and the next suite to take that name would inherit it silently.
   */
  it("excuses only suites that exist", () => {
    const names = suites().map((suite) => `${suite.package}: ${suite.script}`);
    const stale = MAY_REACH_THE_INTERNET.filter((excused) => !names.includes(excused));
    expect(stale).toStrictEqual([]);
  });

  /**
   * THE SECOND OF THE THREE PLACES THE GATE COULD NOT SEE (CNCORE-30). Vitest
   * runs setup files in each test WORKER and a global setup in the MAIN
   * process, so the `setupFiles` the test above checks do not reach a global
   * setup at all -- and a global setup is where this repository builds
   * databases, spawns servers and probes them.
   */
  it("is installed FIRST by every swept suite that has a global setup", async () => {
    const withGlobalSetup = [];
    for (const suite of suites()) {
      const declared = asList((await testConfig(suite)).globalSetup);
      if (declared.length === 0) continue;
      withGlobalSetup.push({ suite: `${suite.package}: ${suite.script}`, first: declared[0] });
    }

    // Vacuous otherwise, exactly as above: three suites declare a global setup
    // today -- `packages/db`, `packages/api` sharing that same file, and the
    // end-to-end run.
    expect(withGlobalSetup.length).toBeGreaterThanOrEqual(3);

    // FIRST rather than merely present, and the order is the whole assertion: a
    // global setup listed ahead of the gate runs ahead of it, which is being
    // ungated for exactly the work that global setup does.
    const open = withGlobalSetup.filter(({ first }) => first !== GATE_IN_GLOBAL_SETUP);
    expect(open.map(({ suite }) => suite)).toStrictEqual([]);
  });
});

/**
 * The rules the sweep is made of, asked DIRECTLY rather than through the
 * repository -- which is the only way to ask them about a pattern or a script
 * this workspace does not happen to have. Both rows marked below went wrong
 * exactly that way: the thing the rule let through was not in the repo, so
 * every assertion above went on passing while the rule said something else.
 */
describe("the rules the sweep is made of", () => {
  it.each<[string, boolean]>([
    ["apps/*", true],
    ["packages/*", true],
    // A LEADING dot is an ordinary directory name. The narrowing below is aimed
    // at relative-path segments, not at dots, so this stays supported.
    [".github/*", true],
    // THE TWO THAT LEAVE THE REPOSITORY, and CNCORE-46's second half: `..`
    // sweeps the repository's PARENT and `.` sweeps the root itself, and both
    // matched the first segment's `[\w.-]+` while the comment on the rule named
    // `../*` as a case it caught.
    ["../*", false],
    ["./*", false],
    // Refused already, and the reason the rule reads the WHOLE pattern.
    ["apps/*/nested", false],
    ["apps/**", false],
    ["apps", false],
    ["*", false],
  ])("reads %s as a workspace pattern: %s", (pattern, supported) => {
    expect(isWorkspacePattern(pattern)).toBe(supported);
  });

  it.each<[string, boolean]>([
    ["vitest run", true],
    ["vitest run --config vitest.e2e.config.ts", true],
    // `--run` is Vitest's own documented flag for the same thing (`docs/config/
    // watch.md`, `docs/guide/cli-generated.md`, read 2026-09-11). No script here
    // spells it that way; a filter that accepts one spelling of run mode and not
    // the other is the shape of rule this whole ticket is about.
    ["vitest --run", true],
    ["vitest --run --config vitest.e2e.config.ts", true],
    // NEITHER, and that is the point of it: `watch` defaults to `!process.env.CI
    // && process.stdin.isTTY`, so bare `vitest` watches on a laptop and runs
    // once in CI. A suite's command must not depend on where it is run.
    ["vitest", false],
    ["vitest watch", false],
    ["jest", false],
    // What the root manifest declares. Nothing at the root is swept, and this is
    // the shape that would be if anything ever were.
    ["turbo run test", false],
    ["node scripts/setup.ts", false],
  ])("reads `%s` as a command that runs a suite: %s", (command, runs) => {
    expect(runsASuite(command)).toBe(runs);
  });

  it.each<[string, string | undefined]>([
    // All four carry a path to Vitest's config loader, measured against this
    // repo's vitest 5.0.0. Only the first is spelled in this repo today, which
    // is exactly why the other three are asked here rather than through it: the
    // sweep went on passing while the rule read three of them as no config at
    // all (CNCORE-51).
    ["vitest run --config vitest.e2e.config.ts", "vitest.e2e.config.ts"],
    ["vitest run --config=vitest.e2e.config.ts", "vitest.e2e.config.ts"],
    ["vitest run -c vitest.e2e.config.ts", "vitest.e2e.config.ts"],
    ["vitest run -c=vitest.e2e.config.ts", "vitest.e2e.config.ts"],
    // Names none, which is the ordinary case here: ten of this repo's eleven
    // suites run the package's own `vitest.config.ts` without saying so, and
    // `apps/web`'s `test:e2e` is the only one that names a config at all.
    ["vitest run", undefined],
    // THE THREE THAT MUST NOT MATCH, one per half of the rule. `--configLoader`
    // is a real Vitest flag that names no path and `--coverage` has a `-c`
    // inside it, and both are held out by the separator: a rule looking for
    // either flag anywhere reads these as the configs `Loader` and `overage`.
    // The third is held out by the word start INSTEAD, and is the case that was
    // missing while the sentence above claimed both halves for the first two --
    // `app-c` is an ordinary project name, and a `-c` ending a flag's value
    // takes the next word with it.
    ["vitest run --configLoader runner", undefined],
    ["vitest run --coverage", undefined],
    ["vitest run --project app-c src/foo.test.ts", undefined],
    // AND THE TWO WHERE THE `-c` IS ANOTHER PROGRAM'S, which is the hazard
    // widening to `-c` brought with it: only the first command in a script is
    // Vitest's, and `-c` belongs to far more programs than `--config` does.
    ["vitest run && playwright test -c playwright.config.ts", undefined],
    ["vitest run --reporter=json; node -c x.js", undefined],
  ])("reads `%s` as naming the config %s", (command, named) => {
    expect(namedConfig(command)).toBe(named);
  });

  it.each<[string, boolean]>([
    ["test", true],
    ["test:e2e", true],
    ["test:contract", true],
    ["test:watch", true],
    ["typecheck", false],
    ["build", false],
    // `test` and then a separator, rather than a prefix: a script that merely
    // starts with those four letters is not making a claim about itself.
    ["testament", false],
  ])("reads `%s` as the name of a test script: %s", (name, named) => {
    expect(isTestScriptName(name)).toBe(named);
  });

  it.each<[string, boolean]>([
    ["test:watch", true],
    // The one script ADR-0103 prescribes that is not meant to run once:
    // Turborepo's Vitest shape, uncached and persistent.
    ["test", false],
    ["test:e2e", false],
    ["test:contract", false],
    ["watch", false],
  ])("reads `%s` as the name of a watch script: %s", (name, watching) => {
    expect(isWatchScriptName(name)).toBe(watching);
  });

  it.each<[string, string, boolean]>([
    ["/repo/packages/db", "/repo/packages/db/vitest.config.ts", true],
    ["/repo/packages/db", "/repo/packages/db/nested/vitest.config.ts", true],
    // What a `--config` that climbs would resolve to. The assertions in this
    // file would then be about a file the package does not own.
    ["/repo/packages/db", "/repo/vitest.config.ts", false],
    ["/repo/packages/db", "/repo/packages/api/vitest.config.ts", false],
    ["/repo/packages/db", "/repo/packages/db", false],
  ])("reads %s as holding %s: %s", (directory, file, inside) => {
    expect(isInside(directory, file)).toBe(inside);
  });
});
