/**
 * WHETHER TWO PROVIDERS' RECORDS DESCRIBE ONE WORK (ADR-0026), scored from what
 * each says about itself and nothing else.
 *
 * PURE, and deliberately: the scorer is what ADR-0028's gate measures, over a
 * labelled set in `testing/works-labelled.json`, and a scorer that read the
 * database could not be measured without one.
 *
 * THE COMPONENT SIGNALS ARE RETURNED BESIDE THE TOTAL, because ADR-0028 says a
 * 0.8 cannot say which signal fired. A reader offered a candidate sees which
 * of title, date and parts carried it.
 */

/** What one side says about a work, as the catalogue holds it. */
export interface WorkEvidence {
  title: string;
  /** EDTF strings, as `released` statements hold them. */
  released: string[];
  /**
   * How many of its own records this Provider holds the work as: 1 for a
   * story or a single episode, 4 for `The Tenth Planet (1)` to `(4)`. See
   * `partsOf`.
   */
  parts: number;
}

export interface WorkMatchSignals {
  /**
   * `same` once a trailing parenthetical, case, diacritics and punctuation are
   * set aside; `subtitle` where one side is what follows the other's last
   * colon (`Children in Need: Born Again`); otherwise `differs`.
   */
  title: "same" | "subtitle" | "differs";
  /** `unknown` where either side states no date to the day. */
  released: "same" | "differs" | "unknown";
  /**
   * `disagree` where one side holds the work as several parts and the other
   * as one record. That is never a match, whatever the title and date say
   * (CNCORE-368's finding, section 3.2): part 1 of a story usually carries the
   * story's title and its date.
   */
  parts: "agree" | "disagree";
}

export type WorkMatchVerdict = "apply" | "offer" | "discard";

export interface WorkMatchScore {
  score: number;
  signals: WorkMatchSignals;
  verdict: WorkMatchVerdict;
}

/**
 * ADR-0027's two bars. At or above `high` a match applies on its own; below
 * `low` it is discarded; between, it is offered to the Owner and never applied.
 *
 * SET AGAINST THE LABELLED SET, not chosen: each combination of signals scores
 * one fixed number below, and the bars sit where the gate in
 * `works-match.test.ts` holds.
 */
export const WORK_MATCH_BARS = { high: 0.9, low: 0.5 } as const;

/** Every combination of title and date, scored. `parts: disagree` is always 0. */
const SCORES: Record<WorkMatchSignals["title"], Record<WorkMatchSignals["released"], number>> = {
  same: { same: 1, unknown: 0.6, differs: 0.3 },
  subtitle: { same: 0.7, unknown: 0.3, differs: 0 },
  differs: { same: 0, unknown: 0, differs: 0 },
};

export function scoreWorkMatch(one: WorkEvidence, other: WorkEvidence): WorkMatchScore {
  const signals: WorkMatchSignals = {
    title: titleSignal(one.title, other.title),
    released: releasedSignal(one.released, other.released),
    parts: one.parts === other.parts ? "agree" : "disagree",
  };
  const score = signals.parts === "disagree" ? 0 : SCORES[signals.title][signals.released];
  return { score, signals, verdict: verdictOf(score) };
}

function verdictOf(score: number): WorkMatchVerdict {
  if (score >= WORK_MATCH_BARS.high) return "apply";
  if (score >= WORK_MATCH_BARS.low) return "offer";
  return "discard";
}

/**
 * How many parts a Provider holds this record's work as, read off its own
 * titles: the siblings it serves in the same Container that carry the same
 * title once a trailing `(n)` is set aside.
 *
 * TMDB'S OWN CONVENTION, MEASURED rather than assumed: `tv/121` season 4 is
 * `The Smugglers (1)` to `(4)`, then `The Tenth Planet (1)` to `(4)` (read
 * 2026-09-26). A title with no `(n)` is one part. So `Army of Ghosts (1)` and
 * `Doomsday (2)`, which the wiki holds as two stories, are one part each.
 *
 * WHAT IT CANNOT SEE: the 1963 series' first three seasons title each part on
 * its own (`An Unearthly Child`, `The Cave of Skulls`), so a story from them
 * reads as one part. The labelled set holds those rows and the gate measures
 * the cost rather than this comment arguing it away.
 */
export function partsOf(title: string, siblings: readonly string[]): number {
  const numbered = PART_NUMBER.exec(title);
  if (numbered === null) return 1;
  const story = numbered[1];
  return siblings.filter((sibling) => PART_NUMBER.exec(sibling)?.[1] === story).length;
}

/** `The Tenth Planet (1)`: the story's title, then a part number in brackets. */
const PART_NUMBER = /^(.*\S)\s*\(\d+\)$/;

function titleSignal(one: string, other: string): WorkMatchSignals["title"] {
  const a = normalised(one);
  const b = normalised(other);
  if (a === b) return "same";
  if (a === subtitleOf(other) || subtitleOf(one) === b) return "subtitle";
  return "differs";
}

function subtitleOf(title: string): string | null {
  const colon = title.lastIndexOf(":");
  return colon === -1 ? null : normalised(title.slice(colon + 1));
}

/**
 * A title with its source's plumbing set aside: one trailing parenthetical
 * (`(TV story)`, `(2)`), case, diacritics, and punctuation, with `&` read as
 * `and` (`Love & Monsters`).
 */
function normalised(title: string): string {
  return title
    .replace(/\s*\([^()]*\)\s*$/, "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function releasedSignal(one: string[], other: string[]): WorkMatchSignals["released"] {
  const days = (dates: string[]) => dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
  const a = days(one);
  const b = days(other);
  if (a.length === 0 || b.length === 0) return "unknown";
  return a.some((date) => b.includes(date)) ? "same" : "differs";
}
