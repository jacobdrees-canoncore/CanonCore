---
status: proposed
---

# CanonCore has two audiences, and both are first-class

CanonCore is built for one owner, and it is assessed by a second reader deciding whether the person
who built it can build. Both are requirements. Neither is a consequence of the other.

The records in this directory were written as though only the first reader existed, and TWO OF
THEM ALREADY REST ON THE SECOND WITHOUT NAMING IT. ADR-0055 says the apps "are being built anyway,
deliberately, because demonstrating them is a stated goal" and never says demonstrating to whom.
`docs/demo.md` describes a public instance whose entire purpose is to be read by someone who is not
the owner, and opens by calling itself "not a decision". Both are legible only once the second
audience is stated, and this record states it.

## What it decides

**The repository goes public when version one's four conditions are met.** WHICH repository is
settled by [[0114-the-public-repository-is-a-fresh-one]]: a new one, seeded from the tree, with the
existing private repository keeping its history and the forensic record. So what this sentence means
by "the artefact" is the ADRs, `CONTEXT.md` and the research corpus — files, all of which travel —
rather than the commit graph, which does not. Between now and then the
repository IS the artefact — there is no demo, no client and no public instance — so this is not a
cosmetic date. Review the forensic record before flipping it: that is the account of five dead
attempts, and publishing it is a separate judgement from publishing the rest.

**Portfolio needs are requirements rather than nice-to-haves.** The apps, the demo and the public
repository are not indulgences to be cut first under pressure. They are what the second audience
reads.

## What it does not decide, and this half is the point

It does not move CNCORE-2's four-condition cap, and it does not resequence the demo, which stays
last. **ADR-0051 still governs scope, unchanged.**

That bound is deliberate rather than cautious. ADR-0051 rests on a forensic record in which the
previous attempts died two to four weeks in and "an artefact revealing total cost preceded the death
every time". A second requirement set is a standing argument for more surface, which is precisely
the pressure that record describes. Naming the second audience makes that pressure arguable. Leaving
it unnamed would let it act invisibly, which is what it has been doing.

So the test for anything justified by this record is: does it make an existing thing VISIBLE, or does
it make a new thing EXIST? The first is what this record is for. The second is ADR-0051's to refuse.

## Consequence worth stating

The demo sequences last and the clients after version one, so for the whole of version one the
second audience has exactly one thing to read: this repository. That is an argument for the records
being good, not for there being more of them.

## Half built, under CNCORE-62 — and this record stays PROPOSED

**BUILT: the flip.** The repository is public, under AGPL-3.0-or-later, and what the second audience
reads is on it — 108 records with dated evidence, `CONTEXT.md`, and the research corpus they are
argued from. `canoncore-history` keeps the pre-publication history and the forensic record, archived
and read-only ([[0114-the-public-repository-is-a-fresh-one]]).

**NOT BUILT: the other two things this record calls requirements rather than appendices.** There is
no client and no demo, and this record is explicit that both are owed to the same audience. It flips
to `accepted` when they exist, not before — which is the point of writing them down as requirements
rather than as hopes.
