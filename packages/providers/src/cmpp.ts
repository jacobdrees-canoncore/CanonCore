import { z } from "zod";

/**
 * CanonCore's own reading of the CMPP responses.
 *
 * THIS SCHEMA IS WRITTEN AGAIN IN EVERY PROVIDER REPO, AND THAT IS THE DESIGN
 * RATHER THAN AN OVERSIGHT. ADR-0031's "no shared code" reaches
 * provider-to-provider as much as provider-to-app, and a shared
 * `@canoncore/cmpp` package is exactly the coupling the repository boundary
 * exists to prevent -- attractive enough that ADR-0110 records the refusal so
 * the proposal meets a decision rather than a shrug. The anti-drift device is
 * the contract test at the second seam (CNCORE-8), which calls every provider
 * over HTTP and holds them to one shape.
 *
 * This copy is a CONSUMER'S, which is why it is not a transcription of the
 * provider's. Zod strips unknown keys, so a provider that declares more than
 * CanonCore reads is fine and stays fine; what is written here is only what
 * this app depends on.
 */

/**
 * A candidate match, or one record by id. Metadata and URLs, never media bytes.
 *
 * `kind` IS THE PROVIDER'S TAXONOMY OF WORKS -- `TV story`, `audio story` -- and
 * is deliberately not called `medium`. CONTEXT.md is binding on names and
 * reserves Medium for a playback medium, so carrying the provider's word over
 * under that name would collide with the catalogue's own meaning on arrival.
 * It is not a closed set either: `TV21 125 short story` is a real value.
 */
export const cmppRecord = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.string().min(1),
  /**
   * Every release date the provider holds, EACH AT ITS OWN PRECISION (ADR-0073).
   * `2007-03` is a real date at a real precision and widening it to a day would
   * invent one, so these are carried as the EDTF strings they arrive as and the
   * catalogue decides the earliest known release for itself (ADR-0081).
   */
  released: z.array(z.string()).default([]),
  writers: z.array(z.string()).default([]),
  series: z.string().nullable().default(null),
  /** Where the record came from. A CONTENT URL: never fetched unchecked. */
  url: z.url(),
});

export type CmppRecord = z.infer<typeof cmppRecord>;

/**
 * One member of a container, at its position in that container's ordering.
 *
 * POSITION IS NOT UNIQUE WITHIN AN ORDERING. Two records the source dates the
 * same day share one, because the source asserts no order between them and a
 * provider that invented one would be handing over a claim nobody made. ADR-0009
 * has no unique constraint on (container, position) for exactly this.
 */
export const cmppPlacement = z.object({
  position: z.number().int().positive(),
  record: cmppRecord,
});

/**
 * A container AND its ordering, together. That togetherness is the whole reason
 * `browse` exists (ADR-0033): the two in one answer ARE placements, so sixty
 * episodes arrive in one call rather than in sixty plus a guess at the order.
 *
 * An ordering is a DATED CLAIM BY A NAMED SOURCE (ADR-0017) rather than a
 * neutral fact, and this is the claim. Recording who made it is the app's half.
 */
export const cmppBrowse = z.object({
  /** The container itself, as a record: a container is an item like any other. */
  container: cmppRecord,
  /**
   * REQUIRED AND NOT DEFAULTED, where `unplaced` below is defaulted. An absent
   * ordering is a malformed browse rather than an empty one, and reading it as
   * empty would import a container with no members and call that success.
   */
  ordering: z.array(cmppPlacement),
  /**
   * Members the provider serves that THIS ordering cannot place -- for the wiki,
   * stories the archive holds no release date for, which is a sixth of them.
   *
   * THEY ARE MEMBERS WITH NO POSITION, not non-members. Dropping them shrinks a
   * container silently and positioning them last asserts an order the source
   * never gave, so they arrive as their own list and stay a distinct fact.
   */
  unplaced: z.array(cmppRecord).default([]),
});

export type CmppPlacement = z.infer<typeof cmppPlacement>;
export type CmppBrowse = z.infer<typeof cmppBrowse>;

/**
 * What `search` answers: candidates, possibly none.
 *
 * AN EMPTY `results` IS AN ANSWER rather than a failure -- a query nothing
 * matched -- which is exactly why a MISSING query must not produce one
 * (ADR-0033, and the `?q=` reading CNCORE-33 settled). The client's job at this
 * seam is to keep those two apart: a provider's refusal travels as a refusal,
 * and only a provider that answered can produce an empty list.
 *
 * THE SHAPE IS THE ONE `packages/contract` SPECIFIES, and this is CanonCore's
 * reading of it rather than an import of it -- the same arrangement the record
 * and browse schemas above are under. That package writes the SPECIFICATION and
 * depends on no `@canoncore/*` package so it cannot reach this one by accident
 * (ADR-0103); this is a CONSUMER'S copy, which strips unknown keys where the
 * specification keeps them. A single schema serving both would make the
 * contract test prove that two providers satisfy CanonCore, which is a much
 * weaker claim than that they satisfy one contract.
 */
export const cmppSearch = z.object({ results: z.array(cmppRecord) });

export type CmppSearch = z.infer<typeof cmppSearch>;

/**
 * The longest `data:` URI a source's mark may be, in characters.
 *
 * 256 KiB of base64, which is about 192 KiB of image. TMDB's wordmark is 2,297
 * bytes, so this admits every mark anybody would actually publish and refuses the
 * one that would be inlined into every page of the catalogue.
 */
const MAX_LOGO_CHARS = 256 * 1024;

