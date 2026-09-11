import { z } from "zod";

import { isEdtfDate } from "./edtf";

/**
 * WHAT ONE PROPERTY'S `validation` COLUMN DECLARES, and what to do about it.
 *
 * ADR-0012 names validation among the four things the properties catalogue
 * declares, and makes "the metadata catalogue lives in the DATABASE rather than
 * in code" the test separating a sound attribute model from `wp_postmeta`. The
 * other three -- `datatype`, `value_kind`, `cardinality` -- are columns with
 * reference tables behind them. This is the fourth, and until CNCORE-47 it was
 * `{}` on every row with nothing reading it.
 *
 * THE DECLARATION IS DATA AND THE EXECUTOR IS CODE, which is not a compromise
 * but what the products this catalogue is modelled on actually do. SQL cannot
 * parse EDTF, and Shopify's database cannot run a regular expression either;
 * what lives in the metafield definition is the DECLARATION, and what runs it is
 * Shopify's code. So the catalogue answers "which properties are checked, and
 * how" -- the question a call-site callback can only be grepped for.
 *
 * A DECLARATION WITH NO CHECKER IS REFUSED, LOUDLY (see `declaredCheck`). That
 * is the failure this module exists to prevent: a row saying `{"format":"iso"}`
 * that silently admits everything is half a mechanism, and half a mechanism
 * reads as a guarded door from outside. `validation.test.ts` walks the seeded
 * catalogue and fails in CI before such a row could ever ship.
 */
const declaration = z.discriminatedUnion("format", [
  z.object({
    format: z.literal("edtf"),
    /**
     * WHICH EDTF LEVELS THE PROPERTY ACCEPTS, as a ceiling. ADR-0073 refuses
     * Level 2 for `released` on a fact about THAT PROPERTY -- its cardinality is
     * `multiple` (migration 1), so `[1667,1668]` says in one string what the
     * catalogue already says with two statements. That argument is the
     * property's, not the format's, which is why the number sits here rather
     * than as a constant beside the parser.
     */
    level: z.union([z.literal(0), z.literal(1)]),
  }),
]);

/**
 * The check this property's declaration calls for, or nothing where it declares
 * none.
 *
 * `{}` IS A DECLARATION AND ITS CONTENT IS "NOTHING IS CHECKED". Every property
 * starts there (migration 1's default), and most stay: `title` is free text and
 * there is no such thing as a malformed one. That is the difference between
 * dispatching here and dispatching on `datatype`, which CNCORE-29 refused for a
 * reason that still holds -- `url` is a seeded datatype with no check, so a
 * dispatch over datatypes reads as though every datatype were guarded. A
 * dispatch over declarations claims nothing about a property declaring `{}`.
 *
 * ANYTHING ELSE THROWS. Only the product adds a property (ADR-0029), so a
 * declaration the catalogue cannot execute is a bug in a migration rather than
 * anything a provider or an owner did -- and the two quiet answers are both
 * worse than the noise. Admitting every value makes the column decorative again;
 * refusing every value quarantines a provider's whole catalogue over a typo in a
 * migration. Neither says what is wrong.
 */
export function declaredCheck(
  property: string,
  validation: unknown,
): ((value: string) => boolean) | undefined {
  const declared = declaration.safeParse(validation);
  if (declared.success) {
    switch (declared.data.format) {
      case "edtf": {
        const { level } = declared.data;
        return (value) => isEdtfDate(value, level);
      }
    }
  }
  if (declaresNothing(validation)) return undefined;
  throw new Error(
    `property ${property} declares a validation the catalogue cannot execute: ${JSON.stringify(validation)}`,
  );
}

/**
 * Checked here as well as by `properties_validation_declares_a_format`, because
 * this module is the one that has to produce a SENTENCE about what is wrong. A
 * constraint violation from three layers down names a table and a rule; it does
 * not name the property or say what it declared.
 */
function declaresNothing(validation: unknown): boolean {
  return (
    typeof validation === "object" &&
    validation !== null &&
    !Array.isArray(validation) &&
    Object.keys(validation).length === 0
  );
}
