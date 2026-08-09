CREATE TABLE `dino_data` (
	`occurrence_no` int NOT NULL,
	`record_type` varchar(32) NOT NULL,
	`reid_no` int,
	`flags` varchar(255),
	`collection_no` int NOT NULL,
	`identified_name` varchar(255) NOT NULL,
	`identified_rank` varchar(64),
	`identified_no` int,
	`difference` varchar(255),
	`accepted_name` varchar(255) NOT NULL,
	`accepted_rank` varchar(64),
	`accepted_no` int,
	`early_interval` varchar(128),
	`late_interval` varchar(128),
	`max_ma` decimal(7,3),
	`min_ma` decimal(7,3),
	`reference_no` int NOT NULL,
	CONSTRAINT `dino_data_occurrence_no` PRIMARY KEY(`occurrence_no`)
);
--> statement-breakpoint
CREATE INDEX `dino_data_collection_no_idx` ON `dino_data` (`collection_no`);--> statement-breakpoint
CREATE INDEX `dino_data_accepted_no_idx` ON `dino_data` (`accepted_no`);--> statement-breakpoint
CREATE INDEX `dino_data_reference_no_idx` ON `dino_data` (`reference_no`);--> statement-breakpoint
CREATE INDEX `dino_data_identification_idx` ON `dino_data` (`identified_name`,`accepted_name`);