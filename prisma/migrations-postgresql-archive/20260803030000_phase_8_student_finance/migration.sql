-- Phase 8 student finance, invoices, receipts, and parent payment records.
-- Keeps student billing separate from tutor payroll/timesheets.

ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'OVERDUE';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CORRECTED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TABLE "FeePlan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "planType" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "description" TEXT,
  "subjectId" TEXT,
  "examPathway" TEXT,
  "billingFrequency" TEXT,
  "defaultQuantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "defaultRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "discountType" TEXT,
  "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "scholarshipOrConcession" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeePlan_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Invoice"
  ADD COLUMN "studentId" TEXT,
  ADD COLUMN "feePlanId" TEXT,
  ADD COLUMN "service" TEXT NOT NULL DEFAULT 'Tutoring support',
  ADD COLUMN "billingPeriodStart" TIMESTAMP(3),
  ADD COLUMN "billingPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
  ADD COLUMN "rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'GBP',
  ADD COLUMN "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "balanceDue" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "createdById" TEXT;

UPDATE "Invoice"
SET "balanceDue" = "totalAmount"
WHERE "balanceDue" = 0 AND "status" <> 'PAID';

ALTER TABLE "Payment"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'PAYMENT',
  ADD COLUMN "paymentMethod" TEXT,
  ADD COLUMN "providerPaymentId" TEXT,
  ADD COLUMN "transactionReference" TEXT,
  ADD COLUMN "receivedById" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "metadata" JSONB;

UPDATE "Payment"
SET
  "paymentMethod" = COALESCE("provider", 'Manual payment entry'),
  "transactionReference" = COALESCE("reference", "transactionReference");

CREATE TABLE "Receipt" (
  "id" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "studentId" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "amountInWords" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "paymentMethod" TEXT NOT NULL,
  "transactionReference" TEXT,
  "dateReceived" TIMESTAMP(3) NOT NULL,
  "service" TEXT NOT NULL,
  "periodCovered" TEXT,
  "authorisedConfirmation" BOOLEAN NOT NULL DEFAULT true,
  "authorisedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");
CREATE INDEX "Receipt_invoiceId_idx" ON "Receipt"("invoiceId");
CREATE INDEX "Receipt_parentId_idx" ON "Receipt"("parentId");
CREATE INDEX "Receipt_studentId_idx" ON "Receipt"("studentId");
CREATE INDEX "Receipt_authorisedById_idx" ON "Receipt"("authorisedById");
CREATE INDEX "Receipt_dateReceived_idx" ON "Receipt"("dateReceived");

CREATE INDEX "FeePlan_planType_idx" ON "FeePlan"("planType");
CREATE INDEX "FeePlan_subjectId_idx" ON "FeePlan"("subjectId");
CREATE INDEX "FeePlan_examPathway_idx" ON "FeePlan"("examPathway");
CREATE INDEX "FeePlan_status_idx" ON "FeePlan"("status");

CREATE INDEX "Invoice_studentId_idx" ON "Invoice"("studentId");
CREATE INDEX "Invoice_feePlanId_idx" ON "Invoice"("feePlanId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_kind_idx" ON "Payment"("kind");
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

ALTER TABLE "FeePlan" ADD CONSTRAINT "FeePlan_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_feePlanId_fkey" FOREIGN KEY ("feePlanId") REFERENCES "FeePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_authorisedById_fkey" FOREIGN KEY ("authorisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
