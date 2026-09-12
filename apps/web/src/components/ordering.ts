/**
 * WHAT A REORDER DOES TO POSITIONS, AS ONE RULE CALLED FROM BOTH DOORS.
 *
 * ADR-0116 makes computing the delta the CALLER's job -- "the client must
 * compute which siblings moved, and a bug there writes fewer rows than it
 * should rather than more" -- and this is that computation, in a module this
 * repository owns rather than inside the drag library's component. That is the
 * same record's last line, and its reason is that a library bump should touch
 * the component and not the rules.
 *
 * IT IS ALSO WHAT KEEPS THE TWO PATHS HONEST WITH EACH OTHER. A drop and a Move
 * up button are one gesture expressed twice, and a page where the mouse and the
 * keyboard disagreed about what a reorder means would be two products.
 */

/** One row of a container's ordering, as the read path hands it over. */
export interface Placed {
  id: string;
  /** ADR-0018, migration 2: a member with no position is still a member. */
  position: number | null;
}

/** The delta `placement.move` takes: what moved, and who shifted for it. */
export interface Reorder {
  id: string;
  position: number | null;
  siblings: { id: string; position: number | null }[];
}

/**
 * Where everything sits after the owner drags `id` to index `to`.
 *
 * POSITIONS ARE SLOTS, AND A REORDER PERMUTES THE PLACEMENTS AMONG THEM. The
 * ordering's positions stay attached to their INDEX and the rows move between
 * them, so the multiset of positions the container holds is exactly what it
 * was. Three consequences, each of which ADR-0116 asks for by name:
 *
 * - NO NUMBER IS INVENTED. An ordering of 1, 5 and 63 reordered still reads 1,
 *   5 and 63. The alternative -- shifting the neighbours by one -- writes
 *   positions nobody asserted into rows a provider placed, which is the
 *   laundering that record refuses whole-ordering writes for.
 * - A TIE SURVIVES. Two placements sharing a position share the same slot after
 *   the permutation, so a reorder breaks no tie, including one it passes
 *   through. ADR-0009 puts a novel and its film at one point on purpose.
 * - AN UNPLACED MEMBER KEEPS ITS ABSENCE. Null sorts last and is a slot like
 *   any other, so dropping INTO the unpositioned group leaves the dropped
 *   placement unpositioned -- ADR-0116's rule, falling out of the model rather
 *   than being special-cased.
 *
 * WHAT IT COSTS IS WORTH SAYING. Dragging a placement ACROSS the boundary
 * between positioned and unpositioned moves that boundary: pull an unplaced
 * member to the top and the last positioned row takes the null it left. That is
 * the honest reading of a gesture that says "this one is first and that one is
 * no longer placed", and it is the arithmetic becoming painful in the exact
 * place ADR-0116 points at fractional indexing for.
 *
 * `null` WHEN NOTHING MOVES, so a drop where a placement already sat writes no
 * rows at all rather than an UPDATE that changes nothing.
 */
export function reorderedTo(ordering: readonly Placed[], id: string, to: number): Reorder | null {
  const from = ordering.findIndex((placed) => placed.id === id);
  if (from === -1) return null;

  const landing = Math.min(Math.max(to, 0), ordering.length - 1);
  if (landing === from) return null;

  const moving = ordering[from];
  if (!moving) return null;

  const rearranged = [...ordering];
  rearranged.splice(from, 1);
  rearranged.splice(landing, 0, moving);

  // The slot at each index is whatever position the ordering held there before
  // anything moved, which is what makes this a permutation rather than a
  // renumbering.
  const changed = rearranged
    .map((placed, index) => ({ id: placed.id, position: ordering[index]?.position ?? null }))
    .filter(
      ({ id: movedId, position }, index) =>
        position !== rearranged[index]?.position || movedId === id,
    );

  const moved = changed.find((placed) => placed.id === id);
  if (!moved) return null;

  return {
    id,
    position: moved.position,
    siblings: changed.filter((placed) => placed.id !== id),
  };
}
