---
status: proposed
---

# The name is settled; do not rename again

CanonCore has already been renamed twice.

AND THE OLD NAMES MUST NOT SURVIVE IN THE CODE. Never "Universora" in an identifier, a path or a
component name. This matters more than it sounds: the salvage manifest instructs lifting code out of
repositories that carried the old name, so the rule governs an operation the project actually
intends to perform, not a hypothetical.

A rename is not a find-and-replace. Karakeep's cost it Docker image continuity and its Firefox
extension outright — "we couldn't get the old one back... you MUST migrate to the new one manually".
The work itself was 14 commits in the tight cluster over three weeks, one of them touching 230 files
(+654/-644).

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-products.md`.
