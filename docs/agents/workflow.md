# Workflow: decision to merged slice

How the skills fit together, from a decision to a slice merged on `main`. It is Matt Pocock's main
flow (`/ask-matt` draws it) with our own skills at the points where it kept going wrong. **Main** is
the one session that plans, dispatches and merges.

Every CanonCore repository works this way, and each one's `CLAUDE.md` points here. These are the
**sibling repositories** a trace reads, with their checkouts:

| Repository | Checkout |
| --- | --- |
| `jacobdrees-canoncore/CanonCore` | `~/orca/projects/CanonCore` |
| `jacobdrees-canoncore/untitled-replica` | `~/canoncore/untitled-replica` |
| `jacobdrees-canoncore/prototype-snapshot` | `~/canoncore/prototype-snapshot` |
| `jacobdrees-canoncore/folder-component` | `~/canoncore/folder-component` |
| `jacobdrees/claude-skills` | `~/.claude/skills` |

## The flow

1. **Grill.** `/grill-with-docs` sharpens the idea by interview, drafting `CONTEXT.md` terms and ADRs
   as they resolve. It is the default in any repository, a spec's **Open decisions** included;
   `/grill-me` is only for a plan with no repository under it. Each option starts from what the
   competitors do. Done when the frontier is empty **and** the Owner confirms the shared
   understanding.
2. **Trace.** `tracing-a-decision` runs once, at the grill's end, over every decision it reached,
   before any of them is committed. It lists every sentence they make false, across this
   repository, every spec, every open ticket and every sibling repository, and puts each claim they
   rest on through `/verify`. **Nothing lands until the Owner says go**; then the records and every
   fix land together.
3. **Spec.** `/to-spec` turns the thread into a spec in Linear.
4. **Tickets.** `/to-tickets` splits it into tracer-bullet tickets, each a sub-issue of the spec
   with its `blocked-by` edges.
5. **Check.** Main runs `checking-a-spec` straight after: five angles over the spec and every
   ticket, each finding put to a refuter. The Owner chooses reshape, fix or read, and it re-runs
   over whatever was rewritten until a run comes back clean. **Nothing is dispatched before clean.**
6. **Dispatch.** `/dispatch` is Main's loop: merge what is ready, retire its worktree, recompute
   the frontier, and put it to the Owner to spend.
7. **Implement.** `/implement`, one ticket per Orca worktree: a draft PR first, then `/tdd` at
   agreed seams, then `/code-review` with its head recorded in the PR. A question only the Owner
   can answer goes to the agent's own question widget, never to Main; with the Owner away, the
   agent writes `OWNER-QUESTION.md` and stops. A defect found at merge goes back through
   `/implement`, never as a free-text fix.
8. **Close.** When the spec's last ticket merges, Main runs `/closing-a-spec`: the install walked,
   every acceptance criterion read off the code, the records checked, and a ticket for whatever is
   wrong. Then Main guides the Owner's own walk of their install, with the accessibility pass, and
   every stall becomes a ticket. The spec closes after that walk.

## Context hygiene

Keep steps 1 to 5 in one unbroken context, so the spec, the tickets and the check are built on the
grill's thinking rather than a summary of it. Matt's window ends at `/to-tickets`; the check joins it
here because Main runs it straight after. Each `/implement` starts fresh from its ticket.

## Where verification lives

`/verify` is called by the steps that rest on a claim: tracing a decision, and the Claims angle of
checking a spec. `/implement` does not add one; its code review covers the diff. Call `/verify`
directly whenever a version, limit, price or a just-made artifact is about to bear weight.

## Off the flow

- A question talk cannot settle detours through `/prototype`, by `/handoff` both ways.
- An effort too foggy for one grill goes through `/wayfinder`, then joins the flow at `/to-spec`.
- `tracker-sweep` repairs drifted tickets when asked; `/dispatch`'s monitor flags the drift.
- `design-panel` runs one UI question past nine design lenses. The Owner invokes it.
- `setup-orca-linear-project` stands up a project or adds a repository. The Owner invokes it.
