import { getPrisma } from "./db.js";
import { auditLog, requireAnyPermission } from "./authMiddleware.js";
import { hasPermission } from "./roles.js";

const payrollAccessPermissions = ["timesheets:manage", "finance:manage", "own:timesheets", "own:payments"];
const payrollManagePermissions = ["timesheets:manage", "finance:manage"];
const rateTypes = [
  { key: "STANDARD_HOURLY", label: "Standard hourly tutoring rate", calculation: "HOURLY" },
  { key: "SHADOW_SESSION_FLAT", label: "Online shadow-session flat rate", calculation: "FLAT" },
  { key: "NVQ_PER_UNIT", label: "NVQ per-unit rate", calculation: "FLAT" },
  { key: "CUSTOM", label: "Other approved custom rate", calculation: "HOURLY" },
];
const rateTypeKeys = new Set(rateTypes.map((rateType) => rateType.key));
const timesheetStatuses = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED", "APPROVED", "PAID", "REJECTED"];
const reviewStatuses = ["UNDER_REVIEW", "RETURNED", "APPROVED", "PAID", "REJECTED"];
const payableLessonStatuses = ["COMPLETED"];
const generatedTimesheetStatuses = ["DRAFT", "RETURNED"];
const tutorFlagTypes = ["MISSING_LESSON", "INCORRECT_DURATION", "INCORRECT_RATE", "OTHER"];

