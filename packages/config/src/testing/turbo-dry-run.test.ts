import { describe, expect, it } from "vitest";
import { plannedTasks, plannedTasksIfKnown } from "./turbo-dry-run";

describe("turbo's plan for a task it knows", () => {
  it("reports every planned copy, each naming the package directory it runs in", () => {
    const planned = plannedTasks("test");

    // Checked against where the package actually sits rather than against a
    // second copy of the plan: the taskId names the package, and `directory` is
    // turbo's own answer for where that package lives.
    expect(planned.find(({ taskId }) => taskId === "@canoncore/config#test")?.directory).toBe(
      "packages/config",
    );
  });
});

describe("the reader that tolerates a name turbo does not know", () => {
  /**
   * The tolerance is about the REFUSAL and nothing else: a known name must come
   * back the same way it does through the strict reader, or the two callers
   * would be reading two different answers from one interface.
   *
   * COMPARED ON `taskId` RATHER THAN WHOLE OBJECTS, and that is not fussiness.
   * A planned task carries turbo's own `cache` state -- `{"status":"MISS"}` or
   * `{"status":"HIT","timeSaved":391,...}` -- which is a fact about the cache at
   * the moment of the spawn, not about the plan. These are two spawns, and this
   * suite runs inside `turbo run test` while ten sibling test tasks finish and
   * write their cache entries. Measured on 2026-09-13: a `turbo run test` for
   * one package between two dry runs flipped `@canoncore/schemas#test` from
   * `MISS` to `HIT`, so `toStrictEqual` over the raw objects reddens on a field
   * neither reader exposes and nothing in the diff caused.
   */
  it("still reports the plan for a name it does know", () => {
    expect(plannedTasksIfKnown("test")?.map(({ taskId }) => taskId)).toStrictEqual(
      plannedTasks("test").map(({ taskId }) => taskId),
    );
  });
});

/**
 * A name no `turbo.json` in this repository defines. Should one ever be added,
 * this reads back as an array and the tests below FAIL rather than pass having
 * lost their subject.
 */
const UNKNOWN_TASK = "no-such-turbo-task";

describe("a task name turbo does not know", () => {
  it("is `null` from the tolerant reader, which is how a caller tells it from a real plan", () => {
    expect(plannedTasksIfKnown(UNKNOWN_TASK)).toBeNull();
  });

  /**
   * THE ASSERTION THAT KEEPS THE STRICT POLICY STRICT, and the reason this
   * module has two functions rather than one with a flag.
   *
   * `turbo-cache-inputs.test.ts` asks for the literal task `test` and reads
   * every assertion off the answer. Were the strict reader ever to return
   * `null` here -- the shape the tolerant one has, one careless edit away --
   * that suite would find no task, assert nothing, and report GREEN. That is
   * the vacuous pass CNCORE-143 removed from `ci-task-env.test.ts`, arriving in
   * the other suite through the helper they now share.
   */
  it("throws from the strict reader, naming the task, so a caller cannot read a plan that is not there", () => {
    expect(() => plannedTasks(UNKNOWN_TASK)).toThrow(UNKNOWN_TASK);
  });
});

/**
 * A name that is not a task name at all, which reaches turbo as an ARGUMENT.
 *
 * `ci-task-env.test.ts` scrapes its candidates out of `ci.yml`, so what arrives
 * here is not always a literal somebody chose. `run --filter=web --dry=json`
 * exits 0 and answers about a narrower graph, which is neither a plan for the
 * name asked about nor a refusal -- so without this it would come back through
 * the tolerant reader looking like an ordinary answer.
 */
describe("a name that would reach turbo as a flag", () => {
  it("is refused by both readers before anything is spawned", () => {
    for (const reader of [plannedTasks, plannedTasksIfKnown]) {
      expect(() => reader("--filter=web")).toThrow("is not a turbo task name");
    }
  });
});
