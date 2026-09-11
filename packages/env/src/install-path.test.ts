import { readFileSync } from "node:fs";
import { join } from "node:path";
import { allSteps, workflow } from "@canoncore/config/testing/ci-workflow";
import { repoRoot } from "@canoncore/config/testing/repo-root";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
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
  const section = /^## Installing it$([\s\S]*?)(?=^## |Z)/m.exec(contents);
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

const sampleFile = join(repoRoot, ".env.example");
const composeFile = join(repoRoot, "compose.yaml");
const dockerfile = join(repoRoot, "Dockerfile");

type Compose = {
  services?: Record<string, { image?: string; environment?: Record<string, string> }>;
};

const compose = (contents: string = readFileSync(composeFile, "utf8")) =>
  parse(contents) as Compose;

/** The service that runs CanonCore itself, as opposed to the database beside it. */
const APP_SERVICE = "canoncore";

function appService(parsed: Compose = compose()) {
  const service = parsed.services?.[APP_SERVICE];
  if (!service) {
    throw new Error(
      `compose.yaml has no \`${APP_SERVICE}\` service, so nothing here knows which container ` +
        "the app's environment belongs to",
    );
  }
  return service;
}

/**
 * The variables `.env.example` offers an installation, which is every
 * assignment at the start of a line.
 *
 * COMMENTS ARE NOT ASSIGNMENTS, and that distinction is the whole reader: this
 * file explains each variable at length above it, and prose mentioning
 * `DATABASE_URL` must not read as the file offering it.
 */
function sampleVariables(contents: string = readFileSync(sampleFile, "utf8")): string[] {
  return [...contents.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1] as string);
}

/** Every variable `compose.yaml` interpolates, in any of the `${...}` forms. */
function interpolatedByCompose(contents: string = readFileSync(composeFile, "utf8")): string[] {
  return [
    ...new Set(
      [...contents.matchAll(/\$\{([A-Z][A-Z0-9_]*)[:?\-}]/g)].map((match) => match[1] as string),
    ),
  ];
}

/**
 * The variables the IMAGE already sets, read off the `Dockerfile`'s `ENV` lines.
 *
 * The third way a variable is accounted for, and the one that is invisible from
 * the install directory: `NODE_ENV` is `production` in the image, so a sample
 * file offering it would be offering to override a value the image is entitled
 * to decide.
 */
function setByTheImage(contents: string = readFileSync(dockerfile, "utf8")): string[] {
  return [...contents.matchAll(/^ENV\s+(.+)$/gm)].flatMap((line) =>
    [...(line[1] as string).matchAll(/([A-Z][A-Z0-9_]*)=/g)].map((pair) => pair[1] as string),
  );
}

describe("the sample environment file and the schema", () => {
  it("reads assignments out of a sample file without reading its prose", () => {
    expect(
      sampleVariables(
        ["# Set DATABASE_URL yourself.", "POSTGRES_PASSWORD=", "", "#CANONCORE_PORT=3000"].join(
          "\n",
        ),
      ),
    ).toStrictEqual(["POSTGRES_PASSWORD"]);
  });

  it("reads every interpolation form compose uses", () => {
    expect(
      interpolatedByCompose(
        [
          // biome-ignore-start lint/suspicious/noTemplateCurlyInString: Compose's own interpolation syntax, quoted on purpose.
          "      A: ${PLAIN}",
          "      B: ${WITH_DEFAULT:-3000}",
          "      C: ${REQUIRED:?say something}",
          "      D: postgresql://u:${IN_THE_MIDDLE}@host/db",
          // biome-ignore-end lint/suspicious/noTemplateCurlyInString: back to ordinary strings.
        ].join("\n"),
      ).sort(),
    ).toStrictEqual(["IN_THE_MIDDLE", "PLAIN", "REQUIRED", "WITH_DEFAULT"]);
  });

  it("reads the variables an image sets, one line or several to a line", () => {
    expect(
      setByTheImage("ENV NODE_ENV=production\nENV PORT=3000 HOSTNAME=0.0.0.0\n"),
    ).toStrictEqual(["NODE_ENV", "PORT", "HOSTNAME"]);
  });

  /**
   * THE FIRST DIRECTION: nothing the schema declares is unreachable.
   *
   * A variable added to the schema has exactly three honest homes -- the sample
   * file an installation edits, the compose file that composes it for them, or
   * the image that already decided it. A fourth outcome, which this refuses, is
   * a variable that exists in the schema and in no document at all: it takes
   * its default silently, and the person it was added for never learns it is
   * there.
   */
  it("accounts for every variable the schema declares", () => {
    const accounted = new Set([
      ...sampleVariables(),
      ...Object.keys(appService().environment ?? {}),
      ...setByTheImage(),
    ]);

    const unaccounted = Object.keys(serverSchema).filter((name) => !accounted.has(name));
    expect(unaccounted).toStrictEqual([]);
  });

  /**
   * THE OTHER DIRECTION, which is the half that rots quietly. A variable left
   * in the sample file after the compose file stops reading it is a setting an
   * installation can type, restart for, and watch do nothing -- and it reads as
   * a feature rather than as dead text, because it is documented.
   */
  it("offers no variable in the sample file that the compose file ignores", () => {
    const read = new Set(interpolatedByCompose());

    const inert = sampleVariables().filter((name) => !read.has(name));
    expect(inert).toStrictEqual([]);
  });
});

