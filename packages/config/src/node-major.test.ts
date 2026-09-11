/**
 * CanonCore's Node major, held to ONE value across the four files that state
 * it -- the `Dockerfile`, `ci.yml`, `package.json` and `README.md` -- and to
 * the rule that says which value that is. A fifth file, `.github/
 * dependabot.yml`, holds the major still until the rule moves, and its expiry
 * is held here too.
 *
 * This exists because the major was asserted in four places and enforced in
 * none (CNCORE-50). ADR-0112 is the record that now decides it; this suite is
 * the half of that record which acts, and it reads the files directly for the
 * same reason `ci-workflow.test.ts` does: the values are written where
 * TypeScript cannot see them, so nothing else would catch one of them moving.
 *
 * THE `Dockerfile` JOINED THEM UNDER CNCORE-63 and it is the one that ships.
 * ADR-0112 was written while this repository had no image and said what adding
 * one would do to this file; this is that, built.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { pnpmSetupSteps, type Workflow, workflow } from "./testing/ci-workflow";
import { repoRoot } from "./testing/repo-root";

/**
 * Every Node major `ci.yml` asks for, named by the job that asks, read out of
 * `pnpm/setup`'s `runtime` input.
 *
 * The input is `node@<major>` rather than a bare number, so the major is taken
 * by parsing rather than by matching the whole string: a run pinned to
 * `node@24.21.0` names the same major as `node@24` and must not read as a
 * different one.
 */
function requestedMajors(parsed: Workflow): { job: string; major: string }[] {
  return pnpmSetupSteps(parsed).map(({ job, step }) => {
    const runtime = step.with?.runtime;
    if (typeof runtime !== "string") {
      throw new Error(`the ${job} job's pnpm/setup step names no runtime`);
    }
    const [engine, version] = runtime.split("@");
    if (engine !== "node" || !version) {
      throw new Error(`the ${job} job asks for ${runtime}, which is not node@<version>`);
    }
    return { job, major: version.split(".")[0] as string };
  });
}

/**
 * Node's own release schedule for the majors that have reached LTS, transcribed
 * from `nodejs/Release`'s `schedule.json` on 2026-09-11.
 *
 * Restated here rather than fetched, for the reason `ci-workflow.test.ts` gives
 * about `pnpm/setup`'s inputs: the suite needs no network, and extending this
 * table means going and reading the vendor's file. The network gate every suite
 * installs would refuse the request anyway.
 *
 * THE ODD MAJORS ARE ABSENT BECAUSE THEY NEVER REACH LTS, which is a fact about
 * Node's release lines and not a gap in this transcription. 23 and 25 each went
 * straight from Current to end-of-life -- 25's was 2026-06-01, so it was already
 * dead when this was written. Vitest's own `engines` range says the same thing
 * independently: `^22.12.0 || ^24.0.0 || >=26.0.0` admits the even lines and
 * refuses the odd ones.
 */
const NODE_SCHEDULE = [
  { major: "22", lts: "2024-10-29", end: "2027-04-30" },
  { major: "24", lts: "2025-10-28", end: "2028-04-30" },
  { major: "26", lts: "2026-10-28", end: "2029-04-30" },
] as const;

/**
 * The day after which NODE_SCHEDULE can no longer be trusted to name the newest
 * LTS line, because a line newer than any transcribed above will have reached
 * LTS by then.
 *
 * NODE SHIPS A NEW LTS LINE EVERY OCTOBER, which is read off the transcribed
 * dates themselves rather than assumed: 22 on 2024-10-29, 24 on 2025-10-28, 26
 * on 2026-10-28. The newest line above is 26, so the next one -- 28, which
 * `schedule.json` does not list yet -- is due in October 2027 and this table
 * goes blind then.
 *
 * WITHOUT THIS the alarm below is a ONE-SHOT device. Bump `ci.yml` to 26 in
 * October 2026 and every test here passes for ever after, including through
 * October 2027 when the rule starts selecting 28 and nothing notices. A guard
 * that can only fire once is the false signal ADR-0112 is meant to remove.
 */
const SCHEDULE_GOES_BLIND_AFTER = "2027-10-01";

/**
 * A date as `schedule.json` writes them, which compare correctly as strings.
 *
 * UTC, via `toISOString`, so the changeover below happens on the same instant
 * everywhere rather than when the runner's local midnight arrives. On a machine
 * west of UTC that means the alarm can fire while it is still the 27th locally.
 */
function asDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The major ADR-0112's rule selects on `date`: the newest major that has
 * REACHED LTS and has not reached end-of-life.
 *
 * "Reached LTS" rather than "is Active LTS", and the difference is the whole
 * reason the rule is worded as it is. A line drops to Maintenance BEFORE its
 * successor becomes Active -- 24 does so on 2026-10-20 and 26 is not Active
 * until 2026-10-28 -- so a rule reading "the Active LTS major" selects NOTHING
 * for those eight days. This one is defined at every instant.
 */
function newestLtsAsOf(date: Date): string {
  const day = asDay(date);
  const reached = NODE_SCHEDULE.filter((line) => line.lts <= day && day < line.end);
  const newest = reached.reduce<(typeof NODE_SCHEDULE)[number] | undefined>(
    (best, line) => (best && Number(best.major) > Number(line.major) ? best : line),
    undefined,
  );
  if (!newest) {
    throw new Error(`no transcribed Node line has reached LTS on ${day}; re-read schedule.json`);
  }
  return newest.major;
}

const manifestFile = join(repoRoot, "package.json");

/**
 * The root manifest's `engines.node`, required to be a bare `>=<major>` floor
 * and returned as that major.
 *
 * THE SHAPE IS THE ASSERTION. ADR-0112 decides that this field is a FLOOR and
 * advisory, so a range that pins (`24.x`, `^24.0.0`) is the defect being
 * guarded against, not a stricter spelling of the same thing -- it would move
 * with the rule and need editing at every major, which is the maintenance this
 * repo decided not to take on. Parsed by hand rather than with `semver`, which
 * is not a dependency here and would be one added to read four characters.
 */
function enginesFloor(): string {
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8")) as {
    engines?: { node?: string };
  };
  const declared = manifest.engines?.node;
  const floor = /^>=(\d+)$/.exec(declared ?? "");
  if (!floor) {
    throw new Error(
      `engines.node is ${JSON.stringify(declared)}; ADR-0112 makes it a bare >=<major> floor`,
    );
  }
  return floor[1] as string;
}

const readmeFile = join(repoRoot, "README.md");

/**
 * The major `README.md` tells a contributor to install.
 *
 * Anchored to the whole setup sentence rather than to the first `Node <n>` in
 * the file, because the prose around it legitimately names OTHER majors -- it
 * explains that corepack is gone from the 25 line on -- and a looser match
 * would read that 25 as the requirement and fail on correct prose.
 */
function readmeMajor(): string {
  const stated = /^Requires Docker and Node (\d+)\b/m.exec(readFileSync(readmeFile, "utf8"));
  if (!stated) {
    throw new Error(
      "README.md has no line starting `Requires Docker and Node <major>`; this test and the " +
        "setup instruction have to be edited together",
    );
  }
  return stated[1] as string;
}

const dockerfile = join(repoRoot, "Dockerfile");

/**
 * The one Node major the `Dockerfile` builds and runs on, or a throw naming the
 * stages that disagree.
 *
 * THE FIFTH ASSERTION, and the one ADR-0112 predicted before it existed. That
 * record's enforcement argument rested on "CanonCore ships no image ... there is
 * no `Dockerfile` anywhere in this repository", and said in terms what adding
 * one would do: "Add one without extending that test and its major can drift
 * while every assertion still passes -- which is CNCORE-50's
 * four-assertions-one-decision defect, re-created by the fix for something
 * else." This function is the extension that sentence asked for.
 *
 * It reads `FROM` lines naming the `node` image and nothing else, so a stage
 * built `FROM base` inherits its major rather than restating it, and a
 * `postgres` or `alpine` base would not be mistaken for one. The major is taken
 * by parsing rather than by matching the whole tag: `node:24.21.0-slim` names
 * the same major as `node:24-slim` and must not read as a different one.
 */
