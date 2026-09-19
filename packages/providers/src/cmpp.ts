import { z } from "zod";

import { boundedProse } from "./reason";

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
  /**
   * THE ID OF THE CONTAINER `series` NAMES, which `browse` takes -- and the
   * name above is never it, because a name can be renamed out from under an
   * import (ADR-0033).
   *
   * READ BY `provider.containerOf`, ONE LOOKUP AT A TIME (CNCORE-238, ADR-0149).
   * It was kept here and read by nothing under CNCORE-187, which is the half
   * that made this possible: it had been STRIPPED, so a record could not reach
   * its container even where its provider said which.
   *
   * WHICH IS WHY THE READER IS A CLICK RATHER THAN THE SEARCH. `provider-tmdb`
   * fills this on a lookup and a browse and NEVER on a search, so no candidate
   * on `/import` carries one and no amount of reading the search results would
   * find it -- the Owner points at one record, and that record alone is looked
   * up. `provider-wiki` sends none at all, since a story sits in many timelines
   * at once, and the page says so rather than offering a way to nothing.
   */
  series_id: z.string().nullable().default(null),
  /**
   * Where the record came from. A CONTENT URL, AND HTTP IS PART OF READING IT
   * rather than something checked later by whoever fetches it.
   *
   * `z.url()` ALONE SAYS ONLY THAT A STRING PARSES AS A URL. Measured against
   * zod 4.5.4, `javascript:alert(1)`, `data:text/html,...`, `vbscript:x` and
   * `file:///etc/passwd` all parsed clean under it -- so this field is the sink
   * a provider would reach a reader's browser through, and ADR-0031's whole
   * position is that a provider is an untrusted URL rather than code we run.
   * It was harmless only while `asProvided` dropped the value and no reader had
   * ever seen one; CNCORE-77 carried these out of the package and CNCORE-68 is
   * the page that puts one in an `href`.
   *
   * SAID AT THE SCHEMA RATHER THAN BY CALLING `assertContentUrl`, and the two
   * are not the same rule. That function guards an outbound request and carries
   * the ADDRESS deny-list with it, which would refuse `http://127.0.0.1:8080/1`
   * -- a perfectly ordinary self-link from a provider the owner runs on
   * loopback, which ADR-0034 makes legal by name. Nothing fetches this URL, so
   * the address question is not this field's to ask; the scheme is, because the
   * scheme is what decides whether a reader's browser treats the value as a
   * destination or as a program.
   *
   * THE REGEXP IS THE RULE SPELLED OUT, AND IT IS MATCHED CASE-SENSITIVELY
   * AGAINST AN ALREADY-LOWERCASED SCHEME. `HTTPS://Example.Invalid/1` passes
   * because the WHATWG parser lowercases the scheme before zod tests it, NOT
   * because the test is case-insensitive: measured against zod 4.5.4,
   * `z.url({ protocol: /^HTTPS$/ }).safeParse("https://x.test/")` is `false`.
   * So this pattern must stay lower case -- an upper-case one would refuse
   * every URL there is, and it would look like the stricter spelling.
   *
   * `javascript://example.invalid/` is refused whatever it is shaped like,
   * because the scheme is read from the parse rather than from the string.
   */
  url: z.url({ protocol: /^https?$/ }),
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
 * What `containers` answers: the containers a provider's SOURCE asserts as
 * containers, as records (ADR-0033 under CNCORE-185 and CNCORE-186).
 *
 * AN EMPTY LIST IS A CLAIM ABOUT THE SOURCE, that it holds none. It is never
 * how a provider declines the operation, which its manifest says -- so a
 * caller reads `operations` before asking, exactly as it does for `browse`.
 */
export const cmppContainers = z.object({ containers: z.array(cmppRecord) });

export type CmppContainers = z.infer<typeof cmppContainers>;

/**
 * The longest `data:` URI a source's mark may be, in characters.
 *
 * 256 KiB of base64, which is about 192 KiB of image. TMDB's wordmark is 2,297
 * bytes, so this admits every mark anybody would actually publish and refuses the
 * one that would be inlined into every page of the catalogue.
 */
const MAX_LOGO_CHARS = 256 * 1024;

/**
 * The longest a licence's own words may be, in characters: `notice`, and the
 * mark's `alt`, which is a notice too (ADR-0123, CNCORE-213).
 *
 * ABOUT TEN TIMES TMDB'S, WHICH IS THE ONE REAL OBLIGATION THERE IS. Its
 * notice is 107 characters and its alt 86, measured on 2026-09-19. A Provider
 * past this is refused whole, so the ceiling sits well above any sentence a
 * licence plausibly asks for. It is still a paragraph and not four mebibytes,
 * and it is printed on every Item page that shows the source's claims.
 */
const MAX_NOTICE_CHARS = 1_000;

/** What stands in for the name of a Provider that named itself in nothing. */
const UNNAMED = "a Provider that did not name itself";

/**
 * What stands in for a credential a Provider described in no words.
 *
 * The Owner still has to be told this Provider wants something, and the honest
 * thing to say about a Provider that described it in nothing is that it
 * described it in nothing.
 */
