import { getPrisma } from "./db.js";
import { auditLog, requireAnyPermission } from "./authMiddleware.js";
import { hasPermission } from "./roles.js";

const workspacePermissions = ["lessons:manage", "reports:manage", "own:lessons", "own:lesson-reports"];
const reportAccessPermissions = ["reports:manage", "own:lesson-reports", "family:lesson-updates"];
const understandingOptions = ["Excellent", "Good", "Fair", "Needs Improvement"];
const engagementOptions = ["Highly Engaged", "Participated Well", "Needed Encouragement", "Disengaged"];
const attendanceOptions = ["Present", "Absent", "Late", "Not Recorded"];
const readinessKeys = ["internetChecked", "cameraChecked", "microphoneChecked", "screenSharingChecked", "lessonMaterialsReady"];

const lessonWorkspaceInclude = {
  student: { select: { id: true, fullName: true, academicGoals: true, parentId: true } },
  students: { select: { id: true, fullName: true, academicGoals: true, parentId: true } },
  tutor: { include: { user: { select: { id: true, email: true, name: true } } } },
  replacementTutor: { include: { user: { select: { id: true, email: true, name: true } } } },
  subject: { select: { id: true, name: true, examPathway: true } },
  report: true,
  homework: { orderBy: { dueDate: "asc" } },
};

const reportInclude = {
  lesson: {
    include: {
      subject: { select: { id: true, name: true, examPathway: true } },
      student: { select: { id: true, fullName: true, parentId: true } },
      students: { select: { id: true, fullName: true, parentId: true } },
      tutor: { select: { id: true, fullName: true, email: true, userId: true } },
      replacementTutor: { select: { id: true, fullName: true, email: true, userId: true } },
    },
  },
  student: { select: { id: true, fullName: true, parentId: true, academicGoals: true } },
  tutor: { select: { id: true, fullName: true, email: true, userId: true } },
  safeguardingConcerns: { select: { id: true, status: true, reportedAt: true } },
};

