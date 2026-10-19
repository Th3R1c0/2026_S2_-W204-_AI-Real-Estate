CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TYPE "public"."flood_hazard_type" AS ENUM('flood_plains', 'flood_prone_areas', 'overland_flow_paths', 'coastal_inundation');--> statement-breakpoint
CREATE TABLE "flood_hazard_zones" (
	"flood_hazard_zone_id" serial PRIMARY KEY NOT NULL,
	"hazard_type" "flood_hazard_type" NOT NULL,
	"source_feature_id" varchar(100) NOT NULL,
	"source_url" varchar(500) NOT NULL,
	"source_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"geom" geometry(Geometry, 4326) NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_flood_hazards" (
	"property_id" integer NOT NULL,
	"flood_hazard_zone_id" integer NOT NULL,
	CONSTRAINT "property_flood_hazards_property_id_flood_hazard_zone_id_pk" PRIMARY KEY("property_id","flood_hazard_zone_id")
);
--> statement-breakpoint
ALTER TABLE "property_flood_hazards" ADD CONSTRAINT "fk_property_flood_hazards_property" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_flood_hazards" ADD CONSTRAINT "fk_property_flood_hazards_zone" FOREIGN KEY ("flood_hazard_zone_id") REFERENCES "public"."flood_hazard_zones"("flood_hazard_zone_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_flood_hazard_zones_source" ON "flood_hazard_zones" USING btree ("hazard_type","source_feature_id");--> statement-breakpoint
CREATE INDEX "sp_flood_hazard_zones_geom" ON "flood_hazard_zones" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "idx_property_flood_hazards_zone" ON "property_flood_hazards" USING btree ("flood_hazard_zone_id");