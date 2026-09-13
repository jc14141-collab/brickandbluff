CREATE TABLE `game_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`host` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`state` text NOT NULL,
	`expires` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `room_expiry` ON `game_rooms` (`expires`);--> statement-breakpoint
CREATE INDEX `room_host` ON `game_rooms` (`host`);