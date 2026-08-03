-- Phase 10 quality assurance, reporting, security, and data-protection foundation.

CREATE TABLE "LessonObservation" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT,
  "tutorId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "observationDate" TIMESTAMP(3) NOT NULL,
  "focusArea" TEXT,
  "rating" TEXT,
  "strengths" TEXT,
  "improvementAreas" TEXT,
  "reviewerNotes" TEXT,
  "nextReviewDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LessonObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TutorReview" (
  "id" TEXT NOT NULL,
  "tutorId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "reviewDate" TIMESTAMP(3) NOT NULL,
  "rating" TEXT,
  "lessonsAssigned" INTEGER NOT NULL DEFAULT 0,
  "lessonsCompleted" INTEGER NOT NULL DEFAULT 0,
  "attendanceRate" DECIMAL(6,2),
  "punctualityRate" DECIMAL(6,2),
  "reportSubmissionRate" DECIMAL(6,2),
  "homeworkFeedbackRate" DECIMAL(6,2),
  "studentRetention" DECIMAL(6,2),
  "complaints" INTEGER NOT NULL DEFAULT 0,
  "qualityReviewNotes" TEXT,
  "nextReviewDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TutorReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingRecord" (
  "id" TEXT NOT NULL,
  "tutorId" TEXT NOT NULL,
  "recordedById" TEXT,
  "title" TEXT NOT NULL,
  "provider" TEXT,
  "trainingDate" TIMESTAMP(3),
  "completionDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "certificateFileKey" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PolicyAcknowledgement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "recordedById" TEXT,
  "policyName" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PolicyAcknowledgement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImprovementPlan" (
  "id" TEXT NOT NULL,
  "tutorId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "title" TEXT NOT NULL,
  "concernSummary" TEXT NOT NULL,
  "requiredActions" TEXT NOT NULL,
  "supportOffered" TEXT,
  "dueDate" TIMESTAMP(3),
  "reviewDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "reviewerNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImprovementPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsentRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "parentId" TEXT,
  "studentId" TEXT,
  "consentType" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL DEFAULT true,
  "legalBasis" TEXT,
  "recordedById" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiryDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataRetentionConfig" (
  "id" TEXT NOT NULL,
  "recordType" TEXT NOT NULL,
  "retentionMonths" INTEGER NOT NULL,
  "action" TEXT NOT NULL DEFAULT 'REVIEW',
  "legalBasis" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "updatedById" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataRetentionConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataProtectionRequest" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT,
  "parentId" TEXT,
  "studentId" TEXT,
  "requestType" TEXT NOT NULL,
  "scope" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "handledById" TEXT,
  "completedAt" TIMESTAMP(3),
  "responseNotes" TEXT,
  "internalNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataProtectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DataRetentionConfig_recordType_key" ON "DataRetentionConfig"("recordType");

CREATE INDEX "LessonObservation_lessonId_idx" ON "LessonObservation"("lessonId");
CREATE INDEX "LessonObservation_tutorId_idx" ON "LessonObservation"("tutorId");
CREATE INDEX "LessonObservation_reviewerId_idx" ON "LessonObservation"("reviewerId");
CREATE INDEX "LessonObservation_observationDate_idx" ON "LessonObservation"("observationDate");
CREATE INDEX "LessonObservation_status_idx" ON "LessonObservation"("status");

CREATE INDEX "TutorReview_tutorId_idx" ON "TutorReview"("tutorId");
CREATE INDEX "TutorReview_reviewerId_idx" ON "TutorReview"("reviewerId");
CREATE INDEX "TutorReview_reviewDate_idx" ON "TutorReview"("reviewDate");
CREATE INDEX "TutorReview_status_idx" ON "TutorReview"("status");

CREATE INDEX "TrainingRecord_tutorId_idx" ON "TrainingRecord"("tutorId");
CREATE INDEX "TrainingRecord_recordedById_idx" ON "TrainingRecord"("recordedById");
CREATE INDEX "TrainingRecord_status_idx" ON "TrainingRecord"("status");
CREATE INDEX "TrainingRecord_expiryDate_idx" ON "TrainingRecord"("expiryDate");

CREATE INDEX "PolicyAcknowledgement_userId_idx" ON "PolicyAcknowledgement"("userId");
CREATE INDEX "PolicyAcknowledgement_recordedById_idx" ON "PolicyAcknowledgement"("recordedById");
CREATE INDEX "PolicyAcknowledgement_policyName_idx" ON "PolicyAcknowledgement"("policyName");
CREATE INDEX "PolicyAcknowledgement_acknowledgedAt_idx" ON "PolicyAcknowledgement"("acknowledgedAt");

CREATE INDEX "ImprovementPlan_tutorId_idx" ON "ImprovementPlan"("tutorId");
CREATE INDEX "ImprovementPlan_reviewerId_idx" ON "ImprovementPlan"("reviewerId");
CREATE INDEX "ImprovementPlan_status_idx" ON "ImprovementPlan"("status");
CREATE INDEX "ImprovementPlan_dueDate_idx" ON "ImprovementPlan"("dueDate");
CREATE INDEX "ImprovementPlan_reviewDate_idx" ON "ImprovementPlan"("reviewDate");

CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");
CREATE INDEX "ConsentRecord_parentId_idx" ON "ConsentRecord"("parentId");
CREATE INDEX "ConsentRecord_studentId_idx" ON "ConsentRecord"("studentId");
CREATE INDEX "ConsentRecord_consentType_idx" ON "ConsentRecord"("consentType");
CREATE INDEX "ConsentRecord_granted_idx" ON "ConsentRecord"("granted");

CREATE INDEX "DataRetentionConfig_active_idx" ON "DataRetentionConfig"("active");
CREATE INDEX "DataRetentionConfig_updatedById_idx" ON "DataRetentionConfig"("updatedById");

CREATE INDEX "DataProtectionRequest_requesterId_idx" ON "DataProtectionRequest"("requesterId");
CREATE INDEX "DataProtectionRequest_parentId_idx" ON "DataProtectionRequest"("parentId");
CREATE INDEX "DataProtectionRequest_studentId_idx" ON "DataProtectionRequest"("studentId");
CREATE INDEX "DataProtectionRequest_requestType_idx" ON "DataProtectionRequest"("requestType");
CREATE INDEX "DataProtectionRequest_status_idx" ON "DataProtectionRequest"("status");
CREATE INDEX "DataProtectionRequest_dueAt_idx" ON "DataProtectionRequest"("dueAt");
CREATE INDEX "DataProtectionRequest_handledById_idx" ON "DataProtectionRequest"("handledById");

ALTER TABLE "LessonObservation" ADD CONSTRAINT "LessonObservation_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LessonObservation" ADD CONSTRAINT "LessonObservation_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonObservation" ADD CONSTRAINT "LessonObservation_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TutorReview" ADD CONSTRAINT "TutorReview_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TutorReview" ADD CONSTRAINT "TutorReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PolicyAcknowledgement" ADD CONSTRAINT "PolicyAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PolicyAcknowledgement" ADD CONSTRAINT "PolicyAcknowledgement_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImprovementPlan" ADD CONSTRAINT "ImprovementPlan_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImprovementPlan" ADD CONSTRAINT "ImprovementPlan_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DataRetentionConfig" ADD CONSTRAINT "DataRetentionConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DataProtectionRequest" ADD CONSTRAINT "DataProtectionRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataProtectionRequest" ADD CONSTRAINT "DataProtectionRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataProtectionRequest" ADD CONSTRAINT "DataProtectionRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataProtectionRequest" ADD CONSTRAINT "DataProtectionRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
