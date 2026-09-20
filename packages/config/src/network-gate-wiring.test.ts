import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { repoRoot } from "./testing/repo-root";
import {
  configFilesIn,
  configFilesOnDisk,
  namedConfig,
  packageScripts,
  runsASuite,
  suiteScripts,
  testBlockOf,
} from "./testing/vitest-configs";
import { packageDirectories } from "./testing/workspace";

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
//
// IT READS THE PATH AND NOTHING ELSE, which is what keeps it a rule a table of
// imaginary paths can hold. `resolvesInside` below is the one the sweep asks,
// and it is this rule put to the file the path actually NAMES.
function isInside(directory: string, file: string): boolean {
  const from = relative(directory, file);
  return from !== "" && !from.startsWith("..");
}

// A path with every symlink on it followed, AS FAR AS THE PATH EXISTS, and
// whatever does not exist appended as written -- a segment that is not there
// cannot be a symlink, so there is nothing about it left to resolve.
//
// THE TAIL IS WHY THIS IS NOT `realpathSync`, which throws ENOENT. A package
// with a test script and no config of its own is the ORDINARY way to be
// ungated: `testBlockOf` resolves an absent config to no `test` block and the
// caller reports that suite as standing open, by name. A throw here would turn
// a suite this sweep NAMES into a stack trace that names the sweep instead.
//
// EVERYTHING `existsSync` ANSWERS FALSE FOR LANDS IN THAT TAIL, which is wider
// than absence and is the reason this is safe rather than merely tolerable. A
// dangling link, a symlink CYCLE and a path under a directory this process
// cannot traverse all arrive as "not there" -- `existsSync` swallows ELOOP and
// EACCES alike and answers false -- so each is placed by its own name and then
// reported by `testBlockOf` as a suite standing open. NONE OF THE THREE IS A
// FILE VITEST COULD HAVE LOADED EITHER, which is what makes placing them right
// rather than lucky: there is no config behind them for the placement to be
// wrong about. Measured 2026-09-19 for the cycle: `existsSync` false and the
// import refused with `ERR_MODULE_NOT_FOUND`.
//
// `directoriesUnder` lets ELOOP THROW instead, and the difference is that it
// has no second reader: a throw there names the path, where here the suite is
// named anyway. `configFilesIn` refuses a dangling CONFIG-SHAPED name for a
// reason of its own, which ADR-0103 carries under "the climb spelled as a
// symlink a script NAMES".
function resolvedPath(path: string): string {
  const missing: string[] = [];
  let found = path;
  while (!existsSync(found)) {
    const parent = dirname(found);
    if (parent === found) return path;
    missing.unshift(basename(found));
    found = parent;
  }
  return join(realpathSync(found), ...missing);
}

// And the rule the sweep actually asks: `isInside`, put to the file the path
// NAMES rather than to the path (CNCORE-202).
//
// A SYMLINK IS A SPELLING OF THAT CLIMB, and the path cannot see it: it is
// local to read and foreign to load, and Vitest loads the file it names.
//
// BOTH SIDES ARE RESOLVED, OR NEITHER, and that is the trap which made
// CNCORE-201 refuse by name instead of resolving. `packages/` may itself be a
// symlink, so a resolved FILE compared against an unresolved DIRECTORY reads
// every config in the repository as escaping. The row below pins it.
//
// THE WHOLE PATH IS RESOLVED RATHER THAN THE NAME lstat-ED, because the link
// need not be the last segment: `--config ./vendored/shared.ts` climbs out
// through a symlinked DIRECTORY, and an lstat on the file it names reads an
// ordinary file and lets it past. A rule that reads one spelling of a thing is
// what CNCORE-51 already cost this sweep once.
//
// The measurements behind all three -- that the shape runs, that the trap
// fires, and what an lstat misses -- are in ADR-0103 under "the climb spelled
// as a symlink a script NAMES", and are NOT restated here: a figure kept in two
// places is a figure that drifts in one of them.
function resolvesInside(directory: string, file: string): boolean {
  return isInside(resolvedPath(directory), resolvedPath(file));
}

