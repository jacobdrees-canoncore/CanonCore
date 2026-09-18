import type { TestSpecification } from "vitest/node";
import { BaseSequencer } from "vitest/node";

/**
 * A FILE ORDER THAT DOES NOT MOVE BETWEEN RUNS, for the suites that share one
 * catalogue and run their files serially.
 *
 * VITEST'S OWN SEQUENCER MOVES A FILE THAT FAILED, which is the one arrangement
 * under which a flake cannot be re-observed by repeating the command.
 * `BaseSequencer.sort` (vitest 5.0.0, read 2026-09-14 and demonstrated in the
 * test beside this file) orders a run: a file that FAILED last run is promoted
 * to FIRST, then files run longest-first, and file size decides only where there
 * are no cached stats. So a failure CHANGES THE CONDITIONS OF THE NEXT RUN.
 *
 * That is harmless where files are independent. It is not harmless here: these
 * suites share ONE catalogue across their files and set `fileParallelism: false`,
 * so a file's POSITION decides what the database holds when it runs. `pnpm test`
 * reported `@canoncore/api: 1 failed | 190 passed` on 2026-09-14 and every run
 * since has been green -- and the promotion above is why re-running could not
 * answer which test it was (CNCORE-199).
 *
 * SORTING BY PATH IS WHAT MAKES THE ORDER A PROPERTY OF THE REPOSITORY rather
 * than of the last run's cache. The order is then the same on a laptop, on a
 * runner and after a red one, so the next one-off failure is reproducible by
 * running the command again -- and `ls`-ing the suite's test files answers which
 * file ran in which position for any run, including one already over.
 *
 * IT DELIBERATELY READS NO CACHE AT ALL. Vitest's remaining two keys -- longest
 * first, then largest -- are throughput heuristics for a PARALLEL run, and these
 * suites have `fileParallelism: false`, so there is no second worker for them to
 * feed. What they cost here is the determinism above, and they buy nothing.
 *
 * THE PROJECT GROUPING IS KEPT because it is not a heuristic. `BaseSequencer`
 * refuses to interleave two projects' files, and a sequencer that sorted on the
 * path alone would do exactly that for any config that grows a second project --
 * silently, since nothing else in Vitest re-groups them.
 */
export class StableSequencer extends BaseSequencer {
  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return [...files].sort(
      (a, b) => compare(a.project.name, b.project.name) || compare(a.moduleId, b.moduleId),
    );
  }
}

/**
 * Ordinary code-unit order, which is what makes the result the same everywhere.
 *
 * NOT `localeCompare`, and that is the point of it being a function: the locale
 * one orders by whatever collation the machine is set to, so the same suite on
 * two machines is two orders and the determinism above is lost exactly where it
 * is needed -- between a laptop and CI.
 */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