function dockerfileMajor(contents: string = readFileSync(dockerfile, "utf8")): string {
  const stages = [...contents.matchAll(/^FROM\s+node:(\d+)[^\s]*(?:\s+AS\s+(\S+))?/gim)].map(
    (stage) => ({ major: stage[1] as string, name: stage[2] ?? "(unnamed)" }),
  );

  if (stages.length === 0) {
    throw new Error(
      "no stage in the Dockerfile builds FROM the node image, so nothing states a major",
    );
  }
  const distinct = [...new Set(stages.map(({ major }) => major))];
  if (distinct.length > 1) {
    const split = stages.map(({ name, major }) => `${name}=node:${major}`).join(", ");
    throw new Error(`the Dockerfile names more than one Node major: ${split}`);
  }
  return distinct[0] as string;
}

/**
 * The one major `ci.yml` runs on, or a throw naming the jobs that disagree.
 *
 * Every caller wants "the major this repository runs", which only exists while
 * the six jobs agree. Collapsing them here rather than in a test of its own is
 * what lets that disagreement fail whichever test asked, instead of needing a
 * separate assertion to notice it.
 */
function ciMajor(parsed: Workflow): string {
  const asked = requestedMajors(parsed);
  if (asked.length === 0) {
    throw new Error("no job in ci.yml runs pnpm/setup, so nothing states the Node major");
  }
  const distinct = [...new Set(asked.map(({ major }) => major))];
  if (distinct.length > 1) {
    const split = asked.map(({ job, major }) => `${job}=node@${major}`).join(", ");
    throw new Error(`ci.yml names more than one Node major: ${split}`);
  }
  return distinct[0] as string;
}

