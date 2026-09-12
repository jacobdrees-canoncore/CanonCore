---
status: accepted
---

# One owner row, but `owner_id` on every table

Single user, one password, no signup, no multi-tenancy, no RLS, no database roles, no
transaction-scoped owner context — and `owner_id` on every table regardless.

That makes multi-user a later migration rather than a rewrite, at the cost of a column nothing
currently reads.

The public demo is read-only with no login.

## As built, under CNCORE-4

"One row" is ENFORCED, by a unique index on a constant expression:
`CREATE UNIQUE INDEX owners_single_row ON owners ((true))`. Multi-user is a
later migration, and dropping this index is the first thing that migration does.

The owner's id is GENERATED PER INSTALL rather than being a constant in the
source. Nothing outside the database needs to name it, and a shared constant is
a value waiting to be assumed unique when it is not.

The owner is also seeded as a SOURCE, at `source_order` 0 -- first in the global
order (ADR-0025), so nothing the owner asserts is beaten by a provider before
ranks are even considered.

No password column ships. Authentication is retrofittable and ADR-0051 keeps
migration 1 to what is not.

## The other two sentences, as built under CNCORE-109

"One password" and "the public demo is read-only with no login" were the half of this record that
nothing implemented. Both are now mechanisms rather than intentions.

**THE PASSWORD IS CONFIGURATION, WHICH IS WHAT KEEPS "no password column ships" TRUE.**
`OWNER_PASSWORD` sits beside `DATABASE_URL` and `PROVIDER_ALLOWLIST`, where this instance's other
secrets already are, and `session.logIn` compares it in constant time on SHA-256 digests -- on
DIGESTS because `timingSafeEqual` refuses buffers of unequal length, so comparing the raw strings
would throw on almost every wrong guess and run in constant time only for the ones that happened to
be the right length. A hash column would have needed a surface to SET it, and "no signup" is this
record's own sentence.

**THE DEMO IS AN INSTANCE THAT NEVER SETS IT.** Not a mode, not a deployment flag, not a build:
`OWNER_PASSWORD` unset means `session.logIn` refuses every password, so nothing can obtain a session
and everything that writes is refused -- while every read still answers, because the read path asks
for nothing (ADR-0072). A visitor is TOLD that rather than left guessing, by `session.configured`,
for the reason `provider.allowlisted` exists one setting over: "that password was refused" is the
wrong sentence to put in front of somebody on an instance that has no password.

**AND ONE ANSWER IS DELIBERATELY AMBIGUOUS.** A wrong password and an instance with no password
both answer `UNAUTHORIZED` from `logIn`. A caller who could tell them apart could ask any instance
on the internet whether it is somebody's catalogue or the demo, which is a question the surface has
no reason to answer procedure by procedure -- `session.configured` answers it once, plainly, where a
page can act on it.

**`owner_id` IS STILL THE COLUMN NOTHING READS, AND THE SESSION DID NOT CHANGE THAT.** A session
carries the owner it belongs to, and `startSession` reads that owner from the single row rather than
taking it from a caller -- because a caller free to name which owner a session belongs to is a caller
free to name the wrong one on the day multi-user arrives.
