-- TutorHiveHub: allow the same subject name across different exam pathways
-- and default tutor payroll/timesheet currency to Nigerian Naira.

UPDATE `Subject`
SET `examPathway` = 'Other'
WHERE `examPathway` IS NULL OR `examPathway` = '';

ALTER TABLE `Subject` DROP INDEX `Subject_name_key`;
ALTER TABLE `Subject` MODIFY `examPathway` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `Subject_name_examPathway_key` ON `Subject`(`name`, `examPathway`);

ALTER TABLE `TutorRate` MODIFY `currency` VARCHAR(191) NOT NULL DEFAULT 'NGN';
ALTER TABLE `TimesheetEntry` MODIFY `currency` VARCHAR(191) NOT NULL DEFAULT 'NGN';
ALTER TABLE `TimesheetAdjustment` MODIFY `currency` VARCHAR(191) NOT NULL DEFAULT 'NGN';