/** One suite: a package, one of its test scripts, and the config that runs it. */
type Suite = { package: string; script: string; config: string };

function suites(): Suite[] {
  // Asserted, not assumed, and it is the half the filter below cannot do:
  // `"test": "jest"` and `"test": "vitest"` alike match no command that runs a
  // suite, so they do not FAIL that filter -- they fall out of it, and the
  // package leaves the sweep without anybody deciding that it should. Two
  // assertions rather than one, because a watch script is held to the first and
  // is the one script here exempt from the second.
  //
  // OVER `packageScripts()` RATHER THAN A WALK OF ITS OWN (CNCORE-251), which
  // is why that reader answers with EVERY script rather than only the ones
  // running a suite: this question cannot be asked of a list already filtered
  // by the command.
  for (const { directory, script, command } of packageScripts()) {
    if (!isTestScriptName(script)) continue;
    expect(/^vitest\b/.test(command), `${directory} runs ${script} as \`${command}\``).toBe(true);
    if (!isWatchScriptName(script)) {
      expect(
        runsASuite(command),
        `${directory} runs ${script} without running a suite: \`${command}\``,
      ).toBe(true);
    }
  }

  return suiteScripts().map(({ directory, package: name, script, command }) => {
    const namedPath = namedConfig(command);
    const config = join(repoRoot, directory, namedPath ?? "vitest.config.ts");
    expect(
      resolvesInside(join(repoRoot, directory), config),
      `${directory} runs ${script} against a config outside the package: ${namedPath}`,
    ).toBe(true);
    return { package: name, script, config };
  });
}

/**
 * Every config whose TEXT names a global setup, which is the count the
 * assertion about global setups is held to.
 *
 * A SECOND WAY OF ASKING, not a second copy of the answer. Everything else in
 * this file learns what a config declares by importing it; this learns it by
 * reading the bytes, so the two cannot fail together.
 */
