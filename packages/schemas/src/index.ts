/**
 * Hand-written Zod schemas, shared by the API contract and its consumers.
 *
 * Deliberately NOT derived from the Drizzle tables. drizzle-orm 0.45.2 — the
 * stable line this repo is on — ships no `./zod` subpath, and the standalone
 * `drizzle-zod` package that would fill the gap last had a stable release on
 * 2025-08-06 and is no longer what Drizzle's own documentation points at. See
 * ADR-0102; the decision is revisited when drizzle-orm 1.0 ships stable and
 * brings the integration in-tree.
 */
import { z } from "zod";

/** What `healthCheck` answers. Published in the OpenAPI document. */
export const healthCheckResult = z.literal("OK");

export type HealthCheckResult = z.infer<typeof healthCheckResult>;

/**
 * What the read path emits for one item.
 *
 * ADR-0045: it NAMES EVERY FIELD rather than being the stored row with fields
 * removed, because a strip-list works right up until someone adds a field and
 * forgets. A field added to `items` later is private until it is written here
 * on purpose.
 *
 * `id` is here and is not an exception to "no internal ids". It is the item's
 * ADDRESS -- `/items/<id>` is canonical and the path is identity (ADR-0066) --
 * so a reader who has the payload already has it. What stays out is everything
 * that would let the catalogue be enumerated or its owner identified:
 * `owner_id`, the change sequence, the merge stamp, and the ids of the
 * statements, sources and properties underneath.
 */
/**
 * What the read path emits for one placement: one item's membership of one
 * container, at one position (ADR-0009).
 *
 * ADR-0045 again -- every field named on purpose. `id` and `containerId` are
 * both ADDRESSES rather than internal ids: `id` is what `?via=` carries, the
 * ordering a reader arrived through (ADR-0066), and `containerId` is the
 * container's own `/items/<id>`. What stays out is `owner_id`, the change
 * sequence, the merge stamp, and `edition_id` -- which has no table behind it
 * yet (ADR-0092) and so nothing a reader could do with it.
 */
export const placementPublic = z.object({
  id: z.uuid(),
  containerId: z.uuid(),
  /** ADR-0014: the container's projected title, so a reader sees a name. */
  containerTitle: z.string().nullable(),
  /**
   * Where it sits in that ordering, or NULL when no source has asserted one.
   * A member with no position is still a member: the source that put it here
   * said nothing about where, and the read path says that rather than inventing
   * a number or dropping the row (migration 2).
   */
  position: z.number().int().nullable(),
  /**
   * ADR-0017, ADR-0071. The kind of source that asserted this placement, since
   * an ordering is a dated claim by a named source rather than a neutral fact:
   * `owner` is the owner's own hand, `provider` an imported ordering. Null when
   * no source stands behind it.
   */
  placedBy: z.string().nullable(),
});

export type PlacementPublic = z.infer<typeof placementPublic>;

/**
 * What the read path emits for one claimed value (ADR-0012).
 *
 * ADR-0045 again, one level down: the statement's own id, its property id and
 * its source id all stay private. A reader can do nothing with any of them, and
 * they are exactly what an enumeration oracle is made of. What is emitted is
 * what a reader can act on -- the property, the value, and who said it.
 */
export const statementPublic = z.object({
  /** The seeded property's name (ADR-0029): `title`, `released`. */
  property: z.string(),
  /** The literal. An item-valued statement has none and is not emitted here. */
  value: z.string(),
  /**
   * ADR-0071. `provider`, `owner`, `sidecar` or `derived` -- WHO asserted the
   * value, which is the question a source answers.
   */
  sourceKind: z.string(),
  /** What that source calls itself: a provider's manifest name, or `Owner`. */
  sourceLabel: z.string(),
});

export type StatementPublic = z.infer<typeof statementPublic>;

