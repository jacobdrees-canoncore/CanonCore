import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

/**
 * The repo keeps its one .env beside the app, and every entry point into this
 * package needs it: the scripts, the test harness and drizzle-kit's config.
 * Resolved off this file rather than the working directory, so it does not
 * matter where the process was started.
 *
 * dotenv does not overwrite a variable already set, so CI -- which has no .env
 * and sets DATABASE_URL in the job -- is unaffected.
 */
dotenv.config({ path: fileURLToPath(new URL("../../../apps/web/.env", import.meta.url)) });
