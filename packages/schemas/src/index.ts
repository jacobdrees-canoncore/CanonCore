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
 * What the read path emits for one MEMBER of a container: the mirror of
 * `placementPublic`, read from the container's end rather than the item's.
 *
 * ADR-0045 again -- every field named on purpose. `id` and `itemId` are both
 * ADDRESSES rather than internal ids: `itemId` is the member's own
 * `/items/<id>`, and `id` is the placement `?via=` carries, which is what says
 * WHICH arrival this was. A repeat is why that distinction has to be in the
 * payload at all -- the same item twice in one container is two members with
 * one `itemId` between them (ADR-0009), so nothing but the placement id can
 * tell the recap from the episode.
 *
 * WHAT IT DOES NOT CARRY is `placedBy`, and THE FIRST REASON GIVEN FOR THAT WAS
 * WRONG. It said a container's own member list is one ordering "so every row
 * would answer the same". ADR-0017 says otherwise: sources disagreeing about
 * position produce TWO placement rows in one container, and nothing stops the
 * owner hand-placing into a container a provider browsed. Rows here can differ
 * in `placedBy`, and the consequence is that a Repeat (ADR-0009, one source,
 * twice, on purpose) and a disagreement (two sources, one membership) render
 * identically.
 *
 * TODO(CNCORE-90): make that distinguishable. It is left out here rather than
 * fixed in place because no instance can hold a disagreement yet -- only
 * `browse` writes placements, and one call writes one source's claims -- and
 * because the fix is not just this field: `findPlacementsOfItem` resolves a
 * spokesman by rank, and a member list cannot copy that ordering, since
 * position leads inside a container (ADR-0018) where rank leads across them.
 */
export const memberPublic = z.object({
  id: z.uuid(),
  /** ADR-0014: the member's projected title. */
  title: z.string().nullable(),
  itemId: z.uuid(),
  /**
   * Where this member sits in THIS container's ordering (ADR-0018), or NULL
   * where no source gave it one. CONTEXT.md calls that Unplaced and is explicit
   * that it is a placement with no position rather than an absent placement:
   * dropping the row shrinks the container silently, and numbering it last
   * asserts an order the source never gave.
   */
  position: z.number().int().nullable(),
});

export type MemberPublic = z.infer<typeof memberPublic>;

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
   */
  members: z.array(memberPublic),
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
 * What the read path emits for the catalogue as a whole.
 *
 * `total` IS PART OF THE CONTRACT rather than something a caller counts for
 * itself, because `entries` is capped: a surface that could only count what it
 * was given would report the first page as the whole catalogue.
 */
export const cataloguePublic = z.object({
  entries: z.array(catalogueEntryPublic),
  /** How many items the catalogue holds altogether, cap or no cap. */
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
 * What the read path emits for a Catalogue search (`CONTEXT.md`), which is the
 * surface that searches the owner's own catalogue -- never the CMPP operation
 * of the same name, which asks a PROVIDER for candidates.
 *
 * THE SAME ENTRIES AS THE LISTING, DELIBERATELY. A result and a catalogue row
 * carry the same four facts: an address, a name, what sort of thing it is, and
 * whether it holds other things. Two schemas for that would be two places to
 * add a field to.
 *
 * AND DELIBERATELY NOT `cataloguePublic`, WHICH IS THE DECISION HERE. That one
 * carries `continuesAfter`, and ADR-0119 makes `null` there mean "the listing
 * ends here". A search over a thousand matches has no cursor to offer yet
 * (CNCORE-88), so answering `null` would tell every caller the hundred it
 * returned were all there were -- a silent cap wearing a contract's clothes.
 * The field is absent rather than present and false.
 */
export const catalogueSearchPublic = z.object({
  entries: z.array(catalogueEntryPublic),
  /**
   * How many items MATCHED altogether, cap or no cap. With no cursor beside it
   * this is the whole of what keeps the cap from being silent, which is why it
   * is in the contract rather than left for a caller to count.
   */
  total: z.number().int().nonnegative(),
});

export type CatalogueSearchPublic = z.infer<typeof catalogueSearchPublic>;
