import { lstatSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The markdown documents under ONE directory, with a symlinked one REFUSED
 * rather than dropped (CNCORE-204), and a symlinked directory REFUSED rather
 * than descended (CNCORE-211).
 *
 * A MODULE OF ITS OWN SINCE CNCORE-259, on `repo-root.ts`'s reason (CNCORE-58):
 * a second suite needed this corpus and wrote its own enumeration instead --
 * `readdirSync(docs, { recursive: true })` filtered on `isFile()`, which is
 * both of the wrongs below at once. Nothing reported it, because a tree with no
 * links answers the same either way. The rule and the reasons are ADR-0103's;
 * what this module adds is that there is now ONE reader to be right, rather
 * than a rule each new sweep has to be told about.
 *
 * `Dirent.isFile()` is lstat, so it is FALSE for a symlink pointing at a file
 * and `isSymbolicLink()` is true instead. Filtering on the first alone took a
 * symlinked document out of the sweeps in silence -- and the silence was wider
 * than a document going unread. `doc-line-citations.test.ts`'s `prose()` feeds
 * the `held` set that decides which PATH and bare-filename citations that sweep
 * BANS, and a target missing from it reads as HISTORY, the exemption
 * `docs/research/README.md` earns for files this tree does not hold. So a path
 * citation into a symlinked document was not merely unchecked: it was
 * affirmatively excused, by a rule that meant to excuse something else. The two
 * NUMBER forms were never affected, because record numbers are read from names
 * without `Dirent`.
 *
 * REFUSED ON CNCORE-200'S ARGUMENT, WITH A SECOND READER THE TICKET SAID A
 * DOCUMENT LACKS. `readFileSync` and every editor follow the link; git does
 * not, and stores it as mode `120000`, a blob holding the target path. So the
 * document a checkout reads at that path and the document the repository holds
 * there do not have the same lines -- the one thing these sweeps are about --
 * and no sweep can be right about a shape its readers answer two ways.
 * CNCORE-201's reason does NOT carry over: there is no placement rule here,
 * since a document's path is simply its name. The measurement, and what
 * refusing costs, are in ADR-0103 under "a symlinked markdown document has
 * lines on disk and none in git", and are NOT restated here: a figure kept in
 * two places is a figure that drifts in one of them.
 *
 * THE NAME IS READ BEFORE THE LINK IS, so what this refuses is a symlink
 * WEARING A DOCUMENT'S NAME rather than a symlink in the corpus, and a DANGLING
 * one is refused on the name alone -- a measured difference from
 * `directoriesUnder`, which drops one. No stat is taken of a document, which is
 * what keeps that one rule rather than two.
 *
 * A SYMLINKED DIRECTORY IS REFUSED TOO, AND BEFORE ANYTHING READS THROUGH IT
 * (CNCORE-211). Node's recursive `readdirSync` descends one, returning what is
 * inside as ordinary files, and takes no option not to -- so this walks the
 * tree itself and never enters a link, which is also what makes a cycle one
 * refusal rather than a read that gives up in silence. Git holds the link as a
 * blob naming its target, so node and git disagree about every path under it,
 * the same split as the document one level down. A directory wears no name to
 * read, so a stat IS taken here: only of a link, and only by a read that
 * recurses, because the root read enters no directory and a link beside the
 * root documents is nothing it sweeps. `throwIfNoEntry: false` drops a dangling
 * one, as `directoriesUnder` does, since there is nothing under it to sweep.
 * The corpus's OWN directory is the first one a recursive read enters, and
 * `docs` is an entry git holds exactly as it holds one beneath it, so it is
 * asked the same question with one `lstat`. The root read's directory is the
 * repository, which git holds no entry for, so it is not asked.
 *
 * Why refusing beats resolving, what leaving it cost, and what refusing costs
 * are in ADR-0103 under "a symlinked directory under `docs/` is descended by
 * node and held as a link by git".
 *
 * EVERY offender is named and not the first, of either kind, for the reason
 * `ungatedPackages`, `directoriesUnder` and `configFilesIn` are each named
 * rather than counted: two are two things to fix.
 *
 * Paths come back RELATIVE to `directory`, which is what lets a caller spell
 * them against whatever root it reports from.
 */
export function markdownIn(directory: string, { recursive = false } = {}): string[] {
  const documents: string[] = [];
  const linkedDocuments: string[] = [];
  const linkedDirectories: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.name.endsWith(".md") && entry.isSymbolicLink()) linkedDocuments.push(path);
      else if (entry.name.endsWith(".md") && entry.isFile()) documents.push(path);
      else if (!recursive) continue;
      else if (entry.isDirectory()) walk(path);
      else if (
        entry.isSymbolicLink() &&
        statSync(path, { throwIfNoEntry: false })?.isDirectory() === true
      ) {
        linkedDirectories.push(path);
      }
    }
  };
  if (recursive && lstatSync(directory).isSymbolicLink()) linkedDirectories.push(directory);
  else walk(directory);
  const refusal = (
    [
      [linkedDocuments, "a symlinked markdown document has lines on disk and none in git"],
      [linkedDirectories, "a symlinked directory has documents on disk and none in git"],
    ] as const
  )
    .filter(([paths]) => paths.length > 0)
    .map(([paths, why]) => `${why}, so it is refused: ${paths.join(", ")}`)
    .join("\n");
  if (refusal !== "") throw new Error(refusal);
  return documents.map((path) => relative(directory, path));
}

const PROSE = ["docs", ".claude"] as const;

export const NOT_PROSE: readonly string[] = [
  // Written and re-added by `next dev`, which says so in its own text.
  "apps/web/AGENTS.md",
];

export function proseIn(root: string): string[] {
  return [
    ...PROSE.flatMap((directory) =>
      markdownIn(join(root, directory), { recursive: true }).map((path) => join(directory, path)),
    ),
    ...markdownIn(root),
  ].sort();
}
