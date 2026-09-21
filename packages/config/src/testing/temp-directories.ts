import { withoutComments } from "./without-comments";

/**
 * One `mkdtemp` or `mkdtempSync` CALL SITE, and whether the file removes what
 * that call makes.
 *
 * A SITE RATHER THAN A DIRECTORY, which is the distinction the name carries: a
 * site inside a helper called from twenty tests makes twenty directories, and
 * this reports the one place they are made. That is also why the fix this
 * check asks for registers the removal AT the site rather than in its callers
 * -- a caller that forgets leaks, and one of three forgetting is the shape
 * CNCORE-336 found across the repository.
 */
export type TemporaryDirectorySite = {
  /** 1-based, so a failure names the line an editor opens at. */
  readonly line: number;
  readonly call: "mkdtemp" | "mkdtempSync";
  /** The identifier the new directory is bound to, or `null` where it is not bound at all. */
  readonly bound: string | null;
  /** How many sites in this file bind this same name, counting this one. */
  readonly sitesSharingItsName: number;
  /** How many removals in this file name it. */
  readonly removals: number;
  /** Whether the file removes what this site makes. See the limits below. */
  readonly removed: boolean;
};

/**
 * WHAT THIS CAN BE WRONG ABOUT, stated because a checker's holes are the part a
 * reader cannot see. It is a scan, not a parser, and it resolves no scopes.
 *
 * IT CAN PASS A SITE THAT LEAKS where the removal is present as text but never
 * runs: inside `if (false)`, inside an unreached branch, or inside a STRING --
 * `withoutComments` strips comments and deliberately keeps strings, so a suite
 * writing source-as-string fixtures can satisfy this by quoting a removal it
 * never performs. `temp-directory-cleanup.test.ts` excludes the one file in
 * this tree that does that on purpose, by name, and the hazard stands for any
 * other that starts to.
 *
 * IT CAN FAIL A SITE THAT IS CLEAN where the removal is not spelled as a call
 * naming the binding: `execFileSync("rm", ["-rf", dir])`, a shared helper taking
 * the path, or a registry of directories removed in a loop all report as leaks.
 * THE CHECK THEREFORE PINS ONE IDIOM rather than the property, and that is a
 * cost taken deliberately: CNCORE-336 asked for the `afterEach` /
 * `onTestFinished` shape already in this repository "rather than a new helper",
 * so the idiom it pins is the one the ticket chose. Extracting a helper later
 * means teaching this reader about it in the same change.
 *
 * IT SEES ONLY A BARE CALL. `fs.mkdtempSync(...)` reports as unbound, which is
 * loud; `const make = mkdtempSync` aliases past it entirely, which is not. No
 * file in this tree does either.
 */
const CREATION = /\b(mkdtempSync|mkdtemp)\s*\(/g;

/** The identifier a call assigns to, reading back from it, or `null`. */
function bindingBefore(before: string): string | null {
  const assignment = /(?:\b(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?$/.exec(
    before,
  );
  return assignment?.[1] ?? null;
}

/**
 * A name as a pattern means ITSELF.
 *
 * `$` is legal in a JavaScript identifier and is an anchor in a pattern, so a
 * name lifted out of a source file and interpolated raw stops matching the
 * thing it was taken from: `$dir` asserts end-of-input, matches nothing, and
 * reports a site the file cleans. Wrong in the loud direction, and still wrong.
 */
function asPattern(name: string): string {
  return name.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * How many times a file removes what one name holds.
 *
 * THE ARGUMENT HAS TO BE THE BINDING, which is what the trailing `[,)]` is for:
 * without it `rmSync(dir.replace("a", "b"), ...)` counts as removing `dir`,
 * and a removal of something DERIVED from the path is not a removal of it.
 */
function removalsOf(code: string, name: string): number {
  const pattern = new RegExp(`\\b(?:rmSync|rm)\\s*\\(\\s*${asPattern(name)}\\s*[,)]`, "g");
  return [...code.matchAll(pattern)].length;
}

/**
 * Whether a name's sites are all accounted for by its removals.
 *
 * ONE SITE TAKES ANY NUMBER OF REMOVALS, because with nothing else bearing the
 * name there is nothing to mis-attribute: `run-suite.test.ts` makes one
 * directory inside a helper and removes it from three `afterEach` hooks, one
 * per `describe`, and all three are removals of that one thing.
 *
 * SEVERAL SITES SHARING A NAME MUST PAIR EXACTLY, and this is the half that
 * closes a hole a plain `removals >= sites` left open. Under that rule the
 * surplus in `run-suite.test.ts` -- three removals against one site -- was
 * slack that a NEWLY ADDED site reusing the name `root` could have been absorbed
 * by in silence, which is the one thing CNCORE-336 asks this check to refuse.
 * Requiring equality once a name is shared spends that slack, and costs a file
 * whose names already pair one-to-one nothing at all.
 *
 * IT STILL CANNOT ATTRIBUTE, and equality is not proof: three sites and three
 * removals pass whether or not they pair up. What it buys is that ADDING a site
 * to a file has to come with adding its removal, which is the edit that was
 * being forgotten.
 */
function isRemoved(sites: number, removals: number): boolean {
  if (sites === 0) return false;
  return sites === 1 ? removals >= 1 : removals === sites;
}

/** Every temporary directory site a source holds, in the order it holds them. */
export function temporaryDirectoriesIn(source: string): TemporaryDirectorySite[] {
  // A COMMENT IS BLANKED RATHER THAN REMOVED by this reader, so the line a
  // site is reported at is still the line the file has it on.
  const code = withoutComments(source);
  const sites = [...code.matchAll(CREATION)].map((match) => {
    const before = code.slice(0, match.index as number);
    return {
      line: before.split("\n").length,
      call: match[1] as TemporaryDirectorySite["call"],
      bound: bindingBefore(before),
    };
  });

  const sitesPerName = new Map<string, number>();
  for (const { bound } of sites) {
    if (bound !== null) sitesPerName.set(bound, (sitesPerName.get(bound) ?? 0) + 1);
  }

  return sites.map((site) => {
    const sitesSharingItsName = site.bound === null ? 0 : (sitesPerName.get(site.bound) ?? 0);
    const removals = site.bound === null ? 0 : removalsOf(code, site.bound);
    return {
      ...site,
      sitesSharingItsName,
      removals,
      removed: isRemoved(sitesSharingItsName, removals),
    };
  });
}
