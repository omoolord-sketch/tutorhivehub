ALTER TYPE "TimesheetStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "TimesheetStatus" ADD VALUE IF NOT EXISTS 'RETURNED';

CREATE TABLE "TutorRate" (
  "id" TEXT NOT NULL,
  "tutorId" TEXT NOT NULL,
  "rateType" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TutorRate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimesheetAdjustment" (
  "id" TEXT NOT NULL,
  "timesheetId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "reason" TEXT NOT NULL,
  "approvedById" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TimesheetAdjustment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Timesheet"
  ADD COLUMN "totalStudents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totalSubjects" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "standardTutoringTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "shadowSessionTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "nvqSupportTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "adjustmentsTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "finalAmountPayable" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "tutorNotes" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "paidById" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "paymentDate" TIMESTAMP(3),
  ADD COLUMN "transactionReference" TEXT,
  ADD COLUMN "returnReason" TEXT,
  ADD COLUMN "rejectionReason" TEXT;

ALTER TABLE "TimesheetEntry"
  ADD COLUMN "durationMinutes" INTEGER,
  ADD COLUMN "rateType" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'GBP',
  ADD COLUMN "attendanceStatus" TEXT,
  ADD COLUMN "reportStatus" TEXT,
  ADD COLUMN "paymentEligibility" TEXT NOT NULL DEFAULT 'REVIEW',
  ADD COLUMN "eligibilityReason" TEXT,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'GENERATED',
  ADD COLUMN "tutorFlagType" TEXT,
  ADD COLUMN "tutorFlagNote" TEXT,
  ADD COLUMN "adminReviewNote" TEXT;

CREATE INDEX "TutorRate_tutorId_idx" ON "TutorRate"("tutorId");
CREATE INDEX "TutorRate_rateType_idx" ON "TutorRate"("rateType");
CREATE INDEX "TutorRate_effectiveDate_idx" ON "TutorRate"("effectiveDate");
CREATE INDEX "TutorRate_endDate_idx" ON "TutorRate"("endDate");
CREATE INDEX "TutorRate_approvedById_idx" ON "TutorRate"("approvedById");

CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");
CREATE INDEX "Timesheet_reviewedById_idx" ON "Timesheet"("reviewedById");
CREATE INDEX "Timesheet_approvedById_idx" ON "Timesheet"("approvedById");
CREATE INDEX "Timesheet_paidById_idx" ON "Timesheet"("paidById");

CREATE INDEX "TimesheetEntry_paymentEligibility_idx" ON "TimesheetEntry"("paymentEligibility");
CREATE INDEX "TimesheetEntry_source_idx" ON "TimesheetEntry"("source");

CREATE INDEX "TimesheetAdjustment_timesheetId_idx" ON "TimesheetAdjustment"("timesheetId");
CREATE INDEX "TimesheetAdjustment_approvedById_idx" ON "TimesheetAdjustment"("approvedById");

ALTER TABLE "TutorRate" ADD CONSTRAINT "TutorRate_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TutorRate" ADD CONSTRAINT "TutorRate_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TimesheetAdjustment" ADD CONSTRAINT "TimesheetAdjustment_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimesheetAdjustment" ADD CONSTRAINT "TimesheetAdjustment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
