CREATE TABLE `quick_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quick_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`host` text NOT NULL,
	`peer` text NOT NULL,
	`map` text NOT NULL,
	`phase` text NOT NULL,
	`protocol` text NOT NULL,
	`created` integer NOT NULL,
	`heartbeat` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quick_rooms_available` ON `quick_rooms` (`protocol`,`phase`,`heartbeat`);--> statement-breakpoint
CREATE TABLE `quick_seats` (
	`token` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`peer` text NOT NULL,
	`expires` integer NOT NULL,
	`connected` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`room`) REFERENCES `quick_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quick_seats_room` ON `quick_seats` (`room`,`expires`);