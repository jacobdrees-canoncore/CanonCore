---
status: accepted
---

# A database rule earns a test when a write can reach it

> **ACCEPTED 2026-09-20, whole, in one repository.** Fifteen violating writes landed against the
> rules a path in this repository can actually reach, the nineteen `touch_row` triggers are asserted
> as a group by attachment rather than nineteen times by behaviour, and the nine rules no write can
> reach are listed below with the reason each is left. No provider repository is touched, so nothing
> is owed at a second one.

This database enforces **35 rules** -- 19 CHECK constraints, 11 UNIQUE constraints and 5 bare unique
indexes. Eleven of them had a test. The other twenty-four were carried by nothing but the absence of
code that broke them, which is a different thing from being held.

**The figures here are DERIVED, which is the arm of ADR-0153 that binds wherever the answer is
there to be taken.** `constraints.test.ts` holds the roll call: it counts the rules from
`pg_constraint` union `pg_index` against the built database, reads the suite to find which of them
any test actually asserts, and requires the remainder to be EXACTLY the nine named below. So the
population, the coverage and this list are one assertion that runs on every test run, and a rule
added without a test or a decision turns it red.

**Against the applied catalogue rather than the migration text**, and that is the choice worth
naming. Counting `CONSTRAINT` across `migrations/*.sql` answers what the ladder SAYS; only the built
database answers what it HOLDS, which is the thing a violating write meets. That is also why this
count is not in `tree-figures.test.ts` -- that suite runs behind the network gate with no PostgreSQL
to ask, so the roll call lives where the database already is. Taken 2026-09-20 and re-derived on
every run since: 35 rules, 26 tested, 9 left.

## The criterion is reachability, and the ticket that filed this had it inverted

CNCORE-260 was filed naming `sources_logo_carries_its_alternative_text` and
`sources_logo_comes_with_a_notice` as the highest-value pair, "the ADR-0036 breach surface". They are
the **least** reachable rules in the whole set, and `/verify` caught that before anything was built
against it.

`packages/contract/src/cmpp.ts` holds `notice: z.string().min(1)` required wherever `attribution`
is present and `alt: z.string().min(1)` required wherever `logo` is -- so **a half-written obligation
is a refused manifest**, not a write the database has to catch. `import.ts:521-523` then writes all
three columns from one `provider.attribution` object, so they cannot come apart on the way in
either. A violating write against those two would have to be composed by hand, and a test that has
to invent a caller is testing the constraint's SQL rather than the product.

So the rule is **reachability**, not count and not severity. A rule some path in this repository can
reach earns a violating write, because the thing being tested is that the database refuses what the
product can actually produce. `import_run_containers_named_once` is the worked example of why that
matters: it was believed unreachable, the ordinary case reached it, and the Owner met a 500
(CNCORE-254, [[0154-a-repeated-container-id-refuses-the-list-rather-than-being-deduped]]).

## What landed

Fifteen violating writes, each asserting **the constraint PostgreSQL named** rather than merely that
something was refused. That is what stops a test tripping a neighbouring rule and passing as though
it had proved the one in its title -- the ordinary way a test like this rots. Each was checked to
fail when given the wrong name.

- **Migration 18's six**, in `import-runs.test.ts` beside CNCORE-254's fix: `outcome_is_known`,
  `landed_counts_what_it_wrote`, `refused_says_why`, `reason_wrote_is_known`, `named_once`,
  `in_list_order`. They go directly against the table on purpose. The suite's functions exist to
  write legal rows, and CNCORE-254 is the proof that going through them cannot reach these: the
  repeat it now refuses by name never gets as far as `named_once`.
- **`sources_order`**, which `import.ts:548` allocates with `max + 1` on every first import from a
  new Provider. A second Provider is a second source row, so this is the constraint the data project
  meets first. It has fired in anger once already, under CNCORE-7.
- **The four where the avoidance was tested and the refusal was not**: `sources_identity`,
  `placement_sources_placement_source`, `group_items_group_item`, `group_providers_group_provider`.
  Each sits behind a find-or-create path with a test asserting it does not collide; none asserted the
  database refuses a collision that got past the path.
