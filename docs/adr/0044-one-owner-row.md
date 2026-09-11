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