/**
 * The comment block sitting directly above `name=` in the sample file, with the
 * `#` markers stripped.
 *
 * CONTIGUOUS, so a blank line ends it: a comment explaining the variable above
 * is not an explanation of this one, and a reader that walked past a blank line
 * would credit every variable with its neighbour's documentation.
 */
function commentAbove(name: string, contents: string = readFileSync(sampleFile, "utf8")): string {
  const lines = contents.split("\n");
  const at = lines.findIndex((line) => line.startsWith(`${name}=`));
  if (at === -1) throw new Error(`${sampleFile} offers no ${name}`);

  const comment: string[] = [];
  for (let above = at - 1; above >= 0 && lines[above]?.startsWith("#"); above -= 1) {
    comment.unshift((lines[above] as string).replace(/^#\s?/, ""));
  }
  return comment.join("\n");
}

describe("what the sample environment file explains", () => {
  it("takes the contiguous comment above a variable and no further", () => {
    const contents = [
      "# About the first one.",
      "FIRST=",
      "",
      "# About the second one,",
      "# over two lines.",
      "SECOND=",
    ].join("\n");

    expect(commentAbove("FIRST", contents)).toBe("About the first one.");
    expect(commentAbove("SECOND", contents)).toBe("About the second one,\nover two lines.");
  });

  it("explains every variable it offers", () => {
    const unexplained = sampleVariables().filter((name) => commentAbove(name).trim() === "");
    expect(unexplained).toStrictEqual([]);
  });

  /**
   * THE ONE THE TICKET NAMES, and the reason it is singled out: ADR-0034 makes
   * the empty value REFUSE EVERY PROVIDER, which is the safe end of the failure
   * and is completely silent. An installation that reads the empty default as
   * "no restriction yet" has the meaning exactly backwards, and the only place
   * that can be corrected before it happens is here.
   */
  it("says that an empty PROVIDER_ALLOWLIST refuses every provider", () => {
    const explanation = commentAbove("PROVIDER_ALLOWLIST").toLowerCase();

    expect(explanation).toMatch(/empty/);
    expect(explanation).toMatch(/refuses every provider/);
  });
});

/**
 * The image the install path pulls, split into the repository half and the tag.
 *
 * ONE IDENTITY, ONE DERIVATION, which is provider-wiki's own recorded defect
 * (CNCORE-45) rather than a hypothetical. `ci.yml` writes the published name
 * once and `image.test.ts` holds the workflow's four uses of it to that one
 * place; this file is the FIFTH use and the only one outside the workflow.
 * Rename the package and the push writes the new name while `compose.yaml` goes
 * on telling strangers to pull the old one, which fails for every one of them
 * and for nobody who tests it.
 */
function installedImage(): { repository: string; tag: string } {
  const image = appService().image;
  const named = /^(.+):([^:/]+)$/.exec(image ?? "");
  if (!named) {
    throw new Error(
      `compose.yaml's \`${APP_SERVICE}\` service names the image ${JSON.stringify(image)}, ` +
        "which is not <repository>:<tag>. An untagged image means `latest` implicitly, and an " +
        "install path is not the place to leave that to a default.",
    );
  }
  return { repository: named[1] as string, tag: named[2] as string };
}

describe("the image the install path pulls", () => {
  it("is the one ci.yml publishes, taken from the workflow rather than restated", () => {
    expect(installedImage().repository).toBe(workflow().env?.IMAGE);
  });

  /**
   * AND THE TAG IS ONE THAT WORKFLOW PRODUCES. The repository half can be right
   * while the tag is a string nothing ever pushes, which fails identically for
   * a stranger -- `manifest unknown` -- and is invisible from the file naming
   * it. `latest` is published from the default branch alone, which is what
   * makes it the tag an install path can name.
   */
  it("carries a tag the workflow's metadata step actually writes", () => {
    const { tag } = installedImage();

    const produced = allSteps(workflow())
      .filter(({ step }) => step.uses?.startsWith("docker/metadata-action"))
      .flatMap(({ step }) => [
        ...String(step.with?.tags ?? "").matchAll(/type=raw,value=([^,\s]+)/g),
      ])
      .map((match) => match[1] as string);

    expect(produced).toContain(tag);
  });
});