const timesheetListInclude = {
  tutor: { select: { id: true, fullName: true, email: true, userId: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  paidBy: { select: { id: true, name: true, email: true } },
  _count: { select: { entries: true, adjustments: true } },
};

const timesheetDetailInclude = {
  tutor: { select: { id: true, fullName: true, email: true, userId: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  paidBy: { select: { id: true, name: true, email: true } },
  entries: {
    include: {
      lesson: {
        include: {
          student: { select: { id: true, fullName: true } },
          students: { select: { id: true, fullName: true } },
          subject: { select: { id: true, name: true } },
          report: { select: { id: true, submittedAt: true } },
        },
      },
    },
    orderBy: [{ date: "asc" }, { lessonTime: "asc" }],
  },
  adjustments: {
    include: {
      approvedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  },
};

export function registerPayrollRoutes(app, { sendPortalEmail } = {}) {
  app.get("/api/portal/payroll/lookups", requireAnyPermission(payrollAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const tutors = await lookupTutors(prisma, request);
      response.json({
        ok: true,
        tutors,
        rateTypes,
        timesheetStatuses,
        paymentEligibilityOptions: ["PAYABLE", "REVIEW", "NOT_PAYABLE"],
        tutorFlagTypes,
      });
    } catch (error) {
      handlePayrollError(error, response, next);
    }
  });

  app.get("/api/portal/tutor-rates", requireAnyPermission(payrollAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const where = await tutorRateScopeWhere(prisma, request);
      const rates = await prisma.tutorRate.findMany({
        where: { AND: [where, buildTutorRateWhere(request.query)] },
        include: {
          tutor: { select: { id: true, fullName: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ tutor: { fullName: "asc" } }, { effectiveDate: "desc" }],
        take: 300,
      });
      response.json({ ok: true, rates });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/tutor-rates", requireAnyPermission(payrollManagePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const data = parseTutorRateInput(request.body, request.portalUser.id);
      const rate = await prisma.tutorRate.create({
        data,
        include: {
          tutor: { select: { id: true, fullName: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      });
      await auditLog({
        request,
        actorId: request.portalUser.id,
        action: "tutor_rate_created",
        entityType: "TutorRate",
        entityId: rate.id,
        metadata: { tutorId: rate.tutorId, rateType: rate.rateType, effectiveDate: rate.effectiveDate },
      });
      response.status(201).json({ ok: true, rate });
    } catch (error) {
      handlePayrollError(error, response, next);
    }
  });

  app.get("/api/portal/timesheets", requireAnyPermission(payrollAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const where = await timesheetScopeWhere(prisma, request);
      const timesheets = await prisma.timesheet.findMany({
        where: { AND: [where, buildTimesheetWhere(request.query, request.portalUser)] },
        include: timesheetListInclude,
        orderBy: [{ yearCovered: "desc" }, { monthCovered: "desc" }, { updatedAt: "desc" }],
        take: 200,
      });
      response.json({ ok: true, timesheets });
    } catch (error) {
      handlePayrollError(error, response, next);
    }
  });

  app.post("/api/portal/timesheets/generate", requireAnyPermission(["timesheets:manage", "finance:manage", "own:timesheets"]), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const { month, year } = parseMonthYear(request.body);
      const tutorId = await resolveTutorIdForRequest(prisma, request, request.body?.tutorId);
      const timesheet = await generateTimesheet({ prisma, request, tutorId, month, year });
      await auditLog({
        request,
        actorId: request.portalUser.id,
        action: "timesheet_generated",
        entityType: "Timesheet",
        entityId: timesheet.id,
        metadata: { tutorId, month, year, totalLessons: timesheet.totalLessons },
      });
      response.status(201).json({ ok: true, timesheet });
    } catch (error) {
      handlePayrollError(error, response, next);
    }
  });

  app.get("/api/portal/timesheets/:id", requireAnyPermission(payrollAccessPermissions), async (request, response, next) => {
    try {
      const timesheet = await findTimesheetForRequest(getPrisma(), request, request.params.id);
      response.json({ ok: true, timesheet });
    } catch (error) {
      handlePayrollError(error, response, next);
    }
  });

  app.post("/api/portal/timesheets/:id/submit", requireAnyPermission(["timesheets:manage", "finance:manage", "own:timesheets"]), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const existing = await findTimesheetForRequest(prisma, request, request.params.id);
      if (!generatedTimesheetStatuses.includes(existing.status)) {
        throw new ValidationError("Only draft or returned timesheets can be submitted.");
      }
      if (existing.entries.length === 0) {
        throw new ValidationError("Generate lesson rows before submitting this timesheet.");
      }
      if (!parseBoolean(request.body?.declaration)) {
        throw new ValidationError("Tutor declaration is required before submission.");
      }

      const timesheet = await prisma.timesheet.update({
        where: { id: existing.id },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          tutorNotes: optional(request.body?.tutorNotes),
          returnReason: null,
          rejectionReason: null,
        },
        include: timesheetDetailInclude,
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "timesheet_submitted", entityType: "Timesheet", entityId: timesheet.id });
      response.json({ ok: true, timesheet });
    } catch (error) {
      handlePayrollError(error, response, next);
    }
  });

  app.post("/api/portal/timesheets/:id/flag-entry", requireAnyPermission(["timesheets:manage", "finance:manage", "own:timesheets"]), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const timesheet = await findTimesheetForRequest(prisma, request, request.params.id);
      if (timesheet.status === "APPROVED" || timesheet.status === "PAID" || timesheet.status === "REJECTED") {
        throw new ValidationError("Approved, paid, or rejected timesheets can no longer be flagged by tutors.");
      }
      const entryId = required(request.body?.entryId, "Timesheet row is required.");
      const flagType = parseOption(request.body?.flagType, tutorFlagTypes, "Select a valid flag type.");
      const note = required(request.body?.note, "A note is required when flagging a timesheet row.");
      const entry = await prisma.timesheetEntry.findFirst({ where: { id: entryId, timesheetId: timesheet.id } });
      if (!entry) {
        throw new NotFoundError("Timesheet row not found.");
      }
      await prisma.timesheetEntry.update({
        where: { id: entry.id },
        data: { tutorFlagType: flagType, tutorFlagNote: note },
      });
      const updated = await prisma.timesheet.findUnique({ where: { id: timesheet.id }, include: timesheetDetailInclude });
      await auditLog({ request, actorId: request.portalUser.id, action: "timesheet_entry_flagged", entityType: "TimesheetEntry", entityId: entry.id, metadata: { timesheetId: timesheet.id, flagType } });
      response.json({ ok: true, timesheet: updated });
    } catch (error) {
      handlePayrollError(error, response, next);
    }
  });

  app.post("/api/portal/timesheets/:id/adjustments", requireAnyPermission(payrollManagePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const timesheet = await findTimesheetForRequest(prisma, request, request.params.id, true);
      if (timesheet.status === "PAID") {
        throw new ValidationError("Paid timesheets cannot be adjusted.");
      }
      const amount = parseMoney(request.body?.amount, "Adjustment amount is required.");
      if (amount === 0) {
        throw new ValidationError("Adjustment amount cannot be zero.");
      }
      const reason = required(request.body?.reason, "Adjustment reason is required.");
      await prisma.timesheetAdjustment.create({
        data: {
          timesheetId: timesheet.id,
          amount,
          currency: parseCurrency(request.body?.currency || "GBP"),
          reason,
          approvedById: request.portalUser.id,
        },
      });
      const updated = await refreshTimesheetTotals(prisma, timesheet.id);
      await auditLog({ request, actorId: request.portalUser.id, action: "timesheet_adjustment_added", entityType: "Timesheet", entityId: timesheet.id, metadata: { amount, reason } });
      response.status(201).json({ ok: true, timesheet: updated });
    } catch (error) {
      handlePayrollError(error, response, next);
    }
  });

  app.post("/api/portal/timesheets/:id/status", requireAnyPermission(payrollManagePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const existing = await findTimesheetForRequest(prisma, request, request.params.id, true);
      const status = parseOption(request.body?.status, reviewStatuses, "Select a valid timesheet status.");
      await assertAdminCanChangeStatus(prisma, request, existing, status);

      const now = new Date();
      const update = { status };
      if (status === "UNDER_REVIEW") {
        update.reviewedById = request.portalUser.id;
        update.reviewedAt = now;
      }
      if (status === "RETURNED") {
        update.reviewedById = request.portalUser.id;
        update.reviewedAt = now;
        update.returnReason = required(request.body?.reason, "Return reason is required.");
      }
      if (status === "REJECTED") {
        update.reviewedById = request.portalUser.id;
        update.reviewedAt = now;
        update.rejectionReason = required(request.body?.reason, "Rejection reason is required.");
      }
      if (status === "APPROVED") {
        update.reviewedById = request.portalUser.id;
        update.reviewedAt = now;
        update.approvedById = request.portalUser.id;
        update.approvedAt = now;
      }
      if (status === "PAID") {
        if (existing.status !== "APPROVED") {
          throw new ValidationError("A timesheet must be approved before it can be marked as paid.");
        }
        update.paidById = request.portalUser.id;
        update.paidAt = now;
        update.paymentDate = requiredDate(request.body?.paymentDate, "Payment date is required.");
        update.transactionReference = required(request.body?.transactionReference, "Transaction reference is required.");
      }

      await refreshTimesheetTotals(prisma, existing.id);
      const updated = await prisma.timesheet.update({ where: { id: existing.id }, data: update, include: timesheetDetailInclude });
      await auditLog({ request, actorId: request.portalUser.id, action: "timesheet_status_updated", entityType: "Timesheet", entityId: updated.id, metadata: { status } });
      if (status === "RETURNED" || status === "APPROVED") {
        await notifyTutorTimesheetEvent({ prisma, request, timesheet: updated, sendPortalEmail, status });
      }
      response.json({ ok: true, timesheet: updated });
    } catch (error) {
      handlePayrollError(error, response, next);
    }
  });

  app.get("/api/portal/timesheets/:id/statement", requireAnyPermission(payrollAccessPermissions), async (request, response, next) => {
    try {
      const timesheet = await findTimesheetForRequest(getPrisma(), request, request.params.id);
      const text = buildPaymentStatement(timesheet);
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.setHeader("Content-Disposition", `attachment; filename="tutorhivehub-timesheet-${timesheet.monthCovered}-${timesheet.yearCovered}.txt"`);
      response.send(text);
    } catch (error) {
      handlePayrollError(error, response, next);
    }
  });
}

