"use client";

import { Button } from "@canoncore/ui/components/button";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical } from "lucide-react";
import { type ReactNode, useRef, useState, useTransition } from "react";

import { movePlacement } from "@/app/items/actions";
import { type Placed, reorderedTo } from "./ordering";

/**
 * DRAGGING A PLACEMENT TO REORDER A CONTAINER (CNCORE-73), which is the first
 * interactivity in this product that genuinely needs a browser.
 *
 * THE ACCELERATOR, NOT THE CAPABILITY. Every row carries Move up and Move down
 * as native forms, and those are the whole of reordering before any script
 * loads -- `CLAUDE.md` requires every keyboard accelerator to have an
 * equivalent visible UI path, and `.claude/rules/frontend.md` names a sortable
 * list as the case where that bites. So this component adds a faster way to do
 * something the page can already do, and a reader who never gets it loses
 * nothing.
 *
 * THE IDENTITY IS THE PLACEMENT, NEVER THE ITEM (ADR-0116), and that record
 * calls it "the single largest adaptation between the reference code and this
 * product". The reference keys each node on the item's id, which is correct
 * where a thing appears once; here one Item routinely sits in several
 * containers, and a Repeat puts one Item in ONE container twice -- so an item
 * id is not unique within a list and a drop would move whichever row the
 * reconciler happened to pick.
 *
 * THE ROWS ARE SERVER-RENDERED AND PASSED THROUGH. What this component owns is
 * the ORDER; what a row says -- its title, its sources, its position, its
 * buttons -- is rendered on the server and handed over as a node. That keeps
 * the read path, the links and the Server Action forms exactly where they were
 * for a visitor, and it is why a visitor gets none of this code at all.
 *
 * THE ARITHMETIC IS NOT IN HERE (ADR-0116's last line). `reorderedTo` is a
 * module this repository owns, shared with the script-less path, so a dnd-kit
 * bump touches this file and not the rules -- and the mouse and the keyboard
 * cannot come to disagree about what a reorder means.
 */
export interface SortableRow extends Placed {
  /** The row's own markup, rendered on the server. */
  content: ReactNode;
}

