-- Real estate site schema (MySQL 8+, InnoDB, utf8mb4)

CREATE DATABASE IF NOT EXISTS real_estate
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE real_estate;

-- ---------------------------------------------------------------
-- Users (customers only; listings and agents are managed outside the user system)
-- ---------------------------------------------------------------
CREATE TABLE users (
  user_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50)  NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,          -- store bcrypt/argon2 hash, never plain text
--   created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Agencies and agents
-- ---------------------------------------------------------------
CREATE TABLE agencies (
  agency_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name      VARCHAR(150) NOT NULL,
  website   VARCHAR(255) NULL,
  phone     VARCHAR(30)  NULL,
  email     VARCHAR(255) NULL,
  PRIMARY KEY (agency_id)
) ENGINE=InnoDB;

CREATE TABLE real_estate_agents (
  agent_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  agency_id      INT UNSIGNED NULL,
  first_name     VARCHAR(80)  NOT NULL,
  last_name      VARCHAR(80)  NOT NULL,
  email          VARCHAR(255) NOT NULL,
  phone_number   VARCHAR(30)  NULL,
  phone_number_2 VARCHAR(30)  NULL,
  photo_url      VARCHAR(500) NULL,
  PRIMARY KEY (agent_id),
  UNIQUE KEY uq_agents_email (email),
  CONSTRAINT fk_agents_agency FOREIGN KEY (agency_id) REFERENCES agencies (agency_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Properties (the listing itself)
-- ---------------------------------------------------------------
CREATE TABLE properties (
  property_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  demo_key     VARCHAR(80) NULL,
  title        VARCHAR(200) NOT NULL,
  body         TEXT NULL,
  listing_type ENUM('sale','rent','lease') NOT NULL,
  status       ENUM('draft','active','under_offer','sold','rented','withdrawn') NOT NULL DEFAULT 'draft',
  listed_at    DATETIME NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (property_id),
  UNIQUE KEY uq_properties_demo_key (demo_key),
  KEY idx_properties_status_type (status, listing_type)
) ENGINE=InnoDB;

-- One row per property (1:1)
CREATE TABLE property_price (
  property_id        INT UNSIGNED NOT NULL,
  pricing_method     ENUM('fixed','negotiation','auction','tender','enquiries_over','price_on_application')
                       NOT NULL DEFAULT 'fixed',
  sale_price         DECIMAL(12,2) NULL,
  rent_price         DECIMAL(10,2) NULL,
  rent_period        ENUM('week','fortnight','month') NULL,   -- NZ rents are usually weekly
  lease_price        DECIMAL(12,2) NULL,
  currency           CHAR(3) NOT NULL DEFAULT 'NZD',
  PRIMARY KEY (property_id),
  KEY idx_price_sale (sale_price),
  KEY idx_price_rent (rent_price),
  CONSTRAINT fk_price_property FOREIGN KEY (property_id) REFERENCES properties (property_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- One row per property (1:1)
CREATE TABLE address (
  property_id   INT UNSIGNED NOT NULL,
  unit_number   VARCHAR(20)  NULL,
  street_number VARCHAR(20)  NOT NULL,
  street_name   VARCHAR(120) NOT NULL,
  suburb        VARCHAR(100) NULL,
  city          VARCHAR(100) NOT NULL,
  province      VARCHAR(100) NULL,              -- region/state/province
  post_code     VARCHAR(12)  NULL,              -- varchar so leading zeros survive
  country       VARCHAR(100) NOT NULL DEFAULT 'New Zealand',
  latitude      DECIMAL(9,6) NOT NULL,
  longitude     DECIMAL(9,6) NOT NULL,
  -- Point (x = longitude, y = latitude) for the spatial index; kept in sync by the triggers below
  location      POINT NOT NULL SRID 0,
  PRIMARY KEY (property_id),
  KEY idx_address_city_suburb (city, suburb),
  KEY idx_address_post_code (post_code),
  SPATIAL INDEX sp_address_location (location),
  CONSTRAINT fk_address_property FOREIGN KEY (property_id) REFERENCES properties (property_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Keep `location` in sync with latitude/longitude (insert lat/long only; never set location by hand)
DELIMITER //
CREATE TRIGGER trg_address_bi BEFORE INSERT ON address
FOR EACH ROW BEGIN
  SET NEW.location = POINT(NEW.longitude, NEW.latitude);
END//
CREATE TRIGGER trg_address_bu BEFORE UPDATE ON address
FOR EACH ROW BEGIN
  SET NEW.location = POINT(NEW.longitude, NEW.latitude);
END//
DELIMITER ;

CREATE TABLE property_details (
  property_id    INT UNSIGNED NOT NULL,
  property_type  ENUM('house','apartment','townhouse','unit','section','lifestyle','commercial','other')
                   NOT NULL DEFAULT 'house',
  land_area      DECIMAL(10,2) NULL,            -- square metres
  floor_area     DECIMAL(10,2) NULL,            -- square metres
  bedrooms       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bathrooms      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ensuites       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  toilets        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  living_rooms   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  garage_parking TINYINT UNSIGNED NOT NULL DEFAULT 0,
  off_street_parking TINYINT UNSIGNED NOT NULL DEFAULT 0,
  year_built     SMALLINT UNSIGNED NULL,
  PRIMARY KEY (property_id),
  KEY idx_details_beds_baths (bedrooms, bathrooms),
  CONSTRAINT fk_details_property FOREIGN KEY (property_id) REFERENCES properties (property_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Property <-> agent (many-to-many: co-listings)
-- ---------------------------------------------------------------
CREATE TABLE property_agent (
  property_id INT UNSIGNED NOT NULL,
  agent_id    INT UNSIGNED NOT NULL,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (property_id, agent_id),
  CONSTRAINT fk_pa_property FOREIGN KEY (property_id) REFERENCES properties (property_id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_agent    FOREIGN KEY (agent_id)    REFERENCES real_estate_agents (agent_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Open homes: one property has many open homes, so no junction table needed
-- ---------------------------------------------------------------
CREATE TABLE open_homes (
  open_home_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id  INT UNSIGNED NOT NULL,
  open_date    DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  PRIMARY KEY (open_home_id),
  KEY idx_open_homes_property_date (property_id, open_date),
  CONSTRAINT fk_oh_property FOREIGN KEY (property_id) REFERENCES properties (property_id) ON DELETE CASCADE,
  CONSTRAINT chk_oh_times CHECK (end_time > start_time)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Valuations and sale history (kept separate so history isn't overwritten)
-- ---------------------------------------------------------------
CREATE TABLE property_valuations (
  valuation_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id       INT UNSIGNED NOT NULL,
  valuation_date    DATE NOT NULL,
  capital_value     DECIMAL(12,2) NULL,
  land_value        DECIMAL(12,2) NULL,
  improvement_value DECIMAL(12,2) NULL,
  low_estimate      DECIMAL(12,2) NULL,
  median_estimate   DECIMAL(12,2) NULL,
  high_estimate     DECIMAL(12,2) NULL,
  source            VARCHAR(100) NULL,          -- e.g. council, automated model
  PRIMARY KEY (valuation_id),
  KEY idx_val_property_date (property_id, valuation_date),
  CONSTRAINT fk_val_property FOREIGN KEY (property_id) REFERENCES properties (property_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE property_sales (
  sale_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id INT UNSIGNED NOT NULL,
  sold_price  DECIMAL(12,2) NOT NULL,
  sold_date   DATE NOT NULL,
  PRIMARY KEY (sale_id),
  KEY idx_sales_property_date (property_id, sold_date),
  CONSTRAINT fk_sales_property FOREIGN KEY (property_id) REFERENCES properties (property_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Media and features
-- ---------------------------------------------------------------
CREATE TABLE property_images (
  image_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id INT UNSIGNED NOT NULL,
  url         VARCHAR(500) NOT NULL,
  caption     VARCHAR(200) NULL,
  sort_order  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_cover    BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (image_id),
  KEY idx_images_property (property_id, sort_order),
  CONSTRAINT fk_images_property FOREIGN KEY (property_id) REFERENCES properties (property_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE features (
  feature_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(80) NOT NULL,              -- pool, heat pump, fibre, pets allowed...
  PRIMARY KEY (feature_id),
  UNIQUE KEY uq_features_name (name)
) ENGINE=InnoDB;

CREATE TABLE property_features (
  property_id INT UNSIGNED NOT NULL,
  feature_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (property_id, feature_id),
  CONSTRAINT fk_pf_property FOREIGN KEY (property_id) REFERENCES properties (property_id) ON DELETE CASCADE,
  CONSTRAINT fk_pf_feature  FOREIGN KEY (feature_id)  REFERENCES features (feature_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- User activity
-- ---------------------------------------------------------------
CREATE TABLE saved_properties (
  user_id     INT UNSIGNED NOT NULL,
  property_id INT UNSIGNED NOT NULL,
  saved_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, property_id),
  KEY idx_saved_property (property_id),
  CONSTRAINT fk_saved_user     FOREIGN KEY (user_id)     REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_property FOREIGN KEY (property_id) REFERENCES properties (property_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE enquiries (
  enquiry_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NULL,                -- null if sent by a visitor
  agent_id    INT UNSIGNED NULL,
  name        VARCHAR(120) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  phone       VARCHAR(30)  NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (enquiry_id),
  KEY idx_enquiries_property (property_id),
  CONSTRAINT fk_enq_property FOREIGN KEY (property_id) REFERENCES properties (property_id) ON DELETE CASCADE,
  CONSTRAINT fk_enq_user     FOREIGN KEY (user_id)     REFERENCES users (user_id) ON DELETE SET NULL,
  CONSTRAINT fk_enq_agent    FOREIGN KEY (agent_id)    REFERENCES real_estate_agents (agent_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Demo metadata used by the current property-explorer interface
-- ---------------------------------------------------------------
CREATE TABLE property_demo_details (
  property_id          INT UNSIGNED NOT NULL,
  display_property_type VARCHAR(40) NULL,
  architectural_style  VARCHAR(40) NULL,
  flood_risk           ENUM('Low','Moderate','High') NULL,
  orientation          ENUM('North','East','South','West') NULL,
  sunlight_hours       DECIMAL(4,1) NULL,
  walkability_score    TINYINT UNSIGNED NULL,
  walkability_label    VARCHAR(40) NULL,
  parks_nearby         TINYINT UNSIGNED NULL,
  cafes_nearby         TINYINT UNSIGNED NULL,
  supermarkets_nearby  TINYINT UNSIGNED NULL,
  PRIMARY KEY (property_id),
  CONSTRAINT fk_demo_details_property FOREIGN KEY (property_id)
    REFERENCES properties (property_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE property_school_zones (
  property_school_zone_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id             INT UNSIGNED NOT NULL,
  name                    VARCHAR(150) NOT NULL,
  type                    ENUM('Primary','Intermediate','Secondary') NOT NULL,
  distance_km             DECIMAL(5,2) NOT NULL,
  is_in_zone              BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (property_school_zone_id),
  KEY idx_school_zones_property (property_id),
  CONSTRAINT fk_school_zones_property FOREIGN KEY (property_id)
    REFERENCES properties (property_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE property_sources (
  property_source_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id        INT UNSIGNED NOT NULL,
  source_key         VARCHAR(80) NOT NULL,
  title              VARCHAR(200) NOT NULL,
  publisher          VARCHAR(150) NOT NULL,
  url                VARCHAR(500) NOT NULL,
  reference          VARCHAR(255) NOT NULL,
  material           TEXT NOT NULL,
  fields             JSON NOT NULL,
  PRIMARY KEY (property_source_id),
  KEY idx_sources_property (property_id),
  CONSTRAINT fk_sources_property FOREIGN KEY (property_id)
    REFERENCES properties (property_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Radius search example: see radius_search.sql