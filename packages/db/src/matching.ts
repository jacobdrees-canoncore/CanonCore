import { and, eq, isNull, sql } from "drizzle-orm";

import { propertyId, type Transaction } from "./claims";
import type { Database } from "./index";
import { insideItsCeiling } from "./queries";
import { matchCandidates, partDisagreements, sources } from "./schema";
import {
  daysOf,
  partsOf,
  scoreWorkMatch,
  titlePatterns,
  type WorkEvidence,
  type WorkMatchScore,
  type WorkMatchSignals,
} from "./works-match";

/**
 * ADR-0026's MATCHING, for one work arriving from one Provider: the Items other
 * Providers already hold, each scored against it (CNCORE-361).
 *
 * IT DECIDES AND WRITES NOTHING. Applying is `importBrowsedContainer`'s, which
 * writes the arriving record onto the Item this names; handing over the band
 * and the part disagreements is `recordWhatWasNotApplied`'s. ADR-0026 keeps the
 * two apart so that no screen can collapse them.
 */
export interface Matched {
  /** The one Item the work lands on, where exactly one scored above the high bar. */
  applyTo: string | null;
  /** Every Item scored between the bars, and any tied above the high one. */
  offered: { itemId: string; score: WorkMatchScore }[];
  /**
   * Items that agree on the title and differ in parts, each with which side
   * holds the parts and how many (CNCORE-368's NO MATCH).
   */
  partsDisagree: { itemId: string; sourceId: string; parts: number; heldHere: boolean }[];
}

/** One Item another Provider holds, as that Provider describes it. */
interface Candidate {
  itemId: string;
  sourceId: string;
  title: string;
}

/**
 * HOW MANY CANDIDATES ONE ARRIVING WORK IS SCORED AGAINST, at most. The block
 * is a title or a date, so a common word (`Rose`) reaches dozens of Items; a
 * work matching more than this many is not one the scorer could have told
 * apart anyway, and the bound keeps one browse from scoring a catalogue.
 */
const CANDIDATE_LIMIT = 50;

export async function matchArrivingWork(
  tx: Transaction,
  { ownerId, sourceId, arriving }: { ownerId: string; sourceId: string; arriving: WorkEvidence },
): Promise<Matched> {
  const titleProperty = await propertyId(tx, ownerId, "title");
  const releasedProperty = await propertyId(tx, ownerId, "released");
  const candidates = await candidatesFor(tx, {
    ownerId,
    sourceId,
    titleProperty,
    releasedProperty,
    arriving,
  });

  const scored = await Promise.all(
    candidates.map(async (candidate) => {
      const evidence = await evidenceOf(tx, candidate, { titleProperty, releasedProperty });
      return { candidate, evidence, score: scoreWorkMatch(arriving, evidence) };
    }),
  );

  const applies = scored.filter(({ score }) => score.verdict === "apply");
  return {
    // TWO ITEMS AT THE HIGH BAR ARE A QUESTION, NOT AN ANSWER: which one is not
    // the scorer's to guess, so both are offered and neither applied.
    applyTo: applies.length === 1 ? (applies[0]?.candidate.itemId ?? null) : null,
    offered: scored
      .filter(({ score }) => score.verdict === "offer" || applies.length > 1)
      .filter(({ score }) => score.verdict !== "discard")
      .map(({ candidate, score }) => ({ itemId: candidate.itemId, score })),
    partsDisagree: scored
      .filter(({ score }) => score.signals.title === "same" && score.signals.parts === "disagree")
      .map(({ candidate, evidence }) =>
        arriving.parts > evidence.parts
          ? { itemId: candidate.itemId, sourceId, parts: arriving.parts, heldHere: false }
          : {
              itemId: candidate.itemId,
              sourceId: candidate.sourceId,
              parts: evidence.parts,
              heldHere: true,
            },
      ),
  };
}

/**
 * Hands over what matching did not apply: the band as candidate pairs, and a
 * part disagreement onto whichever Item holds the work as one record.
 *
 * `itemId` IS THE ITEM THE ARRIVING WORK NOW IS, minted or found. A pair is
 * written once and never refreshed; a disagreement is taken afresh each time
 * its source says it again, since it is read against that source's ceiling.
 */