export function SortableMembers({
  containerId,
  rows,
}: {
  containerId: string;
  rows: SortableRow[];
}) {
  const [order, setOrder] = useState(() => rows.map((row) => row.id));
  /*
   * POSITIONS MOVE ONLY WHEN A DRAG FINISHES, where the order moves while it is
   * still happening. Keeping them apart is what lets the delta be computed
   * against the ordering AS IT WAS: `onDragOver` fires many times and rewrites
   * `order` each time, so by `onDragEnd` the arrangement the drag started from
   * is gone unless something held on to it.
   */
  const [positions, setPositions] = useState(
    () => new Map(rows.map((row) => [row.id, row.position])),
  );
  const startedFrom = useRef<string[]>(order);
  const [, startWriting] = useTransition();

  /*
   * THE SERVER'S ANSWER WINS, AND THAT IS WHAT MAKES A REFUSAL VISIBLE.
   * `movePlacement` calls `refresh()`, so these props come back carrying what
   * the catalogue actually holds -- and if the move was refused (a cycle, a
   * tuple another Repeat holds) they come back in the OLD order while this
   * component is still showing the new one. Without this the page would go on
   * displaying a reorder that never happened.
   *
   * ADJUSTED DURING RENDER RATHER THAN IN AN EFFECT, which is React's own
   * documented way to reset state when a prop changes: an effect would paint
   * the stale order first and correct it a frame later.
   */
  const served = rows.map((row) => `${row.id}:${row.position ?? ""}`).join(",");
  const [lastServed, setLastServed] = useState(served);
  if (lastServed !== served) {
    setLastServed(served);
    setOrder(rows.map((row) => row.id));
    setPositions(new Map(rows.map((row) => [row.id, row.position])));
  }

  const content = new Map(rows.map((row) => [row.id, row.content]));
  const showing = order.filter((id) => content.has(id));

  function commit(event: DragEndEvent) {
    if (event.canceled) return;
    const id = String(event.operation.source?.id ?? "");
    const was = startedFrom.current;
    const landed = order.indexOf(id);
    if (landed === -1) return;

    const ordering: Placed[] = was.map((held) => ({
      id: held,
      position: positions.get(held) ?? null,
    }));
    const reorder = reorderedTo(ordering, id, landed);
    if (!reorder) return;

    setPositions((held) => {
      const next = new Map(held);
      next.set(reorder.id, reorder.position);
      for (const sibling of reorder.siblings) next.set(sibling.id, sibling.position);
      return next;
    });

    /*
     * THE SAME TWO PARALLEL FIELDS THE SCRIPT-LESS FORM POSTS, so both doors
     * reach one parser and one procedure. An absent position is an EMPTY field
     * rather than a missing one: a member with no position is still a member,
     * and an omitted field would be the same request with two meanings.
     */
    const form = new FormData();
    form.set("id", reorder.id);
    form.set("containerId", containerId);
    form.set("position", reorder.position === null ? "" : String(reorder.position));
    for (const sibling of reorder.siblings) {
      form.append("siblingId", sibling.id);
      form.append("siblingPosition", sibling.position === null ? "" : String(sibling.position));
    }

    /*
     * IN A TRANSITION, SO REACT KNOWS A WRITE IS OUTSTANDING. The page has
     * already moved -- the rows above are local state -- so nothing here waits
     * for the answer; what a transition adds is that React treats the action
     * and the `refresh()` it ends with as one pending update rather than as a
     * promise nobody is holding. A bare call is dropped on the floor the moment
     * the reader navigates, which is exactly when a reorder most needs to have
     * been written.
     *
     * A REFUSAL -- a cycle, a tuple another Repeat holds -- comes back as the
     * container AS IT STANDS, and the resync above is what puts the row back.
     */
    startWriting(async () => {
      await movePlacement(form);
    });
  }

  return (
    <DragDropProvider
      onDragStart={() => {
        startedFrom.current = order;
      }}
      onDragOver={(event) => setOrder((held) => move(held, event))}
      onDragEnd={commit}
    >
      <ul className="mt-2 divide-y">
        {showing.map((id, index) => (
          <SortablePlacement key={id} id={id} index={index}>
            {content.get(id)}
          </SortablePlacement>
        ))}
      </ul>
    </DragDropProvider>
  );
}

/**
 * ONE ROW, DRAGGABLE BY A HANDLE RATHER THAN BY ITS WHOLE SURFACE.
 *
 * `SortablePlacement` RATHER THAN THE SINGULAR OF THE LIST ABOVE. `CONTEXT.md`
 * rejects `member` as a NAME for a Placement, and settles "Members" as the
 * reader's word from the container's end -- so the LIST may carry it and one
 * ROW may not, because a row is one Placement and nothing else. Found by
 * review.
 *
 * THE HANDLE IS WHY THE REST OF THE ROW STILL WORKS. A row carries a link to
 * the item and up to three buttons; making the whole row a drag source would
 * turn every one of those into a gesture that sometimes starts a drag instead.
 *
 * AND IT IS A `<button>`, which is what makes the drag reachable from the
 * keyboard at all: dnd-kit's keyboard sensor starts a drag on a focused handle
 * and moves it with the arrow keys. The visible Move controls beside it are the
 * path that requirement actually asks for; this is the accelerator.
 */
function SortablePlacement({
  id,
  index,
  children,
}: {
  id: string;
  index: number;
  children: ReactNode;
}) {
  const { ref, handleRef } = useSortable({ id, index });

  return (
    <li ref={ref} data-placement={id} className="flex items-baseline gap-4 py-2">
      <Button
        ref={handleRef}
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Reorder by dragging"
        className="cursor-grab px-1 text-muted-foreground"
      >
        <GripVertical aria-hidden className="size-4" />
      </Button>
      {children}
    </li>
  );
}