describe("CanonCore's Node major", () => {
  /**
   * THE SELECTOR ITSELF, pinned against worked examples read off Node's
   * schedule rather than recomputed from the table the way the code computes
   * it, so a wrong reading of the table disagrees with these instead of
   * agreeing with itself.
   *
   * The middle case is the one that earns this test. On 2026-10-20 Node 24
   * drops to Maintenance and Node 26 does not become Active until 2026-10-28,
   * so for those eight days NO major is Active LTS. An "Active LTS" rule
   * selects nothing there and this one selects 24, which is inside Node's own
   * guidance -- it permits Maintenance LTS as well as Active.
   */
  it("selects a major on every day, including the eight with no Active LTS line", () => {
    expect(newestLtsAsOf(new Date("2026-09-11"))).toBe("24");
    expect(newestLtsAsOf(new Date("2026-10-21"))).toBe("24");
    expect(newestLtsAsOf(new Date("2026-10-28"))).toBe("26");
  });

  /**
   * THE RULE, MADE TO ACT. Everything else in this file checks that the repo
   * agrees with itself; this is the one assertion that can disagree with the
   * repo and say the repo is wrong.
   *
   * It is green today and goes RED ON 2026-10-28, when Node 26 becomes Active
   * LTS and ADR-0112's rule starts selecting it. That is deliberate and is the
   * point of the record: a rule nothing acts on is what CNCORE-50 was filed
   * about, and a date written only in a comment is a date nobody meets. The
   * failure is one line of `ci.yml` away from green, and the message says which
   * line.
   */
  it("is the major the rule selects today", () => {
    const selected = newestLtsAsOf(new Date());

    expect(
      ciMajor(workflow()),
      `ADR-0112's rule now selects Node ${selected}. The repair is every runtime: in ` +
        `.github/workflows/ci.yml, and README.md's "Requires Docker and Node" line, moved to ` +
        `${selected} together. NODE_SCHEDULE in this file does NOT need extending for that -- ` +
        `it already carries ${selected}, and its own expiry test says when it does.`,
    ).toBe(selected);
  });

  /**
   * The transcription has an expiry and this is it. When this fails the fix is
   * not to move the date: it is to re-read `schedule.json`, add the lines that
   * have appeared since, and set a new expiry from the new newest line.
   */
  it("is read from a schedule transcription that has not gone blind", () => {
    expect(
      asDay(new Date()) < SCHEDULE_GOES_BLIND_AFTER,
      "NODE_SCHEDULE was transcribed on 2026-09-11 and a newer LTS line is now due. " +
        "Re-read nodejs/Release's schedule.json, add the missing lines, and move " +
        "SCHEDULE_GOES_BLIND_AFTER to the October after the newest line you added.",
    ).toBe(true);
  });

  /**
   * The two machine-readable statements of the major, held to not contradicting
   * each other.
   *
   * They are deliberately NOT equal. `engines` is a floor that stays put while
   * the rule moves the CI major up, so `>=24` keeps admitting 26 on purpose and
   * needs no edit on 2026-10-28. What it may never do is climb ABOVE the major
   * the repository actually runs, which would declare a minimum that CI itself
   * fails to meet.
   *
   * NOTHING ELSE READS THIS FIELD. Measured 2026-09-11 in `node:24-alpine` on a
   * root project with an unsatisfiable `">=99"`: pnpm 12.3.4 exits 0 on
   * `pnpm install --frozen-lockfile` with and without `engine-strict=true`, and
   * unlike pnpm 11.20.0 it does not even warn. So this test is the only reader
   * the field has.
   */
  it("declares a floor in package.json that the CI major clears", () => {
    const floor = Number(enginesFloor());
    const running = Number(ciMajor(workflow()));

    expect(floor).toBeLessThanOrEqual(running);
  });

  /**
   * The fourth place the major is written, and the only one a contributor reads
   * before anything runs. A README that names a major CI does not run sends
   * someone to install the wrong thing and nothing else in this repository
   * would ever disagree with it.
   */
  it("is the major README.md tells a contributor to install", () => {
    expect(readmeMajor()).toBe(newestLtsAsOf(new Date()));
  });

  /**
   * THE ARTEFACT, which is the place this record's enforcement argument used to
   * say did not exist.
   *
   * A provider repo's `FROM node:<major>` pins the major by BEING the thing it
   * ships, whatever the other three statements say. CanonCore now has one too,
   * so the asymmetry ADR-0112 used to explain why CI enforces alone is gone --
   * and the defect it opens is that an image's major can drift while `ci.yml`,
   * `package.json` and `README.md` still agree perfectly with each other.
   *
   * Held to the RULE rather than to `ci.yml`, like every other assertion here.
   * Comparing the two files to each other would let a bump applied to both
   * agree its way past the rule that decides which major is right.
   */
  /**
   * THE CHECK ITSELF, against fixtures rather than the real file, for the reason
   * `docker-compose.test.ts` gives about its port reader: run only against the
   * Dockerfile in the tree, this is exercised rather than tested, and it would
   * pass just as well reading nothing.
   *
   * These three cases are the ones that were observed failing by breaking the
   * real Dockerfile while this was written -- a major ahead of the rule, two
   * stages disagreeing, and a base that is not node. Kept here so the
   * observation is standing rather than a sentence in a commit message.
   */
  it("reads a major, a disagreement and an absence out of a Dockerfile", () => {
    expect(dockerfileMajor("FROM node:24-slim AS build\nFROM node:24-slim AS runner\n")).toBe("24");
    // A pinned patch names the same major as a bare one.
    expect(dockerfileMajor("FROM node:24.21.0-slim AS build\n")).toBe("24");
    // A stage built FROM another stage inherits rather than restating.
    expect(dockerfileMajor("FROM node:24-slim AS build\nFROM build AS runner\n")).toBe("24");

    expect(() =>
      dockerfileMajor("FROM node:24-slim AS build\nFROM node:26-slim AS runner\n"),
    ).toThrow(/more than one Node major: build=node:24, runner=node:26/);
    expect(() => dockerfileMajor("FROM debian:trixie-slim AS build\n")).toThrow(
      /nothing states a major/,
    );
  });

  it("is the major the Dockerfile builds and runs on", () => {
    const selected = newestLtsAsOf(new Date());

    expect(
      dockerfileMajor(),
      `ADR-0112's rule now selects Node ${selected}. The Dockerfile is the fifth place the ` +
        `major is written and the only one that ships: move its FROM lines with the rest.`,
    ).toBe(selected);
  });
});

const dependabotFile = join(repoRoot, ".github", "dependabot.yml");

type Dependabot = {
  updates?: {
    "package-ecosystem"?: string;
    directory?: string;
    ignore?: { "dependency-name"?: string; "update-types"?: string[] }[];
  }[];
};

/**
 * The day the `docker` entry's Node-major ignore stops being wanted, taken from
 * the `EXPIRES:` marker that is its ONE copy of the date.
 *
 * A marker rather than a YAML key because Dependabot has no field for "this
 * rule has an end", and the alternative -- a date in prose -- is a date nobody
 * meets. provider-wiki carries the same device under CNCORE-52, and the reason
 * it gives is the one that matters: past its expiry the block goes on
 * suppressing a bump that is by then WANTED, and the failure gets quieter with
 * age, because the longer it sits the more it reads as a settled rule.
 */
