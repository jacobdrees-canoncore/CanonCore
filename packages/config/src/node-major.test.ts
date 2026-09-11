/**
 * CanonCore's Node major, held to ONE value across the three files that state
 * it -- `ci.yml`, `package.json` and `README.md` -- and to the rule that says
 * which value that is.
 *
 * This exists because the major was asserted in four places and enforced in
 * none (CNCORE-50). ADR-0112 is the record that now decides it; this suite is
 * the half of that record which acts, and it reads the files directly for the
 * same reason `ci-workflow.test.ts` does: the values are written where
 * TypeScript cannot see them, so nothing else would catch one of them moving.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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
});