export function registerLessonWorkspaceRoutes(app, { sendPortalEmail }) {
  app.get("/api/portal/lesson-workspace/dashboard", requireAnyPermission(workspacePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const scope = await lessonWorkspaceScopeWhere(prisma, request);
      const now = new Date();
      const inFourteenDays = addDays(now, 14);
      const [upcomingLessons, outstandingReports] = await Promise.all([
        prisma.lesson.findMany({
          where: {
            AND: [
              scope,
              { status: { in: ["SCHEDULED", "TUTOR_READY", "IN_PROGRESS"] } },
              { scheduledStart: { gte: addMinutes(now, -30), lte: inFourteenDays } },
            ],
          },
          include: lessonWorkspaceInclude,
          orderBy: { scheduledStart: "asc" },
          take: 20,
        }),
        prisma.lesson.findMany({
          where: {
            AND: [
              scope,
              { status: "COMPLETED" },
              { OR: [{ reportStatus: "REPORT_OUTSTANDING" }, { report: null }] },
            ],
          },
          include: lessonWorkspaceInclude,
          orderBy: { scheduledEnd: "asc" },
          take: 30,
        }),
      ]);

      response.json({
        ok: true,
        upcomingLessons: await decorateLessons(prisma, upcomingLessons),
        outstandingReports: await decorateLessons(prisma, outstandingReports),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/lesson-workspace/lessons/:id", requireAnyPermission(workspacePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const lesson = await prisma.lesson.findFirst({
        where: { AND: [{ id: request.params.id }, await lessonWorkspaceScopeWhere(prisma, request)] },
        include: lessonWorkspaceInclude,
      });
      if (!lesson) {
        response.status(404).json({ ok: false, message: "Lesson not found." });
        return;
      }
      const [decorated] = await decorateLessons(prisma, [lesson]);
      response.json({ ok: true, lesson: decorated, timeline: await studentTimeline(prisma, lesson.studentId, request) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/lesson-workspace/lessons/:id/ready", requireAnyPermission(["lessons:manage", "own:lessons"]), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const lesson = await requireScopedLesson(prisma, request);
      const checklist = readinessChecklist(request.body);
      const updated = await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          status: lesson.status === "SCHEDULED" ? "TUTOR_READY" : lesson.status,
          tutorReadyAt: new Date(),
          readinessChecklist: checklist,
          preparationApprovedAsLessonTime: request.body?.preparationApprovedAsLessonTime === true && hasPermission(request.portalUser, "lessons:manage"),
        },
        include: lessonWorkspaceInclude,
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "lesson_tutor_ready", entityType: "Lesson", entityId: updated.id, metadata: { checklist } });
      response.json({ ok: true, lesson: updated });
    } catch (error) {
      handleWorkspaceError(error, response, next);
    }
  });

  app.post("/api/portal/lesson-workspace/lessons/:id/attendance", requireAnyPermission(["lessons:manage", "own:lessons"]), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const lesson = await requireScopedLesson(prisma, request);
      const data = parseAttendanceInput(request.body);
      const updated = await prisma.lesson.update({
        where: { id: lesson.id },
        data,
        include: lessonWorkspaceInclude,
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "lesson_attendance_recorded", entityType: "Lesson", entityId: updated.id, metadata: { tutorAttendance: updated.tutorAttendance, studentAttendance: updated.studentAttendance, minutesLate: updated.minutesLate } });
      response.json({ ok: true, lesson: updated });
    } catch (error) {
      handleWorkspaceError(error, response, next);
    }
  });

  app.get("/api/portal/lesson-reports", requireAnyPermission(reportAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const view = String(request.query.view || "submitted");
      const scope = await reportLessonScopeWhere(prisma, request);

      if (view === "outstanding" || view === "overdue") {
        const overdueOnly = view === "overdue";
        const lessons = await prisma.lesson.findMany({
          where: {
            AND: [
              scope,
              { status: "COMPLETED" },
              { OR: [{ reportStatus: "REPORT_OUTSTANDING" }, { report: null }] },
              overdueOnly ? { scheduledEnd: { lt: startOfDay(new Date()) } } : {},
            ],
          },
          include: lessonWorkspaceInclude,
          orderBy: { scheduledEnd: "asc" },
          take: 200,
        });
        response.json({ ok: true, lessons: await decorateLessons(prisma, lessons), reports: [] });
        return;
      }

      const reports = await prisma.lessonReport.findMany({
        where: { lesson: { is: scope }, ...(isParentOnly(request.portalUser) ? { parentVisible: true } : {}) },
        include: reportInclude,
        orderBy: { submittedAt: "desc" },
        take: 200,
      });
      response.json({ ok: true, reports: reports.map((report) => safeReportForUser(report, request.portalUser)), lessons: [] });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/lesson-reports/:id", requireAnyPermission(reportAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const report = await prisma.lessonReport.findFirst({
        where: { AND: [{ id: request.params.id }, { lesson: { is: await reportLessonScopeWhere(prisma, request) } }], ...(isParentOnly(request.portalUser) ? { parentVisible: true } : {}) },
        include: reportInclude,
      });
      if (!report) {
        response.status(404).json({ ok: false, message: "Lesson report not found." });
        return;
      }
      response.json({ ok: true, report: safeReportForUser(report, request.portalUser) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/lesson-reports", requireAnyPermission(["reports:manage", "own:lesson-reports"]), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const lesson = await requireScopedLesson(prisma, request, request.body?.lessonId);
      const data = parseReportInput(request.body, lesson);
      const report = await prisma.lessonReport.upsert({
        where: { lessonId: lesson.id },
        create: data,
        update: {
          topicCovered: data.topicCovered,
          lessonSummary: data.lessonSummary,
          studentParticipation: data.studentParticipation,
          studentUnderstanding: data.studentUnderstanding,
          strengthsObserved: data.strengthsObserved,
          areasNeedingSupport: data.areasNeedingSupport,
          homeworkOrTaskGiven: data.homeworkOrTaskGiven,
          homeworkDueDate: data.homeworkDueDate,
          nextLessonRecommendation: data.nextLessonRecommendation,
          resourcesRequired: data.resourcesRequired,
          parentFriendlyUpdate: data.parentFriendlyUpdate,
          technicalIssuesReported: data.technicalIssuesReported,
          technicalIssueDetails: data.technicalIssueDetails,
          safeguardingConcernRaised: data.safeguardingConcernRaised,
          internalTutorNotes: data.internalTutorNotes,
          parentVisible: data.parentVisible,
          tutorDeclaration: data.tutorDeclaration,
          submittedAt: new Date(),
        },
        include: reportInclude,
      });

      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { status: lesson.status === "COMPLETED" ? lesson.status : "COMPLETED", reportStatus: "SUBMITTED" },
      });

      if (data.homeworkOrTaskGiven) {
        await upsertHomeworkFromReport(prisma, lesson, data);
      }

      if (data.safeguardingConcernRaised) {
        await createSafeguardingConcern({ prisma, request, lesson, report, body: request.body, sendPortalEmail });
      }

      await auditLog({ request, actorId: request.portalUser.id, action: "lesson_report_submitted", entityType: "LessonReport", entityId: report.id, metadata: { lessonId: lesson.id, studentId: data.studentId, safeguardingConcernRaised: data.safeguardingConcernRaised } });
      response.status(201).json({ ok: true, report: safeReportForUser(report, request.portalUser) });
    } catch (error) {
      handleWorkspaceError(error, response, next);
    }
  });

  app.get("/api/portal/students/:id/timeline", requireAnyPermission(reportAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const allowed = await canAccessStudentTimeline(prisma, request, request.params.id);
      if (!allowed) {
        response.status(403).json({ ok: false, message: "Access denied." });
        return;
      }
      response.json({ ok: true, timeline: await studentTimeline(prisma, request.params.id, request) });
    } catch (error) {
      next(error);
    }
  });
}

