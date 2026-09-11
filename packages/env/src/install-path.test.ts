import { existsSync, readFileSync } from "node:fs";
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

const INSTALL_HEADING = "## Installing it";

/**
 * The README's install section: the heading a stranger lands on, down to the
 * next heading of the same level.
 *
 * BOUNDED RATHER THAN WHOLE-FILE, which is the difference between this test and
 * one that cannot fail. `README.md` mentions `DATABASE_URL` three times in its
 * development and CI prose, so a search of the whole file finds every required
 * variable named whether or not the install section says a word about them.
 *
 * FOUND AND SLICED RATHER THAN CAPTURED BY ONE REGEX, because the regex that did
 * it was wrong in two ways at once and passed anyway. It ended `(?=^## |\Z)`,
 * and JAVASCRIPT HAS NO `\Z`: in a regex literal that is an identity escape for
 * the LETTER Z, which Biome then formatted down to a bare `Z` and made look
 * deliberate. So the section ran to the next `## ` or to the first capital Z,
 * whichever came first -- and with no later heading at all it matched nothing,
 * so this function reported a section that was plainly there as missing. Both
 * are fixtures below. A heading search and a slice cannot express either
 * mistake.
 */
function installSection(contents: string = readme()): string {
  const lines = contents.split("\n");
  const start = lines.indexOf(INSTALL_HEADING);
  if (start === -1) {
    throw new Error(
      `README.md has no \`${INSTALL_HEADING}\` section. It is the one thing ` +
        "awesome-selfhosted's checklist asks for by name, and this suite and that " +
        "heading are edited together.",
    );
  }

  const after = lines.slice(start + 1);
  const next = after.findIndex((line) => line.startsWith("## "));
  return (next === -1 ? after : after.slice(0, next)).join("\n");
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
   * THE TWO CASES THE OLD TERMINATOR GOT WRONG, kept as fixtures rather than as
   * a sentence in a commit message. The first passed only because `## Layout`
   * happened to follow the section; the second truncated it at a letter.
   */
  it("reads a section that is the last thing in the file", () => {
    expect(installSection([INSTALL_HEADING, "Set DATABASE_URL.", ""].join("\n"))).toContain(
      "DATABASE_URL",
    );
  });

  it("is not ended by a capital Z in the prose", () => {
    const contents = [INSTALL_HEADING, "Zero setup. Set DATABASE_URL.", "## Layout", ""].join("\n");

    expect(installSection(contents)).toContain("DATABASE_URL");
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
   * AND THE GAP BETWEEN THE TWO, which the assertion above accepts and should
   * not. It takes "the compose file sets it" as an honest home, and that is
   * true of `PROVIDER_ALLOWLIST` whether or not the sample file still mentions
   * it -- because compose sets it FROM the installer's environment. Delete the
   * variable and its explanation from `.env.example` and every check above goes
   * on passing, while the one setting a self-hoster has to be told about
   * silently stops being documented.
   *
   * SO THE RULE IS READ OFF THE VALUE RATHER THAN THE KEY. `PROVIDER_ALLOWLIST:
   * ${PROVIDER_ALLOWLIST:-}` interpolates, so it is the installation's to set
   * and the sample file owes them a line about it. `DATABASE_URL`'s value names
   * `POSTGRES_PASSWORD` and never `DATABASE_URL`, so it is composed FOR them and
   * the sample file must not offer it -- an offer compose would ignore, which
   * the assertion below this one already refuses.
   */
  it("offers every schema variable an installation is the one to set", () => {
    const environment = appService().environment ?? {};
    const offered = new Set(sampleVariables());

    const undocumented = Object.keys(serverSchema).filter(
      (name) =>
        interpolatedByCompose(String(environment[name] ?? "")).includes(name) && !offered.has(name),
    );
    expect(undocumented).toStrictEqual([]);
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

/**
 * Every file the README tells a stranger to download, as the path inside this
 * repository that the URL names.
 *
 * THE TWO URLS ARE THE ONLY PART OF THE INSTALL PATH THAT IS RESTATED RATHER
 * THAN DERIVED, and they are restated in prose, which is where a rename goes to
 * hide. `compose.yaml` moving or being renamed leaves the README pointing at a
 * 404, and the person who finds out is the stranger following it -- the one
 * audience who cannot look in the repository to see what happened.
 *
 * WHAT THIS CANNOT CHECK is that the URL RESOLVES. Every suite here installs the
 * network gate, so an outbound request throws rather than reaching GitHub, and
 * a test that needed the network would be a test that fails on a train. The
 * half that is checkable offline is the half that actually rots: the path.
 */
function downloadedFiles(section: string = installSection()): {
  owner: string;
  repository: string;
  ref: string;
  path: string;
}[] {
  return [
    ...section.matchAll(
      /https:\/\/raw\.githubusercontent\.com\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)\/(\S+?)(?=["'\s]|$)/g,
    ),
  ].map((url) => ({
    owner: url[1] as string,
    repository: url[2] as string,
    ref: url[3] as string,
    path: url[4] as string,
  }));
}

describe("the files the README tells a stranger to download", () => {
  it("finds each one in the section's prose", () => {
    const found = downloadedFiles(
      [
        "curl -fsSLO https://raw.githubusercontent.com/owner/repo/main/compose.yaml",
        "curl -fsSL -o .env https://raw.githubusercontent.com/owner/repo/main/.env.example",
      ].join("\n"),
    );

    expect(found).toStrictEqual([
      { owner: "owner", repository: "repo", ref: "main", path: "compose.yaml" },
      { owner: "owner", repository: "repo", ref: "main", path: ".env.example" },
    ]);
  });

  it("names at least the compose file and the sample environment file", () => {
    expect(
      downloadedFiles()
        .map(({ path }) => path)
        .sort(),
    ).toStrictEqual([".env.example", "compose.yaml"]);
  });

  it("names a path that exists in this repository", () => {
    const missing = downloadedFiles()
      .map(({ path }) => path)
      .filter((path) => !existsSync(join(repoRoot, path)));

    expect(missing).toStrictEqual([]);
  });

  /**
   * AND THE REPOSITORY THEY COME FROM IS THE ONE THE IMAGE OFFERS ITS SOURCE
   * FROM, taken off the `Dockerfile`'s label rather than restated here. That
   * label is how somebody holding only a pulled image finds this code (ADR-0113),
   * so the two are the same statement and a fork that changes one changes both.
   */
  it("comes from the repository the image names as its source", () => {
    const source =
      /org\.opencontainers\.image\.source="https:\/\/github\.com\/([^/]+)\/([^"]+)"/.exec(
        readFileSync(dockerfile, "utf8"),
      );
    if (!source) throw new Error("the Dockerfile states no image source label");

    const elsewhere = downloadedFiles().filter(
      ({ owner, repository }) =>
        owner.toLowerCase() !== (source[1] as string).toLowerCase() ||
        repository.toLowerCase() !== (source[2] as string).toLowerCase(),
    );
    expect(elsewhere).toStrictEqual([]);
  });
});

describe("what the README's install section says about the allowlist", () => {
  /**
   * THE FOURTH STATEMENT OF ONE FACT, and the one that was unpinned. `schema.ts`,
   * `compose.yaml`, `.env.example` and this section all say that an empty
   * allowlist refuses every Provider; the suite held two of them. That is
   * CNCORE-50's four-assertions-one-decision shape, and the cost here is a
   * self-hoster reading the empty default as "nothing restricted yet", which is
   * the meaning exactly backwards.
   */
  it("says that an empty allowlist refuses every Provider", () => {
    const section = installSection().toLowerCase();

    expect(section).toContain("provider_allowlist");
    expect(section).toMatch(/empty refuses every provider/);
  });
});
