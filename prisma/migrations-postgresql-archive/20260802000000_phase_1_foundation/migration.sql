-- Phase 1 foundation schema for the TutorHiveHub educational portal.
-- Generated from prisma/schema.prisma and intended for PostgreSQL.

CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "LessonStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'MISSED');
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PART_PAID', 'PAID', 'VOID');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE "HomeworkStatus" AS ENUM ('ASSIGNED', 'SUBMITTED', 'REVIEWED', 'CANCELLED');
CREATE TYPE "ResourceVisibility" AS ENUM ('INTERNAL', 'TUTORS', 'PARENTS', 'STUDENTS');
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');
CREATE TYPE "SafeguardingStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'ESCALATED');

CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Permission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
  "roleId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Parent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "country" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Student" (
  "id" TEXT NOT NULL,
  "parentId" TEXT,
  "fullName" TEXT NOT NULL,
  "dateOfBirth" TIMESTAMP(3),
  "yearGroup" TEXT,
  "country" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tutor" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "country" TEXT,
  "qualifications" TEXT,
  "mainSubjectAreas" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tutor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subject" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lesson" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "tutorId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "parentId" TEXT,
  "lessonType" TEXT NOT NULL,
  "scheduledStart" TIMESTAMP(3) NOT NULL,
  "scheduledEnd" TIMESTAMP(3) NOT NULL,
  "actualStart" TIMESTAMP(3),
  "actualEnd" TIMESTAMP(3),
  "status" "LessonStatus" NOT NULL DEFAULT 'SCHEDULED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LessonReport" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "tutorId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "topicCovered" TEXT NOT NULL,
  "lessonSummary" TEXT NOT NULL,
  "studentParticipation" TEXT NOT NULL,
  "studentUnderstanding" TEXT NOT NULL,
  "strengthsObserved" TEXT,
  "areasNeedingSupport" TEXT,
  "homeworkOrTaskGiven" TEXT,
  "parentFriendlyUpdate" TEXT NOT NULL,
  "technicalIssuesReported" BOOLEAN NOT NULL DEFAULT false,
  "safeguardingConcernRaised" BOOLEAN NOT NULL DEFAULT false,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LessonReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Timesheet" (
  "id" TEXT NOT NULL,
  "tutorId" TEXT NOT NULL,
  "monthCovered" INTEGER NOT NULL,
  "yearCovered" INTEGER NOT NULL,
  "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
  "totalLessons" INTEGER NOT NULL DEFAULT 0,
  "totalHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "totalAmountDue" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimesheetEntry" (
  "id" TEXT NOT NULL,
  "timesheetId" TEXT NOT NULL,
  "lessonId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "lessonTime" TEXT NOT NULL,
  "studentName" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "lessonType" TEXT NOT NULL,
  "hoursTaught" DECIMAL(6,2) NOT NULL,
  "rate" DECIMAL(10,2) NOT NULL,
  "amountDue" DECIMAL(10,2) NOT NULL,
  "lessonReportSubmitted" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimesheetEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "parentId" TEXT,
  "invoiceNumber" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotal" DECIMAL(10,2) NOT NULL,
  "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "issuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT,
  "reference" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Homework" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "tutorId" TEXT,
  "lessonId" TEXT,
  "subjectId" TEXT,
  "title" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3),
  "status" "HomeworkStatus" NOT NULL DEFAULT 'ASSIGNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Resource" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "url" TEXT,
  "fileKey" TEXT,
  "visibility" "ResourceVisibility" NOT NULL DEFAULT 'INTERNAL',
  "subjectId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "createdById" TEXT,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SafeguardingConcern" (
  "id" TEXT NOT NULL,
  "studentId" TEXT,
  "tutorId" TEXT,
  "reportedById" TEXT,
  "resolvedById" TEXT,
  "status" "SafeguardingStatus" NOT NULL DEFAULT 'OPEN',
  "summary" TEXT NOT NULL,
  "restrictedNotes" TEXT,
  "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SafeguardingConcern_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_PermissionToRole" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE TABLE "_StudentToSubject" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE TABLE "_SubjectToTutor" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
CREATE UNIQUE INDEX "Parent_userId_key" ON "Parent"("userId");
CREATE INDEX "Parent_email_idx" ON "Parent"("email");
CREATE INDEX "Student_parentId_idx" ON "Student"("parentId");
CREATE UNIQUE INDEX "Tutor_userId_key" ON "Tutor"("userId");
CREATE INDEX "Tutor_email_idx" ON "Tutor"("email");
CREATE UNIQUE INDEX "Subject_name_key" ON "Subject"("name");
CREATE INDEX "Lesson_studentId_idx" ON "Lesson"("studentId");
CREATE INDEX "Lesson_tutorId_idx" ON "Lesson"("tutorId");
CREATE INDEX "Lesson_subjectId_idx" ON "Lesson"("subjectId");
CREATE INDEX "Lesson_parentId_idx" ON "Lesson"("parentId");
CREATE INDEX "Lesson_scheduledStart_idx" ON "Lesson"("scheduledStart");
CREATE UNIQUE INDEX "LessonReport_lessonId_key" ON "LessonReport"("lessonId");
CREATE INDEX "LessonReport_tutorId_idx" ON "LessonReport"("tutorId");
CREATE INDEX "LessonReport_studentId_idx" ON "LessonReport"("studentId");
CREATE INDEX "Timesheet_tutorId_idx" ON "Timesheet"("tutorId");
CREATE UNIQUE INDEX "Timesheet_tutorId_monthCovered_yearCovered_key" ON "Timesheet"("tutorId", "monthCovered", "yearCovered");
CREATE INDEX "TimesheetEntry_timesheetId_idx" ON "TimesheetEntry"("timesheetId");
CREATE INDEX "TimesheetEntry_lessonId_idx" ON "TimesheetEntry"("lessonId");
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX "Invoice_parentId_idx" ON "Invoice"("parentId");
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX "Homework_studentId_idx" ON "Homework"("studentId");
CREATE INDEX "Homework_tutorId_idx" ON "Homework"("tutorId");
CREATE INDEX "Homework_lessonId_idx" ON "Homework"("lessonId");
CREATE INDEX "Homework_subjectId_idx" ON "Homework"("subjectId");
CREATE INDEX "Resource_subjectId_idx" ON "Resource"("subjectId");
CREATE INDEX "Resource_createdById_idx" ON "Resource"("createdById");
CREATE INDEX "Notification_recipientId_idx" ON "Notification"("recipientId");
CREATE INDEX "Notification_createdById_idx" ON "Notification"("createdById");
CREATE INDEX "SafeguardingConcern_studentId_idx" ON "SafeguardingConcern"("studentId");
CREATE INDEX "SafeguardingConcern_tutorId_idx" ON "SafeguardingConcern"("tutorId");
CREATE INDEX "SafeguardingConcern_reportedById_idx" ON "SafeguardingConcern"("reportedById");
CREATE INDEX "SafeguardingConcern_resolvedById_idx" ON "SafeguardingConcern"("resolvedById");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE UNIQUE INDEX "_PermissionToRole_AB_unique" ON "_PermissionToRole"("A", "B");
CREATE INDEX "_PermissionToRole_B_index" ON "_PermissionToRole"("B");
CREATE UNIQUE INDEX "_StudentToSubject_AB_unique" ON "_StudentToSubject"("A", "B");
CREATE INDEX "_StudentToSubject_B_index" ON "_StudentToSubject"("B");
CREATE UNIQUE INDEX "_SubjectToTutor_AB_unique" ON "_SubjectToTutor"("A", "B");
CREATE INDEX "_SubjectToTutor_B_index" ON "_SubjectToTutor"("B");

ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Parent" ADD CONSTRAINT "Parent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Tutor" ADD CONSTRAINT "Tutor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LessonReport" ADD CONSTRAINT "LessonReport_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonReport" ADD CONSTRAINT "LessonReport_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonReport" ADD CONSTRAINT "LessonReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafeguardingConcern" ADD CONSTRAINT "SafeguardingConcern_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafeguardingConcern" ADD CONSTRAINT "SafeguardingConcern_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafeguardingConcern" ADD CONSTRAINT "SafeguardingConcern_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafeguardingConcern" ADD CONSTRAINT "SafeguardingConcern_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_StudentToSubject" ADD CONSTRAINT "_StudentToSubject_A_fkey" FOREIGN KEY ("A") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_StudentToSubject" ADD CONSTRAINT "_StudentToSubject_B_fkey" FOREIGN KEY ("B") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_SubjectToTutor" ADD CONSTRAINT "_SubjectToTutor_A_fkey" FOREIGN KEY ("A") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_SubjectToTutor" ADD CONSTRAINT "_SubjectToTutor_B_fkey" FOREIGN KEY ("B") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