/**
 * What a source's licence obliges the app to show, for one source, on a page
 * that is about to show that source's claims (ADR-0036).
 *
 * ADR-0045 again: named, not derived. What stays out is the source's id and its
 * identity -- the URL an owner typed is a deployment detail and, for a provider
 * on a private network, an address a reader has no business being handed.
 */
export const attributionPublic = z.object({
  /** Who imposed it, in their own words: `provider-tmdb`, never a URL. */
  sourceLabel: z.string(),
  /**
   * VERBATIM, and the renderer's job is to print it unaltered. TMDB's terms
   * require the notice "prominently in or on Your Application"; paraphrasing a
   * licence notice breaches it as surely as omitting it.
   */
  notice: z.string(),
  /**
   * The source's mark, where its licence requires one shown, and null where it
   * does not. `dataUri` rather than a URL because the fetch is the reader's
   * browser's: a provider on a private address is reachable by this server and
   * not necessarily by the person reading, and that breach renders as whitespace.
   */
  logo: z
    .object({
      /**
       * THE SAME CONSTRAINT THE WIRE SCHEMA APPLIES, restated rather than
       * assumed. This value reaches an `img` on a rendered page, and a read path
       * that widened it back to `z.string()` would be trusting that every row was
       * written through the one code path that checks -- which is a rule somebody
       * remembers rather than a shape. ADR-0045 names every field the read path
       * emits; naming its type loosely than the field's own is naming it badly.
       */
      dataUri: z.string().regex(/^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$/),
      /**
       * The accessible name, carrying the no-endorsement sentence TMDB's clause
       * requires. A reader who cannot see the mark is exactly the one who needs it.
       */
      alt: z.string(),
    })
    .nullable(),
});

export type AttributionPublic = z.infer<typeof attributionPublic>;

/**
 * What the read path emits for one placement read FROM THE CONTAINER'S END: the
 * mirror of `placementPublic`, which reads the same construct from the item's.
 *
 * NAMED PLACEMENT RATHER THAN MEMBER, and CNCORE-91 is where that was settled.
 * The rows here ARE placements -- each carries the placement's `id` beside
 * `itemId`, and it has to, for the repeat reason below -- so a second noun for
 * them would be a second name for a relationship `CONTEXT.md` has already
 * settled, which is exactly what its `_Avoid_` lists exist to prevent. "Members"
 * survives as THE READER'S WORD for this list and has no type behind it, the way
 * the item page prints "Also appears in" over `placementPublic`; the glossary's
 * Placement entry now says both, so neither is a word nobody decided on.
 *
 * ADR-0045 again -- every field named on purpose. `id` and `itemId` are both
 * ADDRESSES rather than internal ids: `itemId` is the placed item's own
 * `/items/<id>`, and `id` is the placement `?via=` carries, which is what says
 * WHICH arrival this was. A repeat is why that distinction has to be in the
 * payload at all -- the same item twice in one container is two placements with
 * one `itemId` between them (ADR-0009), so nothing but the placement id can
 * tell the recap from the episode.
 *
 * IT CARRIES `assertedBy` WHERE THE MIRROR CARRIES `placedBy`, and the asymmetry
 * is CNCORE-90's decision rather than an oversight. A Repeat (ADR-0009: one
 * source, one item, twice, on purpose) and a disagreement (ADR-0017: two sources
 * claiming different positions for one membership) are THE SAME SHAPE in this
 * list -- one title, twice, at two positions -- and ADR-0017 says outright that
 * nothing STORED separates them. What separates them is WHO asserted each row.
 *
 * SO IT IS THE SET, AND THE LABELS, RATHER THAN ONE KIND. `placedBy` answers
 * what SORT of thing placed it, which is what the item's end filters on, and it
 * cannot carry this: the disagreement an instance can actually hold is a wiki
 * against a broadcaster, two providers, and `placedBy` prints "Imported" for
 * both. Naming the sources is what says a repeat's two rows came from one and a
 * disagreement's from two -- and it closes ADR-0017's other named gap on the
 * way, that two sources corroborating ONE placement were invisible to a reader.
 *
 * WHAT IT STILL DOES NOT CARRY is which of two competing rows SPEAKS. Position
 * leads inside a container (ADR-0018), so the order cannot say it as the item's
 * end does, and no field says it either: a repeat's rows and a disagreement's
 * are one shape to the query, so marking a winner would mean guessing which
 * pairs compete. The reader draws that conclusion from the names, exactly as
 * ADR-0017 has them draw it from two rows on the item's end.
 */
