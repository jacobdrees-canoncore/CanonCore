# Founding ADR drafts

Drafted 2026-09-28 from `../grill-decisions.md` (section 18, the Founding ADR map). These move to `docs/adr/` at process step 7 (D-98), after the old `docs/adr/` is archived to `canoncore-history` in step 5.

- 0001 The Library is imported, and files are only matched to it: D-4, D-53, D-31
- 0002 No default Provider, except Local metadata: D-5, D-36, D-43
- 0003 Providers speak CMPP from a Store of manifest URLs: D-44, D-45, D-46
- 0004 Every value is a sourced Statement, and a Lock wins: D-50, D-51, D-52
- 0005 A fixed hierarchy per medium, with Orderings on top: D-15, D-17, D-24, D-26
- 0006 Item, Edition and Version, and a Version can be a Segment: D-16, D-19, D-60
- 0007 An Item may appear more than once in an Ordering: D-27, D-28, D-30
- 0008 Everything-agnostic: one process on SQLite, and host limits are settings: D-3, D-79, D-13
- 0009 One SwiftUI app for every Apple device, plus a full web client: D-8, D-9, D-10
- 0010 Odd codecs decode on the device, and transcoding is optional: D-55, D-57
- 0011 Invited Accounts and Profiles on Better Auth: D-68, D-69, D-70, D-71
- 0012 Streams use short-lived signed URLs, never Account tokens: D-56
- 0013 Progress is an append-only event log per Profile and Edition: D-59
- 0014 Clients keep a local Library copy fed by a change feed: D-61, D-62
- 0015 A missing file goes Offline, and is recognised again by fingerprint: D-54
- 0016 A pnpm and Turborepo monorepo, with the API contract generated from Zod: D-12, D-86
- 0017 The API is additive-only within a major version: D-64
- 0018 The code is AGPL-3.0: D-82
