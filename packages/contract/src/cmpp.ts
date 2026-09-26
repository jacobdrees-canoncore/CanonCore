import { z } from "zod";

/**
 * WHAT CMPP REQUIRES OF ANY PROVIDER. This file is the specification.
 *
 * Until it existed, nothing anywhere defined the CMPP record shape -- not an ADR,
 * not `CONTEXT.md`. It lived only in each provider's own `src/cmpp.ts` plus
 * CanonCore's reading of it, which made `provider-wiki`'s copy the INCUMBENT
 * DRAFT rather than the specification: whatever the first provider happened to
 * send was the rule, and the second provider discovered that by diverging from it.
 *
 * IT IS DELIBERATELY NOT `@canoncore/providers`' SCHEMA, and this package depends
 * on no `@canoncore/*` package at all so that it cannot become one by accident.
 * That schema is a CONSUMER'S -- "what this app reads" -- and it strips unknown
 * keys everywhere but a record (CNCORE-349), widens where the app does not
 * care, and omits fields nothing renders yet.
 * Holding two providers to it would prove they both satisfy CanonCore, which is a
 * different and much weaker claim than that they satisfy one contract.
 *
 * IT IS THE INTERSECTION, NOT THE UNION. A field one provider sends and the other
 * cannot is not part of the contract, or the contract would be "be TMDB". So the
 * required half is small and the extensions are checked ONLY FOR SHAPE WHEN
 * PRESENT -- which is the half that actually stops drift, since an extension
 * spelled two ways by two providers is exactly how a contract quietly becomes two
 * integrations.
 *
 * UNKNOWN KEYS ARE PERMITTED rather than stripped or refused. ADR-0033 makes
 * `browse` optional and lets a provider declare more than it is asked for, so a
 * provider ahead of the contract is well-formed; what is refused is a provider
 * that spells a KNOWN field wrongly.
 *
 * ON A RECORD, AN UNKNOWN KEY IS A PROPERTY THE SOURCE DEFINES (CNCORE-349), and
 * it answers to the same casing rule as every field here: snake_case. That is a
 * CONTRACT rule and not a courtesy, because a source-defined name the contract
 * later adopts must not need respelling to become the contract's own -- and
 * because a key that merely respells a field this file names (`externalIds`)
 * is not the source's property at all but that field gone missing. The
 * contract test holds every record key to one or the other.
 */

/** A source's own vocabulary for a role, size or kind: never a closed set here. */
const sourceWord = z.string().min(1);

/**
 * EVERY URL CMPP CARRIES IS A CONTENT URL -- `CONTEXT.md`'s own word for a URL
 * arriving inside a provider's response -- AND CMPP IS AN HTTP CONTRACT. So the
 * scheme is part of the shape a provider is held to, not a caller's problem.
 *
 * `z.url()` ALONE DOES NOT SAY THIS. Measured against zod 4.5.4,
 * `javascript:alert(1)`, `data:text/html,...`, `vbscript:x` and
 * `file:///etc/passwd` every one parsed clean under it -- so until this line the
 * contract did not oblige a provider to send an HTTP URL at all, and a provider
 * sending a `javascript:` URL was conformant. ADR-0031 makes a provider an
 * untrusted URL rather than code we run, and a value that runs in the reader's
 * browser is that position failing at the one place it has to hold.
 *
 * THE SCHEME AND NOT THE HOST. `z.httpUrl()` would also require a dotted host
 * name, which refuses `http://127.0.0.1:8080/1` and `http://localhost/1` --
 * ordinary self-links from a provider its owner runs on their own machine, and
 * ADR-0034 makes such a provider legal by name. The contract is the INTERSECTION every provider must
 * satisfy, so a rule that refuses a legitimate deployment is the contract saying
 * "be on the public internet", which is not a thing CMPP requires.
 */
const contentUrl = z.url({ protocol: /^https?$/ });

/**
 * One record: a candidate from `search`, or one thing by id from `lookup`.
 *
 * `kind` IS THE SOURCE'S OWN TAXONOMY -- `TV story`, `movie`, `audio story` -- and
 * CMPP closes no list of them. `CONTEXT.md` reserves Medium for a PLAYBACK medium,
 * so this must never be called that.
 */
