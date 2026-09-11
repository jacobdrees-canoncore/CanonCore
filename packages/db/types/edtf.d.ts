/**
 * `edtf` 4.11.1 ships no types and there is no `@types/edtf` on npm (checked
 * 2026-09-11: 404). Declared here rather than left as `any`, so that the one
 * entry point this repo uses is the one the compiler enforces.
 *
 * ONLY `parse` IS DECLARED, and the omission is the point. The package's
 * DEFAULT export tests `/^\d{5,}$/` against its input and builds a `Date` from
 * it as Unix milliseconds before the grammar ever runs (`src/edtf.js`), so
 * `edtf("99999")` answers a date in January 1970 and `edtf("20071301")` answers
 * one too. A check written on it would admit both. `parse` goes straight to the
 * grammar, and a declaration that names nothing else is what stops the next
 * reader reaching for the shorter import.
 */
declare module "edtf" {
  /** Which EDTF level a parse result sits at: 0, 1 or 2. */
  export interface EdtfParsed {
    type: string;
    level: number;
  }

  /**
   * Parses `input` as EDTF, or throws. `level` is a CEILING -- a result above
   * it is filtered out, and a parse with nothing left throws like a syntax
   * error does.
   */
  export function parse(input: string, constraints?: { level?: number }): EdtfParsed;
}
