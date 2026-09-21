import { withoutComments } from "./without-comments";

/** One `mkdtemp` or `mkdtempSync` call, and whether the file removes what it made. */
export type TemporaryDirectory = {
  /** 1-based, so a failure names the line an editor opens at. */
  readonly line: number;
  readonly call: "mkdtemp" | "mkdtempSync";
  /** The identifier the new directory is bound to, or `null` where it is not bound at all. */
  readonly bound: string | null;
  readonly removed: boolean;
};

const CREATION = /\b(mkdtempSync|mkdtemp)\s*\(/g;

/** The identifier a call assigns to, reading back from it, or `null`. */
function bindingBefore(before: string): string | null {
  const assignment = /(?:\b(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?$/.exec(
    before,
  );
  return assignment?.[1] ?? null;
}

/** How many times a file removes what one name holds. */
function removalsOf(code: string, name: string): number {
  return [...code.matchAll(new RegExp(`\\b(?:rmSync|rm)\\s*\\(\\s*${name}\\b`, "g"))].length;
}

/** Every temporary directory a source makes, in the order it makes them. */
export function temporaryDirectoriesIn(source: string): TemporaryDirectory[] {
  // A COMMENT IS BLANKED RATHER THAN REMOVED by this reader, so the line a
  // site is reported at is still the line the file has it on.
  const code = withoutComments(source);
  const sites = [...code.matchAll(CREATION)].map((match) => {
    const before = code.slice(0, match.index);
    return {
      line: before.split("\n").length,
      call: match[1] as TemporaryDirectory["call"],
      bound: bindingBefore(before),
    };
  });

  const made = new Map<string, number>();
  for (const { bound } of sites) {
    if (bound !== null) made.set(bound, (made.get(bound) ?? 0) + 1);
  }

  return sites.map((site) => ({
    ...site,
    removed: site.bound !== null && removalsOf(code, site.bound) >= (made.get(site.bound) ?? 0),
  }));
}
