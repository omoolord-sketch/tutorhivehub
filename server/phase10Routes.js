import { getPrisma } from "./db.js";
import { auditLog, requireAnyPermission } from "./authMiddleware.js";
import { buildSecurityChecklist } from "./securityHardening.js";
import { getRequestIp } from "./security.js";

const reportingPermissions = ["reporting:read", "system:all"];
const qualityPermissions = ["quality:manage", "system:all"];
const auditPermissions = ["audit:read", "system:all"];
const securityPermissions = ["security:manage", "system:all"];
const dataProtectionPermissions = ["data-protection:manage", "system:all"];
const reportStatuses = ["OPEN", "IN_PROGRESS", "COMPLETED", "CLOSED", "ARCHIVED", "PENDING", "ACTIVE", "INACTIVE"];
const qualityStatuses = ["OPEN", "IN_PROGRESS", "COMPLETED", "CLOSED", "ARCHIVED"];
const trainingStatuses = ["PLANNED", "IN_PROGRESS", "COMPLETED", "EXPIRED", "WAIVED"];
const dataRequestTypes = ["DATA_EXPORT", "DATA_DELETION", "ANONYMISATION", "CONSENT_REVIEW", "RETENTION_REVIEW"];
const dataRequestStatuses = ["OPEN", "IN_PROGRESS", "WAITING_FOR_IDENTITY_CHECK", "COMPLETED", "REJECTED", "CLOSED"];
const retentionActions = ["REVIEW", "ARCHIVE", "ANONYMISE", "DELETE_WHEN_APPROVED"];
const profileStatuses = new Set(["ACTIVE", "INACTIVE", "ARCHIVED"]);
const lessonStatusSet = new Set(["SCHEDULED", "TUTOR_READY", "IN_PROGRESS", "COMPLETED", "STUDENT_ABSENT", "TUTOR_ABSENT", "CANCELLED", "RESCHEDULED", "MISSED"]);
const homeworkStatusSet = new Set(["DRAFT", "ASSIGNED", "SUBMITTED", "LATE", "REVIEWED", "RESUBMISSION_REQUIRED", "COMPLETED", "CANCELLED"]);
const timesheetStatusSet = new Set(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED", "APPROVED", "REJECTED", "PAID"]);
const invoiceStatusSet = new Set(["DRAFT", "SENT", "PARTIALLY_PAID", "PART_PAID", "PAID", "OVERDUE", "CANCELLED", "VOID"]);
const paymentStatusSet = new Set(["PENDING", "COMPLETED", "FAILED", "REFUNDED", "CORRECTED", "CANCELLED"]);
const textStatusSet = new Set(reportStatuses);

const tutorSelect = { id: true, fullName: true, email: true, status: true, mainSubjectAreas: true, internalPerformanceNotes: true };
const userSelect = { id: true, name: true, email: true, role: { select: { name: true } } };
const studentSelect = { id: true, fullName: true, yearGroup: true, examPathway: true, status: true, parentId: true };
const parentSelect = { id: true, fullName: true, email: true, status: true };

export function registerPhase10Routes(app) {
  app.get("/api/portal/reports/summary", requireAnyPermission(reportingPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const summary = await buildAdminReport(prisma, request.query);
      await auditLog({ request, actorId: request.portalUser.id, action: "management_report_viewed", entityType: "Report", metadata: reportFilterMetadata(request.query) });
      response.json({ ok: true, report: summary });
    } catch (error) {
      handlePhase10Error(error, response, next);
    }
  });

  app.get("/api/portal/reports/export.csv", requireAnyPermission(reportingPermissions), async (request, response, next) => {
    try {
      const report = await buildAdminReport(getPrisma(), request.query);
      sendCsv(response, "tutorhivehub-management-report.csv", buildReportRows(report));
      await auditLog({ request, actorId: request.portalUser.id, action: "management_report_exported_csv", entityType: "Report" });
    } catch (error) {
      handlePhase10Error(error, response, next);
    }
  });

  app.get("/api/portal/reports/export.pdf", requireAnyPermission(reportingPermissions), async (request, response, next) => {
    try {
      const report = await buildAdminReport(getPrisma(), request.query);
      sendPdf(response, "tutorhivehub-management-report.pdf", "TutorHiveHub Management Report", buildReportRows(report).map((row) => `${row.section}: ${row.metric} - ${row.value}`));
      await auditLog({ request, actorId: request.portalUser.id, action: "management_report_exported_pdf", entityType: "Report" });
    } catch (error) {
      handlePhase10Error(error, response, next);
    }
  });

  app.get("/api/portal/tutor-performance", requireAnyPermission(reportingPermissions), async (request, response, next) => {
    try {
      const performance = await buildTutorPerformance(getPrisma(), request.query);
      await auditLog({ request, actorId: request.portalUser.id, action: "tutor_performance_viewed", entityType: "TutorPerformance", metadata: reportFilterMetadata(request.query) });
      response.json({ ok: true, performance });
    } catch (error) {
      handlePhase10Error(error, response, next);
    }
  });

  app.get("/api/portal/quality/lookups", requireAnyPermission(qualityPermissions), async (_request, response, next) => {
    try {
      const prisma = getPrisma();
      const [tutors, lessons, users] = await Promise.all([
        prisma.tutor.findMany({ orderBy: { fullName: "asc" }, select: tutorSelect, take: 300 }),
        prisma.lesson.findMany({
          orderBy: { scheduledStart: "desc" },
          include: {
            tutor: { select: { id: true, fullName: true } },
            student: { select: { id: true, fullName: true } },
            subject: { select: { id: true, name: true } },
          },
          take: 300,
        }),
        prisma.user.findMany({ orderBy: { name: "asc" }, select: userSelect, take: 300 }),
      ]);
      response.json({ ok: true, tutors, lessons: lessons.map(safeLessonLookup), users, qualityStatuses, trainingStatuses, reportStatuses });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/quality/observations", requireAnyPermission(qualityPermissions), listQualityRecords("lessonObservation", observationInclude(), "observationDate"));
  app.post("/api/portal/quality/observations", requireAnyPermission(qualityPermissions), createQualityRecord("lessonObservation", parseLessonObservationInput, "lesson_observation_created", observationInclude()));

  app.get("/api/portal/quality/tutor-reviews", requireAnyPermission(qualityPermissions), listQualityRecords("tutorReview", tutorReviewInclude(), "reviewDate"));
  app.post("/api/portal/quality/tutor-reviews", requireAnyPermission(qualityPermissions), createQualityRecord("tutorReview", parseTutorReviewInput, "tutor_review_created", tutorReviewInclude()));

  app.get("/api/portal/quality/training-records", requireAnyPermission(qualityPermissions), listQualityRecords("trainingRecord", trainingRecordInclude(), "createdAt"));
  app.post("/api/portal/quality/training-records", requireAnyPermission(qualityPermissions), createQualityRecord("trainingRecord", parseTrainingInput, "training_record_created", trainingRecordInclude()));

  app.get("/api/portal/quality/policy-acknowledgements", requireAnyPermission(qualityPermissions), listQualityRecords("policyAcknowledgement", policyAcknowledgementInclude(), "acknowledgedAt"));
  app.post("/api/portal/quality/policy-acknowledgements", requireAnyPermission(qualityPermissions), createQualityRecord("policyAcknowledgement", parsePolicyAcknowledgementInput, "policy_acknowledgement_recorded", policyAcknowledgementInclude()));

  app.get("/api/portal/quality/improvement-plans", requireAnyPermission(qualityPermissions), listQualityRecords("improvementPlan", improvementPlanInclude(), "createdAt"));
  app.post("/api/portal/quality/improvement-plans", requireAnyPermission(qualityPermissions), createQualityRecord("improvementPlan", parseImprovementPlanInput, "improvement_plan_created", improvementPlanInclude()));

  app.get("/api/portal/audit-logs", requireAnyPermission(auditPermissions), async (request, response, next) => {
    try {
      const logs = await getAuditLogs(getPrisma(), request.query);
      await auditLog({ request, actorId: request.portalUser.id, action: "audit_logs_viewed", entityType: "AuditLog", metadata: reportFilterMetadata(request.query) });
      response.json({ ok: true, logs });
    } catch (error) {
      handlePhase10Error(error, response, next);
    }
  });

  app.get("/api/portal/audit-logs/export.csv", requireAnyPermission(auditPermissions), async (request, response, next) => {
    try {
      const logs = await getAuditLogs(getPrisma(), request.query, 1000);
      sendCsv(response, "tutorhivehub-audit-logs.csv", logs.map((log) => ({ createdAt: log.createdAt, actor: log.actor?.email || "-", action: log.action, entityType: log.entityType, entityId: log.entityId || "-", ipAddress: log.ipAddress || "-" })));
      await auditLog({ request, actorId: request.portalUser.id, action: "audit_logs_exported_csv", entityType: "AuditLog" });
    } catch (error) {
      handlePhase10Error(error, response, next);
    }
  });

  app.get("/api/portal/audit-logs/export.pdf", requireAnyPermission(auditPermissions), async (request, response, next) => {
    try {
      const logs = await getAuditLogs(getPrisma(), request.query, 250);
      sendPdf(response, "tutorhivehub-audit-logs.pdf", "TutorHiveHub Audit Logs", logs.map((log) => `${dateText(log.createdAt)} | ${log.actor?.email || "-"} | ${log.action} | ${log.entityType} ${log.entityId || ""}`));
      await auditLog({ request, actorId: request.portalUser.id, action: "audit_logs_exported_pdf", entityType: "AuditLog" });
    } catch (error) {
      handlePhase10Error(error, response, next);
    }
  });

  app.get("/api/portal/data-protection", requireAnyPermission(dataProtectionPermissions), async (_request, response, next) => {
    try {
      const prisma = getPrisma();
      const [consents, retentionConfigs, requests, users, parents, students] = await Promise.all([
        prisma.consentRecord.findMany({ include: consentInclude(), orderBy: { recordedAt: "desc" }, take: 200 }),
        prisma.dataRetentionConfig.findMany({ include: retentionInclude(), orderBy: { recordType: "asc" }, take: 100 }),
        prisma.dataProtectionRequest.findMany({ include: dataRequestInclude(), orderBy: { requestedAt: "desc" }, take: 200 }),
        prisma.user.findMany({ orderBy: { name: "asc" }, select: userSelect, take: 300 }),
        prisma.parent.findMany({ orderBy: { fullName: "asc" }, select: parentSelect, take: 300 }),
        prisma.student.findMany({ orderBy: { fullName: "asc" }, select: studentSelect, take: 300 }),
      ]);
      response.json({ ok: true, consents, retentionConfigs, requests, users, parents, students, dataRequestTypes, dataRequestStatuses, retentionActions });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/data-protection/consents", requireAnyPermission(dataProtectionPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const record = await prisma.consentRecord.create({ data: parseConsentInput(request), include: consentInclude() });
      await auditLog({ request, actorId: request.portalUser.id, action: "consent_record_created", entityType: "ConsentRecord", entityId: record.id });
      response.status(201).json({ ok: true, consent: record });
    } catch (error) {
      handlePhase10Error(error, response, next);
    }
  });

  app.post("/api/portal/data-protection/retention", requireAnyPermission(dataProtectionPermissions), async (request, response, next) => {
    try {
      const data = parseRetentionInput(request);
      const record = await getPrisma().dataRetentionConfig.upsert({
        where: { recordType: data.recordType },
        update: data,
        create: data,
        include: retentionInclude(),
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "retention_config_saved", entityType: "DataRetentionConfig", entityId: record.id, metadata: { recordType: record.recordType } });
      response.json({ ok: true, retentionConfig: record });
    } catch (error) {
      handlePhase10Error(error, response, next);
    }
  });

  app.post("/api/portal/data-protection/requests", requireAnyPermission(dataProtectionPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const data = parseDataRequestInput(request);
      const record = await prisma.dataProtectionRequest.create({ data, include: dataRequestInclude() });
      await auditLog({ request, actorId: request.portalUser.id, action: "data_protection_request_created", entityType: "DataProtectionRequest", entityId: record.id, metadata: { requestType: record.requestType } });
      response.status(201).json({ ok: true, request: record });
    } catch (error) {
      handlePhase10Error(error, response, next);
    }
  });

  app.post("/api/portal/data-protection/requests/:id/complete", requireAnyPermission(dataProtectionPermissions), async (request, response, next) => {
    try {
      const record = await getPrisma().dataProtectionRequest.update({
        where: { id: request.params.id },
        data: {
          status: "COMPLETED",
          handledById: request.portalUser.id,
          completedAt: new Date(),
          responseNotes: optional(request.body?.responseNotes),
          internalNotes: optional(request.body?.internalNotes),
        },
        include: dataRequestInclude(),
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "data_protection_request_completed", entityType: "DataProtectionRequest", entityId: record.id });
      response.json({ ok: true, request: record });
    } catch (error) {
      handlePhase10Error(error, response, next);
    }
  });

  app.get("/api/portal/security/status", requireAnyPermission(securityPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const [auditCount, activeSessions, pendingDataRequests, openSafeguarding] = await Promise.all([
        prisma.auditLog.count(),
        prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
        prisma.dataProtectionRequest.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_IDENTITY_CHECK"] } } }),
        prisma.safeguardingConcern.count({ where: { status: { in: ["OPEN", "REVIEWING", "ESCALATED"] } } }),
      ]);
      const checklist = buildSecurityChecklist();
      response.json({
        ok: true,
        security: {
          checklist,
          totals: { auditCount, activeSessions, pendingDataRequests, openSafeguarding },
          deployment: deploymentChecklist(checklist),
          privacyNotice: "/privacy-policy.html",
          backupProcedure: process.env.BACKUP_PROCEDURE_URL || "See PRODUCTION_DEPLOYMENT_CHECKLIST.md",
        },
      });
    } catch (error) {
      next(error);
    }
  });
}

async function buildAdminReport(prisma, query) {
  const range = normaliseDateRange(query);
  const filter = reportFilters(query);
  const lessonWhere = { AND: [dateFilter("scheduledStart", range), filter.lesson] };
  const createdWhere = (extra = {}) => ({ AND: [dateFilter("createdAt", range), extra] });

  const [students, tutors, lessons, homework, timesheets, invoices, payments, supportRequests, reports, observations] = await Promise.all([
    prisma.student.findMany({ where: filter.student, include: { parent: { select: parentSelect }, subjects: true, tutorAssignments: true }, take: 1000 }),
    prisma.tutor.findMany({ where: filter.tutor, include: { subjects: true }, take: 1000 }),
    prisma.lesson.findMany({
      where: lessonWhere,
      include: {
        student: { select: studentSelect },
        tutor: { select: tutorSelect },
        subject: { select: { id: true, name: true, examPathway: true } },
        report: { select: { id: true, submittedAt: true, technicalIssuesReported: true } },
      },
      take: 2000,
    }),
    prisma.homework.findMany({ where: createdWhere(filter.homework), include: { tutor: { select: tutorSelect }, student: { select: studentSelect }, subject: true }, take: 2000 }),
    prisma.timesheet.findMany({ where: createdWhere(filter.timesheet), include: { tutor: { select: tutorSelect } }, take: 1000 }),
    prisma.invoice.findMany({ where: createdWhere(filter.invoice), include: { parent: { select: parentSelect }, student: { select: studentSelect }, payments: true }, take: 1000 }),
    prisma.payment.findMany({ where: { AND: [dateFilter("createdAt", range), filter.payment] }, include: { invoice: { include: { parent: { select: parentSelect }, student: { select: studentSelect } } } }, take: 2000 }),
    prisma.supportRequest.findMany({ where: createdWhere(filter.support), include: { student: { select: studentSelect }, parent: { select: parentSelect }, requester: { select: userSelect } }, take: 1000 }),
    prisma.lessonReport.findMany({ where: { AND: [dateFilter("submittedAt", range), filter.report] }, include: { tutor: { select: tutorSelect }, student: { select: studentSelect } }, take: 2000 }),
    prisma.lessonObservation.findMany({ where: { AND: [dateFilter("observationDate", range), filter.observation] }, include: { tutor: { select: tutorSelect } }, take: 1000 }),
  ]);

  const completedLessons = lessons.filter((lesson) => lesson.status === "COMPLETED");
  const lessonAbsences = lessons.filter((lesson) => lesson.status === "STUDENT_ABSENT" || lesson.studentAttendance === "Absent");
  const tutorAbsences = lessons.filter((lesson) => lesson.status === "TUTOR_ABSENT" || lesson.tutorAttendance === "Absent");
  const outstandingLessonReports = lessons.filter((lesson) => ["COMPLETED", "STUDENT_ABSENT"].includes(lesson.status) && (!lesson.report || lesson.reportStatus === "REPORT_OUTSTANDING"));
  const completedHomework = homework.filter((item) => ["REVIEWED", "COMPLETED"].includes(item.status));
  const outstandingHomework = homework.filter((item) => ["ASSIGNED", "LATE", "RESUBMISSION_REQUIRED"].includes(item.status));
  const completedPayments = payments.filter((payment) => payment.status === "COMPLETED" && payment.kind !== "REFUND");
  const refunds = payments.filter((payment) => payment.status === "COMPLETED" && payment.kind === "REFUND");
  const technicalIncidents = supportRequests.filter((item) => item.category === "Technical issue").length + reports.filter((report) => report.technicalIssuesReported).length;

  return {
    generatedAt: new Date(),
    filters: { startDate: range.startDate, endDate: range.endDate, ...reportFilterMetadata(query) },
    lookups: await reportLookups(prisma),
    metrics: {
      activeStudents: students.filter((student) => student.status === "ACTIVE").length,
      activeTutors: tutors.filter((tutor) => tutor.status === "ACTIVE").length,
      lessonsScheduled: lessons.length,
      lessonsCompleted: completedLessons.length,
      attendanceRecorded: lessons.filter((lesson) => lesson.studentAttendance || lesson.tutorAttendance).length,
      studentAbsences: lessonAbsences.length,
      tutorAbsences: tutorAbsences.length,
      outstandingLessonReports: outstandingLessonReports.length,
      homeworkTotal: homework.length,
      homeworkCompleted: completedHomework.length,
      homeworkOutstanding: outstandingHomework.length,
      homeworkCompletionRate: percentage(completedHomework.length, homework.length),
      timesheetTotals: sumMoney(timesheets.map((timesheet) => timesheet.finalAmountPayable)),
      tutorPayrollApproved: sumMoney(timesheets.filter((timesheet) => ["APPROVED", "PAID"].includes(timesheet.status)).map((timesheet) => timesheet.finalAmountPayable)),
      invoicesIssued: invoices.length,
      invoiceTotals: sumMoney(invoices.map((invoice) => invoice.totalAmount)),
      paymentsReceived: sumMoney(completedPayments.map((payment) => payment.amount)),
      refunds: sumMoney(refunds.map((payment) => payment.amount)),
      outstandingBalances: sumMoney(invoices.map((invoice) => invoice.balanceDue)),
      revenue: sumMoney(completedPayments.map((payment) => payment.amount)) - sumMoney(refunds.map((payment) => payment.amount)),
      supportRequests: supportRequests.length,
      technicalIncidents,
      lessonObservations: observations.length,
    },
    attendance: attendanceBreakdown(lessons),
    tutorWorkload: tutorWorkload(lessons, timesheets, reports, homework),
    financeByStatus: countBy(invoices, (invoice) => invoice.status),
    homeworkByStatus: countBy(homework, (item) => item.status),
    supportByStatus: countBy(supportRequests, (item) => item.status),
  };
}

async function buildTutorPerformance(prisma, query) {
  const range = normaliseDateRange(query);
  const filter = reportFilters(query);
  const [tutors, lessons, reports, homework, supportRequests, reviews] = await Promise.all([
    prisma.tutor.findMany({ where: filter.tutor, include: { studentAssignments: true }, take: 1000 }),
    prisma.lesson.findMany({ where: { AND: [dateFilter("scheduledStart", range), filter.lesson] }, include: { tutor: { select: tutorSelect }, report: true }, take: 3000 }),
    prisma.lessonReport.findMany({ where: { AND: [dateFilter("submittedAt", range), filter.report] }, include: { tutor: { select: tutorSelect } }, take: 3000 }),
    prisma.homework.findMany({ where: { AND: [dateFilter("createdAt", range), filter.homework] }, include: { tutor: { select: tutorSelect } }, take: 3000 }),
    prisma.supportRequest.findMany({ where: { AND: [dateFilter("createdAt", range), { category: "Tutor concern" }] }, take: 1000 }),
    prisma.tutorReview.findMany({ include: tutorReviewInclude(), orderBy: { reviewDate: "desc" }, take: 1000 }),
  ]);

  return tutors.map((tutor) => {
    const tutorLessons = lessons.filter((lesson) => lesson.tutorId === tutor.id || lesson.replacementTutorId === tutor.id);
    const completed = tutorLessons.filter((lesson) => lesson.status === "COMPLETED");
    const present = tutorLessons.filter((lesson) => lesson.tutorAttendance === "Present" || lesson.status === "COMPLETED");
    const readyOnTime = tutorLessons.filter((lesson) => lesson.tutorReadyAt && new Date(lesson.tutorReadyAt) <= new Date(lesson.scheduledStart));
    const tutorReports = reports.filter((report) => report.tutorId === tutor.id);
    const tutorHomework = homework.filter((item) => item.tutorId === tutor.id);
    const reviewedHomework = tutorHomework.filter((item) => ["REVIEWED", "COMPLETED", "RESUBMISSION_REQUIRED"].includes(item.status));
    const latestReview = reviews.find((review) => review.tutorId === tutor.id);
    const activeStudents = new Set((tutor.studentAssignments ?? []).filter((assignment) => assignment.status === "ACTIVE").map((assignment) => assignment.studentId));
    const totalStudents = new Set((tutor.studentAssignments ?? []).map((assignment) => assignment.studentId));
    return {
      tutor: { id: tutor.id, fullName: tutor.fullName, email: tutor.email, status: tutor.status },
      lessonsAssigned: tutorLessons.length,
      lessonsCompleted: completed.length,
      attendanceRate: percentage(present.length, tutorLessons.length),
      punctualityRate: percentage(readyOnTime.length, tutorLessons.length),
      reportSubmissionRate: percentage(tutorReports.length, completed.length),
      homeworkFeedbackRate: percentage(reviewedHomework.length, tutorHomework.length),
      studentRetention: percentage(activeStudents.size, totalStudents.size),
      complaints: supportRequests.filter((request) => textIncludes(request.subject, tutor.fullName) || textIncludes(request.message, tutor.fullName)).length,
      qualityReviewNotes: latestReview?.qualityReviewNotes || tutor.internalPerformanceNotes || null,
      latestReviewDate: latestReview?.reviewDate || null,
      nextReviewDate: latestReview?.nextReviewDate || null,
    };
  });
}

function listQualityRecords(model, include, orderByField) {
  return async (request, response, next) => {
    try {
      const where = qualityWhere(request.query);
      const records = await getPrisma()[model].findMany({
        where,
        include,
        orderBy: { [orderByField]: "desc" },
        take: 300,
      });
      response.json({ ok: true, records });
    } catch (error) {
      next(error);
    }
  };
}

function createQualityRecord(model, parser, action, include) {
  return async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const record = await prisma[model].create({ data: parser(request), include });
      await auditLog({ request, actorId: request.portalUser.id, action, entityType: model, entityId: record.id });
      response.status(201).json({ ok: true, record });
    } catch (error) {
      handlePhase10Error(error, response, next);
    }
  };
}

