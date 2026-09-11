import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The root of the repository, for the suites in this package that read files
 * outside it: `.github/workflows/ci.yml`, `pnpm-workspace.yaml`, `biome.jsonc`,
 * the root `package.json`, `README.md` and the sweep corpus under
 * `docs/research/competitor-sweep/`.
 *
 * A MODULE OF ITS OWN rather than a second export from the reader that first
 * needed it. Three of the four suites reading this path ask nothing about
 * `ci.yml`, and a suite importing a workflow reader for a path constant says
 * the two are related when they are not (CNCORE-58).
 *
 * Derived once because the depth is POSITIONAL: `../../../` is the root from
 * `src/` and is `packages/` from here, with nothing in the type system to say
 * which file it is being counted from. Every copy of it is a copy that has to
 * be re-counted by hand when the file holding it moves, which is the edit
 * CNCORE-56 met when it moved a reader down one directory.
 *
 * `resolve` is what drops the trailing separator `new URL` leaves on a
 * directory, so the constant is a path that reads back the way every other path
 * in these suites does.
 */
export const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