function configsNamingAGlobalSetup(): string[] {
  return configFilesOnDisk().filter((file) => readFileSync(file, "utf8").includes("globalSetup"));
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

    // Vacuous otherwise, in the same way the count below is: an empty disk read
    // is claimed by the empty set.
    //
    // NAMED RATHER THAN COUNTED (CNCORE-160). The guard here was `>= 12`, a
    // number true when it was written and quietly false afterwards -- the
    // repository reached fourteen configs, so two could have left the read with
    // it still green, and a count re-derived from the packages would have had
    // the same slack in it. So the question is asked of each package instead:
    // ADR-0103 gives every package a suite, a suite is run by a config, and a
    // package here with no config at all is the defect rather than a case to
    // allow for. There is no slack to lose two configs into, and an empty disk
    // read fails it with every package named.
    //
    // ASKED OF THE PATHS UNRESOLVED, deliberately, where the sweep over scripts
    // resolves both sides (CNCORE-202). Both of these sides are built from the
    // same `repoRoot`, and `configFilesIn` has already refused any symlink among
    // them, so the two agree or fail together -- a `realpath` per package would
    // buy nothing. What the other site resolves is a path out of a MANIFEST,
    // which is the only one this file does not write itself.
    const ungatedPackages = packageDirectories().filter(
      (directory) => !onDisk.some((file) => isInside(join(repoRoot, directory), file)),
    );
    expect(ungatedPackages).toStrictEqual([]);

    const claimed = new Set(suites().map((suite) => suite.config));
    const unrun = onDisk.filter((file) => !claimed.has(file));
    expect(unrun.map((file) => relative(repoRoot, file))).toStrictEqual([]);
  });

  it("is installed by every suite in the repository", async () => {
    const found = suites();

    // Without this the whole test is vacuous: a workspace file that failed to
    // parse into packages produces an empty list and passes having asked
    // nothing.
    //
    // THE CONFIGS THAT EXIST ARE WHAT COUNTS THEM (CNCORE-160), and the two
    // sides come from different places, which is the whole of why this is worth
    // more than the `12` it replaces: `suites()` learns what exists from the
    // manifests' `scripts`, and `configFilesOnDisk()` from the directory
    // entries. The test above holds every config on disk to being run by a
    // swept suite, so there can be no fewer suites than configs -- and a sweep
    // that quietly stopped finding manifests now fails here instead of passing
    // against a number nobody had re-counted.
    //
    // BOTH SIDES GOING EMPTY TOGETHER is what a floor of one sweep against
    // another cannot see, and neither half is held here. The workspace list
    // emptying is refused in `workspaceDirectories()`, since every sweep in
    // this file descends from it. `configFilesOnDisk()` collapsing on its own
    // -- its filename rule narrowed, or the configs renamed to `.mts` -- would
    // leave this comparing sixteen suites to zero configs and passing, and it
    // is the test ABOVE that fails then: with no config found, every package
    // reads as owning none.
    expect(found.length).toBeGreaterThanOrEqual(configFilesOnDisk().length);

    const open = [];
    for (const suite of found) {
      const name = `${suite.package}: ${suite.script}`;
      if (MAY_REACH_THE_INTERNET.includes(name)) continue;
      const declared = asList((await testBlockOf(suite.config)).setupFiles);
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
      const declared = asList((await testBlockOf(suite.config)).globalSetup);
      if (declared.length === 0) continue;
      withGlobalSetup.push({ suite: `${suite.package}: ${suite.script}`, first: declared[0] });
    }

    // Vacuous otherwise, exactly as above, and counted for the same reason: the
    // `3` here was written when three configs declared one and five do now
    // (CNCORE-160).
    //
    // READ AS TEXT, WHICH IS THE INDEPENDENT SOURCE. `testBlockOf` IMPORTS a
    // config, so a resolution that silently yielded `{}` for every one of them
    // would empty this list and pass; a text search cannot fail that way. The
    // one thing it cannot tell apart is a COMMENTED-OUT declaration, and this
    // file already treats that as the state to catch rather than as a case to
    // allow for: a config whose text names a global setup and whose import
    // declares none fails here, correctly.
    expect(withGlobalSetup.length).toBeGreaterThanOrEqual(configsNamingAGlobalSetup().length);

    // FIRST rather than merely present, and the order is the whole assertion: a
    // global setup listed ahead of the gate runs ahead of it, which is being
    // ungated for exactly the work that global setup does.
    const open = withGlobalSetup.filter(({ first }) => first !== GATE_IN_GLOBAL_SETUP);
    expect(open.map(({ suite }) => suite)).toStrictEqual([]);
  });
});

/**
 * The rules the sweep is made of, asked DIRECTLY rather than through the
 * repository -- which is the only way to ask them about a script this workspace
 * does not happen to have. The rows marked below went wrong exactly that way:
 * the thing the rule let through was not in the repo, so every assertion above
 * went on passing while the rule said something else.
 *
 * `isWorkspacePattern`'s table went with the predicate to
 * `testing/workspace.test.ts` under CNCORE-197, since two files now sweep
 * through it and ADR-0103 keeps a predicate and its table together.
 */
