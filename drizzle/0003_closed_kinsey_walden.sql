CREATE TABLE `maintenance_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`player_name` text NOT NULL,
	`refunded` integer NOT NULL,
	`previous_bank` integer NOT NULL,
	`corrected_bank` integer NOT NULL,
	`previous_guandan_net` integer NOT NULL,
	`corrected_guandan_net` integer NOT NULL,
	`created_at` integer NOT NULL
);

--> statement-breakpoint
CREATE TRIGGER guandan_wallet_repair_receipt AFTER UPDATE ON club_state
WHEN NEW.id = 1
 AND json_type(NEW.state, '$.repairs.guandanWalletTest2V1') = 'object'
 AND json_type(OLD.state, '$.repairs.guandanWalletTest2V1') IS NULL
BEGIN
 INSERT OR IGNORE INTO maintenance_receipts
 (id, player_id, player_name, refunded, previous_bank, corrected_bank, previous_guandan_net, corrected_guandan_net, created_at)
 VALUES (
 json_extract(NEW.state, '$.repairs.guandanWalletTest2V1.id'),
 json_extract(NEW.state, '$.repairs.guandanWalletTest2V1.playerId'),
 json_extract(NEW.state, '$.repairs.guandanWalletTest2V1.name'),
 json_extract(NEW.state, '$.repairs.guandanWalletTest2V1.refunded'),
 json_extract(NEW.state, '$.repairs.guandanWalletTest2V1.previousBank'),
 json_extract(NEW.state, '$.repairs.guandanWalletTest2V1.correctedBank'),
 json_extract(NEW.state, '$.repairs.guandanWalletTest2V1.previousNet'),
 json_extract(NEW.state, '$.repairs.guandanWalletTest2V1.correctedNet'),
 json_extract(NEW.state, '$.repairs.guandanWalletTest2V1.at'));
END;