export const placementInContainerPublic = z.object({
  id: z.uuid(),
  /** ADR-0014: the placed item's projected title. */
  title: z.string().nullable(),
  itemId: z.uuid(),
  /**
   * Where this placement sits in THIS container's ordering (ADR-0018), or NULL
   * where no source gave it one. CONTEXT.md calls that Unplaced and is explicit
   * that it is a placement with no position rather than an absent placement:
   * dropping the row shrinks the container silently, and numbering it last
   * asserts an order the source never gave.
   */
  position: z.number().int().nullable(),
  /**
   * Every source standing behind this placement, by the label each calls itself
   * (ADR-0017), the one that SPEAKS for it first -- rank, then the one global
   * source order, then a stable id, which is `spokesmanFor`'s rule applied to
   * ORDER the names rather than to pick one of them.
   *
   * THE LABEL RATHER THAN THE KIND, because the question a reader asks of this
   * list is who says so. `statementPublic` carries a `sourceLabel` for the same
   * reason, and the page prints it for the same reason again.
   *
   * EMPTY FOR A PLACEMENT NO SOURCE ASSERTED -- a claim nobody made, which is
   * still a placement. Dropping it would be the read path deciding a row does
   * not exist because its provenance was never recorded.
   */
  assertedBy: z.array(z.string()),
});

export type PlacementInContainerPublic = z.infer<typeof placementInContainerPublic>;

/**
 * What a CONTAINER'S OWN LISTING answers with: the page, its size, and where it
 * carries on (ADR-0119).
 *
 * THE SAME THREE FACTS `cataloguePublic` BELOW CARRIES, over a different kind
 * of row. The catalogue, work-browsing and Catalogue search list ITEMS and
 * share one shape for it; a container lists PLACEMENTS, because a Repeat is one
 * item twice in one ordering and an entry has to be able to say which of the
 * two it is. A single schema for both would have to make `entries` a union,
 * which is a shape no caller wants: nothing asks a listing for "items or
 * placements, whichever this one holds".
 *
 * IT IS A SHAPE RATHER THAN THREE FIELDS ON `itemPublic`, so a surface takes
 * the page, the size and the cursor together or not at all. Spread across the
 * item they would be three fields a reader could pick one of -- and the one
 * they would pick is `entries`, which is the silent cap this record exists to
 * refuse.
 */
export const placementsInContainerPublic = z.object({
  entries: z.array(placementInContainerPublic),
  /**
   * How many placements this container holds ALTOGETHER, cap or no cap. A
   * surface that could only count what it was given would report the first
   * hundred as the whole ordering.
   */
  total: z.number().int().nonnegative(),
  /**
   * The placement to ask for the next page with, or `null` where the ordering
   * ends here (ADR-0119).
   *
   * A PLACEMENT'S ID AND NOT AN ITEM'S, which is where this departs from that
   * record's letter and for the reason `?via=` already departs the same way
   * (ADR-0066): a Repeat is one item twice in one container, so an item id
   * names two rows here and cannot say which of them a page ended on.
   */
  continuesAfter: z.uuid().nullable(),
});

export type PlacementsInContainerPublic = z.infer<typeof placementsInContainerPublic>;