async function generateTimesheet({ prisma, request, tutorId, month, year }) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const existing = await prisma.timesheet.findUnique({ where: { tutorId_monthCovered_yearCovered: { tutorId, monthCovered: month, yearCovered: year } } });
  if (existing && !generatedTimesheetStatuses.includes(existing.status)) {
    throw new ValidationError("This timesheet has already been submitted for review and cannot be regenerated.");
  }

  const [lessons, rates] = await Promise.all([
    prisma.lesson.findMany({
      where: {
        scheduledStart: { gte: monthStart, lt: monthEnd },
        status: { in: payableLessonStatuses },
        reportStatus: "SUBMITTED",
        report: { isNot: null },
        OR: [{ replacementTutorId: tutorId }, { tutorId, replacementTutorId: null }],
      },
      include: {
        student: { select: { id: true, fullName: true } },
        students: { select: { id: true, fullName: true } },
        subject: { select: { id: true, name: true } },
        report: { select: { id: true } },
      },
      orderBy: { scheduledStart: "asc" },
    }),
    prisma.tutorRate.findMany({
      where: {
        tutorId,
        effectiveDate: { lt: monthEnd },
        OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
      },
      orderBy: { effectiveDate: "desc" },
    }),
  ]);

  const entriesData = lessons.map((lesson) => buildEntryFromLesson(lesson, rates));

  return prisma.$transaction(async (tx) => {
    const timesheet = existing
      ? await tx.timesheet.update({ where: { id: existing.id }, data: { status: "DRAFT" } })
      : await tx.timesheet.create({ data: { tutorId, monthCovered: month, yearCovered: year, status: "DRAFT" } });

    await tx.timesheetEntry.deleteMany({ where: { timesheetId: timesheet.id, source: "GENERATED" } });
    if (entriesData.length > 0) {
      await tx.timesheetEntry.createMany({ data: entriesData.map((entry) => ({ ...entry, timesheetId: timesheet.id })) });
    }

    return refreshTimesheetTotals(tx, timesheet.id);
  });
}