- **`task_runs_outcome_is_known`, `task_runs_running_has_no_end`, `settings_single_row`,
  `sessions_token_hash_unique`**.

## The nineteen `touch_row` triggers are asserted by ATTACHMENT, not nineteen times by behaviour

Decided by the dispatcher on 2026-09-20. `touch_row` is ONE shared function and two tests already
prove what it DOES -- `constraints.test.ts`'s "gives every row a number and advances it on every
change" and `settings.test.ts`'s assertion of both halves on the one table where every change is an
UPDATE. A behavioural test per table would re-prove one function once per table, and need a bespoke
valid row for each.

**What varies per table is whether the trigger is attached at all**, so that is what the test
queries: every table carrying a `change_sequence` column, against every table carrying a `touch_row`
trigger that is ENABLED, BEFORE and FOR EACH ROW, with the difference asserted empty. All three
matter, because `touch_row` assigns to `NEW`: it does nothing from an AFTER trigger, has no `NEW` to
assign to from a statement-level one, and answers `pg_trigger` just as happily after
`ALTER TABLE ... DISABLE TRIGGER`. A bare existence check passes on all three. Migration 1 attached it to eleven tables in a loop
precisely because "eleven copies are eleven chances for a later table to be added to ten of them",
and every table since has sat outside that loop and had to say so itself. Migrations 10, 13, 16, 18,
19 and 20 each did; this is what fails the day one does not.

**The population is asserted before the difference**, because the difference between two empty sets
is empty and a query that stopped matching anything would otherwise pass while proving nothing.

## The nine left, and why each is left

Listed so a later pass does not re-derive this, and **held to that list by the roll call** in
`constraints.test.ts` rather than by this table alone: the nine below are named there too, and the
test requires the rules no test asserts to be exactly them. Adding a rule without a test, testing one
of the nine, or dropping one, each turns it red. **Five of them share one reason**: nothing in version
one writes the table at all, which `purge.ts:313` already names as a standing category -- "nothing in
version one writes a qualifier or a merge alias, so neither of these can hold a row yet". Verified
2026-09-20 by counting runtime insert call sites outside tests and fixtures: `aliases`, `ranks`,
`properties`, `statement_qualifiers` and `merges` have **zero**.

| Rule | Why it is left |
| --- | --- |
| `aliases_do_not_point_at_themselves` | Nothing writes `aliases`. A merge is the only writer and version one has none. |
| `statement_qualifiers_one_value` | Nothing writes a qualifier. `purge.ts:313` names this as a deliberate, stated state. |
| `ranks_precedence_unique` | `ranks` is a reference table seeded by migration 1 and written by nothing at runtime. |
| `properties_name` | Properties arrive by a RUNG (migrations 1, 3 and 12 seed them), never at runtime. ADR-0029: only the product adds fields. |
| `properties_datatype_agrees_with_value_kind` | Same: a malformed property could only come from a rung, and a rung that wrote one fails when the ladder is applied. |
| `properties_only_item_values_have_a_reference_target` | Same. |
| `sources_logo_carries_its_alternative_text` | Unreachable: `cmpp.ts:293` requires `alt` wherever `logo` is present, and `import.ts` writes both from one object. |
| `sources_logo_comes_with_a_notice` | Unreachable: `cmpp.ts:288` requires `notice` wherever `attribution` is present. |
| `statements_confidence_is_a_probability` | Nothing writes `confidence`. The column and its prose are the only mentions in the tree. |

**The seeded ones are not untested so much as tested elsewhere, and by a better test.** Every rung is
applied from empty on every test run, so a migration seeding a property that broke
`properties_datatype_agrees_with_value_kind` would fail the whole suite at setup rather than one
assertion. Writing a violating property by hand would assert the same SQL twice.

**What would change this.** Each row above names its own trigger: a merge, a qualifier writer, a
runtime property editor, or a Provider that declares half an attribution. The day one arrives, the
rule it reaches stops being unreachable and earns a violating write on the way in -- which is the
same argument CNCORE-254 settled the hard way.
