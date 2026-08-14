CREATE TABLE `attendance_matrix` (
	`weekday` integer NOT NULL,
	`hour` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`weekday`, `hour`)
);
--> statement-breakpoint
CREATE TABLE `check_ins` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`location` text NOT NULL,
	`timestamp` text NOT NULL,
	`date` text NOT NULL,
	`hour` integer NOT NULL,
	`weekday` integer NOT NULL,
	`class_id` text,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `check_ins_member_idx` ON `check_ins` (`member_id`);--> statement-breakpoint
CREATE INDEX `check_ins_date_idx` ON `check_ins` (`date`);--> statement-breakpoint
CREATE INDEX `check_ins_member_date_idx` ON `check_ins` (`member_id`,`date`);--> statement-breakpoint
CREATE TABLE `class_seats` (
	`class_id` text NOT NULL,
	`member_id` text NOT NULL,
	`kind` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`booked_at` text NOT NULL,
	PRIMARY KEY(`class_id`, `member_id`),
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `class_seats_member_idx` ON `class_seats` (`member_id`);--> statement-breakpoint
CREATE INDEX `class_seats_class_kind_idx` ON `class_seats` (`class_id`,`kind`);--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`trainer_id` text NOT NULL,
	`location` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`duration_min` integer NOT NULL,
	`capacity` integer NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `classes_day_idx` ON `classes` (`day_of_week`);--> statement-breakpoint
CREATE INDEX `classes_trainer_idx` ON `classes` (`trainer_id`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`plan_id` text NOT NULL,
	`pool_credits` integer NOT NULL,
	`credits_used` integer DEFAULT 0 NOT NULL,
	`burn_rate_per_week` real NOT NULL,
	`start_date` text NOT NULL,
	`renewal_date` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `daily_attendance` (
	`date` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text NOT NULL,
	`kind` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`actor` text NOT NULL,
	`summary` text NOT NULL,
	`payload` text
);
--> statement-breakpoint
CREATE INDEX `events_entity_idx` ON `events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `events_kind_idx` ON `events` (`kind`);--> statement-breakpoint
CREATE INDEX `events_at_idx` ON `events` (`at`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`source` text NOT NULL,
	`stage` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_date` text NOT NULL,
	`est_value` integer NOT NULL,
	`interested_plan_id` text,
	`note` text DEFAULT '' NOT NULL,
	`lost_reason` text,
	FOREIGN KEY (`owner_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`interested_plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `leads_stage_idx` ON `leads` (`stage`);--> statement-breakpoint
CREATE INDEX `leads_owner_idx` ON `leads` (`owner_id`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`timezone` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`name` text NOT NULL,
	`initials` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`status` text NOT NULL,
	`plan_id` text NOT NULL,
	`home_location` text NOT NULL,
	`assigned_trainer_id` text,
	`company_id` text,
	`joined_date` text NOT NULL,
	`end_date` text,
	`tags` text NOT NULL,
	`metric_tenure_months` integer NOT NULL,
	`metric_last_visit` text,
	`metric_days_since_last_visit` integer,
	`metric_visits_last30` integer NOT NULL,
	`metric_visits_prev30` integer NOT NULL,
	`metric_avg_visits_per_week` real NOT NULL,
	`metric_plan_visits_per_month` integer,
	`metric_credits_remaining` integer,
	`metric_freeze_count` integer NOT NULL,
	`metric_cancel_rate` real NOT NULL,
	`metric_failed_payments` integer NOT NULL,
	`metric_lifetime_value` integer NOT NULL,
	`metric_monthly_value` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`home_location`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_trainer_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `members_status_idx` ON `members` (`status`);--> statement-breakpoint
CREATE INDEX `members_company_idx` ON `members` (`company_id`);--> statement-breakpoint
CREATE INDEX `members_trainer_idx` ON `members` (`assigned_trainer_id`);--> statement-breakpoint
CREATE INDEX `members_plan_idx` ON `members` (`plan_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`timestamp` text NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`entity_type` text,
	`entity_id` text
);
--> statement-breakpoint
CREATE INDEX `notifications_read_idx` ON `notifications` (`read`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`member_id` text NOT NULL,
	`plan_id` text,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`status` text NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`reversal_of` text,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_member_idx` ON `payments` (`member_id`);--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`status`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`interval` text NOT NULL,
	`price` integer NOT NULL,
	`visits_per_month` integer,
	`corporate_only` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`perks` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`name` text NOT NULL,
	`initials` text NOT NULL,
	`role` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`specialties` text NOT NULL,
	`locations` text NOT NULL,
	`active_from` text NOT NULL,
	`active_to` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_role_idx` ON `staff` (`role`);