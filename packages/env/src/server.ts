import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { serverSchema } from "./schema";

/**
 * A COPY OF THE ENVIRONMENT RATHER THAN THE ENVIRONMENT ITSELF (ADR-0169,
 * CNCORE-270).
 *
 * `emptyStringAsUndefined` is what makes an empty value mean unset, and t3-env
 * implements it by DELETING every empty-valued key -- from the object it is
 * handed. Handed `process.env`, reading the configuration MUTATED it: a
 * variable deliberately set empty was gone from the process afterwards, and
 * came back holding whatever `apps/web/.env` said the next time anything in
 * that process loaded `dotenv/config`, because dotenv fills an ABSENT key and
 * leaves a present one alone.
 *
 * THE INSTANCES THAT PAID FOR IT ARE ADR-0044's READ-ONLY ONES. The e2e harness
 * gives them `OWNER_PASSWORD: ""` on purpose (`apps/web/e2e/instance.ts` says
 * why), and a developer who had followed `README.md` and set a password to walk
 * a branch with handed all three of them that password instead -- so the demo
 * grew a login and two tests failed pointing at a header.
 *
 * The copy keeps the deletion on what this module reads and leaves the
 * process's own environment as its caller wrote it.
 */
export const env = createEnv({
  server: serverSchema,
  runtimeEnv: { ...process.env },
  emptyStringAsUndefined: true,
});
