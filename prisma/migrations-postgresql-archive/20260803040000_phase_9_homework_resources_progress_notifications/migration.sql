-- Phase 9 homework workflow, learning resources, progress tracking, and notifications.

ALTER TYPE "HomeworkStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "HomeworkStatus" ADD VALUE IF NOT EXISTS 'LATE';
ALTER TYPE "HomeworkStatus" ADD VALUE IF NOT EXISTS 'RESUBMISSION_REQUIRED';
ALTER TYPE "HomeworkStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

CREATE TYPE "ResourceType" AS ENUM (
  'DOCUMENT',
  'PDF',
  'PRESENTATION',
  'WORKSHEET',
  'IMAGE',
  'APPROVED_LINK',
  'VIDEO',
  'OTHER'
);

ALTER TABLE "Homework"
  ADD COLUMN "instructions" TEXT,
  ADD COLUMN "gradingCriteria" TEXT,
  ADD COLUMN "maxMarks" DECIMAL(6,2),
  ADD COLUMN "mark" DECIMAL(6,2),
  ADD COLUMN "feedback" TEXT,
  ADD COLUMN "attachments" JSONB,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "resubmissionRequestedAt" TIMESTAMP(3);

CREATE TABLE "HomeworkSubmission" (
  "id" TEXT NOT NULL,
  "homeworkId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "submittedById" TEXT,
  "comments" TEXT,
  "fileKey" TEXT,
  "fileName" TEXT,
  "fileMimeType" TEXT,
  "fileSize" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "mark" DECIMAL(6,2),
  "feedback" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Resource"
  ADD COLUMN "fileName" TEXT,
  ADD COLUMN "fileMimeType" TEXT,
  ADD COLUMN "fileSize" INTEGER,
  ADD COLUMN "resourceType" "ResourceType" NOT NULL DEFAULT 'DOCUMENT',
  ADD COLUMN "tutorId" TEXT,
  ADD COLUMN "studentId" TEXT,
  ADD COLUMN "lessonId" TEXT,
  ADD COLUMN "yearGroup" TEXT,
  ADD COLUMN "examPathway" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3);

CREATE TABLE "ProgressRecord" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "tutorId" TEXT,
  "subjectId" TEXT,
  "learningGoals" TEXT NOT NULL,
  "baselineLevel" TEXT,
  "currentLevel" TEXT,
  "skillsAchieved" TEXT,
  "areasForImprovement" TEXT,
  "tutorComments" TEXT,
  "parentSummary" TEXT,
  "parentVisible" BOOLEAN NOT NULL DEFAULT false,
  "reviewDate" TIMESTAMP(3) NOT NULL,
  "goalStatus" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgressRecord_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "entityType" TEXT,
  ADD COLUMN "entityId" TEXT,
  ADD COLUMN "emailSentAt" TIMESTAMP(3);

CREATE TABLE "_HomeworkToResource" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE INDEX "Homework_status_idx" ON "Homework"("status");
CREATE INDEX "Homework_dueDate_idx" ON "Homework"("dueDate");

CREATE INDEX "HomeworkSubmission_homeworkId_idx" ON "HomeworkSubmission"("homeworkId");
CREATE INDEX "HomeworkSubmission_studentId_idx" ON "HomeworkSubmission"("studentId");
CREATE INDEX "HomeworkSubmission_submittedById_idx" ON "HomeworkSubmission"("submittedById");
CREATE INDEX "HomeworkSubmission_reviewedById_idx" ON "HomeworkSubmission"("reviewedById");
CREATE INDEX "HomeworkSubmission_status_idx" ON "HomeworkSubmission"("status");

CREATE INDEX "Resource_tutorId_idx" ON "Resource"("tutorId");
CREATE INDEX "Resource_studentId_idx" ON "Resource"("studentId");
CREATE INDEX "Resource_lessonId_idx" ON "Resource"("lessonId");
CREATE INDEX "Resource_approvedById_idx" ON "Resource"("approvedById");
CREATE INDEX "Resource_resourceType_idx" ON "Resource"("resourceType");
CREATE INDEX "Resource_visibility_idx" ON "Resource"("visibility");
CREATE INDEX "Resource_status_idx" ON "Resource"("status");
CREATE INDEX "Resource_yearGroup_idx" ON "Resource"("yearGroup");
CREATE INDEX "Resource_examPathway_idx" ON "Resource"("examPathway");

CREATE INDEX "ProgressRecord_studentId_idx" ON "ProgressRecord"("studentId");
CREATE INDEX "ProgressRecord_tutorId_idx" ON "ProgressRecord"("tutorId");
CREATE INDEX "ProgressRecord_subjectId_idx" ON "ProgressRecord"("subjectId");
CREATE INDEX "ProgressRecord_goalStatus_idx" ON "ProgressRecord"("goalStatus");
CREATE INDEX "ProgressRecord_reviewDate_idx" ON "ProgressRecord"("reviewDate");
CREATE INDEX "ProgressRecord_parentVisible_idx" ON "ProgressRecord"("parentVisible");
CREATE INDEX "ProgressRecord_createdById_idx" ON "ProgressRecord"("createdById");

CREATE INDEX "Notification_category_idx" ON "Notification"("category");
CREATE INDEX "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

CREATE UNIQUE INDEX "_HomeworkToResource_AB_unique" ON "_HomeworkToResource"("A", "B");
CREATE INDEX "_HomeworkToResource_B_index" ON "_HomeworkToResource"("B");

ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Resource" ADD CONSTRAINT "Resource_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProgressRecord" ADD CONSTRAINT "ProgressRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgressRecord" ADD CONSTRAINT "ProgressRecord_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgressRecord" ADD CONSTRAINT "ProgressRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgressRecord" ADD CONSTRAINT "ProgressRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "_HomeworkToResource" ADD CONSTRAINT "_HomeworkToResource_A_fkey" FOREIGN KEY ("A") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_HomeworkToResource" ADD CONSTRAINT "_HomeworkToResource_B_fkey" FOREIGN KEY ("B") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
