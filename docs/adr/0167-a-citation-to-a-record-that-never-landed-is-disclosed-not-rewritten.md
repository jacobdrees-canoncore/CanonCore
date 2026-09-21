---
status: proposed
---

# A citation to a record that never landed is disclosed, not rewritten

> **PROPOSED 2026-09-20. BUILT OVER PROSE, WHICH IS ONE POPULATION OF TWO.**
> `adr-citations.test.ts` holds every ADR number cited in `docs/`, in `.claude/` (since CNCORE-313,
> [[0190-the-prose-corpus-is-named-once-and-claude-is-prose]]) and in the root's markdown to a
> record this tree holds or an entry in `docs/research/README.md`'s amnesty, and that amnesty now
> names all seven numbers this repository cites and never took. **SINCE CNCORE-264 it also holds the
> SLUG**, where the number resolves and the words after it are a sentence no record carries as its
> name; a number the amnesty accounts for is skipped by that rule, having no file for a slug to be
> wrong against, which is what covers this record's own `[[0086-the-slug]]`. **NOT BUILT: the same rule over
> source comments.** `ADR-0086` in a `.ts` file is the form `adr-as-built.test.ts` reads for a
> different question, and nothing checks it resolves. Source is clean today — the seven live only in
> research — so the gap is a missing guard rather than a standing defect, and it is why this record
> is `proposed` rather than `accepted`. [[0153-a-figure-about-this-tree-is-derived-or-dated]] stands
> `proposed` for the same shape: a rule enforced over one population and no other.

Seven numbers — 0079, 0080, 0086, 0093, 0095, 0098 and 0099 — are cited 40 times across five files
in `docs/research/`, counting the three forms the check matches, and `docs/adr/` has never held any
of them. A sixth file names 0080 in the unmatched list form, so the figure is citations the check
sees rather than every mention. Each citation reads as though it
names a record. None of them does.

## They were never deleted, and that is the whole of it

`audit-new-adrs-internal.md` is titled "Internal consistency audit: ADR-0073..0099" and its method
says every record in that range "was read in full". They existed, on the 2026-09-10 branch it was
auditing. **That audit is what stopped them merging**: it judged each against the bar for being a
record at all, found seven that restated, planned or instructed rather than decided, and named where
each one's content belonged instead.

So the prose is accurate about what was known when it was written. It cites the proposals the audit
was evaluating, and the audit's own verdict on each is the reason the number is free. A reader who
meets `ADR-0086` in `verify-new-adrs-plex.md` is not reading a mistake; they are reading an argument
about a proposal, made before the proposal was refused.

## The fix is a disclosure, because the alternative falsifies the record

`docs/research/README.md` already decided the general case, for deleted FILES: "The citations are
left as they were written. Editing research to match a later deletion would falsify the record of
what was known when." `doc-line-citations.test.ts` leans on that same sentence to leave 330 line
citations legal while refusing the 213 an edit in this repository can break.

Rewriting 40 citations to point at ADR-0019 and ADR-0012 would make every one of those documents
claim it had consulted a record that did not exist on the day it was written. It would buy a
resolvable pointer at the price of the thing research is for. **So the number stays and the amnesty
explains it**, naming what each one decided and where the content lives now — ADR-0015 for 0079's
freeze, ADR-0012 for 0080's rating shape, ADR-0019 for 0086's ten-second rule, `CLAUDE.md`'s
Principles for 0093, `docs/demo.md` for 0095, ADR-0003 and ADR-0063 for 0098. ADR-0099 went nowhere
on purpose, being a UI choice reversible in an afternoon.

## A guard, because a list nobody checks is where this started

The seven accumulated silently and were found by a 688-file scan, not by anything in the tree. The
check asks the tree for the records and the README for the disclosures, so a record added or an
entry written is covered without touching it — `adr-numbering.test.ts`'s reason in its own words, "a
record added without touching this file is still covered".

**IT IS THE THIRD GUARD OF ONE FAMILY, and they divide by what the pointer NAMES rather than by
where it sits.** `doc-line-citations.test.ts` holds a pointer to a LINE, which an edit above it
breaks. [[0166-an-identifier-a-record-names-is-checked-against-what-this-tree-once-held]] holds a
pointer to a SYMBOL, which a rename breaks, and resolves it against what this tree once held. This
holds a pointer to a RECORD, which is broken from birth when the record never landed. All three are
the shape `doc-line-citations.test.ts` names at its own root — a pointer that stays syntactically
fine while becoming false — and none of them could catch the others' population.

**The amnesty is a register, not an allowlist.** An entry whose number a later record takes stops
being a disclosure and starts masking that record, so the check refuses it and the entry is deleted
when that happens.

**It reads the amnesty's TABLE and not its prose**, which was measured rather than reasoned: the
section quotes the audit's title, `ADR-0073..0099`, and the first draft of the reader enrolled
ADR-0073 — a live record — into the amnesty from that sentence. The check above caught it on its
first run.

**Three spellings, and the exclusion is load-bearing.** `ADR-0086`, `[[0086-the-slug]]` and
`docs/adr/0080-...md` are matched. The space-separated list `ADR 0005, 0012, 0080` and the range
`ADR-0073..0099` are not, because every number after the first is bare and indistinguishable from a
date: a sweep that tried it read the `2026` of `(ADR-0129, 2026-09-13)` as a record, in four places.
All seven are still caught, each being cited at least once in a matched form.
