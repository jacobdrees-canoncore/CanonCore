import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  itemKinds,
  propertyCardinalities,
  propertyDatatypes,
  propertyValueKinds,
  ranks,
  sourceKinds,
} from "./reference";
import { idColumn, lifecycleColumns, ownerColumn } from "./shared";

/**
 * ADR-0044. One row, and the unique index on a constant expression is what
 * makes "one" a fact rather than an intention. Multi-user is a later migration,
 * and dropping this index is the first thing that migration does.
 *
 * The only table besides the reference tables and Drizzle's own ledger that
 * carries no `owner_id`: it IS the owner.
 */
export const owners = pgTable(
  "owners",
  {
    id: idColumn(),
    displayName: text("display_name").notNull(),
    ...lifecycleColumns(),
  },
  () => [uniqueIndex("owners_single_row").on(sql`(true)`)],
);

/**
 * ADR-0043. One row per logged-in device, and the row that decides whether a
 * caller may WRITE (CNCORE-109).
 *
 * WHOLE RATHER THAN AS MUCH AS TODAY READS, which is that record's own
 * instruction: the row is the expensive part rather than any column on it, and
 * Audiobookshelf is the measurement behind the instruction — a signed token on
 * the user row, then 52 files and 3,168 lines to put a real session row under
 * it. So the declaration columns ship now and stand empty until something
 * declares one.
 *
 * A DEVICE, WHICH IS NOT THE SAME AS A CLIENT (`CONTEXT.md`). The web UI is not
 * a Client — the server serves it, at the server's own origin — and a browser
 * logging in declares nothing, so its row holds nulls in all four. That is the
 * honest reading of "what it declared" rather than a placeholder: the channel a
 * declaration arrives on is the client work's, and no client exists yet.
 */
export const sessions = pgTable("sessions", {
  id: idColumn(),
  ownerId: ownerColumn().references(() => owners.id),
  /**
   * SHA-256 OF THE TOKEN, never the token. The cookie holds the secret and this
   * holds a verifier: a database dump, a backup or a log of a query is then a
   * list of sessions rather than a set of live credentials. Unique because the
   * token IS the lookup key, and two rows answering one token would make which
   * session a caller holds depend on the planner.
   */
  tokenHash: text("token_hash").notNull().unique(),
  /** What the device calls the software: ADR-0043's client name. */
  clientName: text("client_name"),
  /** What the owner would recognise the device by, for a per-device logout. */
  deviceName: text("device_name"),
  /** Stable across the device's logins, which is what makes the row per-DEVICE. */
  deviceId: text("device_id"),
  clientVersion: text("client_version"),
  /**
   * What the device declared it can play, as the device declared it.
   *
   * OPAQUE HERE ON PURPOSE. ADR-0043 records that Plex carries this on two
   * channels that are not the same field — roles on `X-Plex-Provides`, the codec
   * decision on `X-Plex-Client-Profile-Name` and its `add-direct-play-profile`
   * grammar — and direct play (ADR-0041) is what makes the distinction decisive.
   * Nothing plays anything yet, so pinning a shape now would be inventing the
   * one the first client has to answer.
   */
  capabilities: jsonb("capabilities").$type<Record<string, unknown>>(),
  /**
   * ADR-0043's own column, and not a synonym for `updated_at` beside it.
   * `updated_at` is what the `touch_row` trigger advances on any write to the
   * row; this is the claim the owner reads when deciding which device to log
   * out, and it survives that column coming to mean something else.
   */
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  ...lifecycleColumns(),
});

/**
 * ADR-0040. A merge stamps its id on every row it touches, so reversal is a
 * query — "find everything stamped with merge 47" — rather than `merged_from`
 * columns or a second history mechanism.
 *
 * WHAT IS BUILT HERE IS THE STAMP, NOT THE MERGE. Nothing writes a row to this
 * table yet. The stamp is in migration 1 because it cannot be retrofitted: rows
 * written before it carry no `merge_id` and no ordered `change_sequence`, so a
 * reversal cannot see them. The merge operation itself can arrive whenever, and
 * an unmerge UI later still.
 */
export const merges = pgTable("merges", {
  id: idColumn(),
  ownerId: ownerColumn().references(() => owners.id),
  performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
  ...lifecycleColumns(),
});

/**
 * The merge stamp, on every table a merge can touch — which is the catalogue.
 *
 * `owners` and `merges` themselves carry no stamp, and that is not the type
 * checker winning an argument: a merge merges ITEMS. It never rewrites the
 * single owner row, and a merge stamped with its own id says nothing. Stated
 * here beside the third exception in `reference.ts` so the absences read as
 * decisions rather than as oversights.
 */
const stampColumns = () => ({
  ...lifecycleColumns(),
  mergeId: uuid("merge_id").references(() => merges.id),
});

const ownedColumns = () => ({
  ownerId: ownerColumn().references(() => owners.id),
});

/**
 * ADR-0071, ADR-0025. Who asserted a value: a provider, the owner, a sidecar or
 * a derived computation. The ranking among them is ONE order for the whole
 * instance (ADR-0025) — a per-group order cannot answer an item in two groups
 * whose orders disagree, which is two answers for one field on one page reached
 * by one URL.
 */
