import { randomUUID } from "node:crypto";
import { getPrisma } from "./db.js";
import { auditLog, requireAnyPermission, requireSession } from "./authMiddleware.js";
import { hasPermission } from "./roles.js";

const lessonAccessPermissions = ["lessons:manage", "timetable:manage", "own:lessons", "own:timetable", "family:timetable"];
const availabilityAccessPermissions = ["timetable:manage", "own:timetable"];
const availabilityStatuses = ["PENDING", "APPROVED", "OVERRIDDEN", "REJECTED"];
const approvedAvailabilityStatuses = ["APPROVED", "OVERRIDDEN"];
const availabilityExceptionTypes = ["UNAVAILABLE", "HOLIDAY", "TEMPORARY_AVAILABLE", "TEMPORARY_UNAVAILABLE"];
const lessonStatuses = ["SCHEDULED", "TUTOR_READY", "IN_PROGRESS", "COMPLETED", "STUDENT_ABSENT", "TUTOR_ABSENT", "CANCELLED", "RESCHEDULED"];
const activeLessonStatuses = ["SCHEDULED", "TUTOR_READY", "IN_PROGRESS"];
const defaultTimeZone = "United Kingdom (GMT/BST)";
const timeZoneAliases = new Map([
  [defaultTimeZone, "Europe/London"],
  ["GMT/BST", "Europe/London"],
  ["UK", "Europe/London"],
  ["United Kingdom", "Europe/London"],
  ["Nigeria (WAT)", "Africa/Lagos"],
  ["WAT", "Africa/Lagos"],
  ["Nigeria", "Africa/Lagos"],
  ["UTC", "UTC"],
]);
const lessonTypes = [
  "One-to-One Tutoring",
  "Group Lesson",
  "Shadow Support",
  "NVQ Support",
  "Assessment Session",
  "Replacement Session",
  "Homework Support",
  "GCSE Preparation",
  "A-Level Preparation",
  "WAEC Preparation",
  "JAMB Preparation",
  "SAT Preparation",
  "IELTS Preparation",
  "University Admission Coaching",
  "Other",
];

const lessonInclude = {
  student: { select: { id: true, fullName: true, parentId: true } },
  students: {
    include: {
      parent: {
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      },
    },
  },
  tutor: { include: { user: { select: { id: true, email: true, name: true } } } },
  replacementTutor: { include: { user: { select: { id: true, email: true, name: true } } } },
  subject: { select: { id: true, name: true, examPathway: true } },
  parent: {
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  },
  createdBy: { select: { id: true, name: true, email: true } },
};