function buildEntryFromLesson(lesson, rates) {
  const rateType = rateTypeForLesson(lesson.lessonType);
  const applicableRate = findApplicableRate(rates, rateType, lesson.scheduledStart);
  const durationMinutes = lesson.durationMinutes || Math.round((new Date(lesson.scheduledEnd).getTime() - new Date(lesson.scheduledStart).getTime()) / 60000);
  const hours = round2(Math.max(durationMinutes, 0) / 60);
  const rateAmount = applicableRate ? decimalNumber(applicableRate.amount) : 0;
  const eligibility = paymentEligibility(lesson, applicableRate);
  const amountDue = eligibility.status === "PAYABLE" ? calculateAmount(rateType, hours, rateAmount) : 0;

  return {
    lessonId: lesson.id,
    date: startOfDay(lesson.scheduledStart),
    lessonTime: `${timeText(lesson.scheduledStart)}-${timeText(lesson.scheduledEnd)}`,
    studentName: lessonStudentNames(lesson),
    subject: lesson.subject?.name || "Subject not recorded",
    lessonType: lesson.lessonType,
    durationMinutes,
    hoursTaught: hours,
    rateType,
    rate: rateAmount,
    currency: applicableRate?.currency || "GBP",
    amountDue,
    attendanceStatus: attendanceSummary(lesson),
    reportStatus: lesson.report ? "SUBMITTED" : lesson.reportStatus || "NOT_DUE",
    paymentEligibility: eligibility.status,
    eligibilityReason: eligibility.reason,
    lessonReportSubmitted: Boolean(lesson.report || lesson.reportStatus === "SUBMITTED"),
    source: "GENERATED",
    notes: eligibility.reason,
  };
}

