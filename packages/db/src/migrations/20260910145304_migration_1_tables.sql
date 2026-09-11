CREATE SEQUENCE "public"."change_sequence" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "item_kinds" (
	"kind" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_cardinalities" (
	"cardinality" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_datatypes" (
	"datatype" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_value_kinds" (
	"value_kind" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranks" (
	"rank" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"precedence" integer NOT NULL,
	CONSTRAINT "ranks_precedence_unique" UNIQUE("precedence")
);
--> statement-breakpoint
CREATE TABLE "source_kinds" (
	"kind" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"alias_item_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	"merge_id" uuid,
	CONSTRAINT "aliases_alias_item" UNIQUE("alias_item_id"),
	CONSTRAINT "aliases_do_not_point_at_themselves" CHECK ("aliases"."alias_item_id" <> "aliases"."item_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"is_container" boolean DEFAULT false NOT NULL,
	"is_ordered" boolean DEFAULT false NOT NULL,
	"holds_work" boolean DEFAULT false NOT NULL,
	"title" text,
	"sort_name" text,
	"release_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	"merge_id" uuid,
	CONSTRAINT "items_ordered_implies_container" CHECK (not "items"."is_ordered" or "items"."is_container")
);
--> statement-breakpoint
CREATE TABLE "merges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "placement_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"placement_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"rank" text DEFAULT 'normal' NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	"merge_id" uuid,
	CONSTRAINT "placement_sources_placement_source" UNIQUE("owner_id","placement_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"container_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"edition_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	"merge_id" uuid,
	CONSTRAINT "placements_container_item_position" UNIQUE("owner_id","container_id","item_id","position")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"datatype" text NOT NULL,
	"value_kind" text NOT NULL,
	"cardinality" text NOT NULL,
	"reference_target" text[],
	"validation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	"merge_id" uuid,
	CONSTRAINT "properties_name" UNIQUE("owner_id","name"),
	CONSTRAINT "properties_only_item_values_have_a_reference_target" CHECK ("properties"."value_kind" = 'item' or "properties"."reference_target" is null),
	CONSTRAINT "properties_datatype_agrees_with_value_kind" CHECK (("properties"."datatype" = 'item') = ("properties"."value_kind" = 'item'))
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"identity" text NOT NULL,
	"label" text NOT NULL,
	"source_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	"merge_id" uuid,
	CONSTRAINT "sources_identity" UNIQUE("owner_id","kind","identity"),
	CONSTRAINT "sources_order" UNIQUE("owner_id","source_order"),
	CONSTRAINT "sources_derived_names_its_version" CHECK ("sources"."kind" <> 'derived' or "sources"."identity" ~ '^derived:.+$')
);
--> statement-breakpoint
CREATE TABLE "statement_qualifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"statement_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"value_literal" text,
	"value_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	"merge_id" uuid,
	CONSTRAINT "statement_qualifiers_one_value" CHECK (num_nonnulls("statement_qualifiers"."value_literal", "statement_qualifiers"."value_item_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"subject_item_id" uuid,
	"subject_placement_id" uuid,
	"property_id" uuid NOT NULL,
	"value_literal" text,
	"value_item_id" uuid,
	"source_id" uuid NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rank" text DEFAULT 'normal' NOT NULL,
	"confidence" numeric(4, 3),
	"valid_until" timestamp with time zone,
	"language" text DEFAULT 'none' NOT NULL,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	"merge_id" uuid,
	CONSTRAINT "statements_one_subject" CHECK (num_nonnulls("statements"."subject_item_id", "statements"."subject_placement_id") = 1),
	CONSTRAINT "statements_one_value" CHECK (num_nonnulls("statements"."value_literal", "statements"."value_item_id") = 1),
	CONSTRAINT "statements_confidence_is_a_probability" CHECK ("statements"."confidence" is null or ("statements"."confidence" >= 0 and "statements"."confidence" <= 1))
);
--> statement-breakpoint
CREATE TABLE "vocabulary_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"value" text NOT NULL,
	"retired" boolean DEFAULT false NOT NULL,
	"quarantined" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_sequence" bigint DEFAULT nextval('change_sequence') NOT NULL,
	"merge_id" uuid,
	CONSTRAINT "vocabulary_values_raw_value" UNIQUE("owner_id","property_id","value")
);
--> statement-breakpoint
ALTER TABLE "aliases" ADD CONSTRAINT "aliases_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aliases" ADD CONSTRAINT "aliases_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aliases" ADD CONSTRAINT "aliases_merge_id_merges_id_fk" FOREIGN KEY ("merge_id") REFERENCES "public"."merges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_kind_item_kinds_kind_fk" FOREIGN KEY ("kind") REFERENCES "public"."item_kinds"("kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_merge_id_merges_id_fk" FOREIGN KEY ("merge_id") REFERENCES "public"."merges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merges" ADD CONSTRAINT "merges_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_sources" ADD CONSTRAINT "placement_sources_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_sources" ADD CONSTRAINT "placement_sources_placement_id_placements_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_sources" ADD CONSTRAINT "placement_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_sources" ADD CONSTRAINT "placement_sources_rank_ranks_rank_fk" FOREIGN KEY ("rank") REFERENCES "public"."ranks"("rank") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_sources" ADD CONSTRAINT "placement_sources_merge_id_merges_id_fk" FOREIGN KEY ("merge_id") REFERENCES "public"."merges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_container_id_items_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_merge_id_merges_id_fk" FOREIGN KEY ("merge_id") REFERENCES "public"."merges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_datatype_property_datatypes_datatype_fk" FOREIGN KEY ("datatype") REFERENCES "public"."property_datatypes"("datatype") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_value_kind_property_value_kinds_value_kind_fk" FOREIGN KEY ("value_kind") REFERENCES "public"."property_value_kinds"("value_kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_cardinality_property_cardinalities_cardinality_fk" FOREIGN KEY ("cardinality") REFERENCES "public"."property_cardinalities"("cardinality") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_merge_id_merges_id_fk" FOREIGN KEY ("merge_id") REFERENCES "public"."merges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_kind_source_kinds_kind_fk" FOREIGN KEY ("kind") REFERENCES "public"."source_kinds"("kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_merge_id_merges_id_fk" FOREIGN KEY ("merge_id") REFERENCES "public"."merges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_qualifiers" ADD CONSTRAINT "statement_qualifiers_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_qualifiers" ADD CONSTRAINT "statement_qualifiers_statement_id_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_qualifiers" ADD CONSTRAINT "statement_qualifiers_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_qualifiers" ADD CONSTRAINT "statement_qualifiers_value_item_id_items_id_fk" FOREIGN KEY ("value_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_qualifiers" ADD CONSTRAINT "statement_qualifiers_merge_id_merges_id_fk" FOREIGN KEY ("merge_id") REFERENCES "public"."merges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_subject_item_id_items_id_fk" FOREIGN KEY ("subject_item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_subject_placement_id_placements_id_fk" FOREIGN KEY ("subject_placement_id") REFERENCES "public"."placements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_value_item_id_items_id_fk" FOREIGN KEY ("value_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_rank_ranks_rank_fk" FOREIGN KEY ("rank") REFERENCES "public"."ranks"("rank") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_merge_id_merges_id_fk" FOREIGN KEY ("merge_id") REFERENCES "public"."merges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_values" ADD CONSTRAINT "vocabulary_values_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_values" ADD CONSTRAINT "vocabulary_values_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_values" ADD CONSTRAINT "vocabulary_values_merge_id_merges_id_fk" FOREIGN KEY ("merge_id") REFERENCES "public"."merges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_sort_name" ON "items" USING btree ("sort_name");--> statement-breakpoint
CREATE UNIQUE INDEX "owners_single_row" ON "owners" USING btree ((true));--> statement-breakpoint
CREATE INDEX "placements_container_position" ON "placements" USING btree ("container_id","position");--> statement-breakpoint
CREATE INDEX "placements_item" ON "placements" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "statement_qualifiers_statement" ON "statement_qualifiers" USING btree ("statement_id");--> statement-breakpoint
CREATE INDEX "statements_subject_item_property" ON "statements" USING btree ("subject_item_id","property_id");--> statement-breakpoint
CREATE INDEX "statements_value_item" ON "statements" USING btree ("value_item_id");