const availabilityInclude = {
  tutor: { select: { id: true, fullName: true, email: true, userId: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
};

export function registerSchedulingRoutes(app, { sendPortalEmail }) {
  app.get("/api/portal/scheduling/lookups", requireAnyPermission(lessonAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const scope = await lessonScopeWhere(prisma, request);
      const [students, tutors, subjects] = await Promise.all([
        prisma.student.findMany({ where: await scopedStudentLookupWhere(prisma, request), orderBy: { fullName: "asc" }, select: { id: true, fullName: true, yearGroup: true, parentId: true } }),
        prisma.tutor.findMany({ where: await scopedTutorLookupWhere(prisma, request), orderBy: { fullName: "asc" }, select: { id: true, fullName: true, email: true, timeZone: true } }),
        prisma.subject.findMany({ where: { isActive: true }, orderBy: [{ name: "asc" }, { examPathway: "asc" }], select: { id: true, name: true, examPathway: true } }),
      ]);
      response.json({ ok: true, students, tutors, subjects, lessonTypes, lessonStatuses, availabilityStatuses, availabilityExceptionTypes, scope });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/tutor-availability", requireAnyPermission(availabilityAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const where = await availabilityScopeWhere(prisma, request, buildAvailabilityWhere(request.query));
      const availability = await prisma.tutorAvailability.findMany({ where, include: availabilityInclude, orderBy: [{ tutor: { fullName: "asc" } }, { dayOfWeek: "asc" }, { startTime: "asc" }] });
      response.json({ ok: true, availability });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/tutor-availability", requireAnyPermission(availabilityAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const data = await parseAvailabilityInput(prisma, request);
      const availability = await prisma.tutorAvailability.create({ data, include: availabilityInclude });
      await auditLog({ request, actorId: request.portalUser.id, action: "tutor_availability_created", entityType: "TutorAvailability", entityId: availability.id, metadata: { tutorId: availability.tutorId, status: availability.status } });
      response.status(201).json({ ok: true, availability });
    } catch (error) {
      handleSchedulingError(error, response, next);
    }
  });

  app.patch("/api/portal/tutor-availability/:id", requireAnyPermission(availabilityAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const existing = await prisma.tutorAvailability.findUnique({ where: { id: request.params.id } });
      await assertAvailabilityRecordAccess(prisma, request, existing);
      const data = await parseAvailabilityInput(prisma, request, existing);
      const availability = await prisma.tutorAvailability.update({ where: { id: request.params.id }, data, include: availabilityInclude });
      await auditLog({ request, actorId: request.portalUser.id, action: "tutor_availability_updated", entityType: "TutorAvailability", entityId: availability.id, metadata: { tutorId: availability.tutorId, status: availability.status } });
      response.json({ ok: true, availability });
    } catch (error) {
      handleSchedulingError(error, response, next);
    }
  });

  app.post("/api/portal/tutor-availability/:id/approve", requireSession("timetable:manage"), async (request, response, next) => {
    try {
      const availability = await getPrisma().tutorAvailability.update({
        where: { id: request.params.id },
        data: {
          status: request.body?.override === true ? "OVERRIDDEN" : "APPROVED",
          approvedById: request.portalUser.id,
          approvedAt: new Date(),
          overrideReason: optional(request.body?.overrideReason),
        },
        include: availabilityInclude,
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "tutor_availability_approved", entityType: "TutorAvailability", entityId: availability.id, metadata: { status: availability.status } });
      response.json({ ok: true, availability });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/tutor-availability-exceptions", requireAnyPermission(availabilityAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const where = await availabilityScopeWhere(prisma, request, buildAvailabilityExceptionWhere(request.query));
      const exceptions = await prisma.tutorAvailabilityException.findMany({ where, include: availabilityInclude, orderBy: [{ exceptionDate: "desc" }, { startTime: "asc" }] });
      response.json({ ok: true, exceptions });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/tutor-availability-exceptions", requireAnyPermission(availabilityAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const data = await parseAvailabilityExceptionInput(prisma, request);
      const exception = await prisma.tutorAvailabilityException.create({ data, include: availabilityInclude });
      await auditLog({ request, actorId: request.portalUser.id, action: "tutor_availability_exception_created", entityType: "TutorAvailabilityException", entityId: exception.id, metadata: { tutorId: exception.tutorId, exceptionType: exception.exceptionType, status: exception.status } });
      response.status(201).json({ ok: true, exception });
    } catch (error) {
      handleSchedulingError(error, response, next);
    }
  });

  app.patch("/api/portal/tutor-availability-exceptions/:id", requireAnyPermission(availabilityAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const existing = await prisma.tutorAvailabilityException.findUnique({ where: { id: request.params.id } });
      await assertAvailabilityRecordAccess(prisma, request, existing);
      const data = await parseAvailabilityExceptionInput(prisma, request, existing);
      const exception = await prisma.tutorAvailabilityException.update({ where: { id: request.params.id }, data, include: availabilityInclude });
      await auditLog({ request, actorId: request.portalUser.id, action: "tutor_availability_exception_updated", entityType: "TutorAvailabilityException", entityId: exception.id, metadata: { tutorId: exception.tutorId, exceptionType: exception.exceptionType, status: exception.status } });
      response.json({ ok: true, exception });
    } catch (error) {
      handleSchedulingError(error, response, next);
    }
  });

  app.post("/api/portal/tutor-availability-exceptions/:id/approve", requireSession("timetable:manage"), async (request, response, next) => {
    try {
      const exception = await getPrisma().tutorAvailabilityException.update({
        where: { id: request.params.id },
        data: {
          status: request.body?.override === true ? "OVERRIDDEN" : "APPROVED",
          approvedById: request.portalUser.id,
          approvedAt: new Date(),
          overrideReason: optional(request.body?.overrideReason),
        },
        include: availabilityInclude,
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "tutor_availability_exception_approved", entityType: "TutorAvailabilityException", entityId: exception.id, metadata: { status: exception.status } });
      response.json({ ok: true, exception });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/lessons", requireAnyPermission(lessonAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const lessons = await prisma.lesson.findMany({
        where: { AND: [await lessonScopeWhere(prisma, request), buildLessonWhere(request.query)] },
        include: lessonInclude,
        orderBy: { scheduledStart: "asc" },
        take: 500,
      });
      response.json({ ok: true, lessons });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/lessons/:id", requireAnyPermission(lessonAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const lesson = await prisma.lesson.findFirst({ where: { AND: [{ id: request.params.id }, await lessonScopeWhere(prisma, request)] }, include: lessonInclude });
      if (!lesson) {
        response.status(404).json({ ok: false, message: "Lesson not found." });
        return;
      }
      response.json({ ok: true, lesson });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/lessons", requireSession("lessons:manage"), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const plan = await buildLessonPlan(prisma, request.body, request.portalUser.id);
      await assertScheduleIsValid(prisma, plan);
      const lessons = [];
      for (const occurrence of plan.occurrences) {
        const lesson = await prisma.lesson.create({ data: lessonCreateData(plan, occurrence), include: lessonInclude });
        lessons.push(lesson);
        await notifyLessonUsers({ prisma, request, lesson, eventType: "created", sendPortalEmail });
      }
      await auditLog({ request, actorId: request.portalUser.id, action: "lessons_created", entityType: "Lesson", metadata: { count: lessons.length, recurrenceGroupId: plan.recurrenceGroupId } });
      response.status(201).json({ ok: true, lessons, lesson: lessons[0] });
    } catch (error) {
      handleSchedulingError(error, response, next);
    }
  });

  app.patch("/api/portal/lessons/:id", requireSession("lessons:manage"), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const existing = await prisma.lesson.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        response.status(404).json({ ok: false, message: "Lesson not found." });
        return;
      }
      const plan = await buildLessonPlan(prisma, request.body, existing.createdById ?? request.portalUser.id, request.params.id);
      await assertScheduleIsValid(prisma, plan, request.params.id);
      const occurrence = plan.occurrences[0];
      const lesson = await prisma.lesson.update({ where: { id: request.params.id }, data: lessonUpdateData(plan, occurrence), include: lessonInclude });
      await notifyLessonUsers({ prisma, request, lesson, eventType: "updated", sendPortalEmail });
      await auditLog({ request, actorId: request.portalUser.id, action: "lesson_updated", entityType: "Lesson", entityId: lesson.id });
      response.json({ ok: true, lesson });
    } catch (error) {
      handleSchedulingError(error, response, next);
    }
  });

  app.post("/api/portal/lessons/:id/status", requireAnyPermission(["lessons:manage", "own:lessons"]), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const lesson = await prisma.lesson.findFirst({ where: { AND: [{ id: request.params.id }, await lessonScopeWhere(prisma, request)] } });
      if (!lesson) {
        response.status(404).json({ ok: false, message: "Lesson not found." });
        return;
      }
      const status = parseLessonStatus(request.body?.status);
      const now = new Date();
      const existingReport = await prisma.lessonReport.findUnique({ where: { lessonId: lesson.id }, select: { id: true } });
      const updated = await prisma.lesson.update({
        where: { id: request.params.id },
        data: {
          status,
          actualStart: status === "IN_PROGRESS" && !lesson.actualStart ? now : undefined,
          actualEnd: status === "COMPLETED" && !lesson.actualEnd ? now : undefined,
          reportStatus: status === "COMPLETED" ? (existingReport ? "SUBMITTED" : "REPORT_OUTSTANDING") : status === "CANCELLED" || status === "RESCHEDULED" ? "NOT_DUE" : undefined,
        },
        include: lessonInclude,
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "lesson_status_updated", entityType: "Lesson", entityId: updated.id, metadata: { status } });
      response.json({ ok: true, lesson: updated });
    } catch (error) {
      handleSchedulingError(error, response, next);
    }
  });

  app.post("/api/portal/lessons/:id/cancel", requireSession("lessons:manage"), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const lesson = await prisma.lesson.update({
        where: { id: request.params.id },
        data: {
          status: "CANCELLED",
          cancellationReason: required(request.body?.cancellationReason, "Cancellation reason is required."),
          cancellationInitiatedBy: required(request.body?.cancellationInitiatedBy, "Please record who initiated the cancellation."),
        },
        include: lessonInclude,
      });
      await notifyLessonUsers({ prisma, request, lesson, eventType: "cancelled", sendPortalEmail });
      await auditLog({ request, actorId: request.portalUser.id, action: "lesson_cancelled", entityType: "Lesson", entityId: lesson.id, metadata: { cancellationInitiatedBy: lesson.cancellationInitiatedBy } });
      response.json({ ok: true, lesson });
    } catch (error) {
      handleSchedulingError(error, response, next);
    }
  });

  app.post("/api/portal/lessons/:id/reschedule", requireSession("lessons:manage"), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const original = await prisma.lesson.findUnique({ where: { id: request.params.id }, include: { students: { select: { id: true } } } });
      if (!original) {
        response.status(404).json({ ok: false, message: "Lesson not found." });
        return;
      }
      const body = {
        ...request.body,
        studentIds: original.students.map((student) => student.id),
        tutorId: request.body?.replacementTutorId || original.tutorId,
        subjectId: original.subjectId,
        lessonType: request.body?.lessonType || original.lessonType,
        meetingLink: request.body?.meetingLink ?? original.meetingLink,
        lessonObjective: request.body?.lessonObjective ?? original.lessonObjective,
        notes: request.body?.notes ?? original.notes,
        recurrencePattern: "NONE",
        status: "SCHEDULED",
      };
      const plan = await buildLessonPlan(prisma, body, request.portalUser.id);
      await assertScheduleIsValid(prisma, plan, request.params.id);
      const [newLesson] = await prisma.$transaction([
        prisma.lesson.create({ data: { ...lessonCreateData(plan, plan.occurrences[0]), rescheduledFromId: original.id, replacementTutorId: optional(request.body?.replacementTutorId) }, include: lessonInclude }),
        prisma.lesson.update({ where: { id: original.id }, data: { status: "RESCHEDULED" } }),
      ]);
      await notifyLessonUsers({ prisma, request, lesson: newLesson, eventType: "rescheduled", sendPortalEmail });
      await auditLog({ request, actorId: request.portalUser.id, action: "lesson_rescheduled", entityType: "Lesson", entityId: original.id, metadata: { newLessonId: newLesson.id, replacementTutorId: newLesson.replacementTutorId } });
      response.status(201).json({ ok: true, lesson: newLesson });
    } catch (error) {
      handleSchedulingError(error, response, next);
    }
  });

  app.post("/api/portal/lessons/:id/send-reminder", requireAnyPermission(["lessons:manage", "timetable:manage"]), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const lesson = await prisma.lesson.findUnique({ where: { id: request.params.id }, include: lessonInclude });
      if (!lesson) {
        response.status(404).json({ ok: false, message: "Lesson not found." });
        return;
      }
      await notifyLessonUsers({ prisma, request, lesson, eventType: "reminder", sendPortalEmail });
      await auditLog({ request, actorId: request.portalUser.id, action: "lesson_reminder_sent", entityType: "Lesson", entityId: lesson.id });
      response.json({ ok: true, message: "Lesson reminder queued for relevant users." });
    } catch (error) {
      next(error);
    }
  });
}