function paymentEligibility(lesson, applicableRate) {
  const hasReport = Boolean(lesson.report || lesson.reportStatus === "SUBMITTED");
  if (lesson.status === "TUTOR_ABSENT" || lesson.tutorAttendance === "Absent") {
    return { status: "NOT_PAYABLE", reason: "Tutor was absent." };
  }
  if (lesson.status === "CANCELLED") {
    return { status: "NOT_PAYABLE", reason: "Cancelled lessons require an authorised manual adjustment if payment is due." };
  }
  if (lesson.status === "STUDENT_ABSENT") {
    if (process.env.PORTAL_STUDENT_NO_SHOW_PAYABLE === "true" && applicableRate) {
      return { status: hasReport ? "PAYABLE" : "REVIEW", reason: hasReport ? "Student no-show payable under configured business rule." : "Student no-show is payable, but the daily report is missing." };
    }
    return { status: "REVIEW", reason: "Student no-show payment must be verified against the configured business rule." };
  }
  if (lesson.status !== "COMPLETED") {
    return { status: "REVIEW", reason: "Lesson is not marked completed." };
  }
  if (!hasReport) {
    return { status: "REVIEW", reason: "Daily lesson report is missing. Lessons without submitted daily reports are excluded from generated timesheets." };
  }
  if (!applicableRate) {
    return { status: "REVIEW", reason: "No approved historical rate was found for this lesson date and type." };
  }
  return { status: "PAYABLE", reason: "Completed and verified lesson." };
}

async function refreshTimesheetTotals(prisma, timesheetId) {
  const [entries, adjustments] = await Promise.all([
    prisma.timesheetEntry.findMany({ where: { timesheetId } }),
    prisma.timesheetAdjustment.findMany({ where: { timesheetId } }),
  ]);

  const payableEntries = entries.filter((entry) => entry.paymentEligibility === "PAYABLE");
  const standardTutoringTotal = sumMoney(payableEntries.filter((entry) => entry.rateType === "STANDARD_HOURLY").map((entry) => entry.amountDue));
  const shadowSessionTotal = sumMoney(payableEntries.filter((entry) => entry.rateType === "SHADOW_SESSION_FLAT").map((entry) => entry.amountDue));
  const nvqSupportTotal = sumMoney(payableEntries.filter((entry) => entry.rateType === "NVQ_PER_UNIT").map((entry) => entry.amountDue));
  const customTotal = sumMoney(payableEntries.filter((entry) => entry.rateType === "CUSTOM").map((entry) => entry.amountDue));
  const adjustmentsTotal = sumMoney(adjustments.map((adjustment) => adjustment.amount));
  const totalAmountDue = round2(standardTutoringTotal + shadowSessionTotal + nvqSupportTotal + customTotal);

  return prisma.timesheet.update({
    where: { id: timesheetId },
    data: {
      totalLessons: entries.length,
      totalStudents: uniqueCount(entries.map((entry) => entry.studentName)),
      totalSubjects: uniqueCount(entries.map((entry) => entry.subject)),
      totalHours: round2(entries.reduce((total, entry) => total + decimalNumber(entry.hoursTaught), 0)),
      totalAmountDue,
      standardTutoringTotal,
      shadowSessionTotal,
      nvqSupportTotal,
      adjustmentsTotal,
      finalAmountPayable: round2(totalAmountDue + adjustmentsTotal),
    },
    include: timesheetDetailInclude,
  });
}

async function findTimesheetForRequest(prisma, request, id, manageOnly = false) {
  const where = manageOnly ? {} : await timesheetScopeWhere(prisma, request);
  if (manageOnly && !canManagePayroll(request.portalUser)) {
    throw new ForbiddenError("Access denied.");
  }
  const timesheet = await prisma.timesheet.findFirst({ where: { AND: [{ id }, where] }, include: timesheetDetailInclude });
  if (!timesheet) {
    throw new NotFoundError("Timesheet not found.");
  }
  return timesheet;
}

