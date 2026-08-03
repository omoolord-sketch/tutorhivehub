-- Phase 5 lesson workspace, attendance, daily reports, and restricted safeguarding links.

ALTER TABLE "Lesson"
  ADD COLUMN "tutorReadyAt" TIMESTAMP(3),
  ADD COLUMN "readinessChecklist" JSONB,
  ADD COLUMN "preparationApprovedAsLessonTime" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tutorAttendance" TEXT,
  ADD COLUMN "studentAttendance" TEXT,
  ADD COLUMN "arrivalTime" TIMESTAMP(3),
  ADD COLUMN "minutesLate" INTEGER,
  ADD COLUMN "absenceReason" TEXT,
  ADD COLUMN "attendanceNotes" TEXT,
  ADD COLUMN "reportStatus" TEXT NOT NULL DEFAULT 'NOT_DUE';

UPDATE "Lesson"
SET "reportStatus" = CASE
  WHEN "status" = 'COMPLETED' AND NOT EXISTS (SELECT 1 FROM "LessonReport" WHERE "LessonReport"."lessonId" = "Lesson"."id") THEN 'REPORT_OUTSTANDING'
  WHEN EXISTS (SELECT 1 FROM "LessonReport" WHERE "LessonReport"."lessonId" = "Lesson"."id") THEN 'SUBMITTED'
  ELSE 'NOT_DUE'
END;

CREATE INDEX "Lesson_reportStatus_idx" ON "Lesson"("reportStatus");

ALTER TABLE "LessonReport"
  ADD COLUMN "homeworkDueDate" TIMESTAMP(3),
  ADD COLUMN "nextLessonRecommendation" TEXT,
  ADD COLUMN "resourcesRequired" TEXT,
  ADD COLUMN "technicalIssueDetails" TEXT,
  ADD COLUMN "internalTutorNotes" TEXT,
  ADD COLUMN "parentVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "tutorDeclaration" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SafeguardingConcern"
  ADD COLUMN "lessonId" TEXT,
  ADD COLUMN "lessonReportId" TEXT;

CREATE INDEX "SafeguardingConcern_lessonId_idx" ON "SafeguardingConcern"("lessonId");
CREATE INDEX "SafeguardingConcern_lessonReportId_idx" ON "SafeguardingConcern"("lessonReportId");

ALTER TABLE "SafeguardingConcern" ADD CONSTRAINT "SafeguardingConcern_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafeguardingConcern" ADD CONSTRAINT "SafeguardingConcern_lessonReportId_fkey" FOREIGN KEY ("lessonReportId") REFERENCES "LessonReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