async function buildLessonPlan(prisma, body, createdById, currentLessonId = null) {
  const studentIds = parseIdArray(body.studentIds ?? body.studentId);
  if (studentIds.length === 0) {
    throw new ValidationError("Select at least one student.");
  }

  const lessonType = required(body.lessonType, "Lesson type is required.");
  if (!lessonTypes.includes(lessonType)) {
    throw new ValidationError("Please select a valid lesson type.");
  }

  const timeZone = optional(body.timeZone) || defaultTimeZone;
  const scheduledStart = combineDateTime(body.date, body.startTime, timeZone);
  const scheduledEnd = combineDateTime(body.date, body.endTime, timeZone);
  assertTimeOrder(scheduledStart, scheduledEnd);

  const durationMinutes = Math.round((scheduledEnd.getTime() - scheduledStart.getTime()) / 60000);
  const students = await prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, parentId: true } });
  if (students.length !== studentIds.length) {
    throw new ValidationError("One or more selected students could not be found.");
  }

  const tutorId = required(body.tutorId, "Tutor is required.");
  const subjectId = required(body.subjectId, "Subject is required.");
  const [tutor, subject] = await Promise.all([
    prisma.tutor.findUnique({ where: { id: tutorId }, select: { id: true } }),
    prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true, isActive: true } }),
  ]);
  if (!tutor) {
    throw new ValidationError("Selected tutor could not be found.");
  }
  if (!subject || !subject.isActive) {
    throw new ValidationError("Selected subject is not active.");
  }

  const recurrencePattern = String(body.recurrencePattern || "NONE");
  const recurrence = parseRecurrence(recurrencePattern, scheduledStart, scheduledEnd, body, timeZone);
  const recurrenceGroupId = recurrencePattern === "WEEKLY" ? currentLessonId ? optional(body.recurrenceGroupId) || randomUUID() : randomUUID() : null;
  const primaryStudent = students.find((student) => student.id === studentIds[0]) ?? students[0];

  return {
    studentIds,
    primaryStudentId: primaryStudent.id,
    parentId: primaryStudent.parentId,
    tutorId,
    replacementTutorId: optional(body.replacementTutorId),
    effectiveTutorId: optional(body.replacementTutorId) || tutorId,
    subjectId,
    lessonType,
    timeZone,
    durationMinutes,
    meetingLink: optional(body.meetingLink),
    lessonObjective: optional(body.lessonObjective),
    notes: optional(body.notes),
    status: parseLessonStatus(body.status || "SCHEDULED"),
    recurrencePattern,
    recurrenceGroupId,
    createdById,
    occurrences: recurrence,
  };
}

