/**
 * Seeds one item, in two orderings, into DATABASE_URL, and says where to look
 * at it.
 *
 *   pnpm db:seed
 *
 * The seed itself is `src/seed.ts`, shared with the end-to-end suite so the
 * page is proven against the same write path this gives a developer.
 */
import "../src/load-env.ts";
import { seedOneItemInTwoOrderings } from "../src/seed.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Try `pnpm db:start` first.");
  process.exit(1);
}

const { id, title, projectedTitle, placements } = await seedOneItemInTwoOrderings(connectionString);

console.log(`seeded item ${id}`);
console.log(`  title statement:  ${title}`);
console.log(`  projected column: ${projectedTitle ?? "(empty -- the projection did not run)"}`);
for (const placement of placements) {
  console.log(`  also appears in:  ${placement.containerTitle} (#${placement.position})`);
}
console.log(`  http://localhost:3001/items/${id}`);