export const itemPublic = z.object({
  id: z.uuid(),
  /**
   * ADR-0005's kind, IN THE READER'S WORDS: `Time span`, never `time_span`.
   *
   * THE SAME THING `catalogueEntryPublic.kind` CARRIES, which is the point
   * rather than a coincidence: `kind` means the reader's word for it wherever
   * the read path emits one, so no surface has to know which of two spellings
   * its own call answers with. `CONTEXT.md` is binding on UI copy and is where
   * those words are settled.
   *
   * READ OFF `item_kinds` rather than mapped in TypeScript. Migration 1 seeds a
   * label beside every kind for exactly this, so the words are the catalogue's
   * own and a revision to one reaches every reader with the migration that
   * makes it.
   *
   * THE KEY IS NOT EMITTED BESIDE IT, because nothing reads one: ADR-0004's
   * fold is what a surface actually branches on and `isContainer` below carries
   * that. A second field for the column would be a field added against a reader
   * that does not exist (ADR-0045).
   */
  kind: z.string(),
  /** ADR-0014: a cached copy of whichever title statement currently wins. */
  title: z.string().nullable(),
  sortName: z.string().nullable(),
  /** ADR-0073: an EDTF string, so a year-only date stays a year. */
  releaseDate: z.string().nullable(),
  isContainer: z.boolean(),
  isOrdered: z.boolean(),
  /**
   * Every ordering this item sits in, and where (ADR-0009). ONE list: a
   * container the owner filled by hand and one a provider imported differ by
   * `placedBy` and by nothing else, because they are the same kind of fact.
   */
  placements: z.array(placementPublic),
  /**
   * What this container HOLDS, in its own order (ADR-0018) -- the mirror of
   * `placements` above, which is every ordering this item sits IN. Empty for an
   * item that is not a container, and for a container nothing has been placed
   * in yet.
   *
   * THE FIELD IS NAMED FOR THE GLOSSARY'S OWN VERB. `CONTEXT.md` defines a
   * Container as "an item that holds other items", and `members` -- what this
   * field was called until CNCORE-91 -- is a word the Placement entry now
   * rejects. "Members" stays as the heading a reader sees; this is the name the
   * read path emits, and the two are allowed to differ (ADR-0045).
   *
   * A LISTING RATHER THAN AN ARRAY SINCE CNCORE-89, which is the cap arriving:
   * `browse` imports a whole category in one call and ADR-0077 measures one at
   * 1,049 stories, so this was a thousand rows on an ordinary item page. An
   * array could carry the page and could not carry what the page was not
   * showing.
   */
  holds: placementsInContainerPublic,
  /**
   * Every value anybody has claimed about this item, with who claimed it. The
   * winner for a property comes first, by the same three terms the projection
   * uses (ADR-0024, ADR-0025), so the list cannot disagree with `title` above.
   */
  statements: z.array(statementPublic),
  /**
   * What this page owes for showing the above (ADR-0036).
   *
   * READ OFF THE CLAIMS, not listed anywhere: an item owes TMDB a notice because
   * a TMDB statement or placement is on it. So the obligation ends by itself when
   * the last of those rows goes, and a notice cannot outlive the content that
   * incurred it. Empty for an item whose sources oblige nothing, which is the
   * ordinary case -- the owner's own claims and the archive's both.
   */
  attribution: z.array(attributionPublic),
});

export type ItemPublic = z.infer<typeof itemPublic>;

/**
 * What the read path emits for one entry in the catalogue listing.
 *
 * ADR-0045 again, and DELIBERATELY NARROWER THAN `itemPublic`: a listing is not
 * an item page with the sections dropped. It carries what a reader needs to
 * recognise a row and follow it -- its address, its name, what sort of thing it
 * is -- and nothing a page would have to fetch the rest of the item to render.
 */