/**
 * What a provider declares about itself.
 *
 * `versions` IS OPTIONAL AND ABSENCE MEANS THE FIRST VERSION (ADR-0032). Never
 * required: the W3C Reconciliation Service API this rule is taken from
 * contradicts itself -- its prose infers 0.1 from absence while its JSON schema
 * lists the field under `required` -- and we take the prose, because a required
 * field breaks every existing provider on the day it lands.
 *
 * `operations` is how a provider says whether it answers `browse`, which is the
 * optional one (ADR-0033), and CanonCore READS IT before calling: a provider
 * that does not declare `browse` is never asked for one. The wiki provider
 * declares all three since CNCORE-17, so the optionality is now exercised in
 * both directions rather than only by an absence.
 *
 * (It declared `search` and `lookup` alone until then, and this comment used to
 * say that absence was the only thing in version one exercising the optionality
 * at all. It no longer is, and the sentence is corrected here rather than
 * contradicted somewhere else.)
 */
export const cmppManifest = z.object({
  name: z.string().min(1),
  versions: z.array(z.number().int().positive()).default([1]),
  operations: z.array(z.string()).default([]),
  /**
   * The ceiling on how long CanonCore may keep this provider's values, in
   * seconds. Read as a declared field rather than a special case in our core,
   * which is what keeps a third party's licence terms out of the catalogue's
   * own logic (ADR-0033).
   */
  max_cache_age: z.number().int().positive().optional(),
  images: z
    .object({
      /**
       * What the provider stores for each image role, IN THE SOURCE'S OWN
       * VOCABULARY (ADR-0033). `null` means the source offers no choice of
       * rendition.
       *
       * EITHER ONE VARIANT OR ONE PER ROLE, and the second half is ADR-0033
       * corrected rather than extended. That record fixes the field as
       * `string | null` and gives TMDB's `w500` as its example; TMDB cannot
       * answer it, because `/configuration` puts `w500` in `poster_sizes` and in
       * neither `backdrop_sizes` nor `still_sizes` -- so one string for every role
       * names a size that 404s for two of the three. `provider-tmdb` answers a
       * map for that reason and this app could not read its manifest at all until
       * this line, which is the first thing CNCORE-8's contract test would have
       * caught had it existed first.
       *
       * WIDENED HERE RATHER THAN NARROWED THERE. This is a CONSUMER'S schema and
       * nothing in CanonCore reads the value yet, so widening costs a line;
       * holding a provider to a shape its source makes impossible costs it a bug.
       */
      stored_variant: z
        .union([z.string(), z.record(z.string(), z.string())])
        .nullable()
        .default(null),
      per_role_limit: z.number().int().nonnegative().default(0),
      quality_floor: z.number().int().nonnegative().default(0),
    })
    .optional(),
  /**
   * What this source's licence obliges the app to show, or `null` where it
   * obliges nothing.
   *
   * DECLARED, NOT HARDCODED, which is ADR-0033's whole argument applied to the one
   * field where the temptation is strongest: a notice held in CanonCore against a
   * known provider identity would work perfectly for TMDB and leave the next
   * source's obligation nowhere to go. The app renders what it is handed and knows
   * nothing about whose terms it is satisfying.
   *
   * `null` IS AN ANSWER, not an absence. The wiki provider owes no notice and no
   * mark, and saying so is what lets the app render nothing on purpose rather than
   * render nothing because a key was missing.
   */
  attribution: z
    .object({
      /**
       * VERBATIM, and the app's job is to print it unaltered. ADR-0036 checked
       * TMDB's against their terms character for character; a provider that
       * paraphrases its own licence is a provider in breach, and not something
       * this schema can detect.
       */
      notice: z.string().min(1),
      /**
       * The source's mark, where the source requires one to be shown.
       *
       * THE BYTES ARE HERE RATHER THAN A URL TO FETCH, which is the opposite of
       * how every other image in CMPP travels, and the difference is WHICH PROCESS
       * FETCHES. An image reference on a record is fetched by this server, which
       * ADR-0034's allowlist says may reach the provider. A mark on a page is
       * fetched by the READER'S BROWSER, which nothing has ever promised can: a
       * provider on a LAN address or a container network is reachable by the app
       * and not by the person reading it, and the resulting breach renders as
       * whitespace with nothing reporting it.
       *
       * Rendered through an `img`, never inlined, which is what makes third-party
       * markup safe to display: an SVG loaded through `img` renders with scripting
       * disabled.
       */
      logo: z
        .object({
          /**
           * `data:<media type>;base64,<payload>`, and BOTH HALVES OF THAT ARE
           * CHECKED because this is a third party's string on its way to an `img`
           * on every page the source's claims appear on.
           *
           * `;base64,` is required rather than assumed. `data:image/svg+xml,<svg/>`
           * is the percent-encoded form, is perfectly legal, and is not what
           * anything downstream expects -- so a provider sending it would parse
           * clean and render as a broken image, which is an unmet licence
           * obligation that looks like whitespace.
           *
           * AND A CEILING, because `MAX_BODY_BYTES` is a cap on one RESPONSE and
           * not on what this field costs. These bytes are inlined into every page
           * that shows this source's claims; a 4 MiB manifest is paid once and a
           * 4 MiB mark is paid on every render. A wordmark is a few kilobytes --
           * TMDB's is 2,297 bytes -- so this is generous by two orders of
           * magnitude and still finite.
           */
          data_uri: z
            .string()
            .max(MAX_LOGO_CHARS)
            .regex(
              /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$/,
              "a base64 `data:` image URI",
            ),
          /**
           * The accessible name, carrying the disclaimer TMDB's clause requires --
           * "must make it clear that use of any TMDB logos does not imply any
           * endorsement, certification, or other approval". A reader who cannot see
           * the mark is exactly the reader who needs that sentence in text.
           */
          alt: z.string().min(1),
        })
        .nullable()
        .default(null),
    })
    .nullable()
    .default(null),
});

export type CmppManifest = z.infer<typeof cmppManifest>;
