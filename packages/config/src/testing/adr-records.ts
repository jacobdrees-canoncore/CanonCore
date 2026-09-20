import { readdirSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./repo-root";

const adrDirectory = join(repoRoot, "docs", "adr");

/** A record's number, the file it is in, and where that file sits. */
export type NumberedRecord = {
  /** The four digits the filename opens with, which is how a record is cited. */
  number: string;
  /** The filename alone, which is how a record excludes itself. */
  file: string;
  /** Repo-relative, the way `trackedFiles` reports a path. */
  path: string;
};

/** Every `.md` in the directory, read once. */
function markdown(): string[] {
  return readdirSync(adrDirectory).filter((file) => file.endsWith(".md"));
}

/**
 * Every record in `docs/adr/`, keyed off the four digits its filename opens
 * with.
 *
 * `docs/adr/` is the authority (`CLAUDE.md`) and records are cited by number
 * from three places -- other records as `[[0120-the-slug]]`, source comments as
 * `ADR-0120`, and tickets -- so five suites in this package had to enumerate it
 * and each wrote its own copy of this parse. `ADR-0171` carries the fold.
 *
 * IT ASKS THE TREE rather than a list somebody maintains, which is
 * `adr-numbering.test.ts`'s reason in its own words: "a record added without
 * touching this file is still covered".
 *
 * A LIST, NOT A MAP KEYED BY NUMBER, and that is the one piece of this shape
 * that had to be got right rather than merely moved. `adr-numbering.test.ts`
 * exists to catch TWO RECORDS SHARING ONE NUMBER -- measured on 2026-09-11,
 * when CNCORE-66 and CNCORE-68 both took 0120 and git merged them clean because
 * the slugs differ, which is `CLAUDE.md`'s "parallel agents produce semantic
 * contradictions that compile cleanly". A map keyed by number keeps the last of
 * a colliding pair, so a reader shaped that way would hand that suite a corpus
 * in which the defect it is looking for cannot be represented. Callers that
 * want the map build it themselves, having first been able to see the
 * collision.
 *
 * IT DOES NOT READ THE FILES. Three of the five callers want numbers or paths
 * and nothing else, and reading every record to serve them would be work most
 * of the population does not use. The two that want the text open `path`
 * themselves and parse what they each need out of it -- `adr-as-built.test.ts`
 * takes a status and a decision block, `adr-identifiers.test.ts` takes the
 * camelCase tokens -- and those parses are genuinely not the same read.
 */
export function records(): NumberedRecord[] {
  return markdown().flatMap((file) => {
    const number = /^(\d{4})-/.exec(file)?.[1];
    return number === undefined ? [] : [{ number, file, path: `docs/adr/${file}` }];
  });
}

/**
 * The `.md` files in `docs/adr/` whose names do NOT open with four digits.
 *
 * REPORTED RATHER THAN FILTERED AWAY, because `adr-numbering.test.ts` asks
 * whether every record is named with a number and can only ask it of a reader
 * that kept the ones that are not. Dropping them silently would leave that
 * suite comparing a list against itself: the same defect its own docblock
 * warns about, an assertion "satisfied by having no subject".
 */
export function unnumbered(): string[] {
  return markdown().filter((file) => !/^\d{4}-/.test(file));
}