export const sources = pgTable(
  "sources",
  {
    id: idColumn(),
    ...ownedColumns(),
    kind: text("kind")
      .notNull()
      .references(() => sourceKinds.kind),
    /** `owner`, a provider's URL, a sidecar path, or `derived:palette-v2`. */
    identity: text("identity").notNull(),
    label: text("label").notNull(),
    /** ADR-0025. Ascending: 0 wins. The owner sits first. */
    sourceOrder: integer("source_order").notNull(),
    /**
     * ADR-0036, ADR-0033. What this source's licence obliges the app to SHOW,
     * verbatim, wherever the source's claims are read. NULL means the source
     * imposes nothing, which is the ordinary case — the owner's own claims and
     * the archive's both.
     *
     * ON THE SOURCE ROW, AND THAT IS THE DECISION. Every statement already names
     * its source, so "which claims does this notice cover" is a join rather than a
     * column repeated on every claim. It also puts the obligation on the row a
     * purge deletes, so the notice and the content it covers cannot come apart:
     * TMDB's termination clause requires purging their content, and a notice
     * outliving the content would be the harmless half of that failure.
     *
     * DECLARED BY THE PROVIDER, never held against a known identity in our code
     * (ADR-0033). A notice hardcoded for TMDB works perfectly and leaves the next
     * source's obligation nowhere to go.
     */
    attributionNotice: text("attribution_notice"),
    /**
     * The source's mark, as a complete `data:` URI, where its licence requires one
     * shown. TMDB's terms open "You must use the TMDB logo", which is an obligation
     * rather than a constraint on a choice.
     *
     * BYTES RATHER THAN A URL, because the fetch is the READER'S BROWSER's and not
     * this server's: a provider on a LAN address is reachable by the app and not
     * necessarily by the person reading, and that breach renders as whitespace.
     */
    attributionLogo: text("attribution_logo"),
    /**
     * The mark's accessible name, carrying the clause's third obligation — that
     * the mark "must make it clear that use of any TMDB logos does not imply any
     * endorsement, certification, or other approval by TMDB". A reader who cannot
     * see the mark is precisely the one who needs that sentence as text.
     */
    attributionLogoAlt: text("attribution_logo_alt"),
    ...stampColumns(),
  },
  (t) => [
    unique("sources_identity").on(t.ownerId, t.kind, t.identity),
    unique("sources_order").on(t.ownerId, t.sourceOrder),
    // ADR-0071: `derived` names the computation AND ITS VERSION, never a bare
    // `derived`. That is the load-bearing half — invalidating a computed claim
    // when the algorithm changes is the only operation ever performed on one,
    // and a bare flag cannot answer "which rows does the new extractor
    // invalidate?".
    check(
      "sources_derived_names_its_version",
      sql`${t.kind} <> 'derived' or ${t.identity} ~ '^derived:.+$'`,
    ),
    // A MARK WITH NO ALTERNATIVE TEXT IS A BREACH RENDERED AS A PICTURE. The
    // disclaimer obligation is discharged by the alt text for any reader who
    // cannot see the mark, so the two are one fact and the database says so
    // rather than leaving every writer to remember it.
    check(
      "sources_logo_carries_its_alternative_text",
      sql`num_nonnulls(${t.attributionLogo}, ${t.attributionLogoAlt}) <> 1`,
    ),
    // AND A MARK WITHOUT A NOTICE IS THE OTHER HALF MISSING. Every licence that
    // asks for a mark asks for words with it; a row carrying a logo alone would
    // render a third party's trademark with nothing saying why it is there.
    check(
      "sources_logo_comes_with_a_notice",
      sql`${t.attributionLogo} is null or ${t.attributionNotice} is not null`,
    ),
  ],
);

/**
 * ADR-0002 (the abstract thing, never the file), ADR-0004 (containers fold in),
 * ADR-0005 (seven kinds), ADR-0077 (`holds_work`).
 *
 * `title`, `sort_name` and `release_date` are PROJECTIONS (ADR-0014): the
 * statement is the truth and carries source, rank, language and favourite, and
 * the column is a cached copy of whichever statement currently wins. They are
 * maintained by a trigger on `statements`; see migration 1's second rung.
 */
export const items = pgTable(
  "items",
  {
    id: idColumn(),
    ...ownedColumns(),
    kind: text("kind")
      .notNull()
      .references(() => itemKinds.kind),
    /** Stored, never inferred from having members. */
    isContainer: boolean("is_container").notNull().default(false),
    isOrdered: boolean("is_ordered").notNull().default(false),
    /**
     * ADR-0077. Does this container hold at least one work? Stored and
     * maintained on placement write, because work-browsing is
     * `kind = 'work' AND (NOT is_container OR holds_work)` and a read-time
     * membership walk would make an empty container watchable and then hide it
     * the moment its first member arrived.
     */
    holdsWork: boolean("holds_work").notNull().default(false),
    title: text("title"),
    sortName: text("sort_name"),
    /** EDTF (ADR-0073), so a year-only date stays a year. No precision column. */
    releaseDate: text("release_date"),
    ...stampColumns(),
  },
  (t) => [
    check("items_ordered_implies_container", sql`not ${t.isOrdered} or ${t.isContainer}`),
    index("items_sort_name").on(t.sortName),
    /**
     * CNCORE-175. The recently-added order, which is the second view of the
     * catalogue a reader can choose: `created_at desc, id`, exactly the terms
     * the walk sorts and cuts on.
     *
     * BOTH COLUMNS, IN THE WALK'S OWN DIRECTIONS, because a keyset walk
     * compares the PAIR -- `(created_at, id)` against the anchor's -- and an
     * index on the timestamp alone leaves the tie-break to a sort. Two Items
     * added in one import share a `created_at` to the microsecond, and an
     * import writes thousands at a time, so the tie is the normal case here
     * rather than the rare one.
     */
    index("items_created_at").on(t.createdAt.desc(), t.id),
    /**
     * CNCORE-66. Catalogue search, which matches ANYWHERE inside a title: a
     * reader who has typed `yler` is looking for "Rose Tyler". A b-tree cannot
     * serve that and neither can full-text search, which matches lexemes and
     * answers nothing at all for a fragment -- measured, and written up in
     * migration 8 beside the extension this opclass needs.
     *
     * ONE INDEX, and it serves both halves of the query: `gin_trgm_ops` is what
     * makes `ilike '%...%'` indexable, and `similarity()` -- which orders the
     * results -- comes from the same extension. A second index for the ordering
     * would be a second thing to keep true.
     *
     * IT COVERS THE WINNING TITLE AND ONLY THAT. `title` is a projection
     * (ADR-0014), so alternative and foreign-language titles live as statements
     * and are not reachable through this. Making them searchable needs a
     * partial expression index keyed to a property id that is minted per
     * install, which cannot be declared in a schema file at all.
     */
    index("items_title_trigram").using("gin", t.title.op("gin_trgm_ops")),
  ],
);