function ignoreExpires(): string {
  const marked = /^\s*#\s*EXPIRES:\s*(\d{4}-\d{2}-\d{2})\s*$/m.exec(
    readFileSync(dependabotFile, "utf8"),
  );
  if (!marked) {
    throw new Error(
      ".github/dependabot.yml carries no `# EXPIRES: <date>` marker. The Node-major ignore " +
        "is meant to be DELETED rather than kept, and the marker is what makes that happen.",
    );
  }
  return marked[1] as string;
}

/** The `docker` ecosystem entry, which exists because this repo now ships an image. */
function dockerEntry() {
  const parsed = parse(readFileSync(dependabotFile, "utf8")) as Dependabot;
  const entries = (parsed.updates ?? []).filter(
    (update) => update["package-ecosystem"] === "docker",
  );
  if (entries.length !== 1) {
    throw new Error(
      `.github/dependabot.yml has ${entries.length} docker entries; the Dockerfile at the ` +
        "repository root needs exactly one, and it is not the docker-compose entry",
    );
  }
  return entries[0] as NonNullable<Dependabot["updates"]>[number];
}

/**
 * THE THIRD THING A DOCKERFILE DRAGS IN, and ADR-0112 named it before it
 * existed: "Once an image exists it inherits the recurring-noise problem
 * CNCORE-43, CNCORE-49, CNCORE-52 and CNCORE-59 solved in the provider repos,
 * including the 2026-10-28 expiry machinery."
 *
 * The noise is specific rather than general. Dependabot would raise `node` 24 ->
 * 26 weekly from the day 26 ships, and every one of those pull requests fails
 * `node-major.test.ts` above -- correctly, because the major moves in five
 * places at once and Dependabot can only edit one. A WEEKLY RED PULL REQUEST
 * TEACHES PEOPLE THAT RED IS NORMAL, which is the habit every gate in this
 * repository depends on not forming.
 */
describe("the Dependabot ignore that holds the Node major still", () => {
  it("holds back the major of the node image and nothing else", () => {
    const ignored = dockerEntry().ignore ?? [];

    expect(ignored).toStrictEqual([
      { "dependency-name": "node", "update-types": ["version-update:semver-major"] },
    ]);
  });

  /**
   * THE EXPIRY IS DERIVED FROM THE RULE, NOT REMEMBERED BESIDE IT. The ignore is
   * wanted exactly while the rule still selects the major the Dockerfile runs;
   * the day the next transcribed line reaches LTS, the bump it suppresses is the
   * bump this repository wants. Reading that day off `NODE_SCHEDULE` means the
   * marker cannot drift from the rule that justifies it -- and when the majors
   * do move, the next expiry comes from a line this table does not carry yet,
   * which is what the going-blind test above is for.
   */
  it("expires on the day the rule starts selecting a newer major", () => {
    const running = Number(ciMajor(workflow()));
    const next = NODE_SCHEDULE.filter((line) => Number(line.major) > running).sort(
      (a, b) => Number(a.major) - Number(b.major),
    )[0];
    expect(next, "no transcribed line is newer than the major this repo runs").toBeDefined();

    expect(ignoreExpires()).toBe(next?.lts);
  });

  /**
   * AND IT FIRES. Red from the expiry, with the repair in the message, for the
   * same reason the rule's own alarm is: a block that outlives its reason is
   * indistinguishable from one that still has it.
   */
  it("has not expired", () => {
    const expires = ignoreExpires();

    expect(
      asDay(new Date()) < expires,
      `The Node-major ignore in .github/dependabot.yml expired on ${expires}. DELETE the ` +
        "ignore block and its EXPIRES marker rather than moving the date: the bump it " +
        "suppresses is the one ADR-0112's rule now wants, and it lands together with the " +
        "five places the major is written.",
    ).toBe(true);
  });

  /**
   * ONE COPY OF THE DATE. A second one in a comment is what the marker exists to
   * avoid: two dates that agree today and are edited one at a time.
   */
  it("states that date exactly once", () => {
    const occurrences = readFileSync(dependabotFile, "utf8").split(ignoreExpires()).length - 1;

    expect(occurrences).toBe(1);
  });
});
