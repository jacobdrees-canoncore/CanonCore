# Workflow: decision to merged slice

How the skills fit together, from a decision to a slice merged on `main`. It is Matt Pocock's flow
(`/ask-matt` draws it) with three additions of ours: `check`, `tracing-a-decision` and the audit.
**Main** is the one session that plans, dispatches and merges. Every CanonCore repository works this
way. These are the **sibling repositories** a trace reads, with their checkouts:

| Repository | Checkout |
| --- | --- |
| `jacobdrees-canoncore/CanonCore` | `~/orca/projects/CanonCore` |
| `jacobdrees-canoncore/untitled-replica` | `~/canoncore/untitled-replica` |
| `jacobdrees-canoncore/prototype-snapshot` | `~/canoncore/prototype-snapshot` |
| `jacobdrees-canoncore/folder-component` | `~/canoncore/folder-component` |
| `jacobdrees/claude-skills` | `~/.claude/skills` |

Work takes one of two weights.

## Light

For a change that fits one ticket, needs no new decision and touches no ADR or `CONTEXT.md` term.

1. **One ticket**, filed with its acceptance criteria.
2. **`check`** on it.
3. **`/implement`** in its own Orca worktree.
4. **Main's review** against its acceptance criteria, then the merge.

## Full

For anything else.

1. **Grill.** `/grill-with-docs` sharpens the idea by interview, drafting `CONTEXT.md` terms and
   ADRs as they resolve. Each option starts from what the competitors do. Done when the frontier is
   empty and the Owner confirms the shared understanding.
2. **Trace**, when the grill changes an ADR or a `CONTEXT.md` term. `tracing-a-decision` lists every
   sentence the decisions make false, across this repository, every open spec and ticket and every
   sibling, before any of them is committed. Nothing lands until the Owner says go.
3. **Spec.** `/to-spec`.
4. **Tickets.** `/to-tickets`, each a sub-issue of the spec with its blocked-by edges, ending with an
   **audit ticket** blocked by all the others. A later spec that builds on this one is blocked by
   that first audit, and by any follow-up of it that the later spec needs.
5. **Check.** `check` over the spec and every ticket, always. Only blocking findings hold dispatch;
   after two rounds, what still blocks goes to the Owner, who decides.
6. **Implement.** `/dispatch` starts each ticket on the frontier; `/implement` runs it, one ticket per
   Orca worktree, and Main reviews and merges. A worker needing the Owner invokes `/grill-with-docs`
   in its own worktree.
7. **Audit.** The audit ticket runs `auditing-a-spec`: it files every blocking gap as a follow-up
   with a re-audit, and after round 2 the Owner decides whether another round is funded. The last
   clean round (no blocking gap) carries the Owner's walk and the accessibility pass; the Owner sets
   it Done after the walk, and the spec closes with it.

Keep steps 1 to 5 in one unbroken context, so the spec, the tickets and the check are built on the
grill's thinking rather than a summary of it. Each `/implement` starts fresh from its ticket.

## Off the flow

- A question talk cannot settle detours through `/prototype`.
- An effort too foggy for one grill goes through `/wayfinder`, then joins at `/to-spec`.
- `tracker-sweep` repairs drifted tickets when asked; `design-panel` puts one UI question past nine
  design lenses; `setup-orca-linear-project` stands up a project. The Owner invokes the last two.