export const catalogueEntryPublic = z.object({
  /** The item's ADDRESS. `/items/<id>` is canonical (ADR-0066). */
  id: z.uuid(),
  /** ADR-0014: the projected title. An item with no title statement has none. */
  title: z.string().nullable(),
  /**
   * ADR-0005's kind, so a Person and a Work sharing a name are distinguishable
   * in a list rather than only once a reader has opened one of them.
   *
   * THE LABEL, NOT THE KEY. `CONTEXT.md` is binding on UI copy, and it calls
   * this "Time span" where the column says `time_span` -- so a surface printing
   * the column is showing a reader the schema. The label is seeded beside the
   * kind in migration 1, which is what makes this a read rather than a map.
   *
   * `itemPublic.kind` above carries the same words, and CNCORE-83 is where it
   * started to: a listing and a page disagreeing about what `kind` holds would
   * be two conventions in one read path.
   */
  kind: z.string(),
  /**
   * ADR-0004 folds containers into `work`, so `kind` alone cannot tell a story
   * from an ordering that holds stories. This is what tells them apart.
   */
  isContainer: z.boolean(),
});

export type CatalogueEntryPublic = z.infer<typeof catalogueEntryPublic>;

/**
 * What the read path emits for a LISTING as a whole -- the catalogue, work
 * browsing, and Catalogue search alike.
 *
 * `total` IS PART OF THE CONTRACT rather than something a caller counts for
 * itself, because `entries` is capped: a surface that could only count what it
 * was given would report the first page as the whole catalogue.
 *
 * CATALOGUE SEARCH HAD A SHAPE OF ITS OWN UNTIL CNCORE-88, and the reason it
 * no longer needs one is worth keeping. The entries were always identical -- a
 * result and a catalogue row carry the same four facts -- and the difference
 * was this cursor: a search had none to offer, and ADR-0119 makes
 * `continuesAfter: null` mean "the listing ends here", so a search over a
 * thousand matches answering null would have reported the hundred it returned
 * as all there were. A shape that could not say it beat a field that said it
 * falsely. Search walks now, so `null` means what it means everywhere and the
 * second schema was two places to add a field to.
 */
export const cataloguePublic = z.object({
  entries: z.array(catalogueEntryPublic),
  /**
   * How many items the question asked ANSWERS altogether, cap or no cap: what
   * the catalogue holds, what work-browsing shows, or how many a search
   * matched. One shape for all three, because the cap and what it hides are one
   * rule however the listing was asked for.
   */
  total: z.number().int().nonnegative(),
  /**
   * The id to ask for the next page with, or `null` where the catalogue ends
   * here (ADR-0119).
   *
   * IT IS AN ITEM'S ADDRESS rather than an encoded sort key, which is what
   * keeps the projection behind this seam: a cursor spelling out `sort_name`
   * would be emitting a column ADR-0045 never named, through a side door, into
   * a URL a reader can read.
   *
   * AND IT SAYS BOTH THINGS AT ONCE -- whether there is more, and where it
   * starts -- because a caller could only work the first out by subtracting,
   * and a keyset walk has no offset to subtract from.
   */
  continuesAfter: z.uuid().nullable(),
});

export type CataloguePublic = z.infer<typeof cataloguePublic>;

/**
 * The Owner's own note about one item (ADR-0096), as the read path answers one.
 *
 * NOT `...Public`, AND THE SUFFIX IS THE DECISION. Every other schema in this
 * file is what the read path emits to ANYONE, because ADR-0044 leaves reads open
 * and ADR-0072 gives a visitor everything on the page. A note is the exception
 * ADR-0045 named before there was one to name: that record enumerates what the
 * public read path carries and says "no notes". So this rides on a procedure of
 * the OWNER'S, and a name claiming it was public would be the one field in this
 * file whose name said the opposite of its rule.
 *
 * ADR-0045'S ENUMERATION STILL APPLIES. Every field is named on purpose: the
 * statement's own id, its property id and its source id all stay out, exactly as
 * they do from `statementPublic`. What is emitted is what the page renders --
 * what the owner wrote, and who is on record as having written it.
 *
 * TWO FIELDS, AND NEITHER `property` NOR `sourceKind` IS AMONG THEM, where
 * `statementPublic` carries both. This shape answers about `note` and nothing
 * else, and migration 12 declares that property assertable by the owner alone --
 * so each would be the same constant on every row a reader ever sees, which is a
 * field added against a reader that does not exist. REVIEW CAUGHT `sourceKind`
 * HERE: it was emitted and read by nothing, under a docstring rejecting
 * `property` on exactly that ground. The day a second kind may assert a note is
 * the day the field earns its line, and ADR-0045 makes adding one the
 * deliberate act.
 *
 * `sourceLabel` STAYS BECAUSE THE PAGE RENDERS IT. It is as constant as the kind
 * -- `Owner`, seeded by migration 1 -- and the difference is that something reads
 * it: the note has to say whose it is, and a surface printing that word for
 * itself would be asserting what the row says instead of reading it, which is
 * the rule ADR-0045 settles for every other label the read path carries.
 */
