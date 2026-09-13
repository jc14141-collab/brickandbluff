CREATE TABLE `access_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`started` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `access_attempt_expiry` ON `access_attempts` (`started`);