async function getAuditLogs(prisma, query, take = 300) {
  const range = normaliseDateRange(query);
  return prisma.auditLog.findMany({
    where: {
      AND: [
        dateFilter("createdAt", range),
        cleanData({
          actorId: optional(query.actorId),
          entityType: optional(query.entityType),
          action: query.action ? { contains: String(query.action), mode: "insensitive" } : undefined,
        }),
      ],
    },
    include: { actor: { select: userSelect } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

function parseLessonObservationInput(request) {
  return cleanData({
    lessonId: optional(request.body?.lessonId),
    tutorId: required(request.body?.tutorId, "Tutor is required."),
    reviewerId: request.portalUser.id,
    observationDate: requiredDate(request.body?.observationDate, "Observation date is required."),
    focusArea: optional(request.body?.focusArea),
    rating: optional(request.body?.rating),
    strengths: optional(request.body?.strengths),
    improvementAreas: optional(request.body?.improvementAreas),
    reviewerNotes: optional(request.body?.reviewerNotes),
    nextReviewDate: optionalDate(request.body?.nextReviewDate),
    status: parseOption(request.body?.status || "OPEN", qualityStatuses, "Select a valid observation status."),
  });
}

function parseTutorReviewInput(request) {
  return cleanData({
    tutorId: required(request.body?.tutorId, "Tutor is required."),
    reviewerId: request.portalUser.id,
    reviewDate: requiredDate(request.body?.reviewDate, "Review date is required."),
    rating: optional(request.body?.rating),
    lessonsAssigned: parseIntValue(request.body?.lessonsAssigned, 0),
    lessonsCompleted: parseIntValue(request.body?.lessonsCompleted, 0),
    attendanceRate: optionalDecimal(request.body?.attendanceRate),
    punctualityRate: optionalDecimal(request.body?.punctualityRate),
    reportSubmissionRate: optionalDecimal(request.body?.reportSubmissionRate),
    homeworkFeedbackRate: optionalDecimal(request.body?.homeworkFeedbackRate),
    studentRetention: optionalDecimal(request.body?.studentRetention),
    complaints: parseIntValue(request.body?.complaints, 0),
    qualityReviewNotes: optional(request.body?.qualityReviewNotes),
    nextReviewDate: optionalDate(request.body?.nextReviewDate),
    status: parseOption(request.body?.status || "OPEN", qualityStatuses, "Select a valid review status."),
  });
}

function parseTrainingInput(request) {
  return cleanData({
    tutorId: required(request.body?.tutorId, "Tutor is required."),
    recordedById: request.portalUser.id,
    title: required(request.body?.title, "Training title is required."),
    provider: optional(request.body?.provider),
    trainingDate: optionalDate(request.body?.trainingDate),
    completionDate: optionalDate(request.body?.completionDate),
    expiryDate: optionalDate(request.body?.expiryDate),
    status: parseOption(request.body?.status || "PLANNED", trainingStatuses, "Select a valid training status."),
    notes: optional(request.body?.notes),
  });
}

function parsePolicyAcknowledgementInput(request) {
  return cleanData({
    userId: required(request.body?.userId, "User is required."),
    recordedById: request.portalUser.id,
    policyName: required(request.body?.policyName, "Policy name is required."),
    policyVersion: required(request.body?.policyVersion, "Policy version is required."),
    acknowledgedAt: optionalDateTime(request.body?.acknowledgedAt) || new Date(),
    ipAddress: getRequestIp(request),
    userAgent: request.headers["user-agent"] ?? null,
    notes: optional(request.body?.notes),
  });
}

function parseImprovementPlanInput(request) {
  return cleanData({
    tutorId: required(request.body?.tutorId, "Tutor is required."),
    reviewerId: request.portalUser.id,
    title: required(request.body?.title, "Improvement plan title is required."),
    concernSummary: required(request.body?.concernSummary, "Concern summary is required."),
    requiredActions: required(request.body?.requiredActions, "Required actions are required."),
    supportOffered: optional(request.body?.supportOffered),
    dueDate: optionalDate(request.body?.dueDate),
    reviewDate: optionalDate(request.body?.reviewDate),
    status: parseOption(request.body?.status || "OPEN", qualityStatuses, "Select a valid plan status."),
    reviewerNotes: optional(request.body?.reviewerNotes),
  });
}

function parseConsentInput(request) {
  return cleanData({
    userId: optional(request.body?.userId),
    parentId: optional(request.body?.parentId),
    studentId: optional(request.body?.studentId),
    consentType: required(request.body?.consentType, "Consent type is required."),
    granted: parseBoolean(request.body?.granted),
    legalBasis: optional(request.body?.legalBasis),
    recordedById: request.portalUser.id,
    recordedAt: optionalDateTime(request.body?.recordedAt) || new Date(),
    expiryDate: optionalDate(request.body?.expiryDate),
    notes: optional(request.body?.notes),
  });
}

function parseRetentionInput(request) {
  const retentionMonths = parseIntValue(request.body?.retentionMonths, Number(process.env.DATA_RETENTION_DEFAULT_MONTHS || 84));
  if (retentionMonths < 1) {
    throw new ValidationError("Retention months must be greater than zero.");
  }
  return cleanData({
    recordType: required(request.body?.recordType, "Record type is required."),
    retentionMonths,
    action: parseOption(request.body?.action || "REVIEW", retentionActions, "Select a valid retention action."),
    legalBasis: optional(request.body?.legalBasis),
    active: parseBooleanDefault(request.body?.active, true),
    updatedById: request.portalUser.id,
    notes: optional(request.body?.notes),
  });
}

function parseDataRequestInput(request) {
  const requestType = parseOption(request.body?.requestType, dataRequestTypes, "Select a valid data request type.");
  return cleanData({
    requesterId: optional(request.body?.requesterId),
    parentId: optional(request.body?.parentId),
    studentId: optional(request.body?.studentId),
    requestType,
    scope: optional(request.body?.scope),
    status: parseOption(request.body?.status || "OPEN", dataRequestStatuses, "Select a valid data request status."),
    dueAt: optionalDate(request.body?.dueAt),
    handledById: optional(request.body?.handledById),
    responseNotes: optional(request.body?.responseNotes),
    internalNotes: optional(request.body?.internalNotes),
  });
}

function reportFilters(query) {
  const studentId = optional(query.studentId);
  const parentId = optional(query.parentId);
  const tutorId = optional(query.tutorId);
  const subjectId = optional(query.subjectId);
  const examPathway = optional(query.examPathway);
  const status = optional(query.status);
  const profileStatus = status && profileStatuses.has(status) ? status : undefined;
  const lessonStatus = status && lessonStatusSet.has(status) ? status : undefined;
  const homeworkStatus = status && homeworkStatusSet.has(status) ? status : undefined;
  const timesheetStatus = status && timesheetStatusSet.has(status) ? status : undefined;
  const invoiceStatus = status && invoiceStatusSet.has(status) ? status : undefined;
  const paymentStatus = status && paymentStatusSet.has(status) ? status : undefined;
  const textStatus = status && textStatusSet.has(status) ? status : undefined;

  const student = cleanData({
    id: studentId,
    parentId,
    examPathway,
    status: profileStatus,
    subjects: subjectId ? { some: { id: subjectId } } : undefined,
    tutorAssignments: tutorId ? { some: { tutorId } } : undefined,
  });

  const tutor = cleanData({
    id: tutorId,
    status: profileStatus,
    subjects: subjectId ? { some: { id: subjectId } } : undefined,
  });

  const lesson = cleanData({
    studentId,
    tutorId,
    subjectId,
    parentId,
    status: lessonStatus,
    subject: examPathway ? { examPathway } : undefined,
  });
  const paymentInvoice = cleanData({ parentId, studentId, student: examPathway ? { examPathway } : undefined });

  return {
    student,
    tutor,
    lesson,
    homework: cleanData({ studentId, tutorId, subjectId, status: homeworkStatus, subject: examPathway ? { examPathway } : undefined }),
    timesheet: cleanData({ tutorId, status: timesheetStatus }),
    invoice: cleanData({ parentId, studentId, status: invoiceStatus, student: examPathway ? { examPathway } : undefined }),
    payment: cleanData({ status: paymentStatus, invoice: Object.keys(paymentInvoice).length ? paymentInvoice : undefined }),
    support: cleanData({ parentId, studentId, status: textStatus }),
    report: cleanData({ studentId, tutorId, student: examPathway ? { examPathway } : undefined }),
    observation: cleanData({ tutorId, status: textStatus }),
  };
}

async function reportLookups(prisma) {
  const [students, parents, tutors, subjects] = await Promise.all([
    prisma.student.findMany({ orderBy: { fullName: "asc" }, select: studentSelect, take: 300 }),
    prisma.parent.findMany({ orderBy: { fullName: "asc" }, select: parentSelect, take: 300 }),
    prisma.tutor.findMany({ orderBy: { fullName: "asc" }, select: tutorSelect, take: 300 }),
    prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, examPathway: true, isActive: true }, take: 300 }),
  ]);
  const examPathways = unique(students.map((student) => student.examPathway).concat(subjects.map((subject) => subject.examPathway)));
  return { students, parents, tutors, subjects, examPathways, reportStatuses };
}

function tutorWorkload(lessons, timesheets, reports, homework) {
  const map = new Map();
  for (const lesson of lessons) {
    const tutor = lesson.tutor;
    if (!tutor?.id) continue;
    const existing = map.get(tutor.id) ?? { tutor, lessonsAssigned: 0, lessonsCompleted: 0, hours: 0, reportCount: 0, homeworkFeedback: 0, punctualityRate: 0 };
    existing.lessonsAssigned += 1;
    if (lesson.status === "COMPLETED") existing.lessonsCompleted += 1;
    existing.hours = round2(existing.hours + Number(lesson.durationMinutes || 0) / 60);
    if (lesson.report) existing.reportCount += 1;
    map.set(tutor.id, existing);
  }
  for (const item of homework) {
    if (!item.tutor?.id) continue;
    const existing = map.get(item.tutor.id) ?? { tutor: item.tutor, lessonsAssigned: 0, lessonsCompleted: 0, hours: 0, reportCount: 0, homeworkFeedback: 0, payroll: 0 };
    if (["REVIEWED", "COMPLETED", "RESUBMISSION_REQUIRED"].includes(item.status)) existing.homeworkFeedback += 1;
    map.set(item.tutor.id, existing);
  }
  for (const timesheet of timesheets) {
    if (!timesheet.tutor?.id) continue;
    const existing = map.get(timesheet.tutor.id) ?? { tutor: timesheet.tutor, lessonsAssigned: 0, lessonsCompleted: 0, hours: 0, reportCount: 0, homeworkFeedback: 0, payroll: 0 };
    existing.payroll = round2(Number(existing.payroll || 0) + decimalNumber(timesheet.finalAmountPayable));
    map.set(timesheet.tutor.id, existing);
  }
  return Array.from(map.values()).map((item) => ({
    ...item,
    reportSubmissionRate: percentage(item.reportCount, item.lessonsCompleted),
  })).sort((a, b) => b.lessonsAssigned - a.lessonsAssigned);
}

function attendanceBreakdown(lessons) {
  return {
    present: lessons.filter((lesson) => lesson.status === "COMPLETED" || lesson.studentAttendance === "Present").length,
    late: lessons.filter((lesson) => Number(lesson.minutesLate || 0) > 0 || lesson.studentAttendance === "Late").length,
    studentAbsent: lessons.filter((lesson) => lesson.status === "STUDENT_ABSENT" || lesson.studentAttendance === "Absent").length,
    tutorAbsent: lessons.filter((lesson) => lesson.status === "TUTOR_ABSENT" || lesson.tutorAttendance === "Absent").length,
    cancelled: lessons.filter((lesson) => lesson.status === "CANCELLED").length,
  };
}

export function buildReportRows(report) {
  const rows = Object.entries(report.metrics ?? {}).map(([metric, value]) => ({ section: "Summary", metric: label(metric), value: String(value ?? 0) }));
  for (const [status, count] of Object.entries(report.homeworkByStatus ?? {})) {
    rows.push({ section: "Homework", metric: status, value: String(count) });
  }
  for (const [status, count] of Object.entries(report.financeByStatus ?? {})) {
    rows.push({ section: "Finance", metric: status, value: String(count) });
  }
  for (const [status, count] of Object.entries(report.supportByStatus ?? {})) {
    rows.push({ section: "Support", metric: status, value: String(count) });
  }
  return rows;
}

export function metricRowsToCsv(rows) {
  const keys = rows.length ? Object.keys(rows[0]) : ["section", "metric", "value"];
  return `${keys.join(",")}\n${rows.map((row) => keys.map((key) => csvEscape(row[key])).join(",")).join("\n")}\n`;
}

function sendCsv(response, filename, rows) {
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.send(metricRowsToCsv(rows));
}

function sendPdf(response, filename, title, lines) {
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.send(basicPdf(title, lines));
}

function basicPdf(title, lines) {
  const safeLines = [title, "", ...lines].slice(0, 80).map((line) => String(line).slice(0, 110));
  const stream = safeLines.map((line, index) => `BT /F1 10 Tf 50 ${780 - index * 14} Td (${escapePdf(line)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

function safeLessonLookup(lesson) {
  return {
    id: lesson.id,
    label: `${dateText(lesson.scheduledStart)} - ${lesson.student?.fullName || "Student"} - ${lesson.tutor?.fullName || "Tutor"} - ${lesson.subject?.name || "Subject"}`,
  };
}

function observationInclude() {
  return { lesson: { select: { id: true, scheduledStart: true, lessonType: true } }, tutor: { select: tutorSelect }, reviewer: { select: userSelect } };
}

function tutorReviewInclude() {
  return { tutor: { select: tutorSelect }, reviewer: { select: userSelect } };
}

function trainingRecordInclude() {
  return { tutor: { select: tutorSelect }, recordedBy: { select: userSelect } };
}

function policyAcknowledgementInclude() {
  return { user: { select: userSelect }, recordedBy: { select: userSelect } };
}

function improvementPlanInclude() {
  return { tutor: { select: tutorSelect }, reviewer: { select: userSelect } };
}

function consentInclude() {
  return { user: { select: userSelect }, parent: { select: parentSelect }, student: { select: studentSelect }, recordedBy: { select: userSelect } };
}

function retentionInclude() {
  return { updatedBy: { select: userSelect } };
}

function dataRequestInclude() {
  return { requester: { select: userSelect }, parent: { select: parentSelect }, student: { select: studentSelect }, handledBy: { select: userSelect } };
}

function qualityWhere(query) {
  return cleanData({
    tutorId: optional(query.tutorId),
    status: optional(query.status),
  });
}

function deploymentChecklist(securityChecklist) {
  return [
    { item: "Production environment variables", done: securityChecklist.every((item) => item.status || ["Error monitoring", "Backup procedure"].includes(item.area)) },
    { item: "Database migrations", done: true, detail: "Run npm run db:deploy before release." },
    { item: "Admin seed process", done: true, detail: "Run npm run portal:seed-roles and create the first Super Admin if needed." },
    { item: "Backup instructions", done: Boolean(process.env.BACKUP_PROCEDURE_URL || process.env.BACKUP_STORAGE_LOCATION) },
    { item: "Rollback plan", done: true, detail: "Keep the previous build archive and database backup before each release." },
    { item: "Email-domain configuration", done: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER) },
    { item: "File storage", done: Boolean(process.env.UPLOAD_STORAGE_PATH) },
  ];
}

export function canParentAccessStudent(parentId, student) {
  return Boolean(parentId && student?.parentId === parentId);
}

export function percentage(part, whole) {
  const denominator = Number(whole);
  if (!denominator) return 0;
  return round2((Number(part) / denominator) * 100);
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || "Unspecified";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function dateFilter(field, range) {
  if (!range.startDate && !range.endDate) return {};
  return { [field]: cleanData({ gte: range.startDate, lte: range.endDate }) };
}

export function normaliseDateRange(query) {
  return {
    startDate: optionalDate(query.startDate),
    endDate: optionalDate(query.endDate),
  };
}

function reportFilterMetadata(query) {
  return cleanData({
    startDate: optional(query.startDate),
    endDate: optional(query.endDate),
    studentId: optional(query.studentId),
    parentId: optional(query.parentId),
    tutorId: optional(query.tutorId),
    subjectId: optional(query.subjectId),
    examPathway: optional(query.examPathway),
    status: optional(query.status),
  });
}

function label(value) {
  return String(value).replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()).trim();
}

function textIncludes(value, needle) {
  return Boolean(value && needle && String(value).toLowerCase().includes(String(needle).toLowerCase()));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function sumMoney(values) {
  return round2(values.reduce((total, value) => total + decimalNumber(value), 0));
}

function decimalNumber(value) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parseOption(value, options, message) {
  const cleaned = required(value, message);
  if (!options.includes(cleaned)) {
    throw new ValidationError(message);
  }
  return cleaned;
}

function parseIntValue(value, fallback) {
  const cleaned = optional(value);
  if (!cleaned) return fallback;
  const parsed = Number.parseInt(cleaned, 10);
  if (!Number.isInteger(parsed)) {
    throw new ValidationError("Please enter a valid whole number.");
  }
  return parsed;
}

function optionalDecimal(value) {
  const cleaned = optional(value);
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    throw new ValidationError("Please enter a valid number.");
  }
  return round2(parsed);
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

function optionalDate(value) {
  const cleaned = optional(value);
  if (!cleaned) return null;
  const date = new Date(`${cleaned}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Please enter a valid date.");
  }
  return date;
}

function requiredDate(value, message) {
  const date = optionalDate(value);
  if (!date) {
    throw new ValidationError(message);
  }
  return date;
}

function optionalDateTime(value) {
  const cleaned = optional(value);
  if (!cleaned) return null;
  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Please enter a valid date and time.");
  }
  return date;
}

function parseBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "Yes";
}

function parseBooleanDefault(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return parseBoolean(value);
}

function dateText(value) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value)) : "-";
}

export function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapePdf(value) {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function cleanData(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function handlePhase10Error(error, response, next) {
  if (error instanceof ValidationError) {
    response.status(422).json({ ok: false, message: error.message });
    return;
  }
  next(error);
}

class ValidationError extends Error {}
