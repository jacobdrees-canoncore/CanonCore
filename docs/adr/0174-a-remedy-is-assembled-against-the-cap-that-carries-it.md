---
status: accepted
---

# A remedy is assembled against the cap that carries it

> **ACCEPTED 2026-09-21, whole, in one repository.** The config boundary's refusal names EVERY
> address that needs a CIDR, and it is BUILT BY MEASURING ITSELF: an entry joins the list only when
> the finished sentence still fits [[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]]'s 300
> characters, so the verdict and the remedy survive at any number of addresses rather than at the
> numbers somebody happened to try. What could not be named is COUNTED, and the clause that survives
> every cut is "or your network's range", which is the complete remedy for exactly that case.
> Measured at every N from one to eight in `packages/providers/src/boundary.test.ts`; the high-water
> mark is 296. Two assertions hold it, and deleting the bound reddens both.

## The rule

A refusal whose remedy GROWS WITH ITS INPUT is assembled against the cap that will carry it, not
written and hoped for. Concretely: build the whole sentence, and add the next variable-length part
only if what results still fits.

This is not the same claim as "it fits at the sizes I measured", and the difference is the whole
record. A fixed shape that measures comfortably at the sizes a developer tried is a shape with an N
at which the cap eats its own remedy, and nothing in the system announces that N.

## Why the cap is the wrong thing to lean on

ADR-0123 caps a reason at 300 characters. **That cap TRUNCATES; it does not bound.** What it removes
is the END of the sentence, and the end is where the remedy is — so the failure mode is a refusal
that still reads as authoritative while having lost the only clause the reader could act on.

This repository has now met that failure three times, which is why the answer is a record rather than
another fix:

- CNCORE-249: a value of any length interpolated into a refusal, cut at 300, taking the verdict with
  it. Answered by bounding the VALUE where it enters (`shortly`, `VALUE_MAX`).
- CNCORE-244: a remedy that was WHOLE but wrong — it told the Owner to do the one thing that cannot
  work. Answered by quoting a CIDR rebuilt from the parse, which needs no ceiling.
- CNCORE-287: a remedy that was RIGHT but PARTIAL, and a list that grows with the resolver's answer.
  Answered here.

Each earlier answer removed one source of unbounded length. This one removes the last: a part that is
unbounded because there can be MORE OF THEM, which no per-value ceiling reaches.

## What was measured

All figures from `assertConfigAddresses` itself on 2026-09-21, Node v24.19.0, ipaddr.js 2.5.0. The
long addresses are ULA (`fd12:3456:789a:…`), each rendering at the full 39 characters IPv6 allows,
so every CIDR is 43.

| case | length |
| --- | --- |
| one address, `::1` — keeps ipaddr.js's classification | 187 |
| dual-stack `localhost`, `::1` and `127.0.0.1` | 184 |
| two full-stretch ULA | 251 |
| three full-stretch ULA — **the high-water mark** | 296 |
| four, and every N above it — names two, counts the rest | 263 |
| six, with the bound DELETED | **431**, and `reasonFor` truncates it |

The last row is the assertion's proof rather than its premise: the two tests that hold this rule were
checked by deleting the behaviour they name ([[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]]),
and both go red.

**ONE ENTRY ALWAYS FITS AND NEEDS NO ROOM MADE FOR IT.** The fixed prose plus a single 43-character
CIDR is 207, so the list is never empty and the sentence never degrades to a count with no example.

## What the sentence spends its budget on, and what it gives up

**A MULTI-ADDRESS REFUSAL DOES NOT NAME ipaddr.js'S RANGE, AND A SINGLE-ADDRESS ONE DOES.** Carrying
the range name as well puts two full-stretch IPv6 addresses at 318 — over the cap — so the
classification is the first thing cut. That is the right order: the classification tells the Owner
what KIND of address it is, and the CIDRs tell them what to TYPE. Only one of those is a remedy.

**THE ADDRESSES ARE NAMED ONCE, IN THE REMEDY, RATHER THAN IN THE LEAD AND AGAIN IN THE REMEDY.** The
obvious shape — "refused ::1 and 127.0.0.1: … Add `::1/128, 127.0.0.1/32`" — reads better and costs
375 at full stretch. The lead says how many instead.

**WHAT IT COULD NOT NAME IS COUNTED.** A list the Owner cannot tell is partial is one they paste and
get refused for again, which is CNCORE-287's own defect wearing a different hat. "and 6 more," is
twelve characters that stop the sentence lying by omission.

**IT DOES NOT WIDEN TO THE ENCLOSING BLOCK TO SAVE ROOM.** Offering `::/64` instead of two entries
would be shorter and it ships a hole — [[0034-two-outbound-boundaries]] records that trap and why an
allowlist is narrowed by preference. The budget is not worth a rule.

## Where the ceiling lives

`SENTENCE_MAX` is written in `boundary.ts`, beside the sentences measured against it, and
`REASON_MAX_LENGTH` stays in `reason.ts`. **They are two constants on purpose**: `reason.ts` imports
`OutboundRefused` from `boundary.ts`, so reaching back for the constant would close an import cycle.
`VALUE_MAX` already reasons about the same 300 without importing it.

**WHAT STOPS THEM DRIFTING IS A TEST OF THE ONLY PROPERTY THAT MATTERS**, not a comparison of two
numbers: a refusal built at full stretch is passed through `reasonFor` and asserted to come back
UNCHANGED. If the assembly ceiling ever rose above the reason cap, the sentence this function was
careful to fit would be truncated on its way to the page, and that test is what goes red.

## What this does not decide

The CHECKS. An address that is refused stays refused; this record is only about which addresses one
refusal accounts for and how the sentence carrying them is built. The content boundary keeps stopping
at the first failure, and ADR-0034 says why.