function lessonCreateData(plan, occurrence) {
  return {
    studentId: plan.primaryStudentId,
    students: { connect: plan.studentIds.map((id) => ({ id })) },
    tutorId: plan.tutorId,
    replacementTutorId: plan.replacementTutorId,
    subjectId: plan.subjectId,
    parentId: plan.parentId,
    lessonType: plan.lessonType,
    scheduledStart: occurrence.start,
    scheduledEnd: occurrence.end,
    timeZone: plan.timeZone,
    durationMinutes: plan.durationMinutes,
    meetingLink: plan.meetingLink,
    lessonObjective: plan.lessonObjective,
    status: plan.status,
    recurrencePattern: plan.recurrencePattern,
    recurrenceGroupId: plan.recurrenceGroupId,
    createdById: plan.createdById,
    notes: plan.notes,
  };
}

function lessonUpdateData(plan, occurrence) {
  return {
    ...lessonCreateData(plan, occurrence),
    students: { set: plan.studentIds.map((id) => ({ id })) },
  };
}

async function assertScheduleIsValid(prisma, plan, currentLessonId = null) {
  const conflicts = [];

  for (const occurrence of plan.occurrences) {
    const tutorConflict = await prisma.lesson.findFirst({
      where: {
        id: currentLessonId ? { not: currentLessonId } : undefined,
        status: { in: activeLessonStatuses },
        OR: [{ tutorId: plan.effectiveTutorId }, { replacementTutorId: plan.effectiveTutorId }],
        scheduledStart: { lt: occurrence.end },
        scheduledEnd: { gt: occurrence.start },
      },
      include: { student: { select: { fullName: true } }, subject: { select: { name: true } } },
    });

    if (tutorConflict) {
      conflicts.push(`${dateTimeText(occurrence.start, plan.timeZone)} conflicts with another tutor booking for ${tutorConflict.student?.fullName ?? "a student"}.`);
    }

    const studentConflict = await prisma.lesson.findFirst({
      where: {
        id: currentLessonId ? { not: currentLessonId } : undefined,
        status: { in: activeLessonStatuses },
        OR: [{ studentId: { in: plan.studentIds } }, { students: { some: { id: { in: plan.studentIds } } } }],
        scheduledStart: { lt: occurrence.end },
        scheduledEnd: { gt: occurrence.start },
      },
      include: { student: { select: { fullName: true } }, tutor: { select: { fullName: true } } },
    });

    if (studentConflict) {
      conflicts.push(`${dateTimeText(occurrence.start, plan.timeZone)} conflicts with another student booking with ${studentConflict.tutor?.fullName ?? "a tutor"}.`);
    }

    const availabilityConflict = await checkTutorAvailability(prisma, plan.effectiveTutorId, occurrence.start, occurrence.end, plan.timeZone);
    if (availabilityConflict) {
      conflicts.push(`${dateTimeText(occurrence.start, plan.timeZone)} is outside approved tutor availability: ${availabilityConflict}`);
    }
  }

  if (conflicts.length > 0) {
    throw new ConflictError(`Conflict warning: ${conflicts.join(" ")}`);
  }
}

