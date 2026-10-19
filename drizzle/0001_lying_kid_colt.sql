ALTER TABLE `property_demo_details` MODIFY COLUMN `display_property_type` varchar(40);--> statement-breakpoint
ALTER TABLE `property_demo_details` MODIFY COLUMN `architectural_style` varchar(40);--> statement-breakpoint
ALTER TABLE `property_demo_details` MODIFY COLUMN `flood_risk` enum('Low','Moderate','High');--> statement-breakpoint
ALTER TABLE `property_demo_details` MODIFY COLUMN `orientation` enum('North','East','South','West');--> statement-breakpoint
ALTER TABLE `property_demo_details` MODIFY COLUMN `sunlight_hours` decimal(4,1);