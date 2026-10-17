CREATE TABLE `address` (
	`property_id` int unsigned NOT NULL,
	`unit_number` varchar(20),
	`street_number` varchar(20) NOT NULL,
	`street_name` varchar(120) NOT NULL,
	`suburb` varchar(100),
	`city` varchar(100) NOT NULL,
	`state` varchar(100),
	`post_code` varchar(12),
	`country` varchar(100) NOT NULL DEFAULT 'New Zealand',
	`latitude` decimal(9,6) NOT NULL,
	`longitude` decimal(9,6) NOT NULL,
	`location` point NOT NULL,
	CONSTRAINT `address_property_id` PRIMARY KEY(`property_id`)
);
--> statement-breakpoint
CREATE TABLE `agencies` (
	`agency_id` int unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(150) NOT NULL,
	`website` varchar(255),
	`phone` varchar(30),
	`email` varchar(255),
	CONSTRAINT `agencies_agency_id` PRIMARY KEY(`agency_id`)
);
--> statement-breakpoint
CREATE TABLE `enquiries` (
	`enquiry_id` int unsigned AUTO_INCREMENT NOT NULL,
	`property_id` int unsigned NOT NULL,
	`user_id` int unsigned,
	`agent_id` int unsigned,
	`name` varchar(120) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(30),
	`message` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enquiries_enquiry_id` PRIMARY KEY(`enquiry_id`)
);
--> statement-breakpoint
CREATE TABLE `features` (
	`feature_id` int unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	CONSTRAINT `features_feature_id` PRIMARY KEY(`feature_id`),
	CONSTRAINT `uq_features_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `open_homes` (
	`open_home_id` int unsigned AUTO_INCREMENT NOT NULL,
	`property_id` int unsigned NOT NULL,
	`open_date` date NOT NULL,
	`start_time` time NOT NULL,
	`end_time` time NOT NULL,
	CONSTRAINT `open_homes_open_home_id` PRIMARY KEY(`open_home_id`),
	CONSTRAINT `chk_oh_times` CHECK(`open_homes`.`end_time` > `open_homes`.`start_time`)
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`property_id` int unsigned AUTO_INCREMENT NOT NULL,
	`demo_key` varchar(80),
	`title` varchar(200) NOT NULL,
	`body` text,
	`listing_type` enum('sale','rent','lease') NOT NULL,
	`status` enum('draft','active','under_offer','sold','rented','withdrawn') NOT NULL DEFAULT 'draft',
	`listed_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `properties_property_id` PRIMARY KEY(`property_id`),
	CONSTRAINT `uq_properties_demo_key` UNIQUE(`demo_key`)
);
--> statement-breakpoint
CREATE TABLE `property_agent` (
	`property_id` int unsigned NOT NULL,
	`agent_id` int unsigned NOT NULL,
	`is_primary` boolean NOT NULL DEFAULT false,
	CONSTRAINT `property_agent_property_id_agent_id_pk` PRIMARY KEY(`property_id`,`agent_id`)
);
--> statement-breakpoint
CREATE TABLE `property_demo_details` (
	`property_id` int unsigned NOT NULL,
	`display_property_type` varchar(40) NOT NULL,
	`architectural_style` varchar(40) NOT NULL,
	`flood_risk` enum('Low','Moderate','High') NOT NULL,
	`orientation` enum('North','East','South','West') NOT NULL,
	`sunlight_hours` decimal(4,1) NOT NULL,
	`walkability_score` tinyint unsigned,
	`walkability_label` varchar(40),
	`parks_nearby` tinyint unsigned,
	`cafes_nearby` tinyint unsigned,
	`supermarkets_nearby` tinyint unsigned,
	CONSTRAINT `property_demo_details_property_id` PRIMARY KEY(`property_id`)
);
--> statement-breakpoint
CREATE TABLE `property_details` (
	`property_id` int unsigned NOT NULL,
	`property_type` enum('house','apartment','townhouse','unit','section','lifestyle','commercial','other') NOT NULL DEFAULT 'house',
	`land_area` decimal(10,2),
	`floor_area` decimal(10,2),
	`bedrooms` tinyint unsigned NOT NULL DEFAULT 0,
	`bathrooms` tinyint unsigned NOT NULL DEFAULT 0,
	`ensuites` tinyint unsigned NOT NULL DEFAULT 0,
	`toilets` tinyint unsigned NOT NULL DEFAULT 0,
	`living_rooms` tinyint unsigned NOT NULL DEFAULT 0,
	`garage_parking` tinyint unsigned NOT NULL DEFAULT 0,
	`off_street_parking` tinyint unsigned NOT NULL DEFAULT 0,
	`year_built` smallint unsigned,
	CONSTRAINT `property_details_property_id` PRIMARY KEY(`property_id`)
);
--> statement-breakpoint
CREATE TABLE `property_features` (
	`property_id` int unsigned NOT NULL,
	`feature_id` int unsigned NOT NULL,
	CONSTRAINT `property_features_property_id_feature_id_pk` PRIMARY KEY(`property_id`,`feature_id`)
);
--> statement-breakpoint
CREATE TABLE `property_images` (
	`image_id` int unsigned AUTO_INCREMENT NOT NULL,
	`property_id` int unsigned NOT NULL,
	`url` varchar(500) NOT NULL,
	`caption` varchar(200),
	`sort_order` smallint unsigned NOT NULL DEFAULT 0,
	`is_cover` boolean NOT NULL DEFAULT false,
	CONSTRAINT `property_images_image_id` PRIMARY KEY(`image_id`)
);
--> statement-breakpoint
CREATE TABLE `property_price` (
	`property_id` int unsigned NOT NULL,
	`pricing_method` enum('fixed','negotiation','auction','tender','enquiries_over','price_on_application') NOT NULL DEFAULT 'fixed',
	`sale_price` decimal(12,2),
	`rent_price` decimal(10,2),
	`rent_period` enum('week','fortnight','month'),
	`lease_price` decimal(12,2),
	`currency` char(3) NOT NULL DEFAULT 'NZD',
	CONSTRAINT `property_price_property_id` PRIMARY KEY(`property_id`)
);
--> statement-breakpoint
CREATE TABLE `property_sales` (
	`sale_id` int unsigned AUTO_INCREMENT NOT NULL,
	`property_id` int unsigned NOT NULL,
	`sold_price` decimal(12,2) NOT NULL,
	`sold_date` date NOT NULL,
	CONSTRAINT `property_sales_sale_id` PRIMARY KEY(`sale_id`)
);
--> statement-breakpoint
CREATE TABLE `property_school_zones` (
	`property_school_zone_id` int unsigned AUTO_INCREMENT NOT NULL,
	`property_id` int unsigned NOT NULL,
	`name` varchar(150) NOT NULL,
	`type` enum('Primary','Intermediate','Secondary') NOT NULL,
	`distance_km` decimal(5,2) NOT NULL,
	`is_in_zone` boolean NOT NULL DEFAULT false,
	CONSTRAINT `property_school_zones_property_school_zone_id` PRIMARY KEY(`property_school_zone_id`)
);
--> statement-breakpoint
CREATE TABLE `property_sources` (
	`property_source_id` int unsigned AUTO_INCREMENT NOT NULL,
	`property_id` int unsigned NOT NULL,
	`source_key` varchar(80) NOT NULL,
	`title` varchar(200) NOT NULL,
	`publisher` varchar(150) NOT NULL,
	`url` varchar(500) NOT NULL,
	`reference` varchar(255) NOT NULL,
	`material` text NOT NULL,
	`fields` json NOT NULL,
	CONSTRAINT `property_sources_property_source_id` PRIMARY KEY(`property_source_id`)
);
--> statement-breakpoint
CREATE TABLE `property_valuations` (
	`valuation_id` int unsigned AUTO_INCREMENT NOT NULL,
	`property_id` int unsigned NOT NULL,
	`valuation_date` date NOT NULL,
	`capital_value` decimal(12,2),
	`land_value` decimal(12,2),
	`improvement_value` decimal(12,2),
	`low_estimate` decimal(12,2),
	`median_estimate` decimal(12,2),
	`high_estimate` decimal(12,2),
	`source` varchar(100),
	CONSTRAINT `property_valuations_valuation_id` PRIMARY KEY(`valuation_id`)
);
--> statement-breakpoint
CREATE TABLE `real_estate_agents` (
	`agent_id` int unsigned AUTO_INCREMENT NOT NULL,
	`agency_id` int unsigned,
	`first_name` varchar(80) NOT NULL,
	`last_name` varchar(80) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone_number` varchar(30),
	`phone_number_2` varchar(30),
	`photo_url` varchar(500),
	CONSTRAINT `real_estate_agents_agent_id` PRIMARY KEY(`agent_id`),
	CONSTRAINT `uq_agents_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `saved_properties` (
	`user_id` int unsigned NOT NULL,
	`property_id` int unsigned NOT NULL,
	`saved_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_properties_user_id_property_id_pk` PRIMARY KEY(`user_id`,`property_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`user_id` int unsigned AUTO_INCREMENT NOT NULL,
	`username` varchar(50) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_user_id` PRIMARY KEY(`user_id`),
	CONSTRAINT `uq_users_username` UNIQUE(`username`),
	CONSTRAINT `uq_users_email` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `address` ADD CONSTRAINT `address_property_id_properties_property_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`property_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enquiries` ADD CONSTRAINT `enquiries_property_id_properties_property_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`property_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enquiries` ADD CONSTRAINT `enquiries_user_id_users_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enquiries` ADD CONSTRAINT `enquiries_agent_id_real_estate_agents_agent_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `real_estate_agents`(`agent_id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `open_homes` ADD CONSTRAINT `open_homes_property_id_properties_property_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`property_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_agent` ADD CONSTRAINT `property_agent_property_id_properties_property_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`property_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_agent` ADD CONSTRAINT `property_agent_agent_id_real_estate_agents_agent_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `real_estate_agents`(`agent_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_demo_details` ADD CONSTRAINT `property_demo_details_property_id_properties_property_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`property_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_details` ADD CONSTRAINT `property_details_property_id_properties_property_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`property_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_features` ADD CONSTRAINT `property_features_property_id_properties_property_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`property_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_features` ADD CONSTRAINT `property_features_feature_id_features_feature_id_fk` FOREIGN KEY (`feature_id`) REFERENCES `features`(`feature_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_images` ADD CONSTRAINT `property_images_property_id_properties_property_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`property_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_price` ADD CONSTRAINT `property_price_property_id_properties_property_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`property_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_sales` ADD CONSTRAINT `property_sales_property_id_properties_property_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`property_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_school_zones` ADD CONSTRAINT `property_school_zones_property_id_properties_property_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`property_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_sources` ADD CONSTRAINT `property_sources_property_id_properties_property_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`property_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_valuations` ADD CONSTRAINT `property_valuations_property_id_properties_property_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`property_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `real_estate_agents` ADD CONSTRAINT `real_estate_agents_agency_id_agencies_agency_id_fk` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`agency_id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saved_properties` ADD CONSTRAINT `saved_properties_user_id_users_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saved_properties` ADD CONSTRAINT `saved_properties_property_id_properties_property_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`property_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_address_city_suburb` ON `address` (`city`,`suburb`);--> statement-breakpoint
CREATE INDEX `idx_address_post_code` ON `address` (`post_code`);--> statement-breakpoint
CREATE INDEX `idx_enquiries_property` ON `enquiries` (`property_id`);--> statement-breakpoint
CREATE INDEX `idx_open_homes_property_date` ON `open_homes` (`property_id`,`open_date`);--> statement-breakpoint
CREATE INDEX `idx_properties_status_type` ON `properties` (`status`,`listing_type`);--> statement-breakpoint
CREATE INDEX `idx_details_beds_baths` ON `property_details` (`bedrooms`,`bathrooms`);--> statement-breakpoint
CREATE INDEX `idx_images_property` ON `property_images` (`property_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_price_sale` ON `property_price` (`sale_price`);--> statement-breakpoint
CREATE INDEX `idx_price_rent` ON `property_price` (`rent_price`);--> statement-breakpoint
CREATE INDEX `idx_sales_property_date` ON `property_sales` (`property_id`,`sold_date`);--> statement-breakpoint
CREATE INDEX `idx_school_zones_property` ON `property_school_zones` (`property_id`);--> statement-breakpoint
CREATE INDEX `idx_sources_property` ON `property_sources` (`property_id`);--> statement-breakpoint
CREATE INDEX `idx_val_property_date` ON `property_valuations` (`property_id`,`valuation_date`);--> statement-breakpoint
CREATE INDEX `idx_saved_property` ON `saved_properties` (`property_id`);
--> statement-breakpoint
CREATE SPATIAL INDEX `sp_address_location` ON `address` (`location`);