async function decorateLessons(prisma, lessons) {
  const decorated = [];
  for (const lesson of lessons) {
    const previousReport = await prisma.lessonReport.findFirst({
      where: {
        studentId: lesson.studentId,
        lesson: { scheduledStart: { lt: lesson.scheduledStart } },
      },
      include: {
        lesson: {
          include: {
            subject: { select: { name: true } },
            tutor: { select: { fullName: true } },
          },
        },
      },
      orderBy: { lesson: { scheduledStart: "desc" } },
    });
    const outstandingHomework = await prisma.homework.findMany({
      where: {
        studentId: lesson.studentId,
        status: { in: ["ASSIGNED", "SUBMITTED"] },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    });
    decorated.push({
      ...lesson,
      previousLessonSummary: previousReport?.lessonSummary ?? null,
      previousLessonTopic: previousReport?.topicCovered ?? null,
      outstandingHomework,
      studentAcademicGoals: lesson.student?.academicGoals ?? null,
      reportOutstanding: lesson.status === "COMPLETED" && (!lesson.report || lesson.reportStatus === "REPORT_OUTSTANDING"),
    });
  }
  return decorated;
}

async function requireScopedLesson(prisma, request, lessonId = request.params.id) {
  const lesson = await prisma.lesson.findFirst({
    where: { AND: [{ id: lessonId }, await lessonWorkspaceScopeWhere(prisma, request)] },
    include: lessonWorkspaceInclude,
  });
  if (!lesson) {
    throw new NotFoundError("Lesson not found.");
  }
  return lesson;
}

async function lessonWorkspaceScopeWhere(prisma, request) {
  if (hasPermission(request.portalUser, "lessons:manage") || hasPermission(request.portalUser, "reports:manage")) {
    return {};
  }
  const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
  return tutor ? { OR: [{ tutorId: tutor.id }, { replacementTutorId: tutor.id }] } : { id: "__no_lesson_scope__" };
}

async function reportLessonScopeWhere(prisma, request) {
  if (hasPermission(request.portalUser, "reports:manage") || hasPermission(request.portalUser, "lessons:manage")) {
    return {};
  }
  if (hasPermission(request.portalUser, "own:lesson-reports")) {
    const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    return tutor ? { OR: [{ tutorId: tutor.id }, { replacementTutorId: tutor.id }] } : { id: "__no_report_scope__" };
  }
  if (hasPermission(request.portalUser, "family:lesson-updates")) {
    const parent = await prisma.parent.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    return parent ? { OR: [{ parentId: parent.id }, { students: { some: { parentId: parent.id } } }] } : { id: "__no_report_scope__" };
  }
  return { id: "__no_report_scope__" };
}

function readinessChecklist(body) {
  const checklist = {};
  for (const key of readinessKeys) {
    checklist[key] = body?.[key] === true || body?.[key] === "true" || body?.[key] === "on";
  }
  return checklist;
}

function parseAttendanceInput(body) {
  const tutorAttendance = parseOption(body?.tutorAttendance, attendanceOptions, "Select a valid tutor attendance value.");
  const studentAttendance = parseOption(body?.studentAttendance, attendanceOptions, "Select a valid student attendance value.");
  return cleanData({
    tutorAttendance,
    studentAttendance,
    arrivalTime: optionalDateTime(body?.arrivalTime),
    minutesLate: optionalInt(body?.minutesLate, 0, 600, "Minutes late must be between 0 and 600."),
    absenceReason: optional(body?.absenceReason),
    attendanceNotes: optional(body?.attendanceNotes),
  });
}

function parseReportInput(body, lesson) {
  const studentId = required(body?.studentId || lesson.studentId, "Student is required.");
  const lessonStudentIds = new Set([lesson.studentId, ...(lesson.students ?? []).map((student) => student.id)]);
  if (!lessonStudentIds.has(studentId)) {
    throw new ValidationError("Selected student is not linked to this lesson.");
  }
  const tutorId = lesson.replacementTutorId || lesson.tutorId;
  const tutorDeclaration = body?.tutorDeclaration === true || body?.tutorDeclaration === "true" || body?.tutorDeclaration === "on";
  if (!tutorDeclaration) {
    throw new ValidationError("Tutor declaration is required.");
  }

  return cleanData({
    lessonId: lesson.id,
    tutorId,
    studentId,
    topicCovered: required(body?.topicCovered, "Topic covered is required."),
    lessonSummary: required(body?.lessonSummary, "Lesson summary is required."),
    studentParticipation: parseOption(body?.studentParticipation, engagementOptions, "Select a valid engagement option."),
    studentUnderstanding: parseOption(body?.studentUnderstanding, understandingOptions, "Select a valid understanding option."),
    strengthsObserved: optional(body?.strengthsObserved),
    areasNeedingSupport: optional(body?.areasNeedingSupport),
    homeworkOrTaskGiven: optional(body?.homeworkOrTaskGiven),
    homeworkDueDate: optionalDate(body?.homeworkDueDate),
    nextLessonRecommendation: optional(body?.nextLessonRecommendation),
    resourcesRequired: optional(body?.resourcesRequired),
    parentFriendlyUpdate: required(body?.parentFriendlyUpdate, "Parent-friendly update is required."),
    technicalIssuesReported: parseBoolean(body?.technicalIssuesReported),
    technicalIssueDetails: optional(body?.technicalIssueDetails),
    safeguardingConcernRaised: parseBoolean(body?.safeguardingConcernRaised),
    internalTutorNotes: optional(body?.internalTutorNotes),
    parentVisible: body?.parentVisible === undefined ? true : parseBoolean(body.parentVisible),
    tutorDeclaration,
    submittedAt: new Date(),
  });
}

async function upsertHomeworkFromReport(prisma, lesson, data) {
  await prisma.homework.create({
    data: {
      studentId: data.studentId,
      tutorId: data.tutorId,
      lessonId: lesson.id,
      subjectId: lesson.subjectId,
      title: `Homework from ${dateText(lesson.scheduledStart)}`,
      details: data.homeworkOrTaskGiven,
      dueDate: data.homeworkDueDate,
      status: "ASSIGNED",
    },
  });
}

async function createSafeguardingConcern({ prisma, request, lesson, report, body, sendPortalEmail }) {
  const summary = required(body?.safeguardingConcernDetails, "Safeguarding concern details are required when safeguarding concern is marked yes.");
  const concern = await prisma.safeguardingConcern.create({
    data: {
      studentId: report.studentId,
      tutorId: report.tutorId,
      lessonId: lesson.id,
      lessonReportId: report.id,
      reportedById: request.portalUser.id,
      status: "OPEN",
      summary: summary.slice(0, 240),
      restrictedNotes: summary,
    },
  });

  const admins = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: {
        permissions: {
          some: { key: { in: ["system:all", "safeguarding:read", "safeguarding:manage"] } },
        },
      },
    },
    select: { id: true, email: true },
  });

  const title = "URGENT SAFEGUARDING CONCERN - TutorHiveHub";
  const message = `A safeguarding concern was submitted for ${report.student?.fullName ?? "a student"} after ${subjectLabel(lesson.subject) || "a lesson"} on ${dateText(lesson.scheduledStart)}. Restricted details are stored in the portal.`;
  for (const admin of admins) {
    await prisma.notification.create({
      data: {
        recipientId: admin.id,
        createdById: request.portalUser.id,
        title,
        message,
      },
    });
  }

  const emailTargets = new Set(admins.map((admin) => admin.email).filter(Boolean));
  if (process.env.ADMIN_EMAIL) emailTargets.add(process.env.ADMIN_EMAIL);
  if (sendPortalEmail) {
    for (const email of emailTargets) {
      try {
        await sendPortalEmail({
          to: email,
          subject: title,
          text: message,
          html: `<p>${escapeHtml(message)}</p>`,
        });
      } catch (error) {
        await auditLog({ request, actorId: request.portalUser.id, action: "safeguarding_email_failed", entityType: "SafeguardingConcern", entityId: concern.id, metadata: { email, error: error instanceof Error ? error.message : String(error) } });
      }
    }
  }
}

