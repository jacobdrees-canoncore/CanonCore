---
status: accepted
---

# Containers are Items, and there is no collection kind

LRMoo deprecated F16 Container Work and F17 Aggregation Work with the remark "Use superclass F1
Work", so containers fold into `work` rather than getting a kind of their own. (F18 Serial Work was
NOT deprecated — LRMoo's migration table makes it "a direct subclass of F1 Work", and it is still
declared in v1.1.1, November 2025. The classes actually carrying the deprecation remark are F14,
F15, F16, F17, F19, F20 and F21.)

This deviates from ORE Aggregations and IIIF Ranges, which are both their own classes. Jellyfin's
BoxSet is the only real precedent and it is a codebase rather than a specification.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-standards.md`.
