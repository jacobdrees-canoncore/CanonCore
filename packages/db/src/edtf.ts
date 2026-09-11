/// <reference path="../types/edtf.d.ts" />
// The reference is what carries the declaration into EVERY program that
// compiles this file, not just `packages/db`'s own. An ambient `declare module`
// reaches a project only through its `include`, so without this line
// `@canoncore/api` -- which typechecks this file across the workspace import --
// fails on TS7016 while `pnpm --filter @canoncore/db typecheck` passes.
import { parse } from "edtf";

/**
 * The longest a value may be and still be worth parsing, in characters.
 *
 * A PROVIDER'S STRING REACHES A PARSER HERE, and nothing upstream bounds it:
 * the wire schema is `z.array(z.string())` with no ceiling on the string or the
 * array, and this runs inside the import's TRANSACTION. `edtf` parses with
 * nearley, an Earley parser whose cost climbs superlinearly -- MEASURED against
 * this package: a braced list of repeated years costs 12.8 ms at 1,000 entries,
 * 121 ms at 5,000 and 1,244 ms at 20,000 (100 KB) of blocking CPU. One browse
 * carries a container's worth of values, so an allowlisted provider that is
 * buggy or hostile stalls the import and everything queued behind it.
 *
 * 64 IS MEASURED, NOT PICKED. The longest form this catalogue accepts is 51
 * characters -- `1966-10-08T20:00:00+05:30/1966-11-12T20:00:00+05:30`, a
 * date-time interval carrying both offsets -- and every other level-0 and
 * level-1 shape is shorter. The headroom is for a form nobody has sent yet.
 *
 * WHAT THIS COSTS: an EDTF letter-prefixed year is unbounded in the
 * specification, so `Y` followed by sixty digits is legal and is refused here.
 * It is QUARANTINED rather than lost, exactly as a level-2 set is, so a provider
 * that ever sends one leaves a row saying so instead of a silence.
 */
const LONGEST_WORTH_PARSING = 64;

/**
 * Whether this string is a date ADR-0073 recognises.
 *
 * A PARSE, NOT A PATTERN. EDTF is a specification with levels, intervals,
 * qualification and unspecified digits; a regular expression over it looks
 * finished long before it is, and the shape it gets wrong is the one nobody
 * writes a test for. `edtf` is the Library-of-Congress-format parser the
 * ecosystem uses, and it refuses `2007-13` -- a month of 13, which a naive
 * pattern admits.
 *
 * THE LEVEL IS AN ARGUMENT AND NOT A CONSTANT HERE (CNCORE-47). It was a
 * constant in this file, and ADR-0073's argument for its value of 1 is a fact
 * about `released` rather than about EDTF: that property's cardinality is
 * `multiple` (migration 1), so a Level 2 set says in ONE string what two
 * statements already say. A fact about a property belongs to the property, so
 * the ceiling comes from `properties.validation` (ADR-0012) and arrives here as
 * a number.
 *
 * Level 1 is what admits `1984?` and `198X`, which ADR-0073 names as real
 * values, and is the whole reason this is a parse rather than a date parse.
 */
export function isEdtfDate(value: string, level: 0 | 1): boolean {
  // THE LENGTH FIRST, so the grammar never sees a string that cannot be a date
  // however it is shaped. Cheap, and it is the whole of the defence above.
  if (value.length > LONGEST_WORTH_PARSING) return false;
  try {
    parse(value, { level });
    return true;
  } catch {
    return false;
  }
}
