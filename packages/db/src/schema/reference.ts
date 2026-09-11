import { integer, pgTable, text } from "drizzle-orm/pg-core";

/**
 * REFERENCE TABLES: the product's own closed sets (ADR-0029). They hold no
 * owner data and nothing is minted into one outside a migration — a row
 * appearing here at runtime is a defect, the same defect as a provider defining
 * a field, arriving by a different door.
 *
 * They are the third exception to "every table carries owner_id, a tombstone
 * and a change sequence" (ADR-0044, ADR-0075), after `owners` and Drizzle's own
 * migrations table. An item kind is not owned by anybody and is not soft-
 * deleted; it is deleted by the migration that removes it, or not at all.
 * Stated here rather than left to be noticed, so nobody applies the rule
 * mechanically and nobody reads the absence as an oversight.
 *
 * A VOCABULARY IS NOT ONE OF THESE. A vocabulary backs one property's allowed
 * values, takes rows at runtime from imports, and quarantines what arrives
 * broken (ADR-0030). See `vocabularyValues`.
 */

/** ADR-0005. Seven, and the list is closed; anything finer is a `category` statement. */
export const itemKinds = pgTable("item_kinds", {
  kind: text("kind").primaryKey(),
  label: text("label").notNull(),
});

/** ADR-0071. Four, and `derived` names the computation and its version. */
export const sourceKinds = pgTable("source_kinds", {
  kind: text("kind").primaryKey(),
  label: text("label").notNull(),
});

/**
 * A statement's standing among the values of its field. `precedence` is what
 * the projection sorts on: `preferred` is the owner's favourite and the lock
 * (ADR-0024), so it outranks the whole source order.
 */
export const ranks = pgTable("ranks", {
  rank: text("rank").primaryKey(),
  label: text("label").notNull(),
  precedence: integer("precedence").notNull().unique(),
});

export const propertyDatatypes = pgTable("property_datatypes", {
  datatype: text("datatype").primaryKey(),
  label: text("label").notNull(),
});

/**
 * ADR-0012: value-kind sits on the property definition, never on the row.
 * Measured: across the archive's 518,768 property rows, no property is ever
 * both a link and a literal.
 */
export const propertyValueKinds = pgTable("property_value_kinds", {
  valueKind: text("value_kind").primaryKey(),
  label: text("label").notNull(),
});

export const propertyCardinalities = pgTable("property_cardinalities", {
  cardinality: text("cardinality").primaryKey(),
  label: text("label").notNull(),
});