async function studentTimeline(prisma, studentId, request) {
  const reports = await prisma.lessonReport.findMany({
    where: {
      studentId,
      lesson: { is: await reportLessonScopeWhere(prisma, request) },
      ...(isParentOnly(request.portalUser) ? { parentVisible: true } : {}),
    },
    include: reportInclude,
    orderBy: { lesson: { scheduledStart: "desc" } },
    take: 100,
  });

  return reports.map((report) => ({
    id: report.id,
    lessonDate: report.lesson.scheduledStart,
    tutor: report.tutor?.fullName,
    subject: subjectLabel(report.lesson.subject),
    topic: report.topicCovered,
    attendance: [report.lesson.studentAttendance, report.lesson.minutesLate ? `${report.lesson.minutesLate} minutes late` : null].filter(Boolean).join(" - "),
    summary: report.lessonSummary,
    homework: report.homeworkOrTaskGiven,
    nextSteps: report.nextLessonRecommendation,
    parentFriendlyUpdate: report.parentFriendlyUpdate,
  }));
}

async function canAccessStudentTimeline(prisma, request, studentId) {
  if (hasPermission(request.portalUser, "reports:manage") || hasPermission(request.portalUser, "lessons:manage")) {
    return true;
  }
  if (hasPermission(request.portalUser, "own:lesson-reports")) {
    const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    if (!tutor) return false;
    const assignment = await prisma.studentTutorAssignment.findFirst({ where: { studentId, tutorId: tutor.id, status: "ACTIVE" } });
    const lesson = await prisma.lesson.findFirst({ where: { studentId, OR: [{ tutorId: tutor.id }, { replacementTutorId: tutor.id }] } });
    return Boolean(assignment || lesson);
  }
  if (hasPermission(request.portalUser, "family:lesson-updates")) {
    const parent = await prisma.parent.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    const student = parent ? await prisma.student.findFirst({ where: { id: studentId, parentId: parent.id } }) : null;
    return Boolean(student);
  }
  return false;
}

