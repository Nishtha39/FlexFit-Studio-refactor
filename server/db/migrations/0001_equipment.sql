CREATE TABLE `equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`asset_tag` text NOT NULL,
	`location` text NOT NULL,
	`zone` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`status` text NOT NULL,
	`purchase_date` text NOT NULL,
	`unit_cost` integer NOT NULL,
	`useful_life_months` integer NOT NULL,
	`service_interval_days` integer NOT NULL,
	`last_service_date` text,
	`bookable` integer DEFAULT false NOT NULL,
	`slot_minutes` integer DEFAULT 30 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`location`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `equipment_location_idx` ON `equipment` (`location`);--> statement-breakpoint
CREATE INDEX `equipment_status_idx` ON `equipment` (`status`);--> statement-breakpoint
CREATE INDEX `equipment_bookable_idx` ON `equipment` (`bookable`);--> statement-breakpoint
CREATE TABLE `equipment_faults` (
	`id` text PRIMARY KEY NOT NULL,
	`equipment_id` text NOT NULL,
	`reported_by` text NOT NULL,
	`reporter_name` text NOT NULL,
	`reported_at` text NOT NULL,
	`severity` text NOT NULL,
	`summary` text NOT NULL,
	`status` text NOT NULL,
	`resolved_at` text,
	`resolution_note` text,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `equipment_faults_equipment_idx` ON `equipment_faults` (`equipment_id`);--> statement-breakpoint
CREATE INDEX `equipment_faults_status_idx` ON `equipment_faults` (`status`);--> statement-breakpoint
CREATE TABLE `equipment_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`equipment_id` text NOT NULL,
	`member_id` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`duration_min` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `equipment_res_equipment_date_idx` ON `equipment_reservations` (`equipment_id`,`date`);--> statement-breakpoint
CREATE INDEX `equipment_res_member_idx` ON `equipment_reservations` (`member_id`);--> statement-breakpoint
CREATE TABLE `equipment_services` (
	`id` text PRIMARY KEY NOT NULL,
	`equipment_id` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`vendor` text NOT NULL,
	`cost` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `equipment_services_equipment_idx` ON `equipment_services` (`equipment_id`);--> statement-breakpoint
CREATE INDEX `equipment_services_date_idx` ON `equipment_services` (`date`);