async function checkTutorAvailability(prisma, tutorId, start, end, lessonTimeZone = defaultTimeZone) {
  const exceptions = await prisma.tutorAvailabilityException.findMany({
    where: {
      tutorId,
      status: { in: approvedAvailabilityStatuses },
      exceptionDate: { gte: addDays(start, -2), lt: addDays(end, 2) },
    },
  });

  for (const exception of exceptions) {
    if (!exceptionAppliesToLesson(exception, start, end, lessonTimeZone)) {
      continue;
    }
    if (exception.exceptionType === "UNAVAILABLE" || exception.exceptionType === "HOLIDAY") {
      return exception.exceptionType === "HOLIDAY" ? "tutor is marked as on holiday." : "tutor is unavailable.";
    }
    if (exception.exceptionType === "TEMPORARY_UNAVAILABLE") {
      return "temporary unavailability overlaps this lesson.";
    }
  }

  const temporaryAvailability = exceptions.some((exception) => exception.exceptionType === "TEMPORARY_AVAILABLE" && exceptionAppliesToLesson(exception, start, end, lessonTimeZone));
  if (temporaryAvailability) {
    return null;
  }

  const rules = await prisma.tutorAvailability.findMany({
    where: {
      tutorId,
      status: { in: approvedAvailabilityStatuses },
      recurring: true,
    },
  });

  const covered = rules.some((rule) => {
    const ruleTimeZone = resolveTimeZone(rule.timeZone || lessonTimeZone);
    const lessonWindow = zonedLessonWindow(start, end, ruleTimeZone);
    return Number(rule.dayOfWeek) === lessonWindow.dayOfWeek && timeToMinutes(rule.startTime) <= lessonWindow.startMinutes && timeToMinutes(rule.endTime) >= lessonWindow.endMinutes;
  });
  return covered ? null : "no approved availability covers this time.";
}

function exceptionAppliesToLesson(exception, start, end, lessonTimeZone) {
  const exceptionTimeZone = resolveTimeZone(exception.timeZone || lessonTimeZone);
  if (zonedDateKey(exception.exceptionDate, exceptionTimeZone) !== zonedDateKey(start, exceptionTimeZone)) {
    return false;
  }
  const lessonWindow = zonedLessonWindow(start, end, exceptionTimeZone);
  return exceptionCovers(exception, lessonWindow.startMinutes, lessonWindow.endMinutes);
}

function exceptionCovers(exception, startMinutes, endMinutes) {
  if (!exception.startTime || !exception.endTime) {
    return true;
  }
  return timeToMinutes(exception.startTime) < endMinutes && timeToMinutes(exception.endTime) > startMinutes;
}

async function notifyLessonUsers({ prisma, request, lesson, eventType, sendPortalEmail }) {
  const recipients = new Map();
  const emailRecipients = new Set();
  const title = notificationTitle(eventType);
  const message = notificationMessage(lesson, eventType);

  addRecipient(recipients, lesson.tutor?.user, title, message);
  addRecipient(recipients, lesson.replacementTutor?.user, title, message);
  addRecipient(recipients, lesson.parent?.user, title, message);
  if (lesson.tutor?.email) emailRecipients.add(lesson.tutor.email);
  if (lesson.replacementTutor?.email) emailRecipients.add(lesson.replacementTutor.email);
  if (lesson.parent?.email) emailRecipients.add(lesson.parent.email);

  for (const student of lesson.students ?? []) {
    addRecipient(recipients, student.parent?.user, title, message);
    if (student.parent?.email) {
      emailRecipients.add(student.parent.email);
    }
  }

  for (const recipient of recipients.values()) {
    await prisma.notification.create({
      data: {
        recipientId: recipient.id,
        createdById: request.portalUser.id,
        title,
        message,
      },
    });
  }

  if (sendPortalEmail) {
    for (const email of emailRecipients) {
      try {
        await sendPortalEmail({
          to: email,
          subject: title,
          text: message,
          html: `<p>${escapeHtml(message)}</p>`,
        });
      } catch (error) {
        await auditLog({ request, actorId: request.portalUser.id, action: "lesson_notification_email_failed", entityType: "Lesson", entityId: lesson.id, metadata: { email, eventType, error: error instanceof Error ? error.message : String(error) } });
      }
    }
  }
}

function addRecipient(recipients, user, title, message) {
  if (user?.id) {
    recipients.set(user.id, { id: user.id, title, message });
  }
}

function notificationTitle(eventType) {
  if (eventType === "created") return "TutorHiveHub lesson scheduled";
  if (eventType === "updated") return "TutorHiveHub lesson updated";
  if (eventType === "rescheduled") return "TutorHiveHub lesson rescheduled";
  if (eventType === "cancelled") return "TutorHiveHub lesson cancelled";
  if (eventType === "reminder") return "TutorHiveHub upcoming lesson reminder";
  return "TutorHiveHub lesson notification";
}

