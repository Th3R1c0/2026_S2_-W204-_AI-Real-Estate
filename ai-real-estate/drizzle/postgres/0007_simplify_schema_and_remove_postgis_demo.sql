-- Consolidate chat_history onto buyer_workspaces
ALTER TABLE "buyer_workspaces" ADD COLUMN IF NOT EXISTS "chat_history" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint

-- Add consolidated property metadata columns to property_details
ALTER TABLE "property_details" ADD COLUMN IF NOT EXISTS "display_property_type" varchar(40);
ALTER TABLE "property_details" ADD COLUMN IF NOT EXISTS "architectural_style" varchar(40);
ALTER TABLE "property_details" ADD COLUMN IF NOT EXISTS "orientation" "orientation";
ALTER TABLE "property_details" ADD COLUMN IF NOT EXISTS "sunlight_hours" numeric(4, 1);
ALTER TABLE "property_details" ADD COLUMN IF NOT EXISTS "capital_value" numeric(12, 2);
ALTER TABLE "property_details" ADD COLUMN IF NOT EXISTS "estimated_weekly_rent" numeric(10, 2);
ALTER TABLE "property_details" ADD COLUMN IF NOT EXISTS "ownership_type" varchar(60);
ALTER TABLE "property_details" ADD COLUMN IF NOT EXISTS "sale_method" varchar(160);
ALTER TABLE "property_details" ADD COLUMN IF NOT EXISTS "image_source_url" varchar(500);
ALTER TABLE "property_details" ADD COLUMN IF NOT EXISTS "agent_name" varchar(120);
ALTER TABLE "property_details" ADD COLUMN IF NOT EXISTS "agent_source" varchar(60);
ALTER TABLE "property_details" ADD COLUMN IF NOT EXISTS "agent_contact_url" varchar(500);
--> statement-breakpoint

-- Add label column to open_homes for formatted inspection strings
ALTER TABLE "open_homes" ADD COLUMN IF NOT EXISTS "label" varchar(160);
--> statement-breakpoint

-- Drop unused / demo / PostGIS-dependent tables
DROP TABLE IF EXISTS "property_demo_details" CASCADE;
DROP TABLE IF EXISTS "enquiries" CASCADE;
DROP TABLE IF EXISTS "saved_properties" CASCADE;
DROP TABLE IF EXISTS "property_features" CASCADE;
DROP TABLE IF EXISTS "features" CASCADE;
DROP TABLE IF EXISTS "property_agent" CASCADE;
DROP TABLE IF EXISTS "real_estate_agents" CASCADE;
DROP TABLE IF EXISTS "agencies" CASCADE;
DROP TABLE IF EXISTS "property_flood_hazards" CASCADE;
DROP TABLE IF EXISTS "flood_hazard_zones" CASCADE;
DROP TYPE IF EXISTS "flood_risk" CASCADE;
--> statement-breakpoint

-- Drop PostGIS / spatial columns, triggers, and indexes from address, schools, and school_zones
DROP TRIGGER IF EXISTS "trg_address_bi" ON "address";
DROP TRIGGER IF EXISTS "trg_address_bu" ON "address";
DROP FUNCTION IF EXISTS "sync_address_location"() CASCADE;
DROP INDEX IF EXISTS "sp_address_location";
ALTER TABLE "address" DROP COLUMN IF EXISTS "location";
CREATE INDEX IF NOT EXISTS "idx_address_coords" ON "address" ("latitude", "longitude");
--> statement-breakpoint

DROP INDEX IF EXISTS "sp_schools_location";
ALTER TABLE "schools" DROP COLUMN IF EXISTS "location";
CREATE INDEX IF NOT EXISTS "idx_schools_coords" ON "schools" ("latitude", "longitude");
--> statement-breakpoint

DROP INDEX IF EXISTS "sp_school_zones_geom";
ALTER TABLE "school_zones" DROP CONSTRAINT IF EXISTS "chk_school_zones_nonempty";
ALTER TABLE "school_zones" DROP COLUMN IF EXISTS "geom";
ALTER TABLE "school_zones" ADD COLUMN IF NOT EXISTS "geometry" jsonb;
--> statement-breakpoint

-- Recreate simplified property_flood_hazards table without PostGIS zone polygons
CREATE TABLE IF NOT EXISTS "property_flood_hazards" (
  "property_id" integer NOT NULL REFERENCES "properties"("property_id") ON DELETE CASCADE,
  "hazard_type" "flood_hazard_type" NOT NULL,
  "source_feature_id" varchar(100) NOT NULL DEFAULT 'arcgis-verified',
  "source_url" varchar(500) NOT NULL,
  PRIMARY KEY ("property_id", "hazard_type", "source_feature_id")
);
CREATE INDEX IF NOT EXISTS "idx_property_flood_hazards_property" ON "property_flood_hazards" ("property_id");