function safeReportForUser(report, user) {
  if (!isParentOnly(user)) {
    return report;
  }
  return {
    id: report.id,
    lessonId: report.lessonId,
    studentId: report.studentId,
    tutorId: report.tutorId,
    topicCovered: report.topicCovered,
    lessonSummary: report.lessonSummary,
    studentParticipation: report.studentParticipation,
    studentUnderstanding: report.studentUnderstanding,
    homeworkOrTaskGiven: report.homeworkOrTaskGiven,
    homeworkDueDate: report.homeworkDueDate,
    nextLessonRecommendation: report.nextLessonRecommendation,
    parentFriendlyUpdate: report.parentFriendlyUpdate,
    submittedAt: report.submittedAt,
    lesson: report.lesson,
    student: report.student,
    tutor: report.tutor,
  };
}

function isParentOnly(user) {
  return hasPermission(user, "family:lesson-updates") && !hasPermission(user, "reports:manage") && !hasPermission(user, "lessons:manage");
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

function parseBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "Yes";
}

function optionalInt(value, min, max, message) {
  const cleaned = optional(value);
  if (!cleaned) return null;
  const number = Number.parseInt(cleaned, 10);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ValidationError(message);
  }
  return number;
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

function optionalDateTime(value) {
  const cleaned = optional(value);
  if (!cleaned) return null;
  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Please enter a valid arrival time.");
  }
  return date;
}

function cleanData(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateText(value) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

function subjectLabel(subject) {
  if (!subject?.name) {
    return "";
  }
  return subject.examPathway ? `${subject.name} - ${subject.examPathway}` : subject.name;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function handleWorkspaceError(error, response, next) {
  if (error instanceof ValidationError) {
    response.status(422).json({ ok: false, message: error.message });
    return;
  }
  if (error instanceof NotFoundError) {
    response.status(404).json({ ok: false, message: error.message });
    return;
  }
  next(error);
}

class ValidationError extends Error {}
class NotFoundError extends Error {}
