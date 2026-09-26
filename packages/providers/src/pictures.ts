import type { CmppImage, CmppManifest, CmppRecord } from "./cmpp";

/**
 * The most pictures fetched for one record, whatever its roles. The limit is
 * per role and roles are the source's own words, so without this a provider
 * naming a thousand roles has a thousand fetches made at once. Eight covers
 * both real providers with room: TMDB declares one per role over four roles,
 * and the wiki's largest story carries five pictures of one.
 */
const MAX_PICTURES_PER_RECORD = 8;

/**
 * The image references on a record that may be FETCHED, under the provider's
 * declared `per_role_limit` (ADR-0033, ADR-0037).
 *
 * IN THE ORDER THE PROVIDER SENT THEM, the first `per_role_limit` of each role.
 * No ranking happens here: choosing a better picture than the source's first is
 * the deferred artwork work's (CNCORE-372), and a limit that picks is a limit
 * that has to be told how.
 *
 * `0` FETCHES NOTHING, and so does a manifest with no image policy. The first is
 * a provider declaring that it serves no images; the second is a provider that
 * declared no limit, which is not the same as declaring none. Neither is ever
 * read as "unlimited".
 */
export function picturesToFetch(record: CmppRecord, manifest: CmppManifest): CmppImage[] {
  const limit = manifest.images?.per_role_limit ?? 0;
  const taken = new Map<string, number>();
  return record.images
    .filter((image) => {
      const count = taken.get(image.role) ?? 0;
      if (count >= limit) return false;
      taken.set(image.role, count + 1);
      return true;
    })
    .slice(0, MAX_PICTURES_PER_RECORD);
}