async function assertAdminCanChangeStatus(prisma, request, timesheet, status) {
  if ((status === "APPROVED" || status === "PAID") && timesheet.tutor?.userId === request.portalUser.id) {
    throw new ForbiddenError("Tutors cannot approve or pay their own timesheets.");
  }
  if (status === "PAID" && !hasPermission(request.portalUser, "finance:manage")) {
    throw new ForbiddenError("Only finance users can mark timesheets as paid.");
  }
  const linkedTutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
  if (linkedTutor?.id === timesheet.tutorId && (status === "APPROVED" || status === "PAID")) {
    throw new ForbiddenError("Tutors cannot approve or pay their own timesheets.");
  }
}

async function resolveTutorIdForRequest(prisma, request, requestedTutorId) {
  if (canManagePayroll(request.portalUser)) {
    return required(requestedTutorId, "Tutor is required.");
  }
  if (hasPermission(request.portalUser, "own:timesheets")) {
    const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    if (!tutor) {
      throw new ForbiddenError("No tutor profile is linked to this portal account.");
    }
    if (requestedTutorId && requestedTutorId !== tutor.id) {
      throw new ForbiddenError("Tutors can only generate their own timesheets.");
    }
    return tutor.id;
  }
  throw new ForbiddenError("Access denied.");
}

async function lookupTutors(prisma, request) {
  if (canManagePayroll(request.portalUser)) {
    return prisma.tutor.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, email: true, status: true } });
  }
  const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true, fullName: true, email: true, status: true } });
  return tutor ? [tutor] : [];
}

async function timesheetScopeWhere(prisma, request) {
  if (canManagePayroll(request.portalUser)) {
    return {};
  }
  if (hasPermission(request.portalUser, "own:timesheets") || hasPermission(request.portalUser, "own:payments")) {
    const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    return tutor ? { tutorId: tutor.id } : { id: "__no_timesheet_scope__" };
  }
  return { id: "__no_timesheet_scope__" };
}

async function tutorRateScopeWhere(prisma, request) {
  if (canManagePayroll(request.portalUser)) {
    return {};
  }
  const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
  return tutor ? { tutorId: tutor.id } : { id: "__no_rate_scope__" };
}

function buildTimesheetWhere(query, user) {
  const filters = {};
  if (query.status) {
    filters.status = String(query.status);
  }
  if (query.month) {
    filters.monthCovered = parseInteger(query.month, 1, 12, "Month must be between 1 and 12.");
  }
  if (query.year) {
    filters.yearCovered = parseInteger(query.year, 2020, 2200, "Year must be valid.");
  }
  if (query.tutorId && canManagePayroll(user)) {
    filters.tutorId = String(query.tutorId);
  }
  return filters;
}

function buildTutorRateWhere(query) {
  return cleanData({
    tutorId: optional(query.tutorId),
    rateType: optional(query.rateType),
  });
}

function parseTutorRateInput(body, approvedById) {
  const rateType = parseOption(body?.rateType, [...rateTypeKeys], "Select a valid rate type.");
  const effectiveDate = requiredDate(body?.effectiveDate, "Effective date is required.");
  const endDate = optionalDate(body?.endDate);
  if (endDate && endDate < effectiveDate) {
    throw new ValidationError("Rate end date must be after the effective date.");
  }
  return cleanData({
    tutorId: required(body?.tutorId, "Tutor is required."),
    rateType,
    amount: parseMoney(body?.amount, "Rate amount is required."),
    currency: parseCurrency(body?.currency || "GBP"),
    effectiveDate,
    endDate,
    approvedById,
    approvedAt: new Date(),
    notes: optional(body?.notes),
  });
}

function parseMonthYear(body) {
  return {
    month: parseInteger(body?.month, 1, 12, "Month must be between 1 and 12."),
    year: parseInteger(body?.year, 2020, 2200, "Year must be valid."),
  };
}

