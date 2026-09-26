/**
 * FOUR BEHAVIOURS, ONE FOR EACH WAY ADR-0168 FOUND AN ASSERTION GO HOLLOW.
 *
 * This is the fixture `delete-the-behaviour.test.ts` runs the delete-the-behaviour
 * run against, and nothing else imports it. Each behaviour is a whole line or run
 * of lines, so deleting it leaves a file that still parses: the run is being
 * asked about a behaviour, not about a syntax error.
 *
 * `shapes.check.ts` holds the assertions: for each behaviour, one that reaches it
 * and one that does not. The second kind is written the way the ten CNCORE-257
 * measured were, so a reader who cannot tell them from the first is the reader
 * the run exists for.
 */

/** A catalogue as a migration leaves it: `sources` seeded, no Items. */
export type Catalogue = { sources: string[]; items: string[] };

export function migrated(): Catalogue {
  return { sources: ["owner", "derived:sort-name-v1"], items: [] };
}

/** THE IMPORT, whose origin the first shape counted where a migration had already filled it. */
export function importInto(catalogue: Catalogue, titles: string[]): void {
  catalogue.sources.push("tardis.wiki");
  catalogue.items.push(...titles);
}

export type Placement = { container: string; position: number | null };

/** THE POSITIONS, which the second shape's aggregate carried and never read. */
export function placementsOf(rows: { container: string; position: number }[]): Placement[] {
  return rows.map((row) => ({
    container: row.container,
    position: row.position,
  }));
}

/** THE REFUSAL, which the third shape read through a header that says the same. */
export function page(session: string | null): string {
  const header =
    session === null ? `<header><a href="/login">Log in</a></header>` : "<header></header>";
  let main = "";
  main = session === null ? `<p>This page is the Owner's. <a href="/login">Log in</a></p>` : main;
  return `${header}<main>${main}</main>`;
}

/** The ports a thief holds after binding whatever it was named. A port of 0 names nothing. */
export function aPortThief(port: number): Set<number> {
  return port === 0 ? new Set() : new Set([port]);
}

/** THE STEP ASIDE, which the fourth shape guarded with a trigger it could never pull. */
export function serve(port: number, taken: Set<number>): number {
  let bound = port;
  if (taken.has(port)) bound = port + 1;
  return bound;
}
