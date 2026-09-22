import { eq } from "drizzle-orm";

import { theOwnerId, type Writer } from "./placements";
import { settings } from "./schema";

/**
 * WHAT THIS INSTANCE IS CONFIGURED TO REACH, as the owner wrote it.
 *
 * TWO STRINGS RATHER THAN TWO PARSED SHAPES, and that is the whole reason the
 * move out of the environment changed nothing else. `parseProviderUrls` and
 * `parseAllowlist` live in `@canoncore/providers` and take a string from
 * wherever it comes (ADR-0121, ADR-0034); this package hands over the same
 * string an environment variable used to, so the parsing boundary did not move
 * with the source.
 *
 * It is also why `@canoncore/db` does not depend on `@canoncore/providers`: a
 * store that validated would be a second place the rule lives, free to drift
 * from the one in front of the request.
 */
export interface ProviderSettings {
  /** Which providers this instance searches (ADR-0031, ADR-0121). */
  providerUrls: string;
  /** ADR-0034's allowlist: the hosts and CIDRs a provider base URL may name. */
  providerAllowlist: string;
}

/**
 * NOTHING CONFIGURED, which is what an instance nobody has touched reaches.
 *
 * The empty string on both, because that is the value the environment variables
 * defaulted to and the value both parsers already answer nothing to. An
 * instance with no settings row therefore reaches nothing through the rules
 * that were already there, rather than through a second rule about a missing
 * row (ADR-0034, ADR-0094).
 */
const NOTHING_CONFIGURED: ProviderSettings = { providerUrls: "", providerAllowlist: "" };

/** What a caller of any function below is answered: the settings, and nothing else. */
const WHAT_IS_CONFIGURED = {
  providerUrls: settings.providerUrls,
  providerAllowlist: settings.providerAllowlist,
};

/**
 * Reads the one settings row, or what an unconfigured instance reaches.
 *
 * NO ROW IS NOT AN ERROR. Migration 16 writes none -- an instance that has
 * never been configured has nothing to store -- so the absence IS the
 * configuration, and answering it here keeps every caller from having to know
 * that.
 */
export async function readProviderSettings(writer: Writer): Promise<ProviderSettings> {
  const [row] = await writer.select(WHAT_IS_CONFIGURED).from(settings);
  return row ?? NOTHING_CONFIGURED;
}

/**
 * Writes what the owner configured, as they wrote it.
 *
 * ONE FUNCTION FOR BOTH SETTINGS RATHER THAN ONE EACH, because there is ONE ROW
 * (ADR-0044's shape, migration 16): two writers would each have to know how to
 * create that row, and the one that ran first on a fresh instance would decide
 * what the other's column started as. A caller changing one setting passes one
 * field, and the other is left exactly as it was.
 *
 * AS WRITTEN, NEVER NORMALISED. A provider's URL is its IDENTITY (ADR-0031) and
 * the identity is what every imported claim's source row carries, so rewriting
 * `http://host:8080` to `http://host:8080/` here would make one provider two.
 * The store holds the owner's spelling, which is the only spelling.
 */
export async function writeProviderSettings(
  writer: Writer,
  change: Partial<ProviderSettings>,
): Promise<ProviderSettings> {
  const [existing] = await writer.select({ id: settings.id }).from(settings);

  /*
   * THE FIRST WRITE CREATES THE ROW, and every later one changes it. An
   * instance with no row is one nobody has configured (migration 16 writes
   * none), so there is nothing to insert until an owner configures something.
   *
   * THE UPDATE SETS ONLY THE COLUMNS IT WAS GIVEN, which is what makes "the
   * other is left exactly as it was" true of two writers rather than only of
   * one (CNCORE-386). This read both settings, merged the change into them and
   * wrote the pair back, so an owner editing the allowlist while a provider was
   * named would lose one edit to the other's stale read, with no error
   * anywhere. A column nobody changed is now a column no statement mentions.
   *
   * A TEST PINS IT, in `settings.test.ts`, and says why a plain race could not.
   *
   * `settings_single_row` IS WHAT MAKES THE OTHER RACE LOUD, and it is a
   * different one. Two writes arriving at an UNCONFIGURED instance at once
   * would both find no row; the unique index on `(true)` refuses the second
   * insert, so the loser gets an error instead of a second row that half the
   * reads would answer from.
   */
  const [written] = existing
    ? await writer
        .update(settings)
        .set(change)
        .where(eq(settings.id, existing.id))
        .returning(WHAT_IS_CONFIGURED)
    : await writer
        .insert(settings)
        .values({ ownerId: await theOwnerId(writer), ...NOTHING_CONFIGURED, ...change })
        .returning(WHAT_IS_CONFIGURED);

  if (!written) throw new Error("the settings write returned no row");
  return written;
}

/**
 * Changes the Providers setting by what it holds now, with the row held.
 *
 * FOR THE WRITES THAT ARE A CHANGE TO THE LIST RATHER THAN A NEW ONE (CNCORE-391).
 * Naming a Provider and removing one each compute the next list from the list
 * as it stands. Read on the pool and written back in a second statement, two
 * such changes at once each read the list before the other wrote it, and the
 * second wrote back a list that did not have the first in it: one Provider
 * gone, with no error anywhere. The read here is `FOR UPDATE` inside the write's
 * own transaction, so a second change waits for the first to commit and then
 * reads the list it left.
 *
 * THE CHANGE IS A FUNCTION THE CALLER HANDS IN, because the rule for what a
 * list becomes lives in `@canoncore/providers` and this package does not depend
 * on it (see `ProviderSettings`). Whatever it throws rolls the transaction back
 * and reaches the caller unchanged, so a refusal still changes nothing.
 * What it returns is stored unread, so it must be what a parser answered: the
 * store is validated at its only writer (ADR-0121), and this is that writer's
 * hand, not a second one.
 *
 * NOTHING TO LOCK ON AN UNCONFIGURED INSTANCE, and that race stays the loud one
 * `writeProviderSettings` describes: two first changes both insert, and
 * `settings_single_row` refuses the second.
 */
export async function changeProviderUrls(
  writer: Writer,
  change: (providerUrls: string) => string,
): Promise<ProviderSettings> {
  return writer.transaction(async (tx) => {
    const [row] = await tx.select(WHAT_IS_CONFIGURED).from(settings).for("update");
    const configured = row ?? NOTHING_CONFIGURED;
    return writeProviderSettings(tx, { providerUrls: change(configured.providerUrls) });
  });
}