function notificationMessage(lesson, eventType) {
  const students = (lesson.students?.length ? lesson.students : [lesson.student]).map((student) => student?.fullName).filter(Boolean).join(", ");
  const tutorName = lesson.replacementTutor?.fullName ? `${lesson.replacementTutor.fullName} (replacement tutor)` : lesson.tutor?.fullName;
  return `${notificationTitle(eventType)}: ${subjectLabel(lesson.subject) || "Lesson"} with ${tutorName ?? "TutorHiveHub"} for ${students || "student"} on ${dateTimeText(lesson.scheduledStart, lesson.timeZone)} (${lesson.timeZone || "time zone not set"}).`;
}

function subjectLabel(subject) {
  if (!subject?.name) {
    return "";
  }
  return subject.examPathway ? `${subject.name} - ${subject.examPathway}` : subject.name;
}

async function lessonScopeWhere(prisma, request) {
  const user = request.portalUser;
  if (canManageLessons(user)) {
    return {};
  }

  if (hasPermission(user, "own:lessons") || hasPermission(user, "own:timetable")) {
    const tutor = await prisma.tutor.findUnique({ where: { userId: user.id }, select: { id: true } });
    return tutor ? { OR: [{ tutorId: tutor.id }, { replacementTutorId: tutor.id }] } : { id: "__no_lesson_scope__" };
  }

  if (hasPermission(user, "family:timetable")) {
    const parent = await prisma.parent.findUnique({ where: { userId: user.id }, select: { id: true } });
    return parent ? { OR: [{ parentId: parent.id }, { students: { some: { parentId: parent.id } } }] } : { id: "__no_lesson_scope__" };
  }

  return { id: "__no_lesson_scope__" };
}

async function scopedStudentLookupWhere(prisma, request) {
  if (canManageLessons(request.portalUser)) {
    return { status: "ACTIVE" };
  }
  if (hasPermission(request.portalUser, "family:timetable")) {
    const parent = await prisma.parent.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    return parent ? { parentId: parent.id, status: "ACTIVE" } : { id: "__none__" };
  }
  return { id: "__none__" };
}

async function scopedTutorLookupWhere(prisma, request) {
  if (canManageLessons(request.portalUser)) {
    return { status: "ACTIVE" };
  }
  if (hasPermission(request.portalUser, "own:timetable")) {
    const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    return tutor ? { id: tutor.id } : { id: "__none__" };
  }
  return { id: "__none__" };
}

async function availabilityScopeWhere(prisma, request, baseWhere = {}) {
  if (hasPermission(request.portalUser, "timetable:manage")) {
    return baseWhere;
  }
  const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
  return tutor ? { AND: [baseWhere, { tutorId: tutor.id }] } : { id: "__no_availability_scope__" };
}

async function assertAvailabilityRecordAccess(prisma, request, record) {
  if (!record) {
    throw new NotFoundError("Availability record not found.");
  }
  if (hasPermission(request.portalUser, "timetable:manage")) {
    return;
  }
  const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
  if (!tutor || tutor.id !== record.tutorId) {
    throw new ForbiddenError("Access denied.");
  }
}

async function parseAvailabilityInput(prisma, request, existing = null) {
  const canManage = hasPermission(request.portalUser, "timetable:manage");
  const tutorId = await resolveAvailabilityTutorId(prisma, request, existing);
  const dayOfWeek = optionalInt(request.body?.dayOfWeek, 0, 6, "Day of week must be between 0 and 6.");
  if (dayOfWeek === null) {
    throw new ValidationError("Day of week is required.");
  }
  const startTime = requiredTime(request.body?.startTime, "Start time is required.");
  const endTime = requiredTime(request.body?.endTime, "End time is required.");
  assertTimeStrings(startTime, endTime);
  const status = canManage ? parseAvailabilityStatus(request.body?.status || existing?.status || "PENDING") : "PENDING";
  return cleanData({
    tutorId,
    dayOfWeek,
    startTime,
    endTime,
    timeZone: required(request.body?.timeZone, "Time zone is required."),
    recurring: request.body?.recurring === undefined ? true : parseBoolean(request.body.recurring),
    status,
    approvedById: canManage && (status === "APPROVED" || status === "OVERRIDDEN") ? request.portalUser.id : undefined,
    approvedAt: canManage && (status === "APPROVED" || status === "OVERRIDDEN") ? new Date() : undefined,
    overrideReason: optional(request.body?.overrideReason),
    notes: optional(request.body?.notes),
  });
}

async function parseAvailabilityExceptionInput(prisma, request, existing = null) {
  const canManage = hasPermission(request.portalUser, "timetable:manage");
  const tutorId = await resolveAvailabilityTutorId(prisma, request, existing);
  const exceptionType = required(request.body?.exceptionType, "Exception type is required.");
  if (!availabilityExceptionTypes.includes(exceptionType)) {
    throw new ValidationError("Please select a valid availability exception type.");
  }
  const startTime = optionalTime(request.body?.startTime);
  const endTime = optionalTime(request.body?.endTime);
  if (startTime && endTime) {
    assertTimeStrings(startTime, endTime);
  }
  const status = canManage ? parseAvailabilityStatus(request.body?.status || existing?.status || "PENDING") : "PENDING";
  const timeZone = required(request.body?.timeZone, "Time zone is required.");
  return cleanData({
    tutorId,
    exceptionDate: zonedDateStart(request.body?.exceptionDate, timeZone, "Exception date is required."),
    exceptionType,
    startTime,
    endTime,
    timeZone,
    status,
    approvedById: canManage && (status === "APPROVED" || status === "OVERRIDDEN") ? request.portalUser.id : undefined,
    approvedAt: canManage && (status === "APPROVED" || status === "OVERRIDDEN") ? new Date() : undefined,
    overrideReason: optional(request.body?.overrideReason),
    notes: optional(request.body?.notes),
  });
}

