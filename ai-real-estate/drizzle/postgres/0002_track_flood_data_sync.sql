CREATE TABLE "flood_hazard_sync" (
	"hazard_type" "flood_hazard_type" PRIMARY KEY NOT NULL,
	"imported_feature_count" integer NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
