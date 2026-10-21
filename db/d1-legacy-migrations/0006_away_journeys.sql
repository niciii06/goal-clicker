CREATE TABLE IF NOT EXISTS `solo_travel` (
 `owner` text NOT NULL,
 `fixture_id` text NOT NULL,
 `journey_json` text NOT NULL,
 PRIMARY KEY(`owner`, `fixture_id`)
);