async function resolveAvailabilityTutorId(prisma, request, existing = null) {
  if (hasPermission(request.portalUser, "timetable:manage")) {
    return required(request.body?.tutorId || existing?.tutorId, "Tutor is required.");
  }
  const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
  if (!tutor) {
    throw new ForbiddenError("No tutor profile is linked to this account.");
  }
  return tutor.id;
}

function buildAvailabilityWhere(query) {
  return cleanData({
    tutorId: optional(query.tutorId),
    status: optional(query.status),
    dayOfWeek: query.dayOfWeek !== undefined && String(query.dayOfWeek) !== "" ? Number(query.dayOfWeek) : undefined,
  });
}

function buildAvailabilityExceptionWhere(query) {
  return cleanData({
    tutorId: optional(query.tutorId),
    status: optional(query.status),
    exceptionType: optional(query.exceptionType),
  });
}

function buildLessonWhere(query) {
  const clauses = [];
  const dateRange = dateRangeFromQuery(query);
  if (dateRange) clauses.push({ scheduledStart: dateRange });
  if (query.status) clauses.push({ status: String(query.status) });
  if (query.tutorId) clauses.push({ OR: [{ tutorId: String(query.tutorId) }, { replacementTutorId: String(query.tutorId) }] });
  if (query.studentId) clauses.push({ OR: [{ studentId: String(query.studentId) }, { students: { some: { id: String(query.studentId) } } }] });
  if (query.subjectId) clauses.push({ subjectId: String(query.subjectId) });
  if (query.lessonType) clauses.push({ lessonType: String(query.lessonType) });
  return clauses.length > 0 ? { AND: clauses } : {};
}

function dateRangeFromQuery(query) {
  const from = optional(query.from);
  const to = optional(query.to);
  if (!from && !to) {
    return null;
  }
  return cleanData({
    gte: from ? requiredDate(from, "Invalid start date.") : undefined,
    lt: to ? addDays(requiredDate(to, "Invalid end date."), 1) : undefined,
  });
}

function parseRecurrence(pattern, scheduledStart, scheduledEnd, body, timeZone = defaultTimeZone) {
  if (pattern === "NONE") {
    return [{ start: scheduledStart, end: scheduledEnd }];
  }
  if (pattern !== "WEEKLY") {
    throw new ValidationError("Only one-off and weekly recurring lessons are supported in this phase.");
  }

  const occurrenceCount = optionalInt(body.occurrenceCount, 2, 52, "Recurring lessons must have between 2 and 52 occurrences.");
  const recurrenceEndDate = optional(body.recurrenceEndDate) ? dateKeyFromParts(parseDateParts(body.recurrenceEndDate, "Invalid recurrence end date.")) : null;
  if (!occurrenceCount && !recurrenceEndDate) {
    throw new ValidationError("Recurring weekly lessons need an occurrence count or an end date.");
  }

  const occurrences = [];
  let currentStart = new Date(scheduledStart);
  let currentEnd = new Date(scheduledEnd);
  const max = occurrenceCount || 52;
  for (let index = 0; index < max; index += 1) {
    if (recurrenceEndDate && zonedDateKey(currentStart, timeZone) > recurrenceEndDate) {
      break;
    }
    occurrences.push({ start: new Date(currentStart), end: new Date(currentEnd) });
    currentStart = addZonedDays(currentStart, 7, timeZone);
    currentEnd = addZonedDays(currentEnd, 7, timeZone);
  }

  if (occurrences.length < 2) {
    throw new ValidationError("Recurring weekly lessons must generate at least two lessons.");
  }
  return occurrences;
}

function canManageLessons(user) {
  return hasPermission(user, "lessons:manage") || hasPermission(user, "timetable:manage");
}

function combineDateTime(date, time, timeZone = defaultTimeZone) {
  const parsed = zonedDateTimeToUtc(parseDateParts(date, "Date is required."), parseTimeParts(requiredTime(time, "Time is required.")), timeZone);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError("Please enter a valid lesson date and time.");
  }
  return parsed;
}

function assertTimeOrder(start, end) {
  if (end <= start) {
    throw new ValidationError("End time must be after start time.");
  }
}

function assertTimeStrings(startTime, endTime) {
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw new ValidationError("End time must be after start time.");
  }
}

function parseLessonStatus(value) {
  const status = String(value || "SCHEDULED");
  if (!lessonStatuses.includes(status)) {
    throw new ValidationError("Please select a valid lesson status.");
  }
  return status;
}

function parseAvailabilityStatus(value) {
  const status = String(value || "PENDING");
  if (!availabilityStatuses.includes(status)) {
    throw new ValidationError("Please select a valid availability status.");
  }
  return status;
}

function parseIdArray(value) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return [value];
  }
  return [];
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

function requiredTime(value, message) {
  const cleaned = optionalTime(value);
  if (!cleaned) {
    throw new ValidationError(message);
  }
  return cleaned;
}

