---
status: proposed
---

# A file's identity is its content; its path is location

Identity is SHA1(ascii(decimal size) + hex(SHA1(first 64KB)) + hex(SHA1(last 64KB))), with no
separators and the last term omitted entirely for files of 64KB or smaller.

This is Plex's exact algorithm, published on Plex's own forum on 2025-02-12 (topic 904178, post 5)
and independently reproduced by the asker in the next post. The authority for it is that it
reproduces Plex's `media_parts.hash` column, not the poster's standing — the forum flags staff and
does not flag him.

A moderator had answered the same thread a day earlier with a description that is wrong on three
counts — 4KB not 64KB, the raw bytes rather than their hex digests, and no file-size term — and the
asker records it failing: "the hash changes every time."

Plex computes this on every file and then does not use it to relink moves: it relinks by metadata
GUID instead. A claim that users lose watch state on drive reshuffles is withdrawn — a Plex employee
answering exactly that report said "Watch state is stored independently by the item's GUID, removing
the files should not affect this", and the reporter never reproduced it.
A moved file is the same file. Cost is 128KB read per file.

Two files with the same content are a REDUNDANT FILE, never a "duplicate" — that word names
multi-placement, which is the product's central feature. A redundant file is surfaced as a
SUGGESTION and never auto-deleted.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`.