export async function recordWhatWasNotApplied(
  tx: Transaction,
  { ownerId, itemId, matched }: { ownerId: string; itemId: string; matched: Matched },
): Promise<void> {
  if (matched.offered.length > 0) {
    await tx
      .insert(matchCandidates)
      .values(
        matched.offered.map(({ itemId: candidateItemId, score }) => ({
          ownerId,
          itemId,
          candidateItemId,
          score: score.score,
          titleSignal: score.signals.title,
          releasedSignal: score.signals.released,
        })),
      )
      .onConflictDoNothing();
  }

  for (const disagreement of matched.partsDisagree) {
    // The one-record side: the candidate when the parts arrived, the arriving
    // work when the candidate is the one held as parts.
    const onItem = disagreement.heldHere ? itemId : disagreement.itemId;
    const refreshed = await tx
      .update(partDisagreements)
      .set({ parts: disagreement.parts, observedAt: sql`now()` })
      .where(
        and(
          eq(partDisagreements.itemId, onItem),
          eq(partDisagreements.sourceId, disagreement.sourceId),
          isNull(partDisagreements.deletedAt),
        ),
      )
      .returning({ id: partDisagreements.id });
    if (refreshed.length === 0) {
      await tx.insert(partDisagreements).values({
        ownerId,
        itemId: onItem,
        sourceId: disagreement.sourceId,
        parts: disagreement.parts,
      });
    }
  }
}

/**
 * Every live, non-container Item another Provider holds that shares a day of
 * release with the arriving work or could share its title, as that Provider
 * titles it. An Item this source already says anything about is not a
 * candidate: it is this source's own record, found by identity, not matched.
 */
async function candidatesFor(
  tx: Transaction,
  {
    ownerId,
    sourceId,
    titleProperty,
    releasedProperty,
    arriving,
  }: {
    ownerId: string;
    sourceId: string;
    titleProperty: string;
    releasedProperty: string;
    arriving: WorkEvidence;
  },
): Promise<Candidate[]> {
  const patterns = titlePatterns(arriving.title);
  const days = daysOf(arriving.released);
  if (patterns.length === 0 && days.length === 0) return [];

  const titled = patterns.map((pattern) => sql`title.value_literal ilike ${pattern}`);
  const dated =
    days.length === 0
      ? []
      : [
          sql`exists (
            select 1 from statements dated
            where dated.subject_item_id = title.subject_item_id
              and dated.source_id = title.source_id
              and dated.property_id = ${releasedProperty}
              and dated.deleted_at is null
              and dated.value_literal in (${sql.join(
                days.map((day) => sql`${day}`),
                sql`, `,
              )})
          )`,
        ];

  const found = await tx.execute<{ item_id: string; source_id: string; title: string }>(sql`
    select title.subject_item_id as item_id, title.source_id, title.value_literal as title
    from statements title
    join items on items.id = title.subject_item_id
    join sources on sources.id = title.source_id
    where title.owner_id = ${ownerId}
      and title.property_id = ${titleProperty}
      and title.deleted_at is null
      and title.source_id <> ${sourceId}
      and sources.kind = 'provider'
      and items.deleted_at is null
      and not items.is_container
      and not exists (
        select 1 from statements mine
        where mine.subject_item_id = items.id
          and mine.source_id = ${sourceId}
          and mine.deleted_at is null
      )
      and (${sql.join([...titled, ...dated], sql` or `)})
    limit ${CANDIDATE_LIMIT}
  `);
  return found.rows.map((row) => ({
    itemId: row.item_id,
    sourceId: row.source_id,
    title: row.title,
  }));
}

/**
 * What the candidate's own Provider says of it: its dates, and how many parts
 * it holds the work as, read off the titles that Provider gives the Items it
 * placed beside this one (`partsOf`).
 */