/**
 * ADR-0012, ADR-0015, ADR-0029. The metadata catalogue lives in the DATABASE
 * rather than in code — that is the test separating a sound attribute model
 * from `wp_postmeta`, and Wikibase, Shopify metafields, the OpenMRS concept
 * dictionary and Salesforce all pass it.
 *
 * Only the product adds properties (ADR-0029): neither a provider nor the owner
 * can define one.
 */
export const properties = pgTable(
  "properties",
  {
    id: idColumn(),
    ...ownedColumns(),
    name: text("name").notNull(),
    datatype: text("datatype")
      .notNull()
      .references(() => propertyDatatypes.datatype),
    valueKind: text("value_kind")
      .notNull()
      .references(() => propertyValueKinds.valueKind),
    cardinality: text("cardinality")
      .notNull()
      .references(() => propertyCardinalities.cardinality),
    /**
     * Which item kinds a value may have, for a property whose value-kind is
     * `item`. An ARRAY because `created_by` legitimately targets a person or an
     * organisation, and a single column cannot say so. Frozen at creation
     * alongside `datatype` (ADR-0015).
     */
    referenceTarget: text("reference_target").array(),
    /**
     * WHAT MAY BE READ BACK AS A VALUE OF THIS PROPERTY, as the catalogue
     * declares it rather than as a callback names it (ADR-0012, CNCORE-47).
     * `{}` is a declaration too and its content is "nothing is checked", which
     * is the honest answer for `title`. Migration 7 fills `released`.
     *
     * THE EXECUTOR STAYS IN CODE, and that is not the column failing its own
     * test: SQL cannot parse EDTF, and neither can Shopify's database run a
     * metafield's regular expression. What the catalogue holds is the
     * DECLARATION, which is what makes "which properties are checked, and how"
     * a query rather than a grep. `src/validation.ts` is the executor.
     *
     * NOT FROZEN, where `datatype` and `reference_target` are (ADR-0015). A
     * rule that can be tightened later is what makes "start loose, tighten
     * afterwards" survivable, and tightening one marks offenders at the next
     * refresh rather than rejecting rows that are already here.
     */
    validation: jsonb("validation").notNull().default({}),
    /** ADR-0012: a capabilities object, so a new capability lands without changing shape. */
    capabilities: jsonb("capabilities").notNull().default({}),
    ...stampColumns(),
  },
  (t) => [
    unique("properties_name").on(t.ownerId, t.name),
    // A property taking a LITERAL names no reference target. One taking an item
    // may leave the target open: ADR-0016's `category` genuinely points at any
    // kind, and freezing it (ADR-0015) as a list of all seven would be a freeze
    // on a fact nobody has.
    check(
      "properties_only_item_values_have_a_reference_target",
      sql`${t.valueKind} = 'item' or ${t.referenceTarget} is null`,
    ),
    // `datatype` and `value_kind` answer the same question from two sides and
    // ADR-0012 names both, so they are held consistent rather than trusted.
    check(
      "properties_datatype_agrees_with_value_kind",
      sql`(${t.datatype} = 'item') = (${t.valueKind} = 'item')`,
    ),
    // A DECLARATION NAMES A FORMAT, and `{}` declares nothing. `jsonb` takes a
    // scalar, an array and a null as happily as an object, so without this the
    // one declaration the database cannot type-check is also the one it does not
    // check at all. It deliberately stops short of the per-format shape, which
    // `src/validation.ts` parses and `validation.test.ts` walks the whole
    // catalogue for -- the database says a declaration is well-formed, the
    // executor says it is one the catalogue can run.
    check(
      "properties_validation_declares_a_format",
      sql`jsonb_typeof(${t.validation}) = 'object' and (${t.validation} = '{}'::jsonb or coalesce(jsonb_typeof(${t.validation} -> 'format') = 'string', false))`,
    ),
    // THE SAME ARGUMENT ONE COLUMN OVER (migration 12, ADR-0096). `capabilities`
    // is the second declaration on this table no foreign key can reach, and it
    // holds something since `note`: `{"assertableBy": ["owner"], "public":
    // false}`.
    //
    // `coalesce(..., <key> is null)` RATHER THAN `coalesce(..., false)`, which is
    // the opposite direction from the check above and deliberately so. That one
    // DEMANDS a key, so a missing one must read as false; both keys here are
    // OPTIONAL -- twelve properties declare neither -- so a missing one must read
    // as true. A CHECK refuses only on FALSE, and getting these coalesces the
    // wrong way round would either refuse every existing row or enforce nothing.
    //
    // AN EMPTY `assertableBy` IS REFUSED: it declares a property no source may
    // ever assert, which is a field with no way in rather than a decision. And
    // `public` must be a real boolean, because `jsonb` takes the STRING
    // `"false"` as happily and it reads as truthy wherever it is cast.
    check(
      "properties_capabilities_are_an_object",
      sql`jsonb_typeof(${t.capabilities}) = 'object' and coalesce(jsonb_typeof(${t.capabilities} -> 'assertableBy') = 'array' and jsonb_array_length(${t.capabilities} -> 'assertableBy') > 0, ${t.capabilities} -> 'assertableBy' is null) and coalesce(jsonb_typeof(${t.capabilities} -> 'public') = 'boolean', ${t.capabilities} -> 'public' is null)`,
    ),
  ],
);

