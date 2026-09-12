---
paths:
  - "docs/**"
---

# Documents

**Cite prose by section, never by line number.** A line citation is correct only until somebody
edits the file above it, and NOTHING REPORTS THE BREAK: the citation still reads as though it names
something, and now points at a blank line or the wrong paragraph. `docs/research/` carried 213 of
them, and more than twenty were checked and found already false, four of those into ADR-0109 alone.

What to write instead, in the form the target is keyed by:

- A record or a research document: its heading. So
  `docs/adr/0109-deployment-is-a-shape-not-a-vendor.md` under "The growth path, so a later move is
  not a cancellation", or `the-cheap-end.md` §5, "What to do". Where a heading repeats within one
  file, name the section above it too:
  `resolve-counter-signals.md` has eleven identical `### 4. SURVIVES or MOVES` headings.
- An ADR's opening decision block, which is everything above its first `##`: name the record alone.
  The quote beside it is what pins the sentence.
- `CONTEXT.md`: the **headword**. A glossary is keyed by term, and a term outlives any heading.

`packages/config/src/doc-line-citations.test.ts` fails the build on a line citation this tree can
resolve. It deliberately permits one that it cannot: `docs/research/` cites `SPEC.md`,
`decisions.md` and the forensic record by line — 330 of those — and `docs/research/README.md`
rules them left as written: an edit here cannot move a file that is not here, and rewriting them
to match a later deletion would falsify the record of what was known when.

**Code by line is fine** (`ci.yml:113-132`). An editor resolves it and a build reports it when it
rots. This rule is about prose citing prose.
