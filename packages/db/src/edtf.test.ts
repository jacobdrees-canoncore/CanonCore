import { describe, expect, it } from "vitest";

import { isEdtfDate } from "./edtf";

/**
 * ADR-0073: a date value is an EDTF string and nothing else. These are the
 * cases that record names by hand, plus the ones CNCORE-29 names as what a
 * provider actually sends when it sends rubbish.
 *
 * EVERY CALL NAMES A LEVEL, because since CNCORE-47 the ceiling is an argument
 * rather than a constant in this module: `properties.validation` declares it and
 * the import passes it through (ADR-0012). `1` throughout here, because 1 is
 * what migration 7 declares for `released`, which is the only property with a
 * check and so the only level anything actually runs at.
 */
describe("whether a value is a date this catalogue accepts", () => {
  it("admits a date at every precision EDTF expresses one at", () => {
    expect(isEdtfDate("1966-10-08", 1)).toBe(true);
    expect(isEdtfDate("2007-03", 1)).toBe(true);
    expect(isEdtfDate("1966", 1)).toBe(true);
  });

  it("refuses what a provider sends when it does not send a date", () => {
    expect(isEdtfDate("soon", 1)).toBe(false);
    expect(isEdtfDate("12/03/66", 1)).toBe(false);
    expect(isEdtfDate("", 1)).toBe(false);
  });
});

/**
 * The qualifiers ADR-0073 names by hand. They are why this cannot be a date
 * parse: `198X` has no day, no month and a decade for a year, and it is a real
 * value the archive holds.
 */
describe("the levels of EDTF this catalogue accepts", () => {
  it("admits the Level 1 qualifiers ADR-0073 names as real values", () => {
    expect(isEdtfDate("1984?", 1)).toBe(true);
    expect(isEdtfDate("198X", 1)).toBe(true);
  });

  /**
   * `released` is `multiple` (migration 1), so the catalogue already says two
   * dates with two statements. A Level 2 set says it in one string instead,
   * and nothing can sort, count or compare that form.
   *
   * That argument is about THAT PROPERTY rather than about EDTF, which is why
   * the ceiling moved to `properties.validation` under CNCORE-47 -- a date
   * property whose cardinality were `single` could declare a higher one without
   * this file changing.
   */
  it("refuses a Level 2 set or list, which says in one string what two statements say", () => {
    expect(isEdtfDate("[1667,1668,1670..1672]", 1)).toBe(false);
    expect(isEdtfDate("{1960..1964}", 1)).toBe(false);
  });
});

/**
 * THE TRAP IN THE LIBRARY ITSELF, and the reason `parse` is imported rather
 * than the package's default export. That export tests `/^\d{5,}$/` against
 * its input and builds a date from it as UNIX MILLISECONDS before the grammar
 * runs, so a check written on it answers `true` for both of these and stores a
 * date in January 1970 for what a provider called a year.
 */
describe("a run of digits that is not a date", () => {
  it("refuses a bare number the library would otherwise read as a Unix timestamp", () => {
    expect(isEdtfDate("99999", 1)).toBe(false);
    expect(isEdtfDate("20071301", 1)).toBe(false);
  });

  /** A month of 13. The case a hand-rolled pattern over `\d{4}-\d{2}` admits. */
  it("refuses a month no calendar has", () => {
    expect(isEdtfDate("2007-13", 1)).toBe(false);
  });
});

/**
 * A PROVIDER'S STRING REACHES A PARSER, and nothing upstream bounds its length:
 * the wire schema is `z.array(z.string())` with no ceiling, and this runs inside
 * the import's transaction. `edtf` parses with nearley, whose cost climbs
 * superlinearly -- MEASURED on this machine, a braced list of repeated years at
 * 1k entries takes 12.8 ms, at 5k 121 ms and at 20k (100 KB) 1,244 ms of
 * blocking CPU. On the bulk path one browse carries a container's worth.
 *
 * So the length is checked BEFORE the grammar runs. The longest form this
 * catalogue accepts is 51 characters -- a date-time interval with both offsets,
 * `1966-10-08T20:00:00+05:30/1966-11-12T20:00:00+05:30` -- and the ceiling sits
 * above it with room to spare.
 */
describe("a value far too long to be a date", () => {
  it("admits the longest form this catalogue accepts", () => {
    expect(isEdtfDate("1966-10-08T20:00:00+05:30/1966-11-12T20:00:00+05:30", 1)).toBe(true);
  });

  it("refuses a string longer than any date, without parsing it", () => {
    const hostile = `{${Array(20000).fill("1900").join(",")}}`;
    expect(hostile.length).toBeGreaterThan(100_000);

    const started = performance.now();
    expect(isEdtfDate(hostile, 1)).toBe(false);
    // Generous by two orders of magnitude against the 1,244 ms an unguarded
    // parse of this same string costs: what is under test is that the grammar
    // never sees it, not the exact speed of this machine.
    expect(performance.now() - started).toBeLessThan(100);
  });
});
