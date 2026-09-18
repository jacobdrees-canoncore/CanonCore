import { describe, expect, it } from "vitest";
import type { TestSpecification, Vitest } from "vitest/node";
import { BaseSequencer } from "vitest/node";

import { StableSequencer } from "./stable-sequencer";

const ROOT = "/repo/packages/api";

/** A file as Vitest hands one to a sequencer, carrying only what one reads. */
function aFile(path: string, project = ""): TestSpecification {
  return {
    moduleId: `${ROOT}/${path}`,
    project: { name: project, config: { sequence: { groupOrder: 0 }, isolate: true } },
  } as unknown as TestSpecification;
}

/** A run whose cache remembers the named files failing, and nothing else. */
function aRunThatRemembers(failed: readonly string[]): Vitest {
  return {
    config: { root: ROOT },
    cache: {
      getFileTestResults: (key: string) => ({
        failed: failed.some((path) => key.endsWith(path)),
        duration: 1,
      }),
      getFileStats: () => ({ size: 1 }),
    },
  } as unknown as Vitest;
}

/** A file's path below the suite root, which is what an order is read as. */
function named(file: TestSpecification): string {
  return file.moduleId.slice(`${ROOT}/`.length);
}

describe("the stable sequencer", () => {
  it("orders the files by path, whatever order they arrive in", async () => {
    const sequencer = new StableSequencer(aRunThatRemembers([]));

    const order = await sequencer.sort([
      aFile("src/routers/listing.test.ts"),
      aFile("src/import-list.test.ts"),
      aFile("src/routers/catalogue.test.ts"),
    ]);

    expect(order.map((file) => file.moduleId)).toEqual([
      `${ROOT}/src/import-list.test.ts`,
      `${ROOT}/src/routers/catalogue.test.ts`,
      `${ROOT}/src/routers/listing.test.ts`,
    ]);
  });

  it("leaves a file that failed last run where it was, which Vitest's own does not", async () => {
    const run = aRunThatRemembers(["src/routers/listing.test.ts"]);
    const files = [
      aFile("src/import-list.test.ts"),
      aFile("src/routers/catalogue.test.ts"),
      aFile("src/routers/listing.test.ts"),
    ];

    // The behaviour this class exists to neutralise, demonstrated rather than
    // described: a red file is promoted to FIRST, so the next run of the same
    // command is not the run that failed.
    const vitests = await new BaseSequencer(run).sort([...files]);
    expect(vitests.map(named)).toEqual([
      "src/routers/listing.test.ts",
      "src/import-list.test.ts",
      "src/routers/catalogue.test.ts",
    ]);

    const ours = await new StableSequencer(run).sort([...files]);
    expect(ours.map(named)).toEqual([
      "src/import-list.test.ts",
      "src/routers/catalogue.test.ts",
      "src/routers/listing.test.ts",
    ]);
  });

  it("keeps a project's files together, which is Vitest's own invariant", async () => {
    const sequencer = new StableSequencer(aRunThatRemembers([]));

    const order = await sequencer.sort([
      aFile("src/b.test.ts", "browser"),
      aFile("src/a.test.ts", "unit"),
      aFile("src/a.test.ts", "browser"),
      aFile("src/b.test.ts", "unit"),
    ]);

    expect(order.map((file) => `${file.project.name}:${named(file)}`)).toEqual([
      "browser:src/a.test.ts",
      "browser:src/b.test.ts",
      "unit:src/a.test.ts",
      "unit:src/b.test.ts",
    ]);
  });
});