export const ownerNote = z.object({
  /** What the owner wrote. Free text: `note` declares no validation (ADR-0012). */
  value: z.string(),
  /** What the source calls itself. Migration 1 seeds the owner's as `Owner`. */
  sourceLabel: z.string(),
});

export type OwnerNote = z.infer<typeof ownerNote>;

/**
 * What a write answers with: the Item it addressed, and nothing else.
 *
 * ADR-0045 REACHES A MUTATION TOO. The temptation is to answer with the whole
 * item so the caller need not ask again, and that is the strip-list problem
 * arriving through a second door: a field added to `items` later would ride out
 * on every create without a line being written for it. An id is what a caller
 * actually needs -- it is the address to go to next (ADR-0066) -- and the page
 * that wants the rest asks `item.get`, which names every field it emits.
 */
export const itemWritten = z.object({ id: z.uuid() });

/**
 * A Placement the Owner just wrote, by the id that names it.
 *
 * ITS OWN SCHEMA RATHER THAN `itemWritten`, though the shape is identical. The
 * two name different subjects, and every mutation in this product names a
 * PLACEMENT rather than an item on purpose (ADR-0061) -- a contract that called
 * a placement id an item id would be the one place that ambiguity was written
 * back in.
 */
export const placementWritten = z.object({ id: z.uuid() });

export type PlacementWritten = z.infer<typeof placementWritten>;

export type ItemWritten = z.infer<typeof itemWritten>;

/**
 * ADR-0005's seven kinds, as the catalogue holds them: the key a column takes
 * and the word a reader is shown.
 *
 * BOTH, UNDER NAMES THAT SAY WHICH IS WHICH, which is the pairing `findItem`
 * already answers with. A create form has to submit the VALUE while showing the
 * LABEL, so this is the one place on the read path where a surface legitimately
 * needs each -- everywhere a reader is merely SHOWN a kind, `kind` means the
 * label alone.
 *
 * READ OFF `item_kinds` RATHER THAN LISTED HERE. The seven and their words are
 * migration 1's, and `CONTEXT.md` is binding on them; a copy in this file would
 * be the same closed set in a second language, free to disagree.
 */
export const itemKindPublic = z.object({
  /**
   * What `items.kind` stores: `time_span`, never `Time span`.
   *
   * NAMED `value` RATHER THAN `key` OR `kind`, and both rejections are the
   * glossary's own. `CONTEXT.md` reserves `key` for a Credential, and `kind`
   * already means THE READER'S WORD everywhere else the read path emits one --
   * so reusing it here for the column's spelling would make `kind` answer two
   * things on one surface. `value` is what HTML calls the half of an option a
   * form submits, which is the only thing this field is ever used as.
   */
  value: z.string(),
  /** The reader's word for it, seeded beside the value (CNCORE-83). */
  label: z.string(),
});

export type ItemKindPublic = z.infer<typeof itemKindPublic>;

export const itemKindsPublic = z.object({ kinds: z.array(itemKindPublic) });
