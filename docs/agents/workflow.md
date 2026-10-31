# Workflow: decision to merged slice

How the skills fit together, from a decision to a slice merged on `main`. It is Matt Pocock's flow
(`/ask-matt` draws it) with four additions of ours: `check`, `tracing-a-decision`, the audit, and
`/retro` run automatically at the end of each `/implement`.
**Main** is the one session that plans, dispatches and merges. Every CanonCore repository works this
way. This is the one list of every repository that carries the standard block
(`<!-- standard:start -->`), with its checkout and its Linear board (team key, then workspace). The
rows on the `CC` board are the **sibling repositories** a trace reads; the last three are separate
products that carry the same block:

| Repository | Checkout | Board |
| --- | --- | --- |
| `jacobdrees-canoncore/CanonCore` | `~/orca/projects/CanonCore` | `CC`, `jacobrees-canoncore` |
| `jacobdrees-canoncore/untitled-replica` | `~/canoncore/untitled-replica` | `CC`, `jacobrees-canoncore` |
| `jacobdrees-canoncore/prototype-snapshot` | `~/canoncore/prototype-snapshot` | `CC`, `jacobrees-canoncore` |
| `jacobdrees-canoncore/folder-component` | `~/canoncore/folder-component` | `CC`, `jacobrees-canoncore` |
| `jacobdrees-canoncore/design-prototype` | `~/canoncore/design-prototype` | `CC`, `jacobrees-canoncore` |
| `jacobdrees/claude-skills` | `~/.claude/skills` | `CC`, `jacobrees-canoncore` |
| `jacobrees-applemusic/AppleMusic27` | `~/orca/projects/AppleMusic27` | `AM`, `applemusic27` |
| `jacobrees-extractor/extractor` | `~/orca/projects/Extractor` | `EXT`, `extractor-app` |
| `jacobrees-moneymind/room-finder` | `~/orca/room-finder` | `ROOM`, `moneymind-jdr` |

Any change to the standard block files one refresh ticket per row of this table, on that row's
board. A repository that starts carrying the block joins the table in the same change.

Work takes one of two weights.

## Light

For a change that fits one ticket, needs no new decision and touches no ADR or `GLOSSARY.md` term.

1. **One ticket**, filed with its acceptance criteria.
2. **`check`** on it.
3. **`/implement`** in its own Orca worktree.
4. **Main's light review**, then the merge: green CI, the agent's own code-review recorded in the PR,
   and a quick read of the diff against the acceptance criteria. A ticket that changes a record other
   repos copy (the standard block, agent docs, an ADR, `GLOSSARY.md`, a skill's rules) gets the full
   review instead, however small: reading the diff, re-checking its central claim, and walking any
   reader-facing page.

## Full

For anything else.

1. **Grill.** `/grill-with-docs` sharpens the idea by interview, drafting `GLOSSARY.md` terms and
   ADRs as they resolve. Each option starts from what the competitors do. Done when the frontier is
   empty and the Owner confirms the shared understanding.
2. **Trace**, when the grill changes an ADR or a `GLOSSARY.md` term. `tracing-a-decision` lists every
   sentence the decisions make false, across this repository, every open spec and ticket and every
   sibling, before any of them is committed. Nothing lands until the Owner says go.
3. **Spec.** `/to-spec`.
4. **Tickets.** `/to-tickets`, each a sub-issue of the spec with its blocked-by edges, ending with an
   **audit ticket** blocked by all the others. A later spec that builds on this one is blocked by
   that audit at its clean round, and by any follow-up of it that the later spec needs. In Design
   references every spec waits for the previous one's clean round whether or not it builds on it
   (`dispatching.md`, "One spec at a time").
5. **Check.** `check` over the spec and every ticket, always. Only blocking findings hold dispatch;
   after two rounds, what still blocks goes to the Owner, who decides. Nothing is dispatched until then.
6. **Implement.** `/dispatch` starts each ticket on the frontier; `/implement` runs it, one ticket per
   Orca worktree, and Main gives it the full review and merges. A worker needing the Owner invokes
   `/grill-with-docs` in its own worktree; with the Owner away it writes `OWNER-QUESTION.md` and
   stops. A defect found at merge goes back through `/implement`, never as a free-text fix. Each
   ticket ends with `/retro` on the worker's own session, its findings in the PR body. At the next
   go Main puts the findings of every PR merged since the last go to the Owner as one list, and
   files each one accepted in the repository that owns the fix (`dispatch`'s `asking.md`).
7. **Audit.** The audit ticket runs `auditing-a-spec`: it files every blocking gap as a follow-up
   with a re-audit, and after round 2 the Owner decides: fund a blocking-only round, accept what is
   left, or move it to the owning spec's backlog. The last clean round (no blocking gap) carries the
   Owner's walk and the accessibility pass; the Owner sets it Done after the walk, and the spec
   closes with it.

Keep steps 1 to 5 in one unbroken context, so the spec, the tickets and the check are built on the
grill's thinking rather than a summary of it. Each `/implement` starts fresh from its ticket.

## Off the flow

- A question talk cannot settle detours through `/prototype`.
- An effort too foggy for one grill goes through `/wayfinder`, then joins at `/to-spec`.
- `tracker-sweep` repairs drifted tickets when asked; `design-panel` puts one UI question past nine
  design lenses; `setup-orca-linear-project` stands up a project. The Owner invokes the last two.
