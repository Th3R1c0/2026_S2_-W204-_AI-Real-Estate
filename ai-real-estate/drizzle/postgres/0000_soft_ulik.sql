CREATE TYPE "public"."flood_risk" AS ENUM('Low', 'Moderate', 'High');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('sale', 'rent', 'lease');--> statement-breakpoint
CREATE TYPE "public"."orientation" AS ENUM('North', 'East', 'South', 'West');--> statement-breakpoint
CREATE TYPE "public"."pricing_method" AS ENUM('fixed', 'negotiation', 'auction', 'tender', 'enquiries_over', 'price_on_application');--> statement-breakpoint
CREATE TYPE "public"."property_status" AS ENUM('draft', 'active', 'under_offer', 'sold', 'rented', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('house', 'apartment', 'townhouse', 'unit', 'section', 'lifestyle', 'commercial', 'other');--> statement-breakpoint
CREATE TYPE "public"."rent_period" AS ENUM('week', 'fortnight', 'month');--> statement-breakpoint
CREATE TYPE "public"."school_zone_type" AS ENUM('Primary', 'Intermediate', 'Secondary');--> statement-breakpoint
CREATE TABLE "address" (
	"property_id" integer PRIMARY KEY NOT NULL,
	"unit_number" varchar(20),
	"street_number" varchar(20) NOT NULL,
	"street_name" varchar(120) NOT NULL,
	"suburb" varchar(100),
	"city" varchar(100) NOT NULL,
	"state" varchar(100),
	"post_code" varchar(12),
	"country" varchar(100) DEFAULT 'New Zealand' NOT NULL,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"location" "point" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agencies" (
	"agency_id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"website" varchar(255),
	"phone" varchar(30),
	"email" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"enquiry_id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"user_id" integer,
	"agent_id" integer,
	"name" varchar(120) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(30),
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "features" (
	"feature_id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_homes" (
	"open_home_id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"open_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "chk_oh_times" CHECK ("open_homes"."end_time" > "open_homes"."start_time")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"property_id" serial PRIMARY KEY NOT NULL,
	"demo_key" varchar(80),
	"title" varchar(200) NOT NULL,
	"body" text,
	"listing_type" "listing_type" NOT NULL,
	"status" "property_status" DEFAULT 'draft' NOT NULL,
	"listed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_agent" (
	"property_id" integer NOT NULL,
	"agent_id" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "property_agent_property_id_agent_id_pk" PRIMARY KEY("property_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE "property_demo_details" (
	"property_id" integer PRIMARY KEY NOT NULL,
	"display_property_type" varchar(40),
	"architectural_style" varchar(40),
	"flood_risk" "flood_risk",
	"orientation" "orientation",
	"sunlight_hours" numeric(4, 1),
	"walkability_score" smallint,
	"walkability_label" varchar(40),
	"parks_nearby" smallint,
	"cafes_nearby" smallint,
	"supermarkets_nearby" smallint,
	CONSTRAINT "chk_demo_unsigned_ranges" CHECK (("property_demo_details"."walkability_score" IS NULL OR "property_demo_details"."walkability_score" BETWEEN 0 AND 255)
      AND ("property_demo_details"."parks_nearby" IS NULL OR "property_demo_details"."parks_nearby" BETWEEN 0 AND 255)
      AND ("property_demo_details"."cafes_nearby" IS NULL OR "property_demo_details"."cafes_nearby" BETWEEN 0 AND 255)
      AND ("property_demo_details"."supermarkets_nearby" IS NULL OR "property_demo_details"."supermarkets_nearby" BETWEEN 0 AND 255))
);
--> statement-breakpoint
CREATE TABLE "property_details" (
	"property_id" integer PRIMARY KEY NOT NULL,
	"property_type" "property_type" DEFAULT 'house' NOT NULL,
	"land_area" numeric(10, 2),
	"floor_area" numeric(10, 2),
	"bedrooms" smallint DEFAULT 0 NOT NULL,
	"bathrooms" smallint DEFAULT 0 NOT NULL,
	"ensuites" smallint DEFAULT 0 NOT NULL,
	"toilets" smallint DEFAULT 0 NOT NULL,
	"living_rooms" smallint DEFAULT 0 NOT NULL,
	"garage_parking" smallint DEFAULT 0 NOT NULL,
	"off_street_parking" smallint DEFAULT 0 NOT NULL,
	"year_built" integer,
	CONSTRAINT "chk_details_unsigned_counts" CHECK ("property_details"."bedrooms" BETWEEN 0 AND 255
        AND "property_details"."bathrooms" BETWEEN 0 AND 255
        AND "property_details"."ensuites" BETWEEN 0 AND 255
        AND "property_details"."toilets" BETWEEN 0 AND 255
        AND "property_details"."living_rooms" BETWEEN 0 AND 255
        AND "property_details"."garage_parking" BETWEEN 0 AND 255
        AND "property_details"."off_street_parking" BETWEEN 0 AND 255),
	CONSTRAINT "chk_details_year_built" CHECK ("property_details"."year_built" IS NULL OR "property_details"."year_built" BETWEEN 0 AND 65535)
);
--> statement-breakpoint
CREATE TABLE "property_features" (
	"property_id" integer NOT NULL,
	"feature_id" integer NOT NULL,
	CONSTRAINT "property_features_property_id_feature_id_pk" PRIMARY KEY("property_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "property_images" (
	"image_id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"url" varchar(500) NOT NULL,
	"caption" varchar(200),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	CONSTRAINT "chk_images_sort_order" CHECK ("property_images"."sort_order" BETWEEN 0 AND 65535)
);
--> statement-breakpoint
CREATE TABLE "property_price" (
	"property_id" integer PRIMARY KEY NOT NULL,
	"pricing_method" "pricing_method" DEFAULT 'fixed' NOT NULL,
	"sale_price" numeric(12, 2),
	"rent_price" numeric(10, 2),
	"rent_period" "rent_period",
	"lease_price" numeric(12, 2),
	"currency" char(3) DEFAULT 'NZD' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_sales" (
	"sale_id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"sold_price" numeric(12, 2) NOT NULL,
	"sold_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_school_zones" (
	"property_school_zone_id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"name" varchar(150) NOT NULL,
	"type" "school_zone_type" NOT NULL,
	"distance_km" numeric(5, 2) NOT NULL,
	"is_in_zone" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_sources" (
	"property_source_id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"source_key" varchar(80) NOT NULL,
	"title" varchar(200) NOT NULL,
	"publisher" varchar(150) NOT NULL,
	"url" varchar(500) NOT NULL,
	"reference" varchar(255) NOT NULL,
	"material" text NOT NULL,
	"fields" json NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_valuations" (
	"valuation_id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"valuation_date" date NOT NULL,
	"capital_value" numeric(12, 2),
	"land_value" numeric(12, 2),
	"improvement_value" numeric(12, 2),
	"low_estimate" numeric(12, 2),
	"median_estimate" numeric(12, 2),
	"high_estimate" numeric(12, 2),
	"source" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "real_estate_agents" (
	"agent_id" serial PRIMARY KEY NOT NULL,
	"agency_id" integer,
	"first_name" varchar(80) NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone_number" varchar(30),
	"phone_number_2" varchar(30),
	"photo_url" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "saved_properties" (
	"user_id" integer NOT NULL,
	"property_id" integer NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_properties_user_id_property_id_pk" PRIMARY KEY("user_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_property_id_properties_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_property_id_properties_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_agent_id_real_estate_agents_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."real_estate_agents"("agent_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_homes" ADD CONSTRAINT "open_homes_property_id_properties_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_agent" ADD CONSTRAINT "property_agent_property_id_properties_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_agent" ADD CONSTRAINT "property_agent_agent_id_real_estate_agents_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."real_estate_agents"("agent_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_demo_details" ADD CONSTRAINT "property_demo_details_property_id_properties_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_details" ADD CONSTRAINT "property_details_property_id_properties_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_features" ADD CONSTRAINT "property_features_property_id_properties_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_features" ADD CONSTRAINT "property_features_feature_id_features_feature_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("feature_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_property_id_properties_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_price" ADD CONSTRAINT "property_price_property_id_properties_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_sales" ADD CONSTRAINT "property_sales_property_id_properties_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_school_zones" ADD CONSTRAINT "property_school_zones_property_id_properties_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_sources" ADD CONSTRAINT "property_sources_property_id_properties_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_valuations" ADD CONSTRAINT "property_valuations_property_id_properties_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_estate_agents" ADD CONSTRAINT "real_estate_agents_agency_id_agencies_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("agency_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_properties" ADD CONSTRAINT "saved_properties_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_properties" ADD CONSTRAINT "saved_properties_property_id_properties_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_address_city_suburb" ON "address" USING btree ("city","suburb");--> statement-breakpoint
CREATE INDEX "idx_address_post_code" ON "address" USING btree ("post_code");--> statement-breakpoint
CREATE INDEX "sp_address_location" ON "address" USING gist ("location");--> statement-breakpoint
CREATE INDEX "idx_enquiries_property" ON "enquiries" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_features_name" ON "features" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_open_homes_property_date" ON "open_homes" USING btree ("property_id","open_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_properties_demo_key" ON "properties" USING btree ("demo_key");--> statement-breakpoint
CREATE INDEX "idx_properties_status_type" ON "properties" USING btree ("status","listing_type");--> statement-breakpoint
CREATE INDEX "idx_details_beds_baths" ON "property_details" USING btree ("bedrooms","bathrooms");--> statement-breakpoint
CREATE INDEX "idx_images_property" ON "property_images" USING btree ("property_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_price_sale" ON "property_price" USING btree ("sale_price");--> statement-breakpoint
CREATE INDEX "idx_price_rent" ON "property_price" USING btree ("rent_price");--> statement-breakpoint
CREATE INDEX "idx_sales_property_date" ON "property_sales" USING btree ("property_id","sold_date");--> statement-breakpoint
CREATE INDEX "idx_school_zones_property" ON "property_school_zones" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "idx_sources_property" ON "property_sources" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "idx_val_property_date" ON "property_valuations" USING btree ("property_id","valuation_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agents_email" ON "real_estate_agents" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_saved_property" ON "saved_properties" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE FUNCTION sync_address_location() RETURNS trigger AS $$
BEGIN
  NEW.location := point(NEW.longitude, NEW.latitude);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER trg_address_bi BEFORE INSERT ON "address"
FOR EACH ROW EXECUTE FUNCTION sync_address_location();--> statement-breakpoint
CREATE TRIGGER trg_address_bu BEFORE UPDATE ON "address"
FOR EACH ROW EXECUTE FUNCTION sync_address_location();--> statement-breakpoint
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON "properties"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();