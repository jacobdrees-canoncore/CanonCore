import { readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot } from "./testing/repo-root";

/**
 * TURBO SHARES ITS CACHE ACROSS GIT WORKTREES BY DEFAULT, and this repo builds
 * by dispatching a worktree per ticket (ADR-0051), so the default hands one
 * agent's result to every other agent. ADR-0127 records the decision; this is
 * the line of config that carries it.
 *
 * Turborepo's configuration reference (turborepo.dev/docs/reference/configuration,
 * read 2026-09-13, turbo 2.10.12) is explicit about both halves:
 *
 *   "When no `cacheDir` is specified and you're working in a Git worktree,
 *   Turborepo automatically shares the cache with the main worktree. [...] Cache
 *   artifacts are restored without rewriting their contents, so outputs
 *   containing absolute worktree paths can point to another checkout after a
 *   cache hit. Setting an explicit relative `cacheDir`, such as `.turbo/cache`,
 *   resolves from the root of the current worktree and disables sharing, giving
 *   each worktree its own local cache."
 *
 * WHY A TEST AND NOT ONLY A COMMENT. The value that switches this off is
 * `.turbo/cache`, which is character-for-character turbo's documented DEFAULT.
 * So the line reads as a no-op to anybody tidying, and deleting it restores the
 * sharing silently -- no error, no changed hash, just another worktree's green.
 * That is the same shape as the 5432 the compose file must not publish
 * (`packages/db/src/docker-compose.test.ts`): a config value whose absence is
 * invisible until it has already served a wrong answer.
 *
 * IT ASKS THE FILE because turbo will not answer. `--dry=json` reports a task's
 * hash and cache status but not the directory; `turbo info` reports the CLI,
 * the platform and the daemon; `turbo query` exposes packages, files and tasks.
 * All three checked on 2026-09-13. Nothing short of running a task and watching
 * the filesystem observes the cache directory, and a nested `turbo run` inside a
 * turbo task is a cost and a collision this guard is not worth. So the config is
 * the seam, and the behaviour it produces was measured once, in CNCORE-138's PR.
 */
const turboConfigFile = join(repoRoot, "turbo.json");

type TurboConfig = { cacheDir?: unknown };

/**
 * `turbo.json` is JSONC -- `packages/config/turbo.json` carries the comment
 * explaining why its own test task is uncached -- so the key this file guards
 * can be explained where it is written.
 *
 * NO JSONC PARSER IS AVAILABLE TO DEPEND ON, which is narrower than "none is in
 * the tree" and is the accurate claim. Checked 2026-09-13: `pnpm-workspace.yaml`'s
 * catalogue, which pins every third-party version this repo declares, has none,
 * and the lockfile has no `jsonc-parser`, `strip-json-comments` or `comment-json`.
 * It DOES carry `json5`, which parses both comments and trailing commas -- but
 * transitively, under `@babel/core` and `tsconfig-paths`. Importing it would be
 * depending on a package nothing here declares, held only by whatever those two
 * happen to need next, which the frozen lockfile (ADR-0106) exists to keep out of
 * a diff nobody reviewed.
 */
function parseTurboConfig(text: string): TurboConfig {
  return JSON.parse(withoutComments(text)) as TurboConfig;
}

/**
 * Comments removed by walking the text, because the only thing that makes this
 * more than a pair of regexes is knowing when a `/` is inside a string.
 */
function withoutComments(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);

    if (inString) {
      out += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') {
      inString = true;
      out += character;
      continue;
    }

    if (character === "/" && text.charAt(index + 1) === "/") {
      while (index < text.length && text.charAt(index) !== "\n") index += 1;
      out += "\n";
      continue;
    }

    if (character === "/" && text.charAt(index + 1) === "*") {
      index += 2;
      while (index < text.length && !(text.charAt(index) === "*" && text.charAt(index + 1) === "/"))
        index += 1;
      index += 1;
      // A SPACE rather than nothing, so a comment between two tokens cannot weld
      // them into a third: `[1/*x*/2]` is the one input that would otherwise
      // parse, as `[12]`, instead of failing.
      out += " ";
      continue;
    }

    // JSONC permits a trailing comma and turbo accepts one; `JSON.parse` does
    // not. Dropped here rather than left to throw, because a legal edit to
    // `turbo.json` should not fail this guard with a position in a SyntaxError
    // instead of an answer about `cacheDir`.
    if (character === "}" || character === "]") out = out.replace(/,\s*$/, "");

    out += character;
  }

  return out;
}