describe("the rules the sweep is made of", () => {
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
    // Names none, which is the ordinary case here: twelve of this repo's sixteen
    // suites run the package's own `vitest.config.ts` without saying so, and the
    // four that name a config at all are `apps/web`'s `test:e2e`, `test:live` and
    // `test:browser`, and `packages/api`'s `test:corpus`.
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

/**
 * And the shape the sweep above cannot be right about, ASKED DIRECTLY for the
 * reason the table at the top of this block is: no Vitest config in this
 * repository is a symlink, so the repository is the one place the question
 * cannot be put (CNCORE-201).
 */
describe("a symlinked Vitest config", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "canoncore-configs-"));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("is refused by name rather than dropped out of the sweep", () => {
    writeFileSync(join(directory, "vitest.config.ts"), "");
    symlinkSync(join(directory, "vitest.config.ts"), join(directory, "vitest.e2e.config.ts"));

    expect(() => configFilesIn(directory)).toThrow(/vitest\.e2e\.config\.ts/);
  });

  /**
   * NAMED RATHER THAN COUNTED, which is the line this file already takes about
   * `ungatedPackages` and `directoriesUnder`: two symlinked configs are two
   * things to fix, and a message carrying the first sends the reader back for
   * the second.
   */
  it("is named alongside every other one, rather than the first standing for them all", () => {
    writeFileSync(join(directory, "vitest.config.ts"), "");
    symlinkSync(join(directory, "vitest.config.ts"), join(directory, "vitest.one.config.ts"));
    symlinkSync(join(directory, "vitest.config.ts"), join(directory, "vitest.two.config.ts"));

    expect(() => configFilesIn(directory)).toThrow(/one.*two/s);
  });

  /**
   * A package may hold as many symlinks as it likes; what it may not hold is one
   * wearing the name of a config this sweep would otherwise have to place. The
   * ordering that buys this is on `configFilesIn` itself.
   */
  it("is not an ordinary symlink that no config filename rule matches", () => {
    writeFileSync(join(directory, "vitest.config.ts"), "");
    writeFileSync(join(directory, "notes.md"), "");
    symlinkSync(join(directory, "notes.md"), join(directory, "README.md"));

    expect(configFilesIn(directory)).toStrictEqual([join(directory, "vitest.config.ts")]);
  });

  /**
   * AND A DANGLING ONE IS REFUSED TOO, which is the measured difference from
   * CNCORE-200 rather than an oversight. `directoriesUnder` drops a dangling
   * link because a thing that stats as nothing is not a package to pnpm or to
   * turbo either, so all three readers agree. Here there is no second reader to
   * agree with: a file wearing a config's name and resolving to nothing is a
   * config Vitest would fail to load, and naming it says so.
   */
  it("is refused when it dangles, rather than dropped for stats that find nothing", () => {
    writeFileSync(join(directory, "vitest.config.ts"), "");
    symlinkSync(join(directory, "gone.ts"), join(directory, "vitest.dangling.config.ts"));

    expect(() => configFilesIn(directory)).toThrow(/vitest\.dangling\.config\.ts/);
  });
});

/**
 * And the shape the block above cannot be right about either, ASKED DIRECTLY
 * for the same reason: no script in this repository names a config that is a
 * symlink, and only four of them name a config at all (CNCORE-202).
 *
 * A SCRATCH TREE RATHER THAN A TABLE OF PATHS, unlike the block above, and the
 * filesystem is the whole reason: what is under test is the difference between
 * the path a script writes and the file that path reaches, and only real
 * inodes have one.
 *
 * THE SYMLINKED PARENT IS PINNED RATHER THAN INHERITED, which is the line
 * ADR-0103 already takes about the roll call's fixture. `os.tmpdir()` is behind
 * `/var` -> `/private/var` on macOS and is an ordinary directory on the Linux
 * runner, so a row that leaned on the host's own shape would exercise
 * resolution here and assert nothing at all in CI -- which is the one place
 * these checks exist to work.
 */