function findApplicableRate(rates, rateType, date) {
  const lessonDate = new Date(date);
  return rates.find((rate) => rate.rateType === rateType && new Date(rate.effectiveDate) <= lessonDate && (!rate.endDate || new Date(rate.endDate) >= lessonDate));
}

function rateTypeForLesson(lessonType) {
  const normalised = String(lessonType || "").toLowerCase();
  if (normalised.includes("shadow")) {
    return "SHADOW_SESSION_FLAT";
  }
  if (normalised.includes("nvq")) {
    return "NVQ_PER_UNIT";
  }
  if (normalised.includes("other")) {
    return "CUSTOM";
  }
  return "STANDARD_HOURLY";
}

function calculateAmount(rateType, hours, rateAmount) {
  if (rateType === "SHADOW_SESSION_FLAT" || rateType === "NVQ_PER_UNIT") {
    return round2(rateAmount);
  }
  return round2(hours * rateAmount);
}

function canManagePayroll(user) {
  return hasPermission(user, "timesheets:manage") || hasPermission(user, "finance:manage");
}

function lessonStudentNames(lesson) {
  const students = lesson.students?.length ? lesson.students : [lesson.student];
  return students.map((student) => student?.fullName).filter(Boolean).join(", ") || "Student not recorded";
}

function attendanceSummary(lesson) {
  return [`Tutor: ${lesson.tutorAttendance || "Not Recorded"}`, `Student: ${lesson.studentAttendance || "Not Recorded"}`].join("; ");
}

function buildPaymentStatement(timesheet) {
  const lines = [
    "TutorHiveHub Monthly Timesheet Statement",
    "",
    `Tutor: ${timesheet.tutor?.fullName || "Not recorded"}`,
    `Month: ${monthName(timesheet.monthCovered)} ${timesheet.yearCovered}`,
    `Status: ${timesheet.status}`,
    "",
    "Totals",
    `Total lessons: ${timesheet.totalLessons}`,
    `Total students taught: ${timesheet.totalStudents}`,
    `Total subjects taught: ${timesheet.totalSubjects}`,
    `Total hours: ${moneyText(timesheet.totalHours)}`,
    `Standard tutoring total: ${moneyText(timesheet.standardTutoringTotal)}`,
    `Shadow-session total: ${moneyText(timesheet.shadowSessionTotal)}`,
    `NVQ-support total: ${moneyText(timesheet.nvqSupportTotal)}`,
    `Adjustments: ${moneyText(timesheet.adjustmentsTotal)}`,
    `Final amount payable: ${moneyText(timesheet.finalAmountPayable)}`,
    "",
    "Lesson Rows",
  ];

  for (const entry of timesheet.entries ?? []) {
    lines.push(
      [
        dateText(entry.date),
        entry.lessonTime,
        entry.studentName,
        entry.subject,
        entry.lessonType,
        `${moneyText(entry.hoursTaught)} hours`,
        entry.rateType || "No rate type",
        `Rate ${moneyText(entry.rate)} ${entry.currency}`,
        `Amount ${moneyText(entry.amountDue)} ${entry.currency}`,
        entry.attendanceStatus || "Attendance not recorded",
        entry.reportStatus || "Report status not recorded",
        entry.paymentEligibility,
        entry.eligibilityReason || "",
      ].join(" | "),
    );
  }

  if (timesheet.adjustments?.length) {
    lines.push("", "Adjustments");
    for (const adjustment of timesheet.adjustments) {
      lines.push(`${moneyText(adjustment.amount)} ${adjustment.currency} | ${adjustment.reason} | Approved by ${adjustment.approvedBy?.name || "authorised user"}`);
    }
  }

  if (timesheet.transactionReference) {
    lines.push("", `Payment reference: ${timesheet.transactionReference}`);
  }

  return `${lines.join("\n")}\n`;
}

function uniqueCount(values) {
  const items = new Set();
  for (const value of values) {
    for (const item of String(value || "").split(",")) {
      const cleaned = item.trim().toLowerCase();
      if (cleaned) {
        items.add(cleaned);
      }
    }
  }
  return items.size;
}

