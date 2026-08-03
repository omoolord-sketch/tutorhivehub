-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NULL,
    `status` ENUM('INVITED', 'ACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'INVITED',
    `roleId` VARCHAR(191) NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `activatedAt` DATETIME(3) NULL,
    `deactivatedAt` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `passwordChangedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_roleId_idx`(`roleId`),
    INDEX `User_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Permission_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `sessionTokenHash` VARCHAR(191) NOT NULL,
    `rememberMe` BOOLEAN NOT NULL DEFAULT false,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_sessionTokenHash_key`(`sessionTokenHash`),
    INDEX `Session_userId_idx`(`userId`),
    INDEX `Session_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_idx`(`userId`),
    INDEX `PasswordResetToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailVerificationToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailVerificationToken_tokenHash_key`(`tokenHash`),
    INDEX `EmailVerificationToken_userId_idx`(`userId`),
    INDEX `EmailVerificationToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Parent` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `preferredContactMethod` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `timeZone` VARCHAR(191) NULL,
    `emergencyContactName` VARCHAR(191) NULL,
    `emergencyContactPhone` VARCHAR(191) NULL,
    `emergencyContactRelationship` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Parent_userId_key`(`userId`),
    INDEX `Parent_email_idx`(`email`),
    INDEX `Parent_status_idx`(`status`),
    INDEX `Parent_country_idx`(`country`),
    INDEX `Parent_timeZone_idx`(`timeZone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Student` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `parentId` VARCHAR(191) NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `age` INTEGER NULL,
    `yearGroup` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `timeZone` VARCHAR(191) NULL,
    `schoolOrInstitution` VARCHAR(191) NULL,
    `examPathway` VARCHAR(191) NULL,
    `academicGoals` TEXT NULL,
    `learningNeeds` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `directLoginDisabled` BOOLEAN NOT NULL DEFAULT false,
    `startDate` DATETIME(3) NULL,
    `importantNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Student_userId_key`(`userId`),
    INDEX `Student_userId_idx`(`userId`),
    INDEX `Student_parentId_idx`(`parentId`),
    INDEX `Student_status_idx`(`status`),
    INDEX `Student_yearGroup_idx`(`yearGroup`),
    INDEX `Student_examPathway_idx`(`examPathway`),
    INDEX `Student_country_idx`(`country`),
    INDEX `Student_timeZone_idx`(`timeZone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportRequest` (
    `id` VARCHAR(191) NOT NULL,
    `requesterId` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `studentId` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    `assignedToId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SupportRequest_requesterId_idx`(`requesterId`),
    INDEX `SupportRequest_parentId_idx`(`parentId`),
    INDEX `SupportRequest_studentId_idx`(`studentId`),
    INDEX `SupportRequest_status_idx`(`status`),
    INDEX `SupportRequest_category_idx`(`category`),
    INDEX `SupportRequest_assignedToId_idx`(`assignedToId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tutor` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `timeZone` VARCHAR(191) NULL,
    `qualifications` TEXT NULL,
    `mainSubjectAreas` TEXT NULL,
    `teachingExperience` TEXT NULL,
    `availability` TEXT NULL,
    `cvFileKey` VARCHAR(191) NULL,
    `cvFileName` VARCHAR(191) NULL,
    `certificateFiles` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `startDate` DATETIME(3) NULL,
    `rateInformation` TEXT NULL,
    `internalPerformanceNotes` TEXT NULL,
    `primaryTeachingDevice` VARCHAR(191) NULL,
    `operatingSystem` VARCHAR(191) NULL,
    `internetConnectionType` VARCHAR(191) NULL,
    `averageInternetSpeed` VARCHAR(191) NULL,
    `backupInternet` BOOLEAN NULL,
    `webcamAvailable` BOOLEAN NULL,
    `headsetMicrophoneAvailable` BOOLEAN NULL,
    `quietTeachingEnvironment` BOOLEAN NULL,
    `onlineTeachingPlatforms` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Tutor_userId_key`(`userId`),
    INDEX `Tutor_email_idx`(`email`),
    INDEX `Tutor_status_idx`(`status`),
    INDEX `Tutor_country_idx`(`country`),
    INDEX `Tutor_timeZone_idx`(`timeZone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TutorRate` (
    `id` VARCHAR(191) NOT NULL,
    `tutorId` VARCHAR(191) NOT NULL,
    `rateType` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'GBP',
    `effectiveDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TutorRate_tutorId_idx`(`tutorId`),
    INDEX `TutorRate_rateType_idx`(`rateType`),
    INDEX `TutorRate_effectiveDate_idx`(`effectiveDate`),
    INDEX `TutorRate_endDate_idx`(`endDate`),
    INDEX `TutorRate_approvedById_idx`(`approvedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subject` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `examPathway` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subject_name_key`(`name`),
    INDEX `Subject_category_idx`(`category`),
    INDEX `Subject_examPathway_idx`(`examPathway`),
    INDEX `Subject_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentTutorAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `tutorId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StudentTutorAssignment_studentId_idx`(`studentId`),
    INDEX `StudentTutorAssignment_tutorId_idx`(`tutorId`),
    INDEX `StudentTutorAssignment_subjectId_idx`(`subjectId`),
    INDEX `StudentTutorAssignment_status_idx`(`status`),
    INDEX `StudentTutorAssignment_startDate_idx`(`startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TutorAvailability` (
    `id` VARCHAR(191) NOT NULL,
    `tutorId` VARCHAR(191) NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `timeZone` VARCHAR(191) NOT NULL,
    `recurring` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `overrideReason` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TutorAvailability_tutorId_idx`(`tutorId`),
    INDEX `TutorAvailability_dayOfWeek_idx`(`dayOfWeek`),
    INDEX `TutorAvailability_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TutorAvailabilityException` (
    `id` VARCHAR(191) NOT NULL,
    `tutorId` VARCHAR(191) NOT NULL,
    `exceptionDate` DATETIME(3) NOT NULL,
    `exceptionType` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NULL,
    `endTime` VARCHAR(191) NULL,
    `timeZone` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `overrideReason` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TutorAvailabilityException_tutorId_idx`(`tutorId`),
    INDEX `TutorAvailabilityException_exceptionDate_idx`(`exceptionDate`),
    INDEX `TutorAvailabilityException_exceptionType_idx`(`exceptionType`),
    INDEX `TutorAvailabilityException_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lesson` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `tutorId` VARCHAR(191) NOT NULL,
    `replacementTutorId` VARCHAR(191) NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `lessonType` VARCHAR(191) NOT NULL,
    `scheduledStart` DATETIME(3) NOT NULL,
    `scheduledEnd` DATETIME(3) NOT NULL,
    `timeZone` VARCHAR(191) NULL,
    `durationMinutes` INTEGER NULL,
    `meetingLink` VARCHAR(2048) NULL,
    `lessonObjective` TEXT NULL,
    `tutorReadyAt` DATETIME(3) NULL,
    `readinessChecklist` JSON NULL,
    `preparationApprovedAsLessonTime` BOOLEAN NOT NULL DEFAULT false,
    `tutorAttendance` VARCHAR(191) NULL,
    `studentAttendance` VARCHAR(191) NULL,
    `arrivalTime` DATETIME(3) NULL,
    `minutesLate` INTEGER NULL,
    `absenceReason` TEXT NULL,
    `attendanceNotes` TEXT NULL,
    `reportStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_DUE',
    `actualStart` DATETIME(3) NULL,
    `actualEnd` DATETIME(3) NULL,
    `status` ENUM('SCHEDULED', 'TUTOR_READY', 'IN_PROGRESS', 'COMPLETED', 'STUDENT_ABSENT', 'TUTOR_ABSENT', 'CANCELLED', 'RESCHEDULED', 'MISSED') NOT NULL DEFAULT 'SCHEDULED',
    `recurrencePattern` VARCHAR(191) NULL,
    `recurrenceGroupId` VARCHAR(191) NULL,
    `rescheduledFromId` VARCHAR(191) NULL,
    `cancellationReason` TEXT NULL,
    `cancellationInitiatedBy` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Lesson_studentId_idx`(`studentId`),
    INDEX `Lesson_tutorId_idx`(`tutorId`),
    INDEX `Lesson_subjectId_idx`(`subjectId`),
    INDEX `Lesson_parentId_idx`(`parentId`),
    INDEX `Lesson_replacementTutorId_idx`(`replacementTutorId`),
    INDEX `Lesson_scheduledStart_idx`(`scheduledStart`),
    INDEX `Lesson_scheduledEnd_idx`(`scheduledEnd`),
    INDEX `Lesson_status_idx`(`status`),
    INDEX `Lesson_reportStatus_idx`(`reportStatus`),
    INDEX `Lesson_recurrenceGroupId_idx`(`recurrenceGroupId`),
    INDEX `Lesson_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LessonReport` (
    `id` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NOT NULL,
    `tutorId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `topicCovered` TEXT NOT NULL,
    `lessonSummary` TEXT NOT NULL,
    `studentParticipation` VARCHAR(191) NOT NULL,
    `studentUnderstanding` VARCHAR(191) NOT NULL,
    `strengthsObserved` TEXT NULL,
    `areasNeedingSupport` TEXT NULL,
    `homeworkOrTaskGiven` TEXT NULL,
    `homeworkDueDate` DATETIME(3) NULL,
    `nextLessonRecommendation` TEXT NULL,
    `resourcesRequired` TEXT NULL,
    `parentFriendlyUpdate` TEXT NOT NULL,
    `technicalIssuesReported` BOOLEAN NOT NULL DEFAULT false,
    `technicalIssueDetails` TEXT NULL,
    `safeguardingConcernRaised` BOOLEAN NOT NULL DEFAULT false,
    `internalTutorNotes` TEXT NULL,
    `parentVisible` BOOLEAN NOT NULL DEFAULT true,
    `tutorDeclaration` BOOLEAN NOT NULL DEFAULT false,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LessonReport_lessonId_key`(`lessonId`),
    INDEX `LessonReport_tutorId_idx`(`tutorId`),
    INDEX `LessonReport_studentId_idx`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Timesheet` (
    `id` VARCHAR(191) NOT NULL,
    `tutorId` VARCHAR(191) NOT NULL,
    `monthCovered` INTEGER NOT NULL,
    `yearCovered` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'REJECTED', 'PAID') NOT NULL DEFAULT 'DRAFT',
    `totalLessons` INTEGER NOT NULL DEFAULT 0,
    `totalStudents` INTEGER NOT NULL DEFAULT 0,
    `totalSubjects` INTEGER NOT NULL DEFAULT 0,
    `totalHours` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `totalAmountDue` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `standardTutoringTotal` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `shadowSessionTotal` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `nvqSupportTotal` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `adjustmentsTotal` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `finalAmountPayable` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `tutorNotes` TEXT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `paidById` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `paymentDate` DATETIME(3) NULL,
    `transactionReference` VARCHAR(191) NULL,
    `returnReason` TEXT NULL,
    `rejectionReason` TEXT NULL,
    `submittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Timesheet_tutorId_idx`(`tutorId`),
    INDEX `Timesheet_status_idx`(`status`),
    INDEX `Timesheet_reviewedById_idx`(`reviewedById`),
    INDEX `Timesheet_approvedById_idx`(`approvedById`),
    INDEX `Timesheet_paidById_idx`(`paidById`),
    UNIQUE INDEX `Timesheet_tutorId_monthCovered_yearCovered_key`(`tutorId`, `monthCovered`, `yearCovered`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TimesheetEntry` (
    `id` VARCHAR(191) NOT NULL,
    `timesheetId` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `lessonTime` VARCHAR(191) NOT NULL,
    `studentName` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `lessonType` VARCHAR(191) NOT NULL,
    `durationMinutes` INTEGER NULL,
    `hoursTaught` DECIMAL(6, 2) NOT NULL,
    `rateType` VARCHAR(191) NULL,
    `rate` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'GBP',
    `amountDue` DECIMAL(10, 2) NOT NULL,
    `attendanceStatus` VARCHAR(191) NULL,
    `reportStatus` VARCHAR(191) NULL,
    `paymentEligibility` VARCHAR(191) NOT NULL DEFAULT 'REVIEW',
    `eligibilityReason` TEXT NULL,
    `lessonReportSubmitted` BOOLEAN NOT NULL DEFAULT false,
    `source` VARCHAR(191) NOT NULL DEFAULT 'GENERATED',
    `tutorFlagType` VARCHAR(191) NULL,
    `tutorFlagNote` TEXT NULL,
    `adminReviewNote` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TimesheetEntry_timesheetId_idx`(`timesheetId`),
    INDEX `TimesheetEntry_lessonId_idx`(`lessonId`),
    INDEX `TimesheetEntry_paymentEligibility_idx`(`paymentEligibility`),
    INDEX `TimesheetEntry_source_idx`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TimesheetAdjustment` (
    `id` VARCHAR(191) NOT NULL,
    `timesheetId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'GBP',
    `reason` TEXT NOT NULL,
    `approvedById` VARCHAR(191) NOT NULL,
    `approvedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TimesheetAdjustment_timesheetId_idx`(`timesheetId`),
    INDEX `TimesheetAdjustment_approvedById_idx`(`approvedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `studentId` VARCHAR(191) NULL,
    `feePlanId` VARCHAR(191) NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PART_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID') NOT NULL DEFAULT 'DRAFT',
    `service` VARCHAR(191) NOT NULL DEFAULT 'Tutoring support',
    `billingPeriodStart` DATETIME(3) NULL,
    `billingPeriodEnd` DATETIME(3) NULL,
    `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1,
    `rate` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'GBP',
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `taxAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `amountPaid` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `balanceDue` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `dueDate` DATETIME(3) NULL,
    `issuedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Invoice_invoiceNumber_key`(`invoiceNumber`),
    INDEX `Invoice_parentId_idx`(`parentId`),
    INDEX `Invoice_studentId_idx`(`studentId`),
    INDEX `Invoice_feePlanId_idx`(`feePlanId`),
    INDEX `Invoice_status_idx`(`status`),
    INDEX `Invoice_dueDate_idx`(`dueDate`),
    INDEX `Invoice_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'PAYMENT',
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'GBP',
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CORRECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `paymentMethod` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NULL,
    `providerPaymentId` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `transactionReference` VARCHAR(191) NULL,
    `receivedById` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `metadata` JSON NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Payment_invoiceId_idx`(`invoiceId`),
    INDEX `Payment_status_idx`(`status`),
    INDEX `Payment_kind_idx`(`kind`),
    INDEX `Payment_paidAt_idx`(`paidAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Receipt` (
    `id` VARCHAR(191) NOT NULL,
    `receiptNumber` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `amountInWords` TEXT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'GBP',
    `paymentMethod` VARCHAR(191) NOT NULL,
    `transactionReference` VARCHAR(191) NULL,
    `dateReceived` DATETIME(3) NOT NULL,
    `service` VARCHAR(191) NOT NULL,
    `periodCovered` VARCHAR(191) NULL,
    `authorisedConfirmation` BOOLEAN NOT NULL DEFAULT true,
    `authorisedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Receipt_receiptNumber_key`(`receiptNumber`),
    UNIQUE INDEX `Receipt_paymentId_key`(`paymentId`),
    INDEX `Receipt_invoiceId_idx`(`invoiceId`),
    INDEX `Receipt_parentId_idx`(`parentId`),
    INDEX `Receipt_studentId_idx`(`studentId`),
    INDEX `Receipt_authorisedById_idx`(`authorisedById`),
    INDEX `Receipt_dateReceived_idx`(`dateReceived`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeePlan` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `planType` VARCHAR(191) NOT NULL,
    `service` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `subjectId` VARCHAR(191) NULL,
    `examPathway` VARCHAR(191) NULL,
    `billingFrequency` VARCHAR(191) NULL,
    `defaultQuantity` DECIMAL(10, 2) NOT NULL DEFAULT 1,
    `defaultRate` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'GBP',
    `discountType` VARCHAR(191) NULL,
    `discountAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `scholarshipOrConcession` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FeePlan_planType_idx`(`planType`),
    INDEX `FeePlan_subjectId_idx`(`subjectId`),
    INDEX `FeePlan_examPathway_idx`(`examPathway`),
    INDEX `FeePlan_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Homework` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `tutorId` VARCHAR(191) NULL,
    `lessonId` VARCHAR(191) NULL,
    `subjectId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `details` TEXT NOT NULL,
    `instructions` TEXT NULL,
    `gradingCriteria` TEXT NULL,
    `maxMarks` DECIMAL(6, 2) NULL,
    `mark` DECIMAL(6, 2) NULL,
    `feedback` TEXT NULL,
    `attachments` JSON NULL,
    `dueDate` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'ASSIGNED', 'SUBMITTED', 'LATE', 'REVIEWED', 'RESUBMISSION_REQUIRED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ASSIGNED',
    `publishedAt` DATETIME(3) NULL,
    `submittedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `resubmissionRequestedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Homework_studentId_idx`(`studentId`),
    INDEX `Homework_tutorId_idx`(`tutorId`),
    INDEX `Homework_lessonId_idx`(`lessonId`),
    INDEX `Homework_subjectId_idx`(`subjectId`),
    INDEX `Homework_status_idx`(`status`),
    INDEX `Homework_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeworkSubmission` (
    `id` VARCHAR(191) NOT NULL,
    `homeworkId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `submittedById` VARCHAR(191) NULL,
    `comments` TEXT NULL,
    `fileKey` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NULL,
    `fileMimeType` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SUBMITTED',
    `mark` DECIMAL(6, 2) NULL,
    `feedback` TEXT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HomeworkSubmission_homeworkId_idx`(`homeworkId`),
    INDEX `HomeworkSubmission_studentId_idx`(`studentId`),
    INDEX `HomeworkSubmission_submittedById_idx`(`submittedById`),
    INDEX `HomeworkSubmission_reviewedById_idx`(`reviewedById`),
    INDEX `HomeworkSubmission_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Resource` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `url` VARCHAR(2048) NULL,
    `fileKey` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NULL,
    `fileMimeType` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `resourceType` ENUM('DOCUMENT', 'PDF', 'PRESENTATION', 'WORKSHEET', 'IMAGE', 'APPROVED_LINK', 'VIDEO', 'OTHER') NOT NULL DEFAULT 'DOCUMENT',
    `visibility` ENUM('INTERNAL', 'TUTORS', 'PARENTS', 'STUDENTS') NOT NULL DEFAULT 'INTERNAL',
    `subjectId` VARCHAR(191) NULL,
    `tutorId` VARCHAR(191) NULL,
    `studentId` VARCHAR(191) NULL,
    `lessonId` VARCHAR(191) NULL,
    `yearGroup` VARCHAR(191) NULL,
    `examPathway` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdById` VARCHAR(191) NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Resource_subjectId_idx`(`subjectId`),
    INDEX `Resource_tutorId_idx`(`tutorId`),
    INDEX `Resource_studentId_idx`(`studentId`),
    INDEX `Resource_lessonId_idx`(`lessonId`),
    INDEX `Resource_createdById_idx`(`createdById`),
    INDEX `Resource_approvedById_idx`(`approvedById`),
    INDEX `Resource_resourceType_idx`(`resourceType`),
    INDEX `Resource_visibility_idx`(`visibility`),
    INDEX `Resource_status_idx`(`status`),
    INDEX `Resource_yearGroup_idx`(`yearGroup`),
    INDEX `Resource_examPathway_idx`(`examPathway`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgressRecord` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `tutorId` VARCHAR(191) NULL,
    `subjectId` VARCHAR(191) NULL,
    `learningGoals` TEXT NOT NULL,
    `baselineLevel` VARCHAR(191) NULL,
    `currentLevel` VARCHAR(191) NULL,
    `skillsAchieved` TEXT NULL,
    `areasForImprovement` TEXT NULL,
    `tutorComments` TEXT NULL,
    `parentSummary` TEXT NULL,
    `parentVisible` BOOLEAN NOT NULL DEFAULT false,
    `reviewDate` DATETIME(3) NOT NULL,
    `goalStatus` VARCHAR(191) NOT NULL DEFAULT 'IN_PROGRESS',
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProgressRecord_studentId_idx`(`studentId`),
    INDEX `ProgressRecord_tutorId_idx`(`tutorId`),
    INDEX `ProgressRecord_subjectId_idx`(`subjectId`),
    INDEX `ProgressRecord_goalStatus_idx`(`goalStatus`),
    INDEX `ProgressRecord_reviewDate_idx`(`reviewDate`),
    INDEX `ProgressRecord_parentVisible_idx`(`parentVisible`),
    INDEX `ProgressRecord_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `recipientId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `category` VARCHAR(191) NULL,
    `entityType` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `emailSentAt` DATETIME(3) NULL,
    `status` ENUM('UNREAD', 'READ', 'ARCHIVED') NOT NULL DEFAULT 'UNREAD',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `readAt` DATETIME(3) NULL,

    INDEX `Notification_recipientId_idx`(`recipientId`),
    INDEX `Notification_createdById_idx`(`createdById`),
    INDEX `Notification_category_idx`(`category`),
    INDEX `Notification_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `Notification_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SafeguardingConcern` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NULL,
    `tutorId` VARCHAR(191) NULL,
    `lessonId` VARCHAR(191) NULL,
    `lessonReportId` VARCHAR(191) NULL,
    `reportedById` VARCHAR(191) NULL,
    `resolvedById` VARCHAR(191) NULL,
    `status` ENUM('OPEN', 'REVIEWING', 'RESOLVED', 'ESCALATED') NOT NULL DEFAULT 'OPEN',
    `summary` TEXT NOT NULL,
    `restrictedNotes` TEXT NULL,
    `reportedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SafeguardingConcern_studentId_idx`(`studentId`),
    INDEX `SafeguardingConcern_tutorId_idx`(`tutorId`),
    INDEX `SafeguardingConcern_lessonId_idx`(`lessonId`),
    INDEX `SafeguardingConcern_lessonReportId_idx`(`lessonReportId`),
    INDEX `SafeguardingConcern_reportedById_idx`(`reportedById`),
    INDEX `SafeguardingConcern_resolvedById_idx`(`resolvedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LessonObservation` (
    `id` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NULL,
    `tutorId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NULL,
    `observationDate` DATETIME(3) NOT NULL,
    `focusArea` VARCHAR(191) NULL,
    `rating` VARCHAR(191) NULL,
    `strengths` TEXT NULL,
    `improvementAreas` TEXT NULL,
    `reviewerNotes` TEXT NULL,
    `nextReviewDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LessonObservation_lessonId_idx`(`lessonId`),
    INDEX `LessonObservation_tutorId_idx`(`tutorId`),
    INDEX `LessonObservation_reviewerId_idx`(`reviewerId`),
    INDEX `LessonObservation_observationDate_idx`(`observationDate`),
    INDEX `LessonObservation_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TutorReview` (
    `id` VARCHAR(191) NOT NULL,
    `tutorId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NULL,
    `reviewDate` DATETIME(3) NOT NULL,
    `rating` VARCHAR(191) NULL,
    `lessonsAssigned` INTEGER NOT NULL DEFAULT 0,
    `lessonsCompleted` INTEGER NOT NULL DEFAULT 0,
    `attendanceRate` DECIMAL(6, 2) NULL,
    `punctualityRate` DECIMAL(6, 2) NULL,
    `reportSubmissionRate` DECIMAL(6, 2) NULL,
    `homeworkFeedbackRate` DECIMAL(6, 2) NULL,
    `studentRetention` DECIMAL(6, 2) NULL,
    `complaints` INTEGER NOT NULL DEFAULT 0,
    `qualityReviewNotes` TEXT NULL,
    `nextReviewDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TutorReview_tutorId_idx`(`tutorId`),
    INDEX `TutorReview_reviewerId_idx`(`reviewerId`),
    INDEX `TutorReview_reviewDate_idx`(`reviewDate`),
    INDEX `TutorReview_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrainingRecord` (
    `id` VARCHAR(191) NOT NULL,
    `tutorId` VARCHAR(191) NOT NULL,
    `recordedById` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NULL,
    `trainingDate` DATETIME(3) NULL,
    `completionDate` DATETIME(3) NULL,
    `expiryDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PLANNED',
    `certificateFileKey` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TrainingRecord_tutorId_idx`(`tutorId`),
    INDEX `TrainingRecord_recordedById_idx`(`recordedById`),
    INDEX `TrainingRecord_status_idx`(`status`),
    INDEX `TrainingRecord_expiryDate_idx`(`expiryDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PolicyAcknowledgement` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `recordedById` VARCHAR(191) NULL,
    `policyName` VARCHAR(191) NOT NULL,
    `policyVersion` VARCHAR(191) NOT NULL,
    `acknowledgedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PolicyAcknowledgement_userId_idx`(`userId`),
    INDEX `PolicyAcknowledgement_recordedById_idx`(`recordedById`),
    INDEX `PolicyAcknowledgement_policyName_idx`(`policyName`),
    INDEX `PolicyAcknowledgement_acknowledgedAt_idx`(`acknowledgedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImprovementPlan` (
    `id` VARCHAR(191) NOT NULL,
    `tutorId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `concernSummary` TEXT NOT NULL,
    `requiredActions` TEXT NOT NULL,
    `supportOffered` TEXT NULL,
    `dueDate` DATETIME(3) NULL,
    `reviewDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `reviewerNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ImprovementPlan_tutorId_idx`(`tutorId`),
    INDEX `ImprovementPlan_reviewerId_idx`(`reviewerId`),
    INDEX `ImprovementPlan_status_idx`(`status`),
    INDEX `ImprovementPlan_dueDate_idx`(`dueDate`),
    INDEX `ImprovementPlan_reviewDate_idx`(`reviewDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsentRecord` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `parentId` VARCHAR(191) NULL,
    `studentId` VARCHAR(191) NULL,
    `consentType` VARCHAR(191) NOT NULL,
    `granted` BOOLEAN NOT NULL DEFAULT true,
    `legalBasis` TEXT NULL,
    `recordedById` VARCHAR(191) NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiryDate` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ConsentRecord_userId_idx`(`userId`),
    INDEX `ConsentRecord_parentId_idx`(`parentId`),
    INDEX `ConsentRecord_studentId_idx`(`studentId`),
    INDEX `ConsentRecord_consentType_idx`(`consentType`),
    INDEX `ConsentRecord_granted_idx`(`granted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DataRetentionConfig` (
    `id` VARCHAR(191) NOT NULL,
    `recordType` VARCHAR(191) NOT NULL,
    `retentionMonths` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL DEFAULT 'REVIEW',
    `legalBasis` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `updatedById` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DataRetentionConfig_recordType_key`(`recordType`),
    INDEX `DataRetentionConfig_active_idx`(`active`),
    INDEX `DataRetentionConfig_updatedById_idx`(`updatedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DataProtectionRequest` (
    `id` VARCHAR(191) NOT NULL,
    `requesterId` VARCHAR(191) NULL,
    `parentId` VARCHAR(191) NULL,
    `studentId` VARCHAR(191) NULL,
    `requestType` VARCHAR(191) NOT NULL,
    `scope` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueAt` DATETIME(3) NULL,
    `handledById` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `responseNotes` TEXT NULL,
    `internalNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DataProtectionRequest_requesterId_idx`(`requesterId`),
    INDEX `DataProtectionRequest_parentId_idx`(`parentId`),
    INDEX `DataProtectionRequest_studentId_idx`(`studentId`),
    INDEX `DataProtectionRequest_requestType_idx`(`requestType`),
    INDEX `DataProtectionRequest_status_idx`(`status`),
    INDEX `DataProtectionRequest_dueAt_idx`(`dueAt`),
    INDEX `DataProtectionRequest_handledById_idx`(`handledById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_actorId_idx`(`actorId`),
    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_PermissionToRole` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_PermissionToRole_AB_unique`(`A`, `B`),
    INDEX `_PermissionToRole_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_StudentToSubject` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_StudentToSubject_AB_unique`(`A`, `B`),
    INDEX `_StudentToSubject_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_SubjectToTutor` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_SubjectToTutor_AB_unique`(`A`, `B`),
    INDEX `_SubjectToTutor_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_LessonParticipants` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_LessonParticipants_AB_unique`(`A`, `B`),
    INDEX `_LessonParticipants_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_HomeworkToResource` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_HomeworkToResource_AB_unique`(`A`, `B`),
    INDEX `_HomeworkToResource_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailVerificationToken` ADD CONSTRAINT `EmailVerificationToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Parent` ADD CONSTRAINT `Parent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Parent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportRequest` ADD CONSTRAINT `SupportRequest_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportRequest` ADD CONSTRAINT `SupportRequest_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Parent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportRequest` ADD CONSTRAINT `SupportRequest_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportRequest` ADD CONSTRAINT `SupportRequest_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tutor` ADD CONSTRAINT `Tutor_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TutorRate` ADD CONSTRAINT `TutorRate_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Tutor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TutorRate` ADD CONSTRAINT `TutorRate_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentTutorAssignment` ADD CONSTRAINT `StudentTutorAssignment_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentTutorAssignment` ADD CONSTRAINT `StudentTutorAssignment_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Tutor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentTutorAssignment` ADD CONSTRAINT `StudentTutorAssignment_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TutorAvailability` ADD CONSTRAINT `TutorAvailability_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Tutor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TutorAvailability` ADD CONSTRAINT `TutorAvailability_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TutorAvailabilityException` ADD CONSTRAINT `TutorAvailabilityException_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Tutor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TutorAvailabilityException` ADD CONSTRAINT `TutorAvailabilityException_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lesson` ADD CONSTRAINT `Lesson_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lesson` ADD CONSTRAINT `Lesson_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Tutor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lesson` ADD CONSTRAINT `Lesson_replacementTutorId_fkey` FOREIGN KEY (`replacementTutorId`) REFERENCES `Tutor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lesson` ADD CONSTRAINT `Lesson_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lesson` ADD CONSTRAINT `Lesson_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Parent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lesson` ADD CONSTRAINT `Lesson_rescheduledFromId_fkey` FOREIGN KEY (`rescheduledFromId`) REFERENCES `Lesson`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lesson` ADD CONSTRAINT `Lesson_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LessonReport` ADD CONSTRAINT `LessonReport_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LessonReport` ADD CONSTRAINT `LessonReport_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Tutor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LessonReport` ADD CONSTRAINT `LessonReport_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Timesheet` ADD CONSTRAINT `Timesheet_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Tutor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Timesheet` ADD CONSTRAINT `Timesheet_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Timesheet` ADD CONSTRAINT `Timesheet_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Timesheet` ADD CONSTRAINT `Timesheet_paidById_fkey` FOREIGN KEY (`paidById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimesheetEntry` ADD CONSTRAINT `TimesheetEntry_timesheetId_fkey` FOREIGN KEY (`timesheetId`) REFERENCES `Timesheet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimesheetEntry` ADD CONSTRAINT `TimesheetEntry_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimesheetAdjustment` ADD CONSTRAINT `TimesheetAdjustment_timesheetId_fkey` FOREIGN KEY (`timesheetId`) REFERENCES `Timesheet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimesheetAdjustment` ADD CONSTRAINT `TimesheetAdjustment_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Parent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_feePlanId_fkey` FOREIGN KEY (`feePlanId`) REFERENCES `FeePlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receipt` ADD CONSTRAINT `Receipt_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receipt` ADD CONSTRAINT `Receipt_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receipt` ADD CONSTRAINT `Receipt_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Parent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receipt` ADD CONSTRAINT `Receipt_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receipt` ADD CONSTRAINT `Receipt_authorisedById_fkey` FOREIGN KEY (`authorisedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeePlan` ADD CONSTRAINT `FeePlan_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Homework` ADD CONSTRAINT `Homework_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Homework` ADD CONSTRAINT `Homework_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Tutor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Homework` ADD CONSTRAINT `Homework_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Homework` ADD CONSTRAINT `Homework_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeworkSubmission` ADD CONSTRAINT `HomeworkSubmission_homeworkId_fkey` FOREIGN KEY (`homeworkId`) REFERENCES `Homework`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeworkSubmission` ADD CONSTRAINT `HomeworkSubmission_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeworkSubmission` ADD CONSTRAINT `HomeworkSubmission_submittedById_fkey` FOREIGN KEY (`submittedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeworkSubmission` ADD CONSTRAINT `HomeworkSubmission_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Tutor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgressRecord` ADD CONSTRAINT `ProgressRecord_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgressRecord` ADD CONSTRAINT `ProgressRecord_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Tutor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgressRecord` ADD CONSTRAINT `ProgressRecord_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgressRecord` ADD CONSTRAINT `ProgressRecord_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SafeguardingConcern` ADD CONSTRAINT `SafeguardingConcern_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SafeguardingConcern` ADD CONSTRAINT `SafeguardingConcern_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Tutor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SafeguardingConcern` ADD CONSTRAINT `SafeguardingConcern_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SafeguardingConcern` ADD CONSTRAINT `SafeguardingConcern_lessonReportId_fkey` FOREIGN KEY (`lessonReportId`) REFERENCES `LessonReport`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SafeguardingConcern` ADD CONSTRAINT `SafeguardingConcern_reportedById_fkey` FOREIGN KEY (`reportedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SafeguardingConcern` ADD CONSTRAINT `SafeguardingConcern_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LessonObservation` ADD CONSTRAINT `LessonObservation_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LessonObservation` ADD CONSTRAINT `LessonObservation_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Tutor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LessonObservation` ADD CONSTRAINT `LessonObservation_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TutorReview` ADD CONSTRAINT `TutorReview_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Tutor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TutorReview` ADD CONSTRAINT `TutorReview_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingRecord` ADD CONSTRAINT `TrainingRecord_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Tutor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingRecord` ADD CONSTRAINT `TrainingRecord_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PolicyAcknowledgement` ADD CONSTRAINT `PolicyAcknowledgement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PolicyAcknowledgement` ADD CONSTRAINT `PolicyAcknowledgement_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImprovementPlan` ADD CONSTRAINT `ImprovementPlan_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `Tutor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImprovementPlan` ADD CONSTRAINT `ImprovementPlan_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsentRecord` ADD CONSTRAINT `ConsentRecord_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsentRecord` ADD CONSTRAINT `ConsentRecord_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Parent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsentRecord` ADD CONSTRAINT `ConsentRecord_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsentRecord` ADD CONSTRAINT `ConsentRecord_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataRetentionConfig` ADD CONSTRAINT `DataRetentionConfig_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataProtectionRequest` ADD CONSTRAINT `DataProtectionRequest_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataProtectionRequest` ADD CONSTRAINT `DataProtectionRequest_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Parent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataProtectionRequest` ADD CONSTRAINT `DataProtectionRequest_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataProtectionRequest` ADD CONSTRAINT `DataProtectionRequest_handledById_fkey` FOREIGN KEY (`handledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_PermissionToRole` ADD CONSTRAINT `_PermissionToRole_A_fkey` FOREIGN KEY (`A`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_PermissionToRole` ADD CONSTRAINT `_PermissionToRole_B_fkey` FOREIGN KEY (`B`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_StudentToSubject` ADD CONSTRAINT `_StudentToSubject_A_fkey` FOREIGN KEY (`A`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_StudentToSubject` ADD CONSTRAINT `_StudentToSubject_B_fkey` FOREIGN KEY (`B`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_SubjectToTutor` ADD CONSTRAINT `_SubjectToTutor_A_fkey` FOREIGN KEY (`A`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_SubjectToTutor` ADD CONSTRAINT `_SubjectToTutor_B_fkey` FOREIGN KEY (`B`) REFERENCES `Tutor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_LessonParticipants` ADD CONSTRAINT `_LessonParticipants_A_fkey` FOREIGN KEY (`A`) REFERENCES `Lesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_LessonParticipants` ADD CONSTRAINT `_LessonParticipants_B_fkey` FOREIGN KEY (`B`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_HomeworkToResource` ADD CONSTRAINT `_HomeworkToResource_A_fkey` FOREIGN KEY (`A`) REFERENCES `Homework`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_HomeworkToResource` ADD CONSTRAINT `_HomeworkToResource_B_fkey` FOREIGN KEY (`B`) REFERENCES `Resource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
