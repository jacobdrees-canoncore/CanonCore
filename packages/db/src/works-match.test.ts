import { describe, expect, it } from "vitest";

import { instalmentsOf, scoreWorkMatch } from "./index";
import labelled from "./testing/works-labelled.json";

/**
 * THE MATCHER'S GATE (ADR-0028): precision AND recall over a labelled set that
 * holds rows whose answer is NO MATCH, never accuracy.
 *
 * The set is `testing/works-labelled.json`, built for CNCORE-361 from the
 * populations CNCORE-368's finding names (`docs/research/episode-groups-and-a-
 * scoreable-match.md`): the wiki's 1963 and 2005 stories against TMDB's
 * episodes of `tv/121` and `tv/57243`. Every label cites evidence the scorer
 * never reads -- Wikidata's `P361` and `P6262`, and the wiki's `Epcount` -- so
 * the scorer cannot agree with its own label by construction.
 *
 * THE BAR IS A ONE-SIDED 95% WILSON LOWER BOUND OF 0.90 ON EACH, not a point
 * estimate. The finding's section 3.5 is why: below about fifty rows a 95%
 * observation cannot be told from an 86% one, and a point estimate would pass
 * that. Both degenerate scorers fail it on opposite metrics, which is what
 * makes the pair a gate (ADR-0028).
 */

const LOWER_BOUND = 0.9;

type Row = [
  storyTitle: string,
  storyReleased: string | null,
  episodeId: string,
  episodeTitle: string,
  episodeReleased: string | null,
  match: boolean,
  evidence: string,
];

const rows = labelled.rows as Row[];
const seasons = labelled.seasons as Record<string, string[]>;

/** Every title TMDB serves beside this episode, in its own season (`episode:121:4:5`). */
function siblingsOf(episodeId: string): string[] {
  const [, series, season] = episodeId.split(":");
  const titles = seasons[`${series}:${season}`];
  if (titles === undefined) throw new Error(`the set holds no season for ${episodeId}`);
  return titles;
}

/** What the scorer decides on one row, reading only what an import would hold. */
function applies([storyTitle, storyReleased, episodeId, episodeTitle, episodeReleased]: Row) {
  return (
    scoreWorkMatch(
      { title: storyTitle, released: storyReleased ? [storyReleased] : [], instalments: 1 },
      {
        title: episodeTitle,
        released: episodeReleased ? [episodeReleased] : [],
        instalments: instalmentsOf(episodeTitle, siblingsOf(episodeId)),
      },
    ).verdict === "apply"
  );
}

/** The one-sided 95% Wilson lower bound on a proportion (Brown, Cai and DasGupta, 2001). */
function wilsonLower(successes: number, n: number): number {
  const z = 1.6449;
  const p = successes / n;
  const centre = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return (centre - spread) / (1 + (z * z) / n);
}

describe("the works matcher's gate", () => {
  const decided = rows.map((row) => ({ match: row[5], applied: applies(row) }));
  const truePositives = decided.filter((row) => row.match && row.applied).length;
  const applied = decided.filter((row) => row.applied).length;
  const matches = decided.filter((row) => row.match).length;

  it("holds rows of both answers, enough of each to mean something", () => {
    // Finding 3.5: about a hundred of each before a bound means anything to 0.05.
    expect(matches).toBeGreaterThanOrEqual(100);
    expect(rows.length - matches).toBeGreaterThanOrEqual(100);
  });

  it("applies what is a match, precisely", () => {
    expect(wilsonLower(truePositives, applied)).toBeGreaterThanOrEqual(LOWER_BOUND);
  });

  it("applies most of what is a match", () => {
    expect(wilsonLower(truePositives, matches)).toBeGreaterThanOrEqual(LOWER_BOUND);
  });

  /*
   * THE SET IS TMDB CONTENT, and ADR-0036 caps holding any of it at six months.
   * A committed expectation is a cache no read-time check can reach, so this is
   * the check: the day the set is older than TMDB allows, it is re-taken or
   * deleted rather than silently kept.
   */
  it("is younger than TMDB's six-month ceiling", () => {
    const ageInDays = (Date.now() - Date.parse(labelled.takenOn)) / 86_400_000;
    expect(ageInDays).toBeLessThan(180);
  });
});