const SAID_NOTHING = "this Provider needs something, and did not say what.";

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
 *
 * EVERY STRING HERE IS DECIDED AT ITS FIELD: BOUNDED THERE, OR NAMED WITH THE
 * REASON IT IS NOT (ADR-0123, CNCORE-165). This is the rule a field added to
 * this object meets, written here because here is where it would be added, and
 * `cmpp.test.ts` fails the build on a bare `z.string()` nobody has named:
 *
 * - PROSE CANONCORE FRAMES is `boundedProse`: cut to what the Owner reads, and
 *   floored so a Provider that said nothing cannot crash the request reading
 *   it. `name` and `credential.label`.
 * - PROSE AN OBLIGATION REQUIRES VERBATIM cannot be cut, because cutting a
 *   licence notice is the breach it exists to prevent. So it is REFUSED past a
 *   ceiling, and the refusal is the whole manifest: `attribution.notice` and
 *   `logo.alt` past `MAX_NOTICE_CHARS`, `logo.data_uri` past `MAX_LOGO_CHARS`.
 * - A FIELD NEVER PRINTED AS TEXT is named with that reason: `operations`,
 *   `stored_variant`, and `unlock_path`, which `unlockUrlFor` judges before it
 *   reaches an href.
 *
 * A RECORD'S fields are out of it, which is a different thing from this object
 * and not an omission. A
 * manifest is a Provider describing itself; a record is a source's CLAIM, which
 * the catalogue holds and the Owner curates, and bounding a title would corrupt
 * the catalogue rather than protect a page.
 *
 * WHY AT THE FIELD, AND NOT WHERE A PAGE PRINTS IT: `name` was the fourth
 * surface to carry a Provider's prose and the first nobody had bounded, and it
 * read `z.string().min(1)` exactly as the bounded ones did. A bound at each
 * surface leaves the next surface starting from raw; a bound here leaves nothing
 * downstream able to read the raw value at all.
 */
export const cmppManifest = z.object({
  name: boundedProse(UNNAMED),
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
       *
       * REFUSED PAST ITS CEILING, AND THE REFUSAL IS THE WHOLE MANIFEST
       * (CNCORE-213). It reaches every Item page the source claims a value on,
       * and `boundedProse` would cut it, which is the breach above. Refusing
       * only the attribution would leave the Provider importing content whose
       * notice nothing can print. ADR-0123 records the choice.
       */
      notice: z.string().min(1).max(MAX_NOTICE_CHARS),
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
           *
           * So it is a notice, and is refused past the same ceiling.
           */
          alt: z.string().min(1).max(MAX_NOTICE_CHARS),
        })
        .nullable()
        .default(null),
    })
    .nullable()
    .default(null),
  /**
   * What this provider needs to reach its own upstream, where it needs
   * anything (ADR-0122). Absent from a provider that needs nothing, which is
   * every provider that existed before this field.
   *
   * `z.object` AND NOT `z.looseObject`, WHICH IS THE WHOLE OF CANONCORE'S HALF
   * OF ADR-0122. The contract declares this loosely because a provider may say
   * more about its own credential than CanonCore reads; this is the CONSUMER'S
   * copy, and zod strips what it does not name. So `fields` -- the contract's
   * list of what the Owner supplies -- is dropped HERE, and there is no
   * property anywhere in this app for a credential value to sit in.
   *
   * THAT IS STRUCTURAL RATHER THAN REMEMBERED, and it is the point. An earlier
   * draft of ADR-0122 had CanonCore rendering the provider's form and
   * forwarding what was typed; the record now refuses the value "not even in
   * transit", because MCP's 2026-07-28 revision prohibits form elicitation for
   * credentials by name and BCP 240 removed OAuth's password grant over the
   * same leak surface. A schema that cannot hold the value is how this app
   * stays on the right side of that without a rule anybody has to keep.
   */
  credential: z
    .object({
      /** One sentence for the OWNER: the only prose CanonCore renders about a credential. */
      label: boundedProse(SAID_NOTHING),
      /**
       * WHERE THE OWNER GOES, ON THE PROVIDER. A PATH and not a URL, which is
       * the one place in CMPP that distinction is load-bearing: the provider
       * does not know the URL CanonCore reaches it on -- one behind a proxy
       * could not -- and CanonCore holds that base URL already.
       *
       * A LEADING SLASH IS NOT ENOUGH TO KEEP THE LINK ON THE PROVIDER, and
       * `joinUnlockPath` is where that is settled rather than here. Measured on
       * node 24.19.0: `//evil.test/unlock`, `/\evil.test/unlock` and a path
       * whose first character is a tab all satisfy `startsWith("/")` and all
       * resolve to a DIFFERENT ORIGIN against a provider's base URL. So this
       * field is checked for the contract's own rule and the origin is checked
       * on the joined URL, where the escape actually happens.
       */
      unlock_path: z.string().startsWith("/"),
      /**
       * ONLY THE PROVIDER CAN KNOW THIS. It is the one being refused by its
       * upstream, and a credential's validity is not something CanonCore could
       * test without performing the provider's own job (ADR-0122).
       *
       * THREE AND NOT FOUR: a provider holding something malformed reports
       * `absent`, because from the Owner's side it has nothing to answer with.
       */
      state: z.enum(["absent", "valid", "expired"]),
      /**
       * When it last became that, or null where nothing was ever supplied.
       *
       * `expired` ALONE IS NOT AN ANSWER. It does not say whether the session
       * lapsed a minute ago or three weeks ago, which is the difference between
       * renewing it and going to look at what else broke.
       */
      state_changed_at: z.iso.datetime().nullable(),
    })
    .optional(),
});

export type CmppManifest = z.infer<typeof cmppManifest>;
