import { describe, expect, it } from "vitest";

import { reorderedTo } from "./ordering";

/**
 * THE ARITHMETIC A DRAG OWES THE MUTATION (ADR-0116), which that record makes
 * the CLIENT's job by name: "the client must compute which siblings moved, and
 * a bug there writes fewer rows than it should rather than more."
 *
 * A PURE FUNCTION IN A MODULE THIS REPOSITORY OWNS, never inside the drag
 * library's component -- ADR-0116's last line, so a library bump touches the
 * component and not the rules. It is also what lets the SCRIPT-LESS path and
 * the drag compute identically: the Move up button and a drop are one rule,
 * called twice.
 */
const at = (id: string, position: number | null) => ({ id, position });

describe("reorderedTo", () => {
  it("moves a placement to the top and hands its position to the one it passed", () => {
    // POSITIONS ARE SLOTS AND A REORDER PERMUTES THE MEMBERS AMONG THEM. The
    // multiset of positions a container holds is what it was, so no number is
    // invented and none is thrown away.
    const ordering = [at("a", 1), at("b", 2), at("c", 3)];

    expect(reorderedTo(ordering, "c", 0)).toStrictEqual({
      id: "c",
      position: 1,
      siblings: [
        { id: "a", position: 2 },
        { id: "b", position: 3 },
      ],
    });
  });
});

describe("what a reorder must not quietly fix", () => {
  it("leaves a placement dropped into the unpositioned group unpositioned", () => {
    // ADR-0116 in those words. Null is a slot like any other, so this falls out
    // of the permutation rather than being special-cased.
    const ordering = [at("a", 1), at("b", 2), at("c", null)];

    expect(reorderedTo(ordering, "a", 2)).toStrictEqual({
      id: "a",
      position: null,
      siblings: [
        { id: "b", position: 1 },
        { id: "c", position: 2 },
      ],
    });
  });

  it("keeps a tie the drag never passed through", () => {
    // ADR-0009 puts a novel and the film adapting it at one point on purpose,
    // and ADR-0116 refuses a reorder that breaks a tie it did not create.
    const ordering = [at("a", 1), at("b", 2), at("c", 5), at("d", 5)];

    expect(reorderedTo(ordering, "a", 1)).toStrictEqual({
      id: "a",
      position: 2,
      siblings: [{ id: "b", position: 1 }],
    });
  });

  it("invents no number: an ordering of 1, 5 and 63 still reads 1, 5 and 63", () => {
    // The alternative -- shifting neighbours by one -- writes positions nobody
    // asserted into rows a provider placed, which is the laundering ADR-0116
    // refuses whole-ordering writes for.
    const ordering = [at("a", 1), at("b", 5), at("c", 63)];

    const after = reorderedTo(ordering, "a", 2);

    expect([after?.position, ...(after?.siblings ?? []).map((s) => s.position)].sort()).toStrictEqual(
      [1, 5, 63],
    );
  });
});

describe("a drop that changes nothing", () => {
  it("writes no rows when a placement is dropped where it already sat", () => {
    const ordering = [at("a", 1), at("b", 2)];

    expect(reorderedTo(ordering, "a", 0)).toBeNull();
  });

  it("writes no rows for a placement this ordering does not hold", () => {
    // A stale page, a shared link, a request composed by hand. An answer rather
    // than a fault, which is the posture `findItem` takes (ADR-0066).
    expect(reorderedTo([at("a", 1)], "gone", 0)).toBeNull();
  });

  it("clamps a landing past the end rather than losing the placement", () => {
    const ordering = [at("a", 1), at("b", 2), at("c", 3)];

    expect(reorderedTo(ordering, "a", 99)).toStrictEqual({
      id: "a",
      position: 3,
      siblings: [
        { id: "b", position: 1 },
        { id: "c", position: 2 },
      ],
    });
  });
});
