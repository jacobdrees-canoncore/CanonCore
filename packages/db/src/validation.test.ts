import { beforeAll, describe, expect, it } from "vitest";

import { type Database, properties } from "./index";
import { connect } from "./testing/catalogue";
import { declaredCheck } from "./validation";

let db: Database;

beforeAll(async () => {
  db = await connect();
});

/**
 * CNCORE-47. ADR-0012 names validation among the four things the properties
 * catalogue declares and makes "the metadata catalogue lives in the DATABASE
 * rather than in code" the test of the whole model. This is the half of that
 * which stays in code -- the executor -- and what it owes the declaration.
 */
describe("the check a property's declaration calls for", () => {
  it("reads the format and its parameters out of the declaration", () => {
    const check = declaredCheck("released", { format: "edtf", level: 1 });

    expect(check?.("1966-10-08")).toBe(true);
    // A Level 1 qualifier ADR-0073 names as a real value.
    expect(check?.("1984?")).toBe(true);
    expect(check?.("soon")).toBe(false);
  });

  /**
   * `{}` IS A DECLARATION AND ITS CONTENT IS "NOTHING IS CHECKED". Every
   * property starts there (migration 1's default) and most stay: `title` is free
   * text and there is no such thing as a malformed one.
   *
   * That is also the whole difference between dispatching on this column and
   * dispatching on `datatype`, which CNCORE-29 refused for a reason that still
   * holds -- `url` is a seeded datatype with no check, so a dispatch over
   * datatypes reads as though every datatype were guarded. A dispatch over
   * declarations claims nothing at all about a property declaring `{}`.
   */
  it("declares no check where the catalogue declares nothing", () => {
    expect(declaredCheck("title", {})).toBeUndefined();
  });

  /**
   * A DECLARATION WITH NO EXECUTOR IS REFUSED, LOUDLY, and this is the failure
   * the whole module exists to prevent. Silently admitting every value makes the
   * column decorative again, which is precisely the state CNCORE-47 was filed
   * about: a mechanism that looks like a check from outside and behaves like
   * nothing. Silently refusing every value is worse still -- a typo in a
   * migration would quarantine a provider's entire catalogue.
   *
   * Only the product adds a property (ADR-0029), so this can only ever be a bug
   * in a migration, and the sentence has to name both the property and what it
   * declared or it does not say which migration.
   */
  it("refuses a declaration it cannot execute, naming the property and the declaration", () => {
    expect(() => declaredCheck("released", { format: "iso8601" })).toThrow(
      /property released declares a validation the catalogue cannot execute.*iso8601/,
    );
  });

  /** A known format whose parameters are wrong is the same kind of bug. */
  it("refuses a format it knows whose declaration it cannot read", () => {
    expect(() => declaredCheck("released", { format: "edtf", level: 9 })).toThrow(/cannot execute/);
  });
});

/**
 * THE GUARD THAT MAKES THE TWO HALVES ONE MECHANISM.
 *
 * The declaration lives in the database and the executor lives here, so they can
 * drift -- and a migration writing a format nothing implements would fail at
 * somebody's first import rather than in CI. This walks the seeded catalogue and
 * fails where the pair comes apart, which is the check a foreign key would give
 * a column and `jsonb` cannot.
 */
describe("every check the seeded catalogue declares", () => {
  it("has an executor in this package", async () => {
    const declared = await db
      .select({ name: properties.name, validation: properties.validation })
      .from(properties);

    expect(declared.length).toBeGreaterThan(0);
    for (const property of declared) {
      expect(() => declaredCheck(property.name, property.validation)).not.toThrow();
    }
  });

  /**
   * And the one there is. Named rather than counted, because "some property
   * declares a check" passes just as well when the wrong one does.
   */
  it("is EDTF at Level 1, on released, and nothing else", async () => {
    const declared = await db
      .select({ name: properties.name, validation: properties.validation })
      .from(properties);

    expect(
      declared.filter((property) => declaredCheck(property.name, property.validation)),
    ).toEqual([{ name: "released", validation: { format: "edtf", level: 1 } }]);
  });
});