function sumMoney(values) {
  return round2(values.reduce((total, value) => total + decimalNumber(value), 0));
}

function decimalNumber(value) {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function moneyText(value) {
  return decimalNumber(value).toFixed(2);
}

function parseMoney(value, message) {
  const cleaned = required(value, message);
  const number = Number(cleaned);
  if (!Number.isFinite(number)) {
    throw new ValidationError(message);
  }
  return round2(number);
}

function parseCurrency(value) {
  const cleaned = required(value, "Currency is required.").toUpperCase();
  if (!/^[A-Z]{3}$/.test(cleaned)) {
    throw new ValidationError("Currency must use a three-letter code such as GBP.");
  }
  return cleaned;
}

function parseInteger(value, min, max, message) {
  const cleaned = required(value, message);
  const number = Number.parseInt(cleaned, 10);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ValidationError(message);
  }
  return number;
}

function parseOption(value, options, message) {
  const cleaned = required(value, message);
  if (!options.includes(cleaned)) {
    throw new ValidationError(message);
  }
  return cleaned;
}

function required(value, message) {
  const cleaned = optional(value);
  if (!cleaned) {
    throw new ValidationError(message);
  }
  return cleaned;
}

function optional(value) {
  const cleaned = String(value ?? "").trim();
  return cleaned || null;
}

function requiredDate(value, message) {
  const date = optionalDate(value);
  if (!date) {
    throw new ValidationError(message);
  }
  return date;
}

function optionalDate(value) {
  const cleaned = optional(value);
  if (!cleaned) {
    return null;
  }
  const date = new Date(`${cleaned}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Please enter a valid date.");
  }
  return date;
}

function parseBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "Yes";
}

function startOfDay(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function timeText(value) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function dateText(value) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

function monthName(month) {
  return new Intl.DateTimeFormat("en-GB", { month: "long" }).format(new Date(2026, Number(month) - 1, 1));
}

function cleanData(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null));
}

async function notifyTutorTimesheetEvent({ prisma, request, timesheet, sendPortalEmail, status }) {
  const recipientId = timesheet.tutor?.userId;
  if (!recipientId) {
    return;
  }

  const isApproved = status === "APPROVED";
  const title = isApproved ? "TutorHiveHub timesheet approved" : "TutorHiveHub timesheet returned";
  const message = isApproved
    ? `Your ${monthName(timesheet.monthCovered)} ${timesheet.yearCovered} timesheet has been approved.`
    : `Your ${monthName(timesheet.monthCovered)} ${timesheet.yearCovered} timesheet has been returned for correction.`;
  const category = isApproved ? "TIMESHEET_APPROVED" : "TIMESHEET_RETURNED";

  await prisma.notification.create({
    data: {
      recipientId,
      createdById: request.portalUser.id,
      title,
      message,
      category,
      entityType: "Timesheet",
      entityId: timesheet.id,
    },
  });

  if (!sendPortalEmail || !timesheet.tutor?.email) {
    return;
  }

  try {
    await sendPortalEmail({ to: timesheet.tutor.email, subject: title, text: message, html: `<p>${escapeHtml(message)}</p>` });
  } catch (error) {
    await auditLog({ request, actorId: request.portalUser.id, action: "timesheet_notification_email_failed", entityType: "Timesheet", entityId: timesheet.id, metadata: { email: timesheet.tutor.email, category, error: error instanceof Error ? error.message : String(error) } });
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function handlePayrollError(error, response, next) {
  if (error instanceof ValidationError) {
    response.status(422).json({ ok: false, message: error.message });
    return;
  }
  if (error instanceof ForbiddenError) {
    response.status(403).json({ ok: false, message: error.message });
    return;
  }
  if (error instanceof NotFoundError) {
    response.status(404).json({ ok: false, message: error.message });
    return;
  }
  next(error);
}

class ValidationError extends Error {}
class ForbiddenError extends Error {}
class NotFoundError extends Error {}