export const record = z.looseObject({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: sourceWord,
  /**
   * Every release date the source holds, EACH AT ITS OWN PRECISION (ADR-0073).
   * `2007-03` is a real date at a real precision, and a provider widening it to a
   * day would be inventing one. Absent means the source holds none, which is a
   * real answer -- a sixth of the archive's stories are like that.
   */
  released: z.array(z.string()).default([]),
  writers: z.array(z.string()).default([]),
  /** The container's NAME, where the source names one. Never its id: that is `series_id`. */
  series: z.string().nullable().default(null),
  /** Where the record came from, on the web. A CONTENT URL, so HTTP or nothing. */
  url: contentUrl,

  /*
   * THE EXTENSIONS. Not required of anybody -- `provider-wiki` serves no images
   * and has one id space, so it can send none of these and is fully conformant.
   * Checked for SHAPE when present, which is the whole anti-drift job: a second
   * provider inventing `externalIds` or a bare `image` string would pass a test
   * that only asked whether the required fields were there.
   */

  /**
   * The CMPP id of the container `series` names, so the container can be BROWSED
   * rather than only read. A NAME cannot be browsed, and multi-search never
   * returns collections -- so without this a film named its collection and
   * nothing could reach it. Plex requires `parentRatingKey` beside `parentTitle`
   * for the same reason.
   */
  series_id: z.string().min(1).nullable().optional(),
  /**
   * References, never bytes (ADR-0031).
   *
   * ONLY `role` AND `url` ARE REQUIRED, and that is the intersection being taken
   * seriously rather than a weak schema. ADR-0033 names five fields for an image
   * reference -- `id`, `role`, `url`, `description_url`, `licences` -- and TMDB
   * has none of the three this omits: it serves no file description pages and no
   * per-file licence tags, because its images come from studios who keep those
   * rights. It sends `width` instead, which ADR-0033's list does not name at all
   * and which is the only thing `quality_floor` can be enforced against.
   *
   * So the two providers share exactly `role` and `url`, and requiring either
   * one's full set would be writing "be that provider" into the contract. THIS
   * SCHEMA REQUIRED `width` UNTIL CI RAN IT AGAINST THE REAL WIKI IMAGE, which is
   * this file making the very mistake it exists to prevent -- taking the shape of
   * whichever provider was in front of it as the rule.
   *
   * What the optional fields buy is the half a required set could not: each is
   * checked WHEN PRESENT, so a provider inventing `licence` or `pixelWidth` fails
   * here rather than passing as an unknown extension nobody reads.
   */
  images: z
    .array(
      z.looseObject({
        /** What the image is FOR. Without it `per_role_limit` limits nothing. */
        role: sourceWord,
        /** Where the BYTES are: the field ADR-0037's store is filled from. */
        url: contentUrl,
        /** The source's own stable handle, where it has one. */
        id: z.string().min(1).nullable().optional(),
        /** The page describing the file, where a source keeps licence and credit. */
        description_url: contentUrl.nullable().optional(),
        /** The source's own licence labels. Empty means the source states none. */
        licences: z.array(z.string()).optional(),
        /** Pixels, where the source publishes them: what `quality_floor` is checked against. */
        width: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  /**
   * This record's id in other people's id spaces, KEYED BY SCHEME. What lets
   * CanonCore know two providers are describing one work without matching on
   * title and year against a confidence score (ADR-0028). Plex ships it as
   * `Guid[]`, Jellyfin as `ProviderIds`.
   */
  external_ids: z.record(z.string(), z.string()).optional(),
  /**
   * WHICH OF THE CATALOGUE'S SEVEN KINDS THIS RECORD IS (ADR-0005, CNCORE-367),
   * where `kind` above is the source's own word for it. The provider maps one
   * to the other because only it knows its vocabulary; the contract closes the
   * target, so an eighth kind is refused here rather than at a foreign key.
   * Absent means a work, which is what every record was before this existed.
   */
  item_kind: z
    .enum(["work", "person", "organisation", "place", "time_span", "character", "concept"])
    .optional(),
});

export type CmppRecord = z.infer<typeof record>;

/** What `search` answers. Candidates, possibly none: an empty result is an answer. */
export const searchResponse = z.looseObject({ results: z.array(record) });

/**
 * One member of a container, at its position in that container's ordering.
 *
 * POSITION IS 1-BASED AND NOT UNIQUE. Two records the source asserts no order
 * between share a position, because a provider that invented one would be handing
 * over a claim nobody made (ADR-0009, ADR-0017). It is never the source's own
 * numbering: TMDB files specials as season ZERO, and a position of 0 is not a
 * position -- the source's numbering is already in the id.
 */
export const placement = z.looseObject({
  position: z.number().int().positive(),
  record,
});

/**
 * What `browse` answers: a container AND its ordering, together.
 *
 * The togetherness is the whole reason the operation exists (ADR-0033) -- the two
 * in one answer ARE placements, so sixty episodes arrive in one call rather than
 * in sixty plus a guess at the order.
 */
export const browseResponse = z.looseObject({
  /** A container is a record like any other (ADR-0004). */
  container: record,
  /**
   * REQUIRED AND NOT DEFAULTED, where `unplaced` is defaulted. An absent ordering
   * is a malformed browse rather than an empty one, and reading it as empty would
   * import a container with no members and call that success.
   */
  ordering: z.array(placement),
  /**
   * Members the source serves that THIS ordering cannot place. MEMBERS WITH NO
   * POSITION, not non-members: dropping them shrinks a container silently and
   * positioning them last asserts an order the source never gave.
   */
  unplaced: z.array(record).default([]),
});

/**
 * What the `containers` operation answers: the containers this provider's SOURCE ASSERTS
 * as containers.
 *
 * THIS SAID "EVERY CONTAINER THIS PROVIDER HOLDS", AND THE FIRST PROVIDER TO ANSWER IT
 * SHOWED THAT IS NARROWER THAN EVERY ID `browse` TAKES. Corrected in the sentence rather
 * than under it, because a note below would leave the strict reading standing as the one a
 * provider is held to. `provider-wiki` browses a `Theory:Timeline` page, any `Category:`
 * and, since CNCORE-367, the two infoboxes that type a Time span, and lists only the first:
 * a timeline is a container the wiki WROTE as one,
 * over a bounded population, where a category is one that provider COMPUTES by release date
 * because a category states membership and no sequence. Every page in namespace 14 is one,
 * maintenance categories included, and a listing padded with those is worth nothing to the
 * Owner it exists to save from knowing an id in advance. NO COUNT IS CLAIMED FOR THAT
 * NAMESPACE -- nothing has measured it, and the argument turns on a category being
 * UNASSERTED as an ordering rather than on how many there are.
 *
 * THE NARROWING DOES NOT LET AN UNBOUNDED SOURCE IN, which is the test of it. TMDB asserts
 * its collections and its series as containers, so a provider answering only what its
 * source asserts still cannot answer there -- `provider-tmdb` declines, and ADR-0033
 * carries why.
 *
 * RECORDS RATHER THAN IDS, because ADR-0004 makes a container a record like any
 * other and `browse` already answers one as a record. A list of bare ids would
 * oblige the app to `lookup` each one before it could show the Owner a name,
 * which is the wall this operation exists to knock down arriving one level along.
 *
 * WRAPPED IN AN OBJECT, as `search` is and for the same reason: a bare array has
 * nowhere to grow a cursor, and a provider that one day holds more containers
 * than it will answer at once needs one. Left out here because no provider does
 * -- the wiki holds 465 `Theory:Timeline` pages -- and because an optional field
 * added later is an addition rather than a change (ADR-0032), which is the
 * argument `credential` already rests on.
 *
 * AN EMPTY LIST IS AN ANSWER, exactly as an empty `results` is: it says this
 * source holds no containers. It is NOT how a provider says it does not offer
 * the operation -- that is declared in the manifest, and conflating the two is
 * what this operation exists to stop.
 */
export const containersResponse = z.looseObject({ containers: z.array(record) });

/** The two operations every provider must answer (ADR-0033). */
export const REQUIRED_OPERATIONS = ["search", "lookup"] as const;

/** A container AND its ordering, together. Declared when offered, never assumed. */
export const BROWSE_OPERATION = "browse";

/**
 * Which containers this provider holds. Declared when offered, never assumed.
 *
 * NAMED FOR WHAT IT ANSWERS rather than for the asking, which is how the two
 * products that solve this solve it: Plex answers its libraries at
 * `/library/sections` and Jellyfin its own at `/Library/MediaFolders`. The name
 * is the path, as it is for the other three, so `GET /containers` is the whole
 * of the request.
 */
export const CONTAINERS_OPERATION = "containers";

const declaration = z.looseObject({
  name: z.string().min(1),
  versions: z.array(z.number().int().positive()).default([1]),
  /**
   * WHICH OPERATIONS THIS PROVIDER ANSWERS. `search` and `lookup` are required of
   * everyone (ADR-0033); `browse` and `containers` are the two a provider may
   * decline, so a manifest naming two of the four is well-formed.
   *
   * THAT THE REQUIRED TWO ARE THERE IS NOT CHECKED HERE, and this comment said
   * it was. It is checked by the conformance suite, against a provider answering
   * over HTTP, because a provider that DECLARES `search` is not thereby a
   * provider that answers one -- which is the claim worth holding and is not a
   * claim a schema can make. The one rule this schema does enforce is below.
   */
  operations: z.array(z.string().min(1)),
  /** Seconds. A source's cache CEILING, where it imposes one (ADR-0037). */
  max_cache_age: z.number().int().positive().optional(),
  images: z
    .looseObject({
      /**
       * One variant, or one per role, or null for a source that offers no choice
       * of rendition. THE MAP IS NOT TMDB SPECIAL-CASING: TMDB's `/configuration`
       * puts `w500` in `poster_sizes` and in neither `backdrop_sizes` nor
       * `still_sizes`, so a single string names a size that 404s for two of three
       * roles. ADR-0033 fixed this as `string | null` and was corrected by the
       * second provider existing.
       */
      stored_variant: z.union([z.string(), z.record(z.string(), z.string())]).nullable(),
      /** `0` says this source serves no images: a declaration, not an unset field. */
      per_role_limit: z.number().int().nonnegative(),
      /** A minimum stored width in pixels. `0` says the source publishes no dimensions. */
      quality_floor: z.number().int().nonnegative(),
    })
    .optional(),
  /**
   * What this source's licence obliges an app to show, or null where it obliges
   * nothing (ADR-0036). DECLARED rather than held in the app against a known
   * provider, which is ADR-0033's rule at the field where breaking it is most
   * tempting: a notice hardcoded for TMDB works perfectly and leaves the next
   * source's obligation nowhere to go.
   */
  attribution: z
    .looseObject({
      notice: z.string().min(1),
      logo: z
        .looseObject({
          /** Bytes, because the fetch is the READER'S BROWSER's and not the app's. */
          data_uri: z.string().regex(/^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$/),
          alt: z.string().min(1),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  /**
   * WHAT THIS PROVIDER NEEDS IN ORDER TO REACH ITS OWN UPSTREAM, and where the
   * OWNER goes to supply it (ADR-0122).
   *
   * OPTIONAL, AND THAT IS THE WHOLE REASON IT COULD BE ADDED AT ALL. A provider
   * whose upstream wants nothing declares nothing and stays conformant with no
   * change -- `provider-tmdb` is exactly that -- so this is an addition rather
   * than a new contract, and ADR-0032's version does not move for an optional
   * field. A required one would break every provider that already exists on the
   * day it landed, which is the same argument `versions` itself is settled by.
   *
   * CANONCORE READS THE LABEL AND THE STATE AND LINKS TO THE PATH. It does not
   * render the fields and it never carries the answer -- not in storage and not
   * in transit. That is not this contract being cautious: the Model Context
   * Protocol's 2026-07-28 revision prohibits the same thing by name ("the
   * third-party credentials MUST NOT transit through the MCP client"), and BCP
   * 240 removed OAuth's password grant over it, because "credentials can leak in
   * more places than just the authorization server". An earlier draft of
   * ADR-0122 had CanonCore rendering the form and forwarding what was typed.
   *
   * SO WHY DECLARE THE FIELDS AT ALL, if CanonCore does not render them. Because
   * the Owner reads them to know what is being asked for before they click, and
   * because the file the provider writes is the real interface (ADR-0122) -- a
   * script or a scheduled job renewing the credential needs the field names, and
   * a provider that kept them to itself would oblige every such writer to read
   * its source.
   */
  credential: z
    .looseObject({
      /**
       * One sentence for the OWNER, and the only prose CanonCore renders about a
       * credential. Empty is refused because a blank here is a settings page
       * with nothing in it where the instruction should be.
       */
      label: z.string().min(1),
      /**
       * What to supply, by name and in words. AT LEAST ONE: a declaration with
       * no fields asks for nothing, which is a provider that should have
       * declared no credential.
       */
      fields: z
        .array(
          z.looseObject({
            /** The key a submission carries it under. */
            name: z.string().min(1),
            /** What it IS, in words. A field that only named itself would leave the Owner guessing. */
            label: z.string().min(1),
          }),
        )
        .min(1),
      /**
       * A PATH, NOT A CONTENT URL, and this is the one place in CMPP where that
       * distinction is load-bearing rather than pedantic. Every other URL the
       * contract carries comes FROM the source and is rendered to a reader
       * (`contentUrl` above); this one addresses the PROVIDER, which does not
       * know the URL CanonCore reaches it on -- one behind a proxy could not --
       * and CanonCore holds that base URL already. So the provider names the
       * path and CanonCore joins the two.
       *
       * LEADING SLASH REQUIRED, because a relative path joins against whatever
       * the base URL's last segment happens to be, which is a link that works on
       * one deployment and 404s on the next.
       */
      unlock_path: z.string().startsWith("/"),
      /**
       * ONLY THE PROVIDER CAN KNOW THIS. It is the one being refused by the
       * upstream, and a credential's validity is not something CanonCore could
       * test without performing the provider's own job. CanonCore already
       * fetches the manifest, so the state arrives with a read it was making
       * anyway -- no polling, and no health check the contract does not define.
       *
       * THREE AND NOT FOUR. A provider that held something malformed reports
       * `absent`, because from the Owner's side there is nothing to answer with.
       * And one holding a credential it could not Spend, its upstream being
       * unreachable, reports `valid` rather than a fourth word: the contract reads
       * anything but `valid` as a provider owed a 503, so a fourth state would
       * oblige one holding a credential that works to refuse with it (CNCORE-207).
       */
      state: z.enum(["absent", "valid", "expired"]),
      /**
       * When it last became that, or null where nothing has ever been supplied.
       *
       * `expired` ALONE IS NOT AN ANSWER: it does not tell the Owner whether the
       * session lapsed a minute ago or three weeks ago, which is the difference
       * between renewing it and going to look at what else broke.
       */
      state_changed_at: z.iso.datetime().nullable(),
    })
    .optional(),
});

/**
 * THE MANIFEST, AND THE ONE RULE ITS OPERATIONS LIST CARRIES BEYOND THE REQUIRED
 * TWO: LISTING CONTAINERS OBLIGES BROWSING THEM.
 *
 * The operation exists so that browsing does not require knowing an id first
 * (ADR-0033), so a provider that answers `containers` while declining `browse`
 * offers the Owner a page of ids it will not serve. The two are separately
 * optional and this one direction is not: `browse` alone is what both real
 * providers declare and stays well-formed.
 *
 * A MALFORMED MANIFEST RATHER THAN A DECLARATION TO BE READ AROUND. The
 * declaration is a promise, and a promise of ids this provider will not serve is
 * not a capability the app could honour by being careful.
 *
 * IT IS A SEPARATE BINDING so that the refinement reads on its own line rather
 * than re-indenting every field above it, which is a diff nobody can review.
 */
export const manifest = declaration.refine(
  (declared) =>
    !declared.operations.includes(CONTAINERS_OPERATION) ||
    declared.operations.includes(BROWSE_OPERATION),
  {
    error: `a provider declaring \`${CONTAINERS_OPERATION}\` must declare \`${BROWSE_OPERATION}\` too: listing containers nothing can browse offers ids that lead nowhere`,
    path: ["operations"],
  },
);

export type CmppManifest = z.infer<typeof manifest>;
