-- Migration 4, under CNCORE-8. WHAT A SOURCE'S LICENCE OBLIGES THE APP TO SHOW.
--
-- IT WAS WRITTEN AS MIGRATION 3 AND RENUMBERED ON MERGE. CNCORE-28 added the
-- external-id mapping as migration 3 while this branch was open, and the journal
-- is a registry both tickets appended to -- which is why each ran in its own
-- worktree, so the collision arrived as a conflict git reports rather than as a
-- silent overwrite. Theirs was on `main` first and is therefore the earlier rung,
-- so this one moved to sit after it. ADR-0047 freezes a rung once RELEASED;
-- neither is, so renumbering this one cost nothing and renumbering theirs was
-- never on the table.
--
-- The second provider is the first one whose source charges for its data in
-- obligations rather than money. TMDB's API Terms paragraph 3 is three of them:
-- a verbatim notice placed prominently, their logo shown at all, and the logo
-- made not to imply endorsement. Read 2026-09-11; ADR-0036 carries the text.
--
-- THE COLUMNS ARE ON `sources` AND THAT IS THE DECISION THIS RUNG MAKES. An
-- obligation belongs to whoever imposed it, and every statement and every
-- placement already names its source -- so "which claims does this notice cover"
-- is a join, not a column repeated on every claim. It also puts the obligation
-- on the row a purge deletes, which is what keeps the notice and the content it
-- covers from coming apart: TMDB's termination clause requires purging their
-- content, and a notice outliving the content is the harmless half of that.
--
-- THE VALUES ARE THE PROVIDER'S, NEVER OURS (ADR-0033). A notice held in
-- CanonCore against a known provider identity works perfectly for TMDB and
-- leaves the next source's obligation nowhere to go. The app renders what it is
-- handed and knows nothing about whose terms it is satisfying.
--
-- THE LOGO IS BYTES RATHER THAN A URL, which is the opposite of how every other
-- image in CMPP travels, and the difference is WHICH PROCESS FETCHES. An image
-- reference on a record is fetched by this server, which ADR-0034's allowlist
-- says may reach the provider. A mark on a page is fetched by the READER'S
-- BROWSER, which nothing has ever promised can: a provider on a LAN address or a
-- container network is reachable by the app and not by the person reading it,
-- and that breach renders as whitespace with nothing reporting it.
--
-- TWO CHECKS, each holding a half-written obligation out of the table. A mark
-- with no alternative text is a breach rendered as a picture, since the alt text
-- is where the no-endorsement sentence lives for a reader who cannot see the
-- mark; and a mark with no notice renders a third party's trademark with nothing
-- saying why it is there. `num_nonnulls(...) <> 1` rather than a pair of
-- implications, because what is being said is that the two are ONE FACT.
--
-- STRATEGY (ADR-0047 asks every rung to state one): IT MIGRATES EVERYTHING, and
-- briefly, because it only ADDS. Three nullable columns and two checks that are
-- vacuously true of every existing row -- NULL in all three satisfies both. No
-- row can fail to transform, so there is nothing to quarantine. NULL is also a
-- real answer here rather than a gap waiting to be filled: it says the source
-- imposes nothing, which is true of the owner and of the archive alike.

ALTER TABLE "sources" ADD COLUMN "attribution_notice" text;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "attribution_logo" text;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "attribution_logo_alt" text;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_logo_carries_its_alternative_text" CHECK (num_nonnulls("sources"."attribution_logo", "sources"."attribution_logo_alt") <> 1);--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_logo_comes_with_a_notice" CHECK ("sources"."attribution_logo" is null or "sources"."attribution_notice" is not null);