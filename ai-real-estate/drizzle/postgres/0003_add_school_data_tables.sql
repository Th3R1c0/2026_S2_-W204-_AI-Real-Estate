CREATE TABLE "school_data_sync" (
	"singleton_id" integer PRIMARY KEY NOT NULL,
	"imported_school_count" integer NOT NULL,
	"imported_zone_count" integer NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_school_data_sync_singleton" CHECK ("school_data_sync"."singleton_id" = 1)
);
--> statement-breakpoint
CREATE TABLE "school_zones" (
	"school_zone_id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"zone_name" varchar(200),
	"zone_type" varchar(100),
	"geom" geometry(MultiPolygon, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"school_id" integer PRIMARY KEY NOT NULL,
	"org_name" varchar(200) NOT NULL,
	"org_type" varchar(100) NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"enrolment_scheme" boolean NOT NULL,
	"location" geography(Point, 4326)
);
--> statement-breakpoint
ALTER TABLE "school_zones" ADD CONSTRAINT "school_zones_school_id_schools_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("school_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_school_zones_school" ON "school_zones" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "sp_school_zones_geom" ON "school_zones" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "sp_schools_location" ON "schools" USING gist ("location");