function optionalTime(value) {
  const cleaned = optional(value);
  if (!cleaned) {
    return null;
  }
  const { hours, minutes } = parseTimeParts(cleaned);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function requiredDate(value, message) {
  const cleaned = required(value, message);
  const date = new Date(`${cleaned}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(message);
  }
  return date;
}

function optionalInt(value, min, max, message) {
  const cleaned = optional(value);
  if (!cleaned) {
    return null;
  }
  const number = Number.parseInt(cleaned, 10);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ValidationError(message);
  }
  return number;
}

function parseBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "Yes";
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value).split(":").map((part) => Number.parseInt(part, 10));
  return hours * 60 + minutes;
}

function parseDateParts(value, message) {
  const cleaned = required(value, message);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleaned);
  if (!match) {
    throw new ValidationError(message);
  }
  const [, yearText, monthText, dayText] = match;
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new ValidationError(message);
  }
  return { year, month, day };
}

function parseTimeParts(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) {
    throw new ValidationError("Please enter time in HH:MM format.");
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) {
    throw new ValidationError("Please enter a valid time.");
  }
  return { hours, minutes };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function zonedDateStart(date, timeZone, message) {
  return zonedDateTimeToUtc(parseDateParts(date, message), { hours: 0, minutes: 0 }, timeZone);
}

function zonedDateTimeToUtc(dateParts, timeParts, timeZone) {
  const zone = resolveTimeZone(timeZone);
  const utcGuess = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, timeParts.hours, timeParts.minutes, 0, 0);
  const firstOffset = timeZoneOffsetMs(new Date(utcGuess), zone);
  let utcTime = utcGuess - firstOffset;
  const secondOffset = timeZoneOffsetMs(new Date(utcTime), zone);
  if (secondOffset !== firstOffset) {
    utcTime = utcGuess - secondOffset;
  }
  return new Date(utcTime);
}

function addZonedDays(date, days, timeZone) {
  const zone = resolveTimeZone(timeZone);
  const parts = zonedDateTimeParts(date, zone);
  const nextDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return zonedDateTimeToUtc(
    { year: nextDate.getUTCFullYear(), month: nextDate.getUTCMonth() + 1, day: nextDate.getUTCDate() },
    { hours: parts.hour, minutes: parts.minute },
    zone,
  );
}

function zonedLessonWindow(start, end, timeZone) {
  const zone = resolveTimeZone(timeZone);
  const startParts = zonedDateTimeParts(start, zone);
  const endParts = zonedDateTimeParts(end, zone);
  return {
    dayOfWeek: dayOfWeekFromParts(startParts),
    startMinutes: startParts.hour * 60 + startParts.minute,
    endMinutes: endParts.hour * 60 + endParts.minute,
  };
}

function zonedDateKey(value, timeZone) {
  return dateKeyFromParts(zonedDateTimeParts(value, resolveTimeZone(timeZone)));
}

function dateKeyFromParts(parts) {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function dayOfWeekFromParts(parts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

const dateTimeFormatters = new Map();

function zonedDateTimeParts(value, timeZone) {
  const zone = resolveTimeZone(timeZone);
  const formatter = getDateTimePartsFormatter(zone);
  const values = {};
  for (const part of formatter.formatToParts(new Date(value))) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }
  return {
    year: Number.parseInt(values.year, 10),
    month: Number.parseInt(values.month, 10),
    day: Number.parseInt(values.day, 10),
    hour: Number.parseInt(values.hour, 10),
    minute: Number.parseInt(values.minute, 10),
    second: Number.parseInt(values.second || "0", 10),
  };
}

function getDateTimePartsFormatter(timeZone) {
  if (!dateTimeFormatters.has(timeZone)) {
    dateTimeFormatters.set(timeZone, new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }));
  }
  return dateTimeFormatters.get(timeZone);
}

function timeZoneOffsetMs(date, timeZone) {
  const parts = zonedDateTimeParts(date, timeZone);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
  return localAsUtc - date.getTime();
}

function resolveTimeZone(value) {
  const cleaned = optional(value) || defaultTimeZone;
  const explicit = timeZoneAliases.get(cleaned);
  const inferred = explicit || inferTimeZone(cleaned);
  if (isValidTimeZone(inferred)) {
    return inferred;
  }
  return "UTC";
}

function inferTimeZone(value) {
  const cleaned = String(value || "").trim();
  const lowered = cleaned.toLowerCase();
  if (lowered.includes("united kingdom") || lowered.includes("gmt/bst") || lowered.includes("london")) {
    return "Europe/London";
  }
  if (lowered.includes("nigeria") || lowered.includes("wat") || lowered.includes("lagos")) {
    return "Africa/Lagos";
  }
  if (lowered === "other") {
    return "UTC";
  }
  return cleaned;
}

function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function dateTimeText(value, timeZone = defaultTimeZone) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: resolveTimeZone(timeZone) }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanData(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null));
}

function handleSchedulingError(error, response, next) {
  if (error instanceof ConflictError) {
    response.status(409).json({ ok: false, message: error.message });
    return;
  }
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
class ConflictError extends Error {}
class ForbiddenError extends Error {}
class NotFoundError extends Error {}

export const __schedulingTestInternals = {
  checkTutorAvailability,
  combineDateTime,
  dateTimeText,
  parseRecurrence,
  resolveTimeZone,
  zonedDateKey,
};