async function evidenceOf(
  tx: Transaction,
  candidate: Candidate,
  { titleProperty, releasedProperty }: { titleProperty: string; releasedProperty: string },
): Promise<WorkEvidence> {
  const released = await tx.execute<{ value: string }>(sql`
    select value_literal as value from statements
    where subject_item_id = ${candidate.itemId}
      and source_id = ${candidate.sourceId}
      and property_id = ${releasedProperty}
      and deleted_at is null
  `);
  const siblings = await tx.execute<{ title: string }>(sql`
    select distinct on (beside.item_id) title.value_literal as title
    from placement_sources claimed
    join placements here on here.id = claimed.placement_id and here.deleted_at is null
    join placements beside on beside.container_id = here.container_id and beside.deleted_at is null
    join placement_sources besideClaimed
      on besideClaimed.placement_id = beside.id
      and besideClaimed.source_id = claimed.source_id
      and besideClaimed.deleted_at is null
    join statements title
      on title.subject_item_id = beside.item_id
      and title.source_id = claimed.source_id
      and title.property_id = ${titleProperty}
      and title.deleted_at is null
    where claimed.source_id = ${candidate.sourceId}
      and here.item_id = ${candidate.itemId}
      and claimed.deleted_at is null
  `);
  return {
    title: candidate.title,
    released: released.rows.map((row) => row.value),
    parts: partsOf(
      candidate.title,
      siblings.rows.map((row) => row.title),
    ),
  };
}

/** How many parts another Provider holds one Item's work as (CNCORE-361). */
export interface PartsHeldElsewhere {
  sourceLabel: string;
  parts: number;
}

/**
 * Every Provider that holds this Item's work as several parts, none of which
 * was matched to it. Read against each source's ceiling, since the count is
 * that source's claim (ADR-0036).
 */
export async function findPartsHeldElsewhere(
  db: Database | Transaction,
  itemId: string,
): Promise<PartsHeldElsewhere[]> {
  return db
    .select({ sourceLabel: sources.label, parts: partDisagreements.parts })
    .from(partDisagreements)
    .innerJoin(sources, eq(sources.id, partDisagreements.sourceId))
    .where(
      and(
        eq(partDisagreements.itemId, itemId),
        isNull(partDisagreements.deletedAt),
        insideItsCeiling(partDisagreements.observedAt),
      ),
    )
    .orderBy(sources.sourceOrder);
}

/** A match offered on one Item: the other Item, and what the scorer saw. */
export interface MatchCandidateOfItem {
  itemId: string;
  title: string | null;
  score: number;
  signals: WorkMatchSignals;
  /** The other Item's part disagreements, so the row says what its page says. */
  partsHeldElsewhere: PartsHeldElsewhere[];
}

/**
 * Every match offered on this Item and not yet decided, read from either end
 * of the pair: an offer is one question, whichever page it is met on.
 */
export async function findMatchCandidatesOfItem(
  db: Database,
  itemId: string,
): Promise<MatchCandidateOfItem[]> {
  const found = await db.execute<{
    other: string;
    title: string | null;
    score: number;
    title_signal: WorkMatchSignals["title"];
    released_signal: WorkMatchSignals["released"];
  }>(sql`
    select
      case when pair.item_id = ${itemId} then pair.candidate_item_id else pair.item_id end as other,
      other.title,
      pair.score,
      pair.title_signal,
      pair.released_signal
    from match_candidates pair
    join items other
      on other.id = case when pair.item_id = ${itemId} then pair.candidate_item_id else pair.item_id end
    where (pair.item_id = ${itemId} or pair.candidate_item_id = ${itemId})
      and pair.deleted_at is null
      and other.deleted_at is null
    order by pair.score desc, other.id
  `);
  return Promise.all(
    found.rows.map(async (row) => ({
      itemId: row.other,
      title: row.title,
      score: row.score,
      // An offered pair never disagrees about parts: that is a zero, discarded.
      signals: { title: row.title_signal, released: row.released_signal, parts: "agree" as const },
      partsHeldElsewhere: await findPartsHeldElsewhere(db, row.other),
    })),
  );
}