/**
 * ADR-0030. One vocabulary backs one property's allowed values. Rows arrive at
 * runtime from imports, which is the whole difference from a reference table.
 *
 * UNIQUENESS SITS ON THE RAW VALUE and there is no normalised match key. That
 * was measured against the archive and refuted: normalising collapses 0 of 70
 * `Medium` values and 1 of 1,566 `Writer` values. The wreckage is SEMANTIC —
 * free text typed into a field expecting a term — and no amount of case-folding
 * reaches it, which is what `quarantined` is for.
 *
 * Where uniqueness sits is the one frozen decision here: moving the constraint
 * later means resolving whatever collided in the meantime.
 */
export const vocabularyValues = pgTable(
  "vocabulary_values",
  {
    id: idColumn(),
    ...ownedColumns(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    value: text("value").notNull(),
    /** Deliberately deprecated, kept only for the rows already using it. */
    retired: boolean("retired").notNull().default(false),
    /** Arrived broken from an import, held apart from the live set. */
    quarantined: boolean("quarantined").notNull().default(false),
    ...stampColumns(),
  },
  (t) => [unique("vocabulary_values_raw_value").on(t.ownerId, t.propertyId, t.value)],
);

/**
 * ADR-0009, ADR-0017, ADR-0018, ADR-0092. One item's membership of one
 * container, at one position. The product's central claim.
 *
 * The id is a STABLE SURROGATE rather than a key made of (container, position),
 * which is what Jellyfin uses: under a composite key any reorder changes the
 * key and every external reference goes stale.
 */
export const placements = pgTable(
  "placements",
  {
    id: idColumn(),
    ...ownedColumns(),
    containerId: uuid("container_id")
      .notNull()
      .references(() => items.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    /**
     * Where this placement sits in its container's ordering -- and NULL when
     * the source that asserted the membership asserted no position for it.
     *
     * NULLABLE ON PURPOSE (migration 2, CNCORE-7). `browse` hands back members
     * a container's ordering cannot place: for the wiki that is a story the
     * archive holds no release date for, and its ordering IS release order, so
     * a sixth of the archive's stories arrive this way. A MEMBER WITH NO
     * POSITION IS STILL A MEMBER -- dropping it shrinks a container silently,
     * and putting it last asserts it came out after everything else, which the
     * source never said. So the absence is recorded rather than filled in.
     */
    position: integer("position"),
    /**
     * ADR-0092. A container may hold a SPECIFIC edition rather than the work: a
     * 4K box set contains the 4K editions, not "the films". The column ships
     * with migration 1 because placements do; `editions` arrives with its own
     * slice, and the foreign key with it.
     */
    editionId: uuid("edition_id"),
    ...stampColumns(),
  },
  (t) => [
    // ADR-0017. The same item at the same position twice is never a deliberate
    // duplicate; it is always agreement, recorded against one row.
    //
    // NULLS NOT DISTINCT, so that holds for a member with no position too. Under
    // PostgreSQL's default two sources both saying "a member, position unknown"
    // would be two rows, because NULL is distinct from NULL -- and agreement
    // about the least certain fact in the table would be the one kind of
    // agreement this constraint failed to record.
    //
    // AND IT IS `DEFERRABLE INITIALLY IMMEDIATE` IN THE DATABASE, WHICH THIS
    // LINE CANNOT SAY. drizzle-orm 0.45.2's `unique()` publishes
    // `nullsNotDistinct()` and nothing else, so migration 14 hand-writes the
    // deferrability and there is no way to declare it here. Nothing drifts:
    // `drizzle-kit generate` diffs this file against the head snapshot and
    // neither models deferrability, so a later `generate` can neither notice
    // nor re-emit it. The reason it is deferrable lives in that rung -- a
    // reorder is one permutation, and a rule about an ordering is only
    // observable between transactions.
    unique("placements_container_item_position")
      .on(t.ownerId, t.containerId, t.itemId, t.position)
      .nullsNotDistinct(),
    // AND DELIBERATELY NO UNIQUE CONSTRAINT ON (container_id, position).
    // ADR-0009: a story-order container holding both a novel and the film that
    // adapts it must place them at the same point without inventing an order
    // between them. Two DIFFERENT items sharing one position is what that is
    // FOR; without the reason written down it reads as a missing constraint.
    index("placements_container_position").on(t.containerId, t.position),
    index("placements_item").on(t.itemId),
  ],
);

/**
 * ADR-0017. A placement has many sources. Sources agreeing are recorded against
 * one placement row; sources disagreeing about position produce two placement
 * rows, resolved by rank — exactly as two competing statements are.
 *
 * An ordering is a dated claim by a named source, not a neutral fact.
 */
export const placementSources = pgTable(
  "placement_sources",
  {
    id: idColumn(),
    ...ownedColumns(),
    placementId: uuid("placement_id")
      .notNull()
      .references(() => placements.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    rank: text("rank")
      .notNull()
      .default("normal")
      .references(() => ranks.rank),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    ...stampColumns(),
  },
  (t) => [unique("placement_sources_placement_source").on(t.ownerId, t.placementId, t.sourceId)],
);

/**
 * ADR-0012, ADR-0013, ADR-0090. Every claimed value and every relationship.
 * The statement records only what changed, with who said it and when — not a
 * versioned copy of the whole item, which would duplicate every unchanged field
 * on every save.
 *
 * It carries the same four provenance facts as MARC 21 field 883: creation
 * process (the source), a confidence 0..1, a creation date and a validity end.
 *
 * SUBJECTS. ADR-0012 names three addressable, field-bearing tables: items,
 * editions and placements. Two of them exist, so two subject columns exist, and
 * `subject_edition_id` arrives with `editions`.
 *
 * THAT LOOKS LIKE A CONTRADICTION OF `placements.edition_id` ABOVE, WHICH SHIPS
 * WITHOUT ITS TABLE, and the difference is not a general principle about
 * nullable columns -- it is which of them a record decides. ADR-0092 puts
 * `placements.edition_id` in migration 1 by name, and gives the reason: a
 * container may hold a specific edition rather than the work. Nothing decides
 * `subject_edition_id`, so ADR-0051's default applies and it waits for the
 * slice that can also give it a foreign key. Stated because an implementer
 * reading these two columns together will otherwise assume one is a mistake.
 */
export const statements = pgTable(
  "statements",
  {
    id: idColumn(),
    ...ownedColumns(),
    subjectItemId: uuid("subject_item_id").references(() => items.id, { onDelete: "cascade" }),
    subjectPlacementId: uuid("subject_placement_id").references(() => placements.id, {
      onDelete: "cascade",
    }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    valueLiteral: text("value_literal"),
    valueItemId: uuid("value_item_id").references(() => items.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    rank: text("rank")
      .notNull()
      .default("normal")
      .references(() => ranks.rank),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    /**
     * ADR-0090. BCP 47, and unknown is the VALUE `none` rather than an absent
     * one — copied from IIIF Presentation 3.0 §4.4, where it is a `must`.
     * Without unknown-language being a real value, "show me the untagged ones"
     * cannot be expressed at all.
     */
    language: text("language").notNull().default("none"),
    /**
     * ADR-0090. Where a claim applies, a SECOND AXIS beside language and never
     * a synonym for it. Nullable, and NULL means the claim is not
     * country-scoped at all, which is the ordinary case.
     */
    country: text("country"),
    /**
     * CNCORE-29. A value that arrived broken from an import, HELD APART FROM
     * THE LIVE SET rather than refused at the door -- ADR-0030's posture for a
     * vocabulary value, applied to a claim.
     *
     * NOT A SECOND TOMBSTONE. `deleted_at` says a claim was WITHDRAWN by
     * whoever made it, and every reader honours it for that reason; this says
     * the claim still stands and the catalogue cannot read it. The two are
     * orthogonal exactly as `retired` and `quarantined` are on
     * `vocabulary_values`, and a row can carry both.
     *
     * WHY THE VALUE IS KEPT AT ALL: it carries the provider that said it, so
     * "what did this source actually send" stays answerable. Dropping it at the
     * door would leave the catalogue unable to tell a provider that sends
     * nothing from one that sends rubbish.
     */
    quarantined: boolean("quarantined").notNull().default(false),
    ...stampColumns(),
  },
  (t) => [
    check(
      "statements_one_subject",
      sql`num_nonnulls(${t.subjectItemId}, ${t.subjectPlacementId}) = 1`,
    ),
    check("statements_one_value", sql`num_nonnulls(${t.valueLiteral}, ${t.valueItemId}) = 1`),
    check(
      "statements_confidence_is_a_probability",
      sql`${t.confidence} is null or (${t.confidence} >= 0 and ${t.confidence} <= 1)`,
    ),
    index("statements_subject_item_property").on(t.subjectItemId, t.propertyId),
    index("statements_value_item").on(t.valueItemId),
    // CNCORE-28. THE REVERSE LOOKUP: not "what does this item claim" but "which
    // item does this source's own id name". Every import makes it once per
    // record -- sixty times for one browse -- so without it a bulk import is a
    // sequential scan of every statement in the catalogue per member.
    //
    // IT INDEXES A HASH OF THE VALUE RATHER THAN THE VALUE, and that is a fix
    // rather than a flourish. A btree index tuple is capped at 2704 bytes, and
    // `value_literal` is unbounded `text` -- so indexing it directly made every
    // literal statement in the catalogue subject to that cap, and a provider
    // returning a long enough title aborted the whole import transaction.
    // MEASURED against this database, not assumed: at 2600 random characters the
    // insert succeeds, at 2800 it fails with `index row size 2848 exceeds btree
    // version 4 maximum 2704`. `md5` is 32 characters whatever it is given, so
    // the cap is unreachable and no future long-text property inherits it.
    // Collisions cannot give a wrong answer, because the lookup still compares
    // the value itself; the hash only narrows what it compares.
    //
    // NOT UNIQUE, and the unique one is not here either. CNCORE-31 holds one
    // provider's id to one item with `statements_one_item_per_external_id`,
    // which is PARTIAL -- it covers the `external_id` property alone, because
    // two items may legitimately share every other property's value -- and a
    // partial index needs that property's id as a LITERAL, since PostgreSQL
    // refuses a subquery in an index predicate. The id is minted per install
    // and this file is one file shared by every install, so the index CANNOT BE
    // DECLARED HERE and lives hand-written in migration 5. Stated so the
    // absence reads as a decision rather than as a rule nobody got round to.
    index("statements_property_literal_source").on(
      t.propertyId,
      sql`md5(${t.valueLiteral})`,
      t.sourceId,
    ),
  ],
);

/**
 * ADR-0067. A fact only true in a context: appeared in a place, in this work,
 * at this time. How much of a source an adaptation covers is one of these, on
 * the `based_on` statement — never `edition_coverage`, which describes what
 * fraction of its OWN work an edition covers and cannot see across an
 * adaptation at all.
 */
export const statementQualifiers = pgTable(
  "statement_qualifiers",
  {
    id: idColumn(),
    ...ownedColumns(),
    statementId: uuid("statement_id")
      .notNull()
      .references(() => statements.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    valueLiteral: text("value_literal"),
    valueItemId: uuid("value_item_id").references(() => items.id),
    ...stampColumns(),
  },
  (t) => [
    check(
      "statement_qualifiers_one_value",
      sql`num_nonnulls(${t.valueLiteral}, ${t.valueItemId}) = 1`,
    ),
    index("statement_qualifiers_statement").on(t.statementId),
  ],
);

/**
 * ADR-0040. The retained id of a merged-away item, resolving to the item that
 * survived. It is an IDENTITY, never an alternative name — an alternative name
 * is a statement.
 *
 * In migration 1 because the first merge breaks every old URL without it.
 *
 * `alias_item_id` carries no foreign key ON PURPOSE: the row it names is gone,
 * which is what makes it an alias rather than a second pointer at a live item.
 */
export const aliases = pgTable(
  "aliases",
  {
    id: idColumn(),
    ...ownedColumns(),
    aliasItemId: uuid("alias_item_id").notNull(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    ...stampColumns(),
  },
  (t) => [
    unique("aliases_alias_item").on(t.aliasItemId),
    // An alias resolving to another alias is a chain nothing walks.
    check("aliases_do_not_point_at_themselves", sql`${t.aliasItemId} <> ${t.itemId}`),
  ],
);

/**
 * ADR-0049. One row per RUN of one task: when it started, when it stopped, and
 * how it ended.
 *
 * THE ROW IS THE VISIBILITY. That record's minimum is that last night's failure
 * can be seen, and a registry that ran things in memory would answer "what
 * happened last night" only until the process restarted -- which is the
 * maintenance job that silently stopped months ago, wearing a page.
 *
 * KEYED BY THE TASK'S KEY AND NOT BY A FOREIGN KEY, because a task is CODE
 * rather than a row: `sweep-sessions` is a function this repository ships, and
 * a table of tasks would be a second place to add one from, out of step with
 * the code the moment either moved. The key is the join, and a run whose task
 * has been deleted from the code still reads as history rather than dangling.
 *
 * `outcome` CARRIES `running` RATHER THAN LEAVING IT TO A NULL `ended_at`. The
 * two would be one fact stored twice, so the check below makes them one fact
 * the database keeps: a row is running exactly while it has no end.
 *
 * TODO(CNCORE-124): NOTHING REMOVES A ROW FROM HERE. A daily task writes 365 a
 * year and ADR-0049 names eight more kinds of work that will each want a key,
 * so this table is the tombstone compaction that record lists arriving back at
 * the registry's own history. A second task on the registry is the shape for
 * it, which is what that ticket builds.
 *
 * A CHECK RATHER THAN A REFERENCE TABLE, which is a departure worth stating.
 * The reference tables hold the CATALOGUE'S closed vocabularies (ADR-0029) --
 * kinds, ranks, datatypes -- each carrying a label a page prints and each
 * referenced by the owner's own rows. An outcome is none of that: it is this
 * mechanism's own state, read by this mechanism, and a four-row table to hold
 * it would be ceremony rather than the rule being followed.
 */
export const taskRuns = pgTable(
  "task_runs",
  {
    id: idColumn(),
    ...ownedColumns(),
    /** The key of the task this was a run of. See `@canoncore/tasks`. */
    taskKey: text("task_key").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    /**
     * STOPPED IS DISTINCT FROM BROKEN, which is ADR-0049's own instruction and
     * the reason it names Jellyfin's shape: a sweep the owner stopped is not an
     * incident and a sweep that threw is.
     *
     * AND `cancelled` IS DISTINCT FROM `aborted`, which is the third value
     * Jellyfin ships and `verify-adr-jellyfin.md` §34 says is the one worth
     * copying: the owner stopping a run and the server dying under one are
     * different facts, and only the second is a machine to go and look at.
     */
    outcome: text("outcome").notNull().default("running"),
    /**
     * What the run did, or what broke it -- the sentence an owner reads.
     *
     * NULL WHILE IT RUNS, because nothing has been done yet. Bounded by the
     * registry that writes it rather than by this column: see `BOUNDED_DETAIL`
     * in `@canoncore/tasks`.
     */
    detail: text("detail"),
    ...lifecycleColumns(),
  },
  (t) => [
    check(
      "task_runs_outcome_is_known",
      sql`${t.outcome} in ('running', 'completed', 'failed', 'cancelled', 'aborted')`,
    ),
    // RUNNING IS EXACTLY "HAS NOT ENDED". Stored as one fact rather than two
    // that can disagree, which is what a row reading `completed` with no end
    // time would be.
    check("task_runs_running_has_no_end", sql`(${t.outcome} = 'running') = (${t.endedAt} is null)`),
    // WHAT EVERY READ OF THIS TABLE ASKS: this task's runs, newest first.
    index("task_runs_by_task").on(t.taskKey, t.startedAt.desc()),
  ],
);

/**
 * WHAT THE OWNER CONFIGURED ABOUT THIS INSTANCE, in the catalogue rather than
 * in the environment (CNCORE-99, ADR-0121).
 *
 * `PROVIDER_URLS` AND `PROVIDER_ALLOWLIST` MOVED HERE TOGETHER, which is what
 * `packages/env/src/schema.ts` committed to beside the allowlist itself: "when
 * there is one, this moves into it and the boundary does not change". Both are
 * held as the STRING the owner wrote, because `parseProviderUrls` and
 * `parseAllowlist` take a string from wherever it comes -- so only the source
 * moved and the parsing boundary is exactly where it was.
 *
 * TWO COLUMNS RATHER THAN A KEY AND A VALUE. A settings row per key would be a
 * bag this instance could put anything in, and what exists is two settings; a
 * third arrives as a rung that names it, which is the same posture ADR-0029
 * takes towards fields. It also keeps every value TYPED at the schema, where a
 * `value text` column makes every setting a string that happens to parse.
 *
 * ONE ROW, ENFORCED THE WAY `owners` IS. Settings belong to the instance and
 * there is one instance, so a second row would make "what is configured" depend
 * on which row a query happened to read first.
 *
 * ITS TOMBSTONE IS WRITTEN BY NOTHING, and that is named here rather than left
 * to be noticed: ADR-0075 puts a tombstone on every table and nothing deletes
 * this row -- removing a provider rewrites a value on it. The column is what
 * that record refuses to retrofit, and it stands empty the way `task_runs`'s
 * does.
 */
export const settings = pgTable(
  "settings",
  {
    id: idColumn(),
    ...ownedColumns(),
    /**
     * WHICH PROVIDERS THIS INSTANCE SEARCHES, as their base URLs separated by
     * commas or whitespace (ADR-0031, ADR-0121).
     *
     * EMPTY BY DEFAULT, so an instance nobody has configured searches nothing
     * and a surface says so rather than showing an empty result (ADR-0094).
     */
    providerUrls: text("provider_urls").notNull().default(""),
    /**
     * ADR-0034'S ALLOWLIST: the exact hosts and CIDRs a provider base URL may
     * name, separated by commas or whitespace.
     *
     * EMPTY BY DEFAULT, WHICH REFUSES EVERY PROVIDER. That is the safe end of
     * the failure and it survived the move out of the environment unchanged: an
     * instance nobody has configured reaches nothing, and moving the setting to
     * a surface must not quietly turn that into a permissive default.
     */
    providerAllowlist: text("provider_allowlist").notNull().default(""),
    ...lifecycleColumns(),
  },
  () => [uniqueIndex("settings_single_row").on(sql`(true)`)],
);

/**
 * ONE WALK OVER A LIST OF CONTAINERS AT ONE PROVIDER, and where it got to
 * (CNCORE-166, migration 18).
 *
 * WHY THE WALK'S POSITION IS A ROW RATHER THAN A VARIABLE. The wiki's corpus is
 * 465 Containers, and 43.8s is what the LARGEST of them costs end to end
 * (measured against the live wiki, 2026-09-13) rather than what a typical one
 * does -- the whole list landed in about eleven minutes (ADR-0137), and this
 * comment multiplied the two until CNCORE-246. A
 * walk keeping its position in one process's memory starts again from the
 * beginning whenever anything interrupts it -- and the thing that interrupts it
 * is the ordinary one: ADR-0122's Credential lapses, and every Container after
 * that point refuses.
 *
 * IT IS `task_runs`'s ARGUMENT AT A FINER GRAIN. ADR-0049 opens a run when it
 * STARTS rather than writing one when it finishes, because a history written
 * only on completion cannot describe the run that never finished. What a resume
 * needs to read back here is not whether the run finished but WHICH OF ITS 465
 * CONTAINERS DID, so the rows that carry an outcome are the Containers.
 */
export const importRuns = pgTable(
  "import_runs",
  {
    id: idColumn(),
    ...ownedColumns(),
    /**
     * Which Provider this walk is at, as the base URL that IS its identity
     * (ADR-0031).
     *
     * NOT A FOREIGN KEY TO `sources`, though that table holds the same string
     * for the same Provider. A run may be opened against a Provider this
     * catalogue has never imported from -- the ordinary case on a fresh install
     * -- and `sources` has no row for one until the first import writes it.
     */
    providerIdentity: text("provider_identity").notNull(),
    ...lifecycleColumns(),
  },
  (t) => [
    // How a resume finds its run: the runs at one Provider, newest first.
    index("import_runs_by_provider").on(t.providerIdentity, t.createdAt.desc()),
  ],
);

/**
 * ONE CONTAINER'S PLACE IN ONE RUN, and how asking for it went.
 *
 * A RUN IS OPEN EXACTLY WHILE ONE OF THESE IS `pending`, which is why
 * `import_runs` carries no column saying so. The same fact stored twice is two
 * facts free to disagree, which is the argument migration 13 makes for
 * `task_runs_running_has_no_end`.
 */
export const importRunContainers = pgTable(
  "import_run_containers",
  {
    id: idColumn(),
    ...ownedColumns(),
    runId: uuid("run_id")
      .notNull()
      .references(() => importRuns.id),
    /** The Provider's own id for the Container, the one `browse` takes (ADR-0033). */
    externalId: text("external_id").notNull(),
    /**
     * WHERE THIS CONTAINER SAT IN THE LIST THE OWNER HANDED OVER, and NEVER a
     * Placement's Position (ADR-0018, `CONTEXT.md`). A Placement's Position is a
     * claim about an Ordering that a Source made; this is the order somebody
     * typed 465 lines in. Zero-based, because it indexes what the caller passed
     * rather than anything a reader is shown.
     */
    listPosition: integer("list_position").notNull(),
    /**
     * `pending` until this Container has been asked for, and then how it went.
     *
     * `refused` COVERS THE THREE WAYS ONE CONTAINER FAILS WITHOUT THE RUN
     * FAILING: the Provider could not be reached or answered badly, the Provider
     * declines `browse` (ADR-0033 makes that well-formed), and the Provider
     * holds nothing at that id (ADR-0066 makes that an answer). The REASON tells
     * them apart, because what the Owner does about each is read off the
     * sentence and nothing in this catalogue branches on which of the three it
     * was.
     */
    outcome: text("outcome").notNull().default("pending"),
    /** What `browse` answered: how many Placements landed, and what was held apart (CNCORE-29). */
    placements: integer("placements"),
    quarantinedValues: integer("quarantined_values"),
    /**
     * Why it refused, in ADR-0123's two fields: whose sentence this is, and the
     * sentence. Bounded by `reasonFor` in `@canoncore/providers` rather than by
     * these columns, exactly as `task_runs.detail` is bounded by the registry.
     */
    reasonText: text("reason_text"),
    reasonWrote: text("reason_wrote"),
    ...lifecycleColumns(),
  },
  (t) => [
    check(
      "import_run_containers_outcome_is_known",
      sql`${t.outcome} in ('pending', 'landed', 'refused')`,
    ),
    // WHAT LANDED SAYS WHAT IT WROTE, AND WHAT REFUSED SAYS WHY -- as an
    // equivalence rather than as nullable columns nobody checks, so a `refused`
    // with no sentence is a row this database will not hold.
    check(
      "import_run_containers_landed_counts_what_it_wrote",
      sql`(${t.outcome} = 'landed') = (${t.placements} is not null and ${t.quarantinedValues} is not null)`,
    ),
    check(
      "import_run_containers_refused_says_why",
      sql`(${t.outcome} = 'refused') = (${t.reasonText} is not null and ${t.reasonWrote} is not null)`,
    ),
    check(
      "import_run_containers_reason_wrote_is_known",
      sql`${t.reasonWrote} is null or ${t.reasonWrote} in ('canoncore', 'provider')`,
    ),
    // The order every read of a run asks for, and unique because two Containers
    // cannot share a place in one list -- which is what makes the order total
    // rather than merely usual.
    uniqueIndex("import_run_containers_in_list_order").on(t.runId, t.listPosition),
    // ONE CONTAINER APPEARS ONCE IN A RUN, and this index HOLDS that invariant
    // rather than saving anything. Migration 18 framed it as saving a repeated
    // browse -- "43.8s spent asking a Provider a question it has already
    // answered" -- and an index does no such thing: it refused the INSERT, for
    // the whole list, and the 23505 reached the Owner as a 500 (CNCORE-254).
    // What saves the browse is `beginImportRun` refusing a repeat by name and
    // position before a row is written (ADR-0154), so this stands behind a
    // check rather than alone. Migration 18 is frozen and cannot say so; rung
    // 22 carries the corrected sentence as a COMMENT ON the index itself.
    // ADR-0009's REPEAT is the opposite case and untouched: a story may sit
    // twice in one ORDERING, which is a claim about a Container's members
    // rather than about a list of Containers to import.
    uniqueIndex("import_run_containers_named_once").on(t.runId, t.externalId),
  ],
);

/**
 * ADR-0010. A GROUP IS A BROWSING SCOPE: what a view is narrowed to, never a
 * partition, and never typed by medium.
 *
 * ONE COLUMN THE OWNER FILLS, which is the whole table. A Group is a name and
 * an identity; everything a Group DOES is the predicate other surfaces read it
 * through, and a column here for any of it would be a scope stored twice.
 *
 * NO UNIQUE INDEX ON `name`, deliberately. Two scopes an Owner has called the
 * same thing is their business -- ADR-0010 makes the name their own words --
 * and a unique constraint here would carry the trap `placements` documents at
 * greater length: a tombstoned row goes on occupying its tuple, so a Group the
 * Owner deleted would refuse the next one they named after it, citing a row
 * they cannot see.
 *
 * `lifecycleColumns` RATHER THAN `stampColumns`, which is the same reading
 * `owners` and `merges` get: a merge merges ITEMS (ADR-0040), and this row
 * names none. `group_items` below does name one and is stamped accordingly.
 */
export const groups = pgTable("groups", {
  id: idColumn(),
  ...ownedColumns(),
  /** The Owner's own words for this scope (ADR-0010). */
  name: text("name").notNull(),
  ...lifecycleColumns(),
});

/**
 * ADR-0010. ONE ITEM'S PRESENCE IN ONE GROUP, AS ITS OWN RELATION -- which is
 * that record's entire decision and the reason it is not a column on `items`.
 *
 * A COLUMN WOULD MAKE A GROUP A PARTITION, an item belonging to exactly one,
 * and multi-placement is the entire product. The measured case is the crossover:
 * 96.8% of the wiki's stories sit in more than one category, median 4.
 *
 * AND IT IS NOT A PLACEMENT (`CONTEXT.md`). A Placement is one item's membership
 * of one CONTAINER at one POSITION, carrying every source that asserted it; this
 * row is a scope the Owner drew, has no position, and no source asserts it but
 * them. The two would be one table only if a Group were a Container, which is
 * the partition ADR-0010 refuses.
 *
 * ONE ITEM SITS IN A GROUP ONCE. There is no position here, so the Repeat
 * ADR-0009 licences has nothing to be a repeat OF -- an item named twice in one
 * scope is the same claim twice. The unique index is what makes that a fact, and
 * `putItemInGroupByHand` meets its tombstone the way `placeItemByHand` does.
 */
export const groupItems = pgTable(
  "group_items",
  {
    id: idColumn(),
    ...ownedColumns(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    ...stampColumns(),
  },
  (t) => [
    unique("group_items_group_item").on(t.ownerId, t.groupId, t.itemId),
    // WHICH GROUPS THIS ITEM IS IN, which is the read the Item page makes
    // (story 38) and the one the unique index above cannot serve: its leading
    // column is the group, so an item-first lookup would scan.
    index("group_items_item").on(t.itemId),
  ],
);

/**
 * ADR-0025. WHICH PROVIDERS ONE GROUP ASKS, one row per Provider -- the half of
 * that record which needed Groups to exist (CNCORE-182).
 *
 * THE PROVIDER BY ITS BASE URL, WHICH IS ITS IDENTITY (ADR-0031), and not a
 * foreign key to `sources` for the reason `import_runs` gives: a Group may ask a
 * Provider this catalogue has never imported from, which is the ordinary case on
 * a fresh install, and `sources` holds no row for one until the first import
 * writes it.
 *
 * A CHOICE OF WHO IS ASKED AND NEVER A RANKING. There is no order column, and
 * that absence is the decision: the source order is one for the instance
 * (`sources.source_order`), because an Item in two Groups ranked differently
 * would have two answers for one field at one address.
 *
 * `lifecycleColumns` AND NOT `stampColumns`, the reading `groups` gets above: a
 * merge merges Items (ADR-0040), and this row names none.
 */
export const groupProviders = pgTable(
  "group_providers",
  {
    id: idColumn(),
    ...ownedColumns(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id),
    providerIdentity: text("provider_identity").notNull(),
    ...lifecycleColumns(),
  },
  (t) => [unique("group_providers_group_provider").on(t.ownerId, t.groupId, t.providerIdentity)],
);
