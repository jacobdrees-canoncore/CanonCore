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

export const itemPublic = z.object({
  id: z.uuid(),
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