describe("the file a script's --config actually names", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "canoncore-named-"));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  /**
   * THE SHAPE THE TICKET IS NAMED FOR. The path is local, so `isInside` reads it
   * as owned; the file is not, and `testBlockOf` would import it.
   */
  it("is refused when the name is a symlink pointing out of the package", () => {
    mkdirSync(join(directory, "pkg"));
    mkdirSync(join(directory, "elsewhere"));
    writeFileSync(join(directory, "elsewhere", "shared.ts"), "");
    symlinkSync(join(directory, "elsewhere", "shared.ts"), join(directory, "pkg", "shared.ts"));

    expect(resolvesInside(join(directory, "pkg"), join(directory, "pkg", "shared.ts"))).toBe(false);
  });

  /**
   * THE TRAP, AND THE REASON BOTH SIDES ARE RESOLVED. A resolved FILE compared
   * against an unresolved DIRECTORY reads this -- an ordinary config a package
   * really owns -- as escaping, and would redden every package in a checkout
   * held behind a symlinked parent. ADR-0103 allows that parent, so this is a
   * shape the sweep has to stay right about rather than one it may refuse.
   */
  it("is still held by a package whose workspace parent is itself a symlink", () => {
    mkdirSync(join(directory, "elsewhere", "db"), { recursive: true });
    mkdirSync(join(directory, "repo"));
    symlinkSync(join(directory, "elsewhere"), join(directory, "repo", "packages"));
    writeFileSync(join(directory, "elsewhere", "db", "vitest.config.ts"), "");

    const pkg = join(directory, "repo", "packages", "db");
    expect(resolvesInside(pkg, join(pkg, "vitest.config.ts"))).toBe(true);
  });

  /**
   * ABSENCE IS NOT A CLIMB. A package with a test script and no config of its
   * own is the ordinary way to be ungated, and the caller says so by NAMING the
   * suite; a rule that threw ENOENT here would replace that with a stack trace.
   */
  it("places a config that is not there rather than crashing on it", () => {
    mkdirSync(join(directory, "pkg"));

    expect(resolvesInside(join(directory, "pkg"), join(directory, "pkg", "vitest.config.ts"))).toBe(
      true,
    );
  });

  /**
   * THE SPELLING AN lstat ON THE NAME WOULD MISS, which is why the whole path is
   * resolved rather than the last segment examined: the file this names is an
   * ordinary file, and the link is the directory above it.
   */
  it("is refused when a DIRECTORY on the way out is the symlink", () => {
    mkdirSync(join(directory, "pkg"));
    mkdirSync(join(directory, "elsewhere"));
    writeFileSync(join(directory, "elsewhere", "shared.ts"), "");
    symlinkSync(join(directory, "elsewhere"), join(directory, "pkg", "vendored"));

    expect(
      resolvesInside(join(directory, "pkg"), join(directory, "pkg", "vendored", "shared.ts")),
    ).toBe(false);
  });

  /**
   * AND A LINK THAT IS NO CLIMB IS NOT REFUSED, which is a DELIBERATE difference
   * from `configFilesIn` rather than an inconsistency with it. That one reads a
   * FILENAME and so cannot tell which way a link points, and ADR-0103 records
   * the cost of refusing it anyway. Here the direction is known, and the rule
   * this serves refuses a climb -- so refusing a link that stays inside the
   * package would be narrower than Vitest with nothing asking for it.
   */
  it("is held when the symlink points at a file in the package's own tree", () => {
    mkdirSync(join(directory, "pkg"));
    writeFileSync(join(directory, "pkg", "vitest.config.ts"), "");
    symlinkSync(join(directory, "pkg", "vitest.config.ts"), join(directory, "pkg", "shared.ts"));

    expect(resolvesInside(join(directory, "pkg"), join(directory, "pkg", "shared.ts"))).toBe(true);
  });

  /**
   * AND A DANGLING ONE IS PLACED RATHER THAN REFUSED, which `resolvedPath` says
   * why of: what is placed is a path with no file behind it, so the caller
   * reports that suite as standing open.
   */
  it("places a dangling one rather than refusing it", () => {
    mkdirSync(join(directory, "pkg"));
    symlinkSync(join(directory, "pkg", "gone.ts"), join(directory, "pkg", "shared.ts"));

    expect(resolvesInside(join(directory, "pkg"), join(directory, "pkg", "shared.ts"))).toBe(true);
  });
});
