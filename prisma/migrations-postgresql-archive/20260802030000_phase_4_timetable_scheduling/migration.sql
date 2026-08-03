-- Phase 4 timetable, tutor availability, and lesson scheduling.

ALTER TYPE "LessonStatus" ADD VALUE IF NOT EXISTS 'TUTOR_READY';
ALTER TYPE "LessonStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "LessonStatus" ADD VALUE IF NOT EXISTS 'STUDENT_ABSENT';
ALTER TYPE "LessonStatus" ADD VALUE IF NOT EXISTS 'TUTOR_ABSENT';
ALTER TYPE "LessonStatus" ADD VALUE IF NOT EXISTS 'RESCHEDULED';

CREATE TABLE "TutorAvailability" (
  "id" TEXT NOT NULL,
  "tutorId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "timeZone" TEXT NOT NULL,
  "recurring" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "overrideReason" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TutorAvailability_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TutorAvailability_tutorId_idx" ON "TutorAvailability"("tutorId");
CREATE INDEX "TutorAvailability_dayOfWeek_idx" ON "TutorAvailability"("dayOfWeek");
CREATE INDEX "TutorAvailability_status_idx" ON "TutorAvailability"("status");

ALTER TABLE "TutorAvailability" ADD CONSTRAINT "TutorAvailability_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TutorAvailability" ADD CONSTRAINT "TutorAvailability_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TutorAvailabilityException" (
  "id" TEXT NOT NULL,
  "tutorId" TEXT NOT NULL,
  "exceptionDate" TIMESTAMP(3) NOT NULL,
  "exceptionType" TEXT NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "timeZone" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "overrideReason" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TutorAvailabilityException_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TutorAvailabilityException_tutorId_idx" ON "TutorAvailabilityException"("tutorId");
CREATE INDEX "TutorAvailabilityException_exceptionDate_idx" ON "TutorAvailabilityException"("exceptionDate");
CREATE INDEX "TutorAvailabilityException_exceptionType_idx" ON "TutorAvailabilityException"("exceptionType");
CREATE INDEX "TutorAvailabilityException_status_idx" ON "TutorAvailabilityException"("status");

ALTER TABLE "TutorAvailabilityException" ADD CONSTRAINT "TutorAvailabilityException_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TutorAvailabilityException" ADD CONSTRAINT "TutorAvailabilityException_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lesson"
  ADD COLUMN "replacementTutorId" TEXT,
  ADD COLUMN "timeZone" TEXT,
  ADD COLUMN "durationMinutes" INTEGER,
  ADD COLUMN "meetingLink" TEXT,
  ADD COLUMN "lessonObjective" TEXT,
  ADD COLUMN "recurrencePattern" TEXT,
  ADD COLUMN "recurrenceGroupId" TEXT,
  ADD COLUMN "rescheduledFromId" TEXT,
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "cancellationInitiatedBy" TEXT,
  ADD COLUMN "createdById" TEXT;

CREATE INDEX "Lesson_replacementTutorId_idx" ON "Lesson"("replacementTutorId");
CREATE INDEX "Lesson_scheduledEnd_idx" ON "Lesson"("scheduledEnd");
CREATE INDEX "Lesson_status_idx" ON "Lesson"("status");
CREATE INDEX "Lesson_recurrenceGroupId_idx" ON "Lesson"("recurrenceGroupId");
CREATE INDEX "Lesson_createdById_idx" ON "Lesson"("createdById");

ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_replacementTutorId_fkey" FOREIGN KEY ("replacementTutorId") REFERENCES "Tutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "_LessonParticipants" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

INSERT INTO "_LessonParticipants" ("A", "B")
SELECT "id", "studentId"
FROM "Lesson";

CREATE UNIQUE INDEX "_LessonParticipants_AB_unique" ON "_LessonParticipants"("A", "B");
CREATE INDEX "_LessonParticipants_B_index" ON "_LessonParticipants"("B");

ALTER TABLE "_LessonParticipants" ADD CONSTRAINT "_LessonParticipants_A_fkey" FOREIGN KEY ("A") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_LessonParticipants" ADD CONSTRAINT "_LessonParticipants_B_fkey" FOREIGN KEY ("B") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
