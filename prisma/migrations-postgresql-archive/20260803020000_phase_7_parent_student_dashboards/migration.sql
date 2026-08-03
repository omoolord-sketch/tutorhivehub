ALTER TABLE "Student"
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "directLoginDisabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SupportRequest" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "parentId" TEXT,
  "studentId" TEXT,
  "category" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "assignedToId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");
CREATE INDEX "Student_userId_idx" ON "Student"("userId");

CREATE INDEX "SupportRequest_requesterId_idx" ON "SupportRequest"("requesterId");
CREATE INDEX "SupportRequest_parentId_idx" ON "SupportRequest"("parentId");
CREATE INDEX "SupportRequest_studentId_idx" ON "SupportRequest"("studentId");
CREATE INDEX "SupportRequest_status_idx" ON "SupportRequest"("status");
CREATE INDEX "SupportRequest_category_idx" ON "SupportRequest"("category");
CREATE INDEX "SupportRequest_assignedToId_idx" ON "SupportRequest"("assignedToId");

ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
