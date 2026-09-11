import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./testing/repo-root";

/**
 * ADR-0113 sets the outbound licence at `AGPL-3.0-or-later`, and the awkward
 * part is that NEITHER ARTEFACT CAN CARRY THAT STRING ON ITS OWN.
 *
 * The licence FILE cannot: the GNU text contains the substring "SPDX" zero
 * times, and GNU puts the `-only` / `-or-later` election in the notice rather
 * than in the licence. GitHub cannot either: `licensee` says outright that it
 * "does not parse these expressions", so the badge reads the deprecated bare
 * `AGPL-3.0` whatever the project elected -- Nextcloud and Mastodon both elect
 * `-or-later` and both display `AGPL-3.0`.
 *
 * So the election lives in the manifest, and this file is what stops the two
 * halves drifting apart. A `LICENSE` with no manifest declaration leaves the
 * election UNSTATED; a manifest declaration with no `LICENSE` grants nothing.
 */

const MANIFEST_LICENCE = "AGPL-3.0-or-later";

/** The first line of the GNU AGPL v3 text, used to tell it from a stub. */
const AGPL_HEADING = "GNU AFFERO GENERAL PUBLIC LICENSE";

describe("the outbound licence", () => {
  it("ships the AGPL text at the repository root, where licensee looks", () => {
    const licence = readFileSync(join(repoRoot, "LICENSE"), "utf8");
    expect(licence).toContain(AGPL_HEADING);
    expect(licence).toContain("Version 3, 19 November 2007");
  });

  it("leaves no placeholder unfilled in the how-to-apply appendix", () => {
    const licence = readFileSync(join(repoRoot, "LICENSE"), "utf8");
    expect(licence).not.toContain("<year>");
    expect(licence).not.toContain("<name of author>");
  });

  it("states the -or-later election in the manifest, which is the only place it can live", () => {
    const manifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    expect(manifest.license).toBe(MANIFEST_LICENCE);
  });

  it("carries no SPDX identifier in the licence file, so nothing reads the election from there", () => {
    const licence = readFileSync(join(repoRoot, "LICENSE"), "utf8");
    expect(licence).not.toContain("SPDX");
  });
});
