import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@canoncore/config/testing/repo-root";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { serverSchema } from "./schema";

/**
 * The variables in `schema` that an installation MUST set, which is every field
 * that refuses `undefined`.
 *
 * ASKED OF THE FIELD RATHER THAN READ OFF ITS TYPE. `z.ZodDefault` is one way a
 * field becomes optional and `z.ZodOptional` is another; parsing `undefined` is
 * the behaviour both of them are for, so a field that acquires a default in a
 * third way still reads as optional here.
 */
function requiredNames(schema: Record<string, z.ZodType>): string[] {
  return Object.entries(schema)
    .filter(([, field]) => !field.safeParse(undefined).success)
    .map(([name]) => name);
}

describe("the env schema, read as data", () => {
  /**
   * THE CHECK ITSELF, against fixtures rather than the real schema, for the
   * reason `docker-compose.test.ts` gives about its port reader: run only
   * against the live object it is exercised rather than tested, and it would
   * pass just as well reading nothing.
   */
  it("tells a variable that must be set from one that has a default", () => {
    expect(
      requiredNames({
        MUST_BE_SET: z.string().min(1),
        HAS_A_DEFAULT: z.string().default("something"),
        MAY_BE_ABSENT: z.string().optional(),
      }),
    ).toStrictEqual(["MUST_BE_SET"]);
  });

  /**
   * And the live schema is one this reader can answer about at all. An empty
   * object would satisfy every assertion below it by having no subject.
   */
  it("finds at least one variable an installation has to set", () => {
    expect(requiredNames(serverSchema).length).toBeGreaterThan(0);
  });
});

const readme = () => readFileSync(join(repoRoot, "README.md"), "utf8");

/**
 * The README's install section: the heading a stranger lands on, down to the
 * next heading of the same level.
 *
 * BOUNDED RATHER THAN WHOLE-FILE, which is the difference between this test and
 * one that cannot fail. `README.md` mentions `DATABASE_URL` three times in its
 * development and CI prose, so a search of the whole file finds every required
 * variable named whether or not the install section says a word about them.
 */
function installSection(contents: string = readme()): string {
  const section = /^## Installing it$([\s\S]*?)(?=^## |\Z)/m.exec(contents);
  if (!section) {
    throw new Error(
      "README.md has no `## Installing it` section. It is the one thing " +
        "awesome-selfhosted's checklist asks for by name, and this suite and that " +
        "heading are edited together.",
    );
  }
  return section[1] as string;
}

describe("the README's install section", () => {
  it("is bounded by the next heading rather than running to the end of the file", () => {
    const contents = [
      "# CanonCore",
      "## Installing it",
      "Set DATABASE_URL.",
      "## Running it",
      "Set SOMETHING_ELSE.",
      "",
    ].join("\n");

    expect(installSection(contents)).toContain("DATABASE_URL");
    expect(installSection(contents)).not.toContain("SOMETHING_ELSE");
  });

  /**
   * EVERY VARIABLE AN INSTALLATION HAS TO SET. The schema is the authority and
   * this is the document; a variable added to the first without the second is
   * one a stranger discovers when the container exits.
   */
  it("names every variable the schema requires", () => {
    const section = installSection();

    const unnamed = requiredNames(serverSchema).filter((name) => !section.includes(name));
    expect(unnamed).toStrictEqual([]);
  });
});