/**
 * Whether a declared `cacheDir` names a directory of THIS checkout's own.
 *
 * The docs' word is "relative", and relative is necessary rather than
 * sufficient: `../` is relative too and lands in the sibling worktree.
 */
function staysInsideCheckout(cacheDir: unknown): boolean {
  if (typeof cacheDir !== "string" || cacheDir === "" || isAbsolute(cacheDir)) return false;

  const within = relative(repoRoot, resolve(repoRoot, cacheDir));
  // The first SEGMENT, not a prefix: `..cache` starts with `..` and is an
  // ordinary directory of this checkout.
  return within !== "" && within.split(sep)[0] !== ".." && !isAbsolute(within);
}

function readTurboConfig(): TurboConfig {
  return parseTurboConfig(readFileSync(turboConfigFile, "utf8"));
}

describe("the turbo cache directory", () => {
  it("is read from a file that may carry the comment explaining it", () => {
    // A `//` inside a STRING is what a naive stripper eats, and this very file
    // opens with one: the `$schema` URL. Fixtures rather than only the real
    // file, so the reader is tested and not merely exercised -- the same reason
    // `docker-compose.test.ts` builds its 5432 cases by hand.
    expect(
      parseTurboConfig(`{
  // The cache is per worktree.
  "$schema": "https://turbo.build/schema.json",
  "cacheDir": ".turbo/cache"
}`),
    ).toStrictEqual({ $schema: "https://turbo.build/schema.json", cacheDir: ".turbo/cache" });

    expect(parseTurboConfig('{ /* why */ "cacheDir": ".turbo/cache" }')).toStrictEqual({
      cacheDir: ".turbo/cache",
    });

    // A declaration that has been commented OUT is not a declaration, which is
    // the way this guard is likeliest to be defeated by accident.
    expect(
      parseTurboConfig(`{
  // "cacheDir": ".turbo/cache",
  "ui": "tui"
}`),
    ).toStrictEqual({ ui: "tui" });

    // A trailing comma is legal JSONC and turbo accepts one; a comma INSIDE a
    // string is not one, and survives.
    expect(
      parseTurboConfig(`{
  "tasks": { "build": {}, },
  "ui": "tui,",
}`),
    ).toStrictEqual({ tasks: { build: {} }, ui: "tui," });

    // The only input that would weld two tokens into a third if a block comment
    // left nothing behind: this must fail rather than read back as 12.
    expect(() => parseTurboConfig('{ "a": [1/* x */2] }')).toThrow();
  });

  it("is declared, because leaving it unset shares the cache with the main worktree", () => {
    expect(readTurboConfig().cacheDir).toBeTypeOf("string");
  });

  it("resolves inside the checkout running the task, rather than beside another one", () => {
    // The three ways the declaration can be present and still share. An
    // ABSOLUTE path aims every worktree at one directory again, which is the
    // default wearing a different spelling; a climb does the same thing by
    // arithmetic, and `../cncore-99/...` is what that looks like when it is a
    // neighbouring ticket's worktree it lands in.
    expect(staysInsideCheckout(".turbo/cache")).toBe(true);
    expect(staysInsideCheckout("node_modules/.cache/turbo")).toBe(true);
    expect(staysInsideCheckout("/Users/shared/.turbo/cache")).toBe(false);
    expect(staysInsideCheckout("../.turbo/cache")).toBe(false);
    expect(staysInsideCheckout("../cncore-99-provider-settings/.turbo/cache")).toBe(false);
    expect(staysInsideCheckout(".turbo/../../elsewhere")).toBe(false);
    expect(staysInsideCheckout(undefined)).toBe(false);
    // Starts with `..` and climbs nowhere.
    expect(staysInsideCheckout("..cache/turbo")).toBe(true);

    expect(staysInsideCheckout(readTurboConfig().cacheDir)).toBe(true);
  });
});
