-- Phase 3 master-data schema for parents, students, tutors, subjects, and tutor assignments.

ALTER TABLE "Parent"
  ADD COLUMN "preferredContactMethod" TEXT,
  ADD COLUMN "timeZone" TEXT,
  ADD COLUMN "emergencyContactName" TEXT,
  ADD COLUMN "emergencyContactPhone" TEXT,
  ADD COLUMN "emergencyContactRelationship" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "notes" TEXT;

CREATE INDEX "Parent_status_idx" ON "Parent"("status");
CREATE INDEX "Parent_country_idx" ON "Parent"("country");
CREATE INDEX "Parent_timeZone_idx" ON "Parent"("timeZone");

ALTER TABLE "Student"
  ADD COLUMN "age" INTEGER,
  ADD COLUMN "timeZone" TEXT,
  ADD COLUMN "schoolOrInstitution" TEXT,
  ADD COLUMN "examPathway" TEXT,
  ADD COLUMN "academicGoals" TEXT,
  ADD COLUMN "learningNeeds" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "importantNotes" TEXT;

CREATE INDEX "Student_status_idx" ON "Student"("status");
CREATE INDEX "Student_yearGroup_idx" ON "Student"("yearGroup");
CREATE INDEX "Student_examPathway_idx" ON "Student"("examPathway");
CREATE INDEX "Student_country_idx" ON "Student"("country");
CREATE INDEX "Student_timeZone_idx" ON "Student"("timeZone");

ALTER TABLE "Tutor"
  ADD COLUMN "timeZone" TEXT,
  ADD COLUMN "teachingExperience" TEXT,
  ADD COLUMN "availability" TEXT,
  ADD COLUMN "cvFileKey" TEXT,
  ADD COLUMN "cvFileName" TEXT,
  ADD COLUMN "certificateFiles" JSONB,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "rateInformation" TEXT,
  ADD COLUMN "internalPerformanceNotes" TEXT,
  ADD COLUMN "primaryTeachingDevice" TEXT,
  ADD COLUMN "operatingSystem" TEXT,
  ADD COLUMN "internetConnectionType" TEXT,
  ADD COLUMN "averageInternetSpeed" TEXT,
  ADD COLUMN "backupInternet" BOOLEAN,
  ADD COLUMN "webcamAvailable" BOOLEAN,
  ADD COLUMN "headsetMicrophoneAvailable" BOOLEAN,
  ADD COLUMN "quietTeachingEnvironment" BOOLEAN,
  ADD COLUMN "onlineTeachingPlatforms" TEXT;

CREATE INDEX "Tutor_status_idx" ON "Tutor"("status");
CREATE INDEX "Tutor_country_idx" ON "Tutor"("country");
CREATE INDEX "Tutor_timeZone_idx" ON "Tutor"("timeZone");

ALTER TABLE "Subject"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "examPathway" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Subject_category_idx" ON "Subject"("category");
CREATE INDEX "Subject_examPathway_idx" ON "Subject"("examPathway");
CREATE INDEX "Subject_isActive_idx" ON "Subject"("isActive");

CREATE TABLE "StudentTutorAssignment" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "tutorId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentTutorAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentTutorAssignment_studentId_idx" ON "StudentTutorAssignment"("studentId");
CREATE INDEX "StudentTutorAssignment_tutorId_idx" ON "StudentTutorAssignment"("tutorId");
CREATE INDEX "StudentTutorAssignment_subjectId_idx" ON "StudentTutorAssignment"("subjectId");
CREATE INDEX "StudentTutorAssignment_status_idx" ON "StudentTutorAssignment"("status");
CREATE INDEX "StudentTutorAssignment_startDate_idx" ON "StudentTutorAssignment"("startDate");

ALTER TABLE "StudentTutorAssignment" ADD CONSTRAINT "StudentTutorAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTutorAssignment" ADD CONSTRAINT "StudentTutorAssignment_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTutorAssignment" ADD CONSTRAINT "StudentTutorAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
