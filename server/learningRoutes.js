import fs from "node:fs/promises";
import path from "node:path";
import { getPrisma } from "./db.js";
import { auditLog, requireAnyPermission } from "./authMiddleware.js";
import { hasPermission } from "./roles.js";

const learningAccessPermissions = [
  "homework:manage",
  "own:homework",
  "family:homework",
  "resources:manage",
  "resources:approved",
  "progress:manage",
  "own:progress",
  "family:progress",
];
const homeworkAccessPermissions = ["homework:manage", "own:homework", "family:homework"];
const homeworkManagePermissions = ["homework:manage", "own:homework"];
const resourceAccessPermissions = ["resources:manage", "resources:approved"];
const progressAccessPermissions = ["progress:manage", "own:progress", "family:progress"];
const progressManagePermissions = ["progress:manage", "own:progress"];
const notificationAccessPermissions = ["notifications:manage", "own:notifications"];

const homeworkStatuses = ["DRAFT", "ASSIGNED", "SUBMITTED", "LATE", "REVIEWED", "RESUBMISSION_REQUIRED", "COMPLETED", "CANCELLED"];
const reviewStatuses = ["REVIEWED", "RESUBMISSION_REQUIRED", "COMPLETED"];
const resourceTypes = ["DOCUMENT", "PDF", "PRESENTATION", "WORKSHEET", "IMAGE", "APPROVED_LINK", "VIDEO", "OTHER"];
const resourceVisibility = ["INTERNAL", "TUTORS", "PARENTS", "STUDENTS"];
const resourceStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"];
const goalStatuses = ["NOT_STARTED", "IN_PROGRESS", "ACHIEVED", "NEEDS_REVIEW", "PAUSED", "ARCHIVED"];

const allowedUploadExtensions = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".txt", ".mp4", ".mov", ".webm"]);
const allowedUploadMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const homeworkInclude = {
  student: { select: { id: true, fullName: true, parentId: true, yearGroup: true, userId: true, user: { select: { id: true, email: true, name: true } }, parent: { select: { id: true, fullName: true, email: true, userId: true, user: { select: { id: true, email: true, name: true } } } } } },
  tutor: { select: { id: true, fullName: true, email: true, userId: true, user: { select: { id: true, email: true, name: true } } } },
  subject: { select: { id: true, name: true, examPathway: true } },
  lesson: { select: { id: true, lessonType: true, scheduledStart: true, scheduledEnd: true } },
  resources: {
    include: {
      subject: { select: { id: true, name: true } },
      tutor: { select: { id: true, fullName: true } },
      student: { select: { id: true, fullName: true } },
    },
    orderBy: { title: "asc" },
  },
  submissions: {
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  },
};

const resourceInclude = {
  subject: { select: { id: true, name: true, examPathway: true } },
  tutor: { select: { id: true, fullName: true, email: true, userId: true } },
  student: { select: { id: true, fullName: true, yearGroup: true, parentId: true, userId: true } },
  lesson: { select: { id: true, scheduledStart: true, lessonType: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
};

const progressInclude = {
  student: { select: { id: true, fullName: true, parentId: true, yearGroup: true, userId: true } },
  tutor: { select: { id: true, fullName: true, email: true, userId: true } },
  subject: { select: { id: true, name: true, examPathway: true } },
  createdBy: { select: { id: true, name: true, email: true } },
};

export function registerLearningRoutes(app, upload, { sendPortalEmail } = {}) {
  app.get("/api/portal/learning/lookups", requireAnyPermission(learningAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const [students, tutors, subjects, lessons, resources] = await Promise.all([
        prisma.student.findMany({ where: await studentScopeWhere(prisma, request), orderBy: { fullName: "asc" }, select: { id: true, fullName: true, parentId: true, yearGroup: true, examPathway: true, status: true } }),
        prisma.tutor.findMany({ where: await tutorScopeWhere(prisma, request), orderBy: { fullName: "asc" }, select: { id: true, fullName: true, email: true, status: true } }),
        prisma.subject.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, examPathway: true, category: true } }),
        prisma.lesson.findMany({ where: await lessonLookupWhere(prisma, request), orderBy: { scheduledStart: "desc" }, take: 100, select: { id: true, studentId: true, tutorId: true, subjectId: true, lessonType: true, scheduledStart: true } }),
        prisma.resource.findMany({ where: await resourceScopeWhere(prisma, request), include: resourceInclude, orderBy: { title: "asc" }, take: 200 }),
      ]);

      response.json({
        ok: true,
        students,
        tutors,
        subjects,
        lessons,
        resources: resources.map(safeResource),
        homeworkStatuses,
        reviewStatuses,
        resourceTypes,
        resourceVisibility,
        resourceStatuses,
        goalStatuses,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/homework", requireAnyPermission(homeworkAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const homework = await prisma.homework.findMany({
        where: { AND: [await homeworkScopeWhere(prisma, request), buildHomeworkWhere(request.query, request.portalUser)] },
        include: homeworkInclude,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 300,
      });
      response.json({ ok: true, homework: homework.map((item) => safeHomework(item, request.portalUser)) });
    } catch (error) {
      handleLearningError(error, response, next);
    }
  });

  app.get("/api/portal/homework/:id", requireAnyPermission(homeworkAccessPermissions), async (request, response, next) => {
    try {
      const homework = await findHomeworkForRequest(getPrisma(), request, request.params.id);
      response.json({ ok: true, homework: safeHomework(homework, request.portalUser) });
    } catch (error) {
      handleLearningError(error, response, next);
    }
  });

  app.get("/api/portal/homework/:id/attachments/:index/download", requireAnyPermission(homeworkAccessPermissions), async (request, response, next) => {
    try {
      const homework = await findHomeworkForRequest(getPrisma(), request, request.params.id);
      const index = Number.parseInt(String(request.params.index), 10);
      const attachments = Array.isArray(homework.attachments) ? homework.attachments : [];
      const attachment = attachments[index];
      if (!attachment?.key || Number.isNaN(index)) {
        throw new NotFoundError("Homework attachment not found.");
      }
      await sendStoredFile(response, attachment.key, attachment.originalName || "homework-attachment");
    } catch (error) {
      handleLearningError(error, response, next);
    }
  });

  app.post("/api/portal/homework", requireAnyPermission(homeworkManagePermissions), upload.single("attachment"), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const homework = await createHomework({ prisma, request, sendPortalEmail });
      await auditLog({ request, actorId: request.portalUser.id, action: "homework_created", entityType: "Homework", entityId: homework.id, metadata: { status: homework.status } });
      response.status(201).json({ ok: true, homework: safeHomework(homework, request.portalUser) });
    } catch (error) {
      handleLearningError(error, response, next);
    }
  });

  app.post("/api/portal/homework/:id/publish", requireAnyPermission(homeworkManagePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const existing = await findHomeworkForRequest(prisma, request, request.params.id, true);
      const homework = await prisma.homework.update({
        where: { id: existing.id },
        data: { status: "ASSIGNED", publishedAt: new Date() },
        include: homeworkInclude,
      });
      await notifyHomeworkAssigned({ prisma, request, homework, sendPortalEmail });
      await auditLog({ request, actorId: request.portalUser.id, action: "homework_published", entityType: "Homework", entityId: homework.id });
      response.json({ ok: true, homework: safeHomework(homework, request.portalUser) });
    } catch (error) {
      handleLearningError(error, response, next);
    }
  });

  app.post("/api/portal/homework/:id/submit", requireAnyPermission(["own:homework"]), upload.single("submissionFile"), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const homework = await findHomeworkForRequest(prisma, request, request.params.id);
      await assertStudentCanSubmit(prisma, request, homework);
      const stored = request.file ? await storeLearningUpload(request.file, "homework-submissions") : null;
      const status = isLate(homework.dueDate) ? "LATE" : "SUBMITTED";
      const submission = await prisma.homeworkSubmission.create({
        data: {
          homeworkId: homework.id,
          studentId: homework.studentId,
          submittedById: request.portalUser.id,
          comments: optional(request.body?.comments),
          fileKey: stored?.key,
          fileName: stored?.originalName,
          fileMimeType: stored?.mimeType,
          fileSize: stored?.size,
          status,
        },
      });
      const updated = await prisma.homework.update({
        where: { id: homework.id },
        data: { status, submittedAt: new Date() },
        include: homeworkInclude,
      });
      await notifyHomeworkSubmitted({ prisma, request, homework: updated, submission, sendPortalEmail });
      await auditLog({ request, actorId: request.portalUser.id, action: "homework_submitted", entityType: "HomeworkSubmission", entityId: submission.id, metadata: { homeworkId: homework.id, status } });
      response.status(201).json({ ok: true, homework: safeHomework(updated, request.portalUser) });
    } catch (error) {
      handleLearningError(error, response, next);
    }
  });

  app.post("/api/portal/homework/:id/review", requireAnyPermission(homeworkManagePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const existing = await findHomeworkForRequest(prisma, request, request.params.id, true);
      const status = parseOption(request.body?.status, reviewStatuses, "Select a valid review status.");
      const latestSubmission = existing.submissions?.[0] ?? null;
      const mark = parseOptionalDecimal(request.body?.mark);
      const feedback = required(request.body?.feedback, "Feedback is required.");
      const now = new Date();

      if (latestSubmission) {
        await prisma.homeworkSubmission.update({
          where: { id: latestSubmission.id },
          data: { mark, feedback, status, reviewedById: request.portalUser.id, reviewedAt: now },
        });
      }

      const homework = await prisma.homework.update({
        where: { id: existing.id },
        data: {
          status,
          mark,
          feedback,
          reviewedAt: now,
          completedAt: status === "COMPLETED" ? now : null,
          resubmissionRequestedAt: status === "RESUBMISSION_REQUIRED" ? now : null,
        },
        include: homeworkInclude,
      });
      await notifyFeedbackAvailable({ prisma, request, homework, sendPortalEmail });
      await auditLog({ request, actorId: request.portalUser.id, action: "homework_reviewed", entityType: "Homework", entityId: homework.id, metadata: { status, mark } });
      response.json({ ok: true, homework: safeHomework(homework, request.portalUser) });
    } catch (error) {
      handleLearningError(error, response, next);
    }
  });

  app.get("/api/portal/homework-submissions/:id/download", requireAnyPermission(homeworkAccessPermissions), async (request, response, next) => {
    try {
      const submission = await findSubmissionForRequest(getPrisma(), request, request.params.id);
      if (!submission.fileKey) {
        throw new NotFoundError("Submission file not found.");
      }
      await sendStoredFile(response, submission.fileKey, submission.fileName || "homework-submission");
    } catch (error) {
      handleLearningError(error, response, next);
    }
  });

  app.get("/api/portal/resources", requireAnyPermission(resourceAccessPermissions), async (request, response, next) => {
    try {
      const resources = await getPrisma().resource.findMany({
        where: { AND: [await resourceScopeWhere(getPrisma(), request), buildResourceWhere(request.query)] },
        include: resourceInclude,
        orderBy: [{ status: "asc" }, { title: "asc" }],
        take: 300,
      });
      response.json({ ok: true, resources: resources.map(safeResource) });
    } catch (error) {
      handleLearningError(error, response, next);
    }
  });

  app.post("/api/portal/resources", requireAnyPermission(["resources:manage"]), upload.single("file"), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const stored = request.file ? await storeLearningUpload(request.file, "resources") : null;
      const data = parseResourceInput(request.body, request.portalUser.id, stored);
      const resource = await prisma.resource.create({ data, include: resourceInclude });
      await auditLog({ request, actorId: request.portalUser.id, action: "resource_created", entityType: "Resource", entityId: resource.id, metadata: { resourceType: resource.resourceType, visibility: resource.visibility } });
      response.status(201).json({ ok: true, resource: safeResource(resource) });
    } catch (error) {
      handleLearningError(error, response, next);
    }
  });

  app.get("/api/portal/resources/:id/download", requireAnyPermission(resourceAccessPermissions), async (request, response, next) => {
    try {
      const resource = await findResourceForRequest(getPrisma(), request, request.params.id);
      if (!resource.fileKey) {
        throw new NotFoundError("Resource file not found.");
      }
      await sendStoredFile(response, resource.fileKey, resource.fileName || resource.title);
    } catch (error) {
      handleLearningError(error, response, next);
    }
  });

  app.get("/api/portal/progress", requireAnyPermission(progressAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const progress = await prisma.progressRecord.findMany({
        where: { AND: [await progressScopeWhere(prisma, request), buildProgressWhere(request.query)] },
        include: progressInclude,
        orderBy: { reviewDate: "desc" },
        take: 300,
      });
      response.json({ ok: true, progress: progress.map((record) => safeProgress(record, request.portalUser)) });
    } catch (error) {
      handleLearningError(error, response, next);
    }
  });

  app.post("/api/portal/progress", requireAnyPermission(progressManagePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const data = await parseProgressInput(prisma, request);
      const record = await prisma.progressRecord.create({ data, include: progressInclude });
      if (record.parentVisible) {
        await notifyProgressUpdated({ prisma, request, record, sendPortalEmail });
      }
      await auditLog({ request, actorId: request.portalUser.id, action: "progress_record_created", entityType: "ProgressRecord", entityId: record.id, metadata: { studentId: record.studentId, goalStatus: record.goalStatus, parentVisible: record.parentVisible } });
      response.status(201).json({ ok: true, progressRecord: safeProgress(record, request.portalUser) });
    } catch (error) {
      handleLearningError(error, response, next);
    }
  });

  app.get("/api/portal/notifications", requireAnyPermission(notificationAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const where = hasPermission(request.portalUser, "notifications:manage") && request.query.scope === "all" ? buildNotificationWhere(request.query) : { AND: [{ recipientId: request.portalUser.id }, buildNotificationWhere(request.query)] };
      const notifications = await prisma.notification.findMany({
        where,
        include: {
          recipient: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 300,
      });
      response.json({ ok: true, notifications });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/notifications/:id/read", requireAnyPermission(notificationAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const notification = await prisma.notification.findFirst({
        where: hasPermission(request.portalUser, "notifications:manage") ? { id: request.params.id } : { id: request.params.id, recipientId: request.portalUser.id },
      });
      if (!notification) {
        throw new NotFoundError("Notification not found.");
      }
      const updated = await prisma.notification.update({ where: { id: notification.id }, data: { status: "READ", readAt: new Date() } });
      await auditLog({ request, actorId: request.portalUser.id, action: "notification_marked_read", entityType: "Notification", entityId: notification.id });
      response.json({ ok: true, notification: updated });
    } catch (error) {
      handleLearningError(error, response, next);
    }
  });

  app.post("/api/portal/notifications/read-all", requireAnyPermission(notificationAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      await prisma.notification.updateMany({
        where: { recipientId: request.portalUser.id, status: "UNREAD" },
        data: { status: "READ", readAt: new Date() },
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "notifications_marked_read", entityType: "Notification" });
      response.json({ ok: true, message: "Notifications marked as read." });
    } catch (error) {
      next(error);
    }
  });
}

async function createHomework({ prisma, request, sendPortalEmail }) {
  const body = request.body ?? {};
  const tutorId = await resolveTutorForHomework(prisma, request, body.tutorId);
  const studentId = required(body.studentId, "Student is required.");
  await assertStudentInHomeworkScope(prisma, request, studentId, tutorId);
  const resourceIds = parseIdArray(body.resourceIds);
  const resourceConnect = resourceIds.length ? { connect: resourceIds.map((id) => ({ id })) } : undefined;
  const stored = request.file ? await storeLearningUpload(request.file, "homework-attachments") : null;
  const status = parseOption(body.status || (parseBoolean(body.saveDraft) ? "DRAFT" : "ASSIGNED"), ["DRAFT", "ASSIGNED"], "Homework can be saved as draft or assigned.");

  const homework = await prisma.homework.create({
    data: cleanData({
      studentId,
      tutorId,
      lessonId: optional(body.lessonId),
      subjectId: optional(body.subjectId),
      title: required(body.title, "Homework title is required."),
      details: required(body.details || body.instructions, "Homework instructions are required."),
      instructions: optional(body.instructions),
      gradingCriteria: optional(body.gradingCriteria),
      maxMarks: parseOptionalDecimal(body.maxMarks),
      dueDate: optionalDate(body.dueDate),
      status,
      publishedAt: status === "ASSIGNED" ? new Date() : null,
      attachments: stored ? [stored] : undefined,
      resources: resourceConnect,
    }),
    include: homeworkInclude,
  });

  if (homework.status === "ASSIGNED") {
    await notifyHomeworkAssigned({ prisma, request, homework, sendPortalEmail });
  }
  return homework;
}

async function notifyHomeworkAssigned({ prisma, request, homework, sendPortalEmail }) {
  const recipients = homeworkRecipients(homework);
  await notifyUsers({
    prisma,
    request,
    users: recipients.users,
    emails: recipients.emails,
    title: "TutorHiveHub homework assigned",
    message: `${homework.title} has been assigned to ${homework.student?.fullName || "a student"}${homework.dueDate ? ` and is due on ${dateText(homework.dueDate)}` : ""}.`,
    category: "HOMEWORK_ASSIGNED",
    entityType: "Homework",
    entityId: homework.id,
    sendPortalEmail,
  });
}

async function notifyHomeworkSubmitted({ prisma, request, homework, submission, sendPortalEmail }) {
  const users = [homework.tutor?.user].filter(Boolean);
  const emails = [homework.tutor?.email].filter(Boolean);
  await notifyUsers({
    prisma,
    request,
    users,
    emails,
    title: "TutorHiveHub homework submitted",
    message: `${homework.student?.fullName || "A student"} submitted ${homework.title}.`,
    category: "HOMEWORK_SUBMITTED",
    entityType: "HomeworkSubmission",
    entityId: submission.id,
    sendPortalEmail,
  });
}

async function notifyFeedbackAvailable({ prisma, request, homework, sendPortalEmail }) {
  const recipients = homeworkRecipients(homework);
  await notifyUsers({
    prisma,
    request,
    users: recipients.users,
    emails: recipients.emails,
    title: "TutorHiveHub homework feedback available",
    message: `Feedback is available for ${homework.title}.`,
    category: "FEEDBACK_AVAILABLE",
    entityType: "Homework",
    entityId: homework.id,
    sendPortalEmail,
  });
}

async function notifyProgressUpdated({ prisma, request, record, sendPortalEmail }) {
  const student = await prisma.student.findUnique({
    where: { id: record.studentId },
    include: { parent: { include: { user: { select: { id: true, email: true, name: true } } } }, user: { select: { id: true, email: true, name: true } } },
  });
  await notifyUsers({
    prisma,
    request,
    users: [student?.parent?.user, student?.user].filter(Boolean),
    emails: [student?.parent?.email, student?.user?.email].filter(Boolean),
    title: "TutorHiveHub progress update",
    message: `A progress update is available for ${student?.fullName || "your student"}.`,
    category: "PROGRESS_UPDATED",
    entityType: "ProgressRecord",
    entityId: record.id,
    sendPortalEmail,
  });
}

async function notifyUsers({ prisma, request, users, emails, title, message, category, entityType, entityId, sendPortalEmail }) {
  const uniqueUsers = new Map();
  for (const user of users) {
    if (user?.id) uniqueUsers.set(user.id, user);
  }
  const uniqueEmails = new Set(emails.filter(Boolean));
  for (const user of uniqueUsers.values()) {
    await prisma.notification.create({
      data: {
        recipientId: user.id,
        createdById: request.portalUser.id,
        title,
        message,
        category,
        entityType,
        entityId,
      },
    });
  }
  if (!sendPortalEmail) {
    return;
  }
  for (const email of uniqueEmails) {
    try {
      await sendPortalEmail({ to: email, subject: title, text: message, html: `<p>${escapeHtml(message)}</p>` });
    } catch (error) {
      await auditLog({ request, actorId: request.portalUser.id, action: "learning_notification_email_failed", entityType, entityId, metadata: { email, category, error: error instanceof Error ? error.message : String(error) } });
    }
  }
}

function homeworkRecipients(homework) {
  const users = [homework.student?.user, homework.student?.parent?.user].filter(Boolean);
  const emails = [homework.student?.parent?.email, homework.student?.user?.email].filter(Boolean);
  return { users, emails };
}

async function findHomeworkForRequest(prisma, request, id, manageOnly = false) {
  const scope = manageOnly ? await homeworkManageScopeWhere(prisma, request) : await homeworkScopeWhere(prisma, request);
  const homework = await prisma.homework.findFirst({ where: { AND: [{ id }, scope] }, include: homeworkInclude });
  if (!homework) {
    throw new NotFoundError("Homework not found.");
  }
  return homework;
}

async function findSubmissionForRequest(prisma, request, id) {
  const submission = await prisma.homeworkSubmission.findFirst({
    where: { id, homework: { is: await homeworkScopeWhere(prisma, request) } },
    include: { homework: { include: homeworkInclude } },
  });
  if (!submission) {
    throw new NotFoundError("Homework submission not found.");
  }
  return submission;
}

async function findResourceForRequest(prisma, request, id) {
  const resource = await prisma.resource.findFirst({ where: { AND: [{ id }, await resourceScopeWhere(prisma, request)] }, include: resourceInclude });
  if (!resource) {
    throw new NotFoundError("Resource not found.");
  }
  return resource;
}

async function homeworkScopeWhere(prisma, request) {
  if (hasPermission(request.portalUser, "homework:manage")) {
    return {};
  }
  if (hasPermission(request.portalUser, "own:homework")) {
    const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    if (tutor) return { tutorId: tutor.id };
    const student = await prisma.student.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    if (student) return { studentId: student.id, status: { not: "DRAFT" } };
  }
  if (hasPermission(request.portalUser, "family:homework")) {
    const parent = await prisma.parent.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    return parent ? { student: { parentId: parent.id }, status: { not: "DRAFT" } } : { id: "__no_homework_scope__" };
  }
  return { id: "__no_homework_scope__" };
}

async function homeworkManageScopeWhere(prisma, request) {
  if (hasPermission(request.portalUser, "homework:manage")) {
    return {};
  }
  if (hasPermission(request.portalUser, "own:homework")) {
    const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    return tutor ? { tutorId: tutor.id } : { id: "__no_homework_manage_scope__" };
  }
  return { id: "__no_homework_manage_scope__" };
}

async function resourceScopeWhere(prisma, request) {
  if (hasPermission(request.portalUser, "resources:manage")) {
    return {};
  }
  if (hasPermission(request.portalUser, "resources:approved")) {
    const [tutor, student, parent] = await Promise.all([
      prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } }),
      prisma.student.findUnique({ where: { userId: request.portalUser.id }, select: { id: true, parentId: true, subjects: { select: { id: true } } } }),
      prisma.parent.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } }),
    ]);
    if (tutor) {
      return { status: "ACTIVE", OR: [{ visibility: "TUTORS" }, { tutorId: tutor.id }] };
    }
    if (student) {
      const subjectIds = student.subjects.map((subject) => subject.id);
      return {
        status: "ACTIVE",
        OR: [
          { visibility: "STUDENTS" },
          { studentId: student.id },
          { subjectId: { in: subjectIds } },
        ],
      };
    }
    if (parent) {
      return { status: "ACTIVE", OR: [{ visibility: "PARENTS" }, { student: { parentId: parent.id } }] };
    }
  }
  return { id: "__no_resource_scope__" };
}

async function progressScopeWhere(prisma, request) {
  if (hasPermission(request.portalUser, "progress:manage")) {
    return {};
  }
  if (hasPermission(request.portalUser, "own:progress")) {
    const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    if (tutor) return { tutorId: tutor.id };
    const student = await prisma.student.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    if (student) return { studentId: student.id, parentVisible: true };
  }
  if (hasPermission(request.portalUser, "family:progress")) {
    const parent = await prisma.parent.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    return parent ? { student: { parentId: parent.id }, parentVisible: true } : { id: "__no_progress_scope__" };
  }
  return { id: "__no_progress_scope__" };
}

async function studentScopeWhere(prisma, request) {
  if (hasPermission(request.portalUser, "homework:manage") || hasPermission(request.portalUser, "progress:manage")) {
    return { status: "ACTIVE" };
  }
  if (hasPermission(request.portalUser, "own:homework") || hasPermission(request.portalUser, "own:progress")) {
    const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    if (tutor) return { status: "ACTIVE", tutorAssignments: { some: { tutorId: tutor.id, status: "ACTIVE" } } };
    const student = await prisma.student.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    if (student) return { id: student.id };
  }
  if (hasPermission(request.portalUser, "family:homework") || hasPermission(request.portalUser, "family:progress")) {
    const parent = await prisma.parent.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
    return parent ? { parentId: parent.id } : { id: "__no_student_scope__" };
  }
  return { id: "__no_student_scope__" };
}

async function tutorScopeWhere(prisma, request) {
  if (hasPermission(request.portalUser, "homework:manage") || hasPermission(request.portalUser, "progress:manage")) {
    return { status: "ACTIVE" };
  }
  const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
  return tutor ? { id: tutor.id } : { id: "__no_tutor_scope__" };
}

async function lessonLookupWhere(prisma, request) {
  if (hasPermission(request.portalUser, "homework:manage")) {
    return {};
  }
  const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
  if (tutor) return { OR: [{ tutorId: tutor.id }, { replacementTutorId: tutor.id }] };
  const student = await prisma.student.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
  if (student) return { OR: [{ studentId: student.id }, { students: { some: { id: student.id } } }] };
  const parent = await prisma.parent.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
  return parent ? { OR: [{ parentId: parent.id }, { students: { some: { parentId: parent.id } } }] } : { id: "__no_lesson_scope__" };
}

async function resolveTutorForHomework(prisma, request, requestedTutorId) {
  if (hasPermission(request.portalUser, "homework:manage")) {
    return optional(requestedTutorId);
  }
  const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
  if (!tutor) {
    throw new ForbiddenError("Only tutors or authorised staff can create homework.");
  }
  if (requestedTutorId && requestedTutorId !== tutor.id) {
    throw new ForbiddenError("Tutors can only create homework as themselves.");
  }
  return tutor.id;
}

async function assertStudentInHomeworkScope(prisma, request, studentId, tutorId) {
  if (hasPermission(request.portalUser, "homework:manage")) {
    return;
  }
  if (!tutorId) {
    throw new ForbiddenError("Tutor profile is required.");
  }
  const assignment = await prisma.studentTutorAssignment.findFirst({ where: { studentId, tutorId, status: "ACTIVE" }, select: { id: true } });
  const lesson = await prisma.lesson.findFirst({ where: { studentId, OR: [{ tutorId }, { replacementTutorId: tutorId }] }, select: { id: true } });
  if (!assignment && !lesson) {
    throw new ForbiddenError("Tutors can only create homework for assigned students.");
  }
}

async function assertStudentCanSubmit(prisma, request, homework) {
  const student = await prisma.student.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
  if (!student || student.id !== homework.studentId) {
    throw new ForbiddenError("Students can only submit their own homework.");
  }
  if (!["ASSIGNED", "LATE", "RESUBMISSION_REQUIRED", "SUBMITTED"].includes(homework.status)) {
    throw new ValidationError("This homework is not open for submission.");
  }
}

async function parseProgressInput(prisma, request) {
  const studentId = required(request.body?.studentId, "Student is required.");
  await assertStudentInProgressScope(prisma, request, studentId);
  const tutorId = await resolveProgressTutor(prisma, request, request.body?.tutorId);
  const goalStatus = parseOption(request.body?.goalStatus || "IN_PROGRESS", goalStatuses, "Select a valid goal status.");
  return cleanData({
    studentId,
    tutorId,
    subjectId: optional(request.body?.subjectId),
    learningGoals: required(request.body?.learningGoals, "Learning goals are required."),
    baselineLevel: optional(request.body?.baselineLevel),
    currentLevel: optional(request.body?.currentLevel),
    skillsAchieved: optional(request.body?.skillsAchieved),
    areasForImprovement: optional(request.body?.areasForImprovement),
    tutorComments: optional(request.body?.tutorComments),
    parentSummary: optional(request.body?.parentSummary),
    parentVisible: parseBoolean(request.body?.parentVisible),
    reviewDate: requiredDate(request.body?.reviewDate, "Review date is required."),
    goalStatus,
    createdById: request.portalUser.id,
  });
}

async function assertStudentInProgressScope(prisma, request, studentId) {
  if (hasPermission(request.portalUser, "progress:manage")) {
    return;
  }
  const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
  if (!tutor) {
    throw new ForbiddenError("Only tutors or authorised staff can create progress records.");
  }
  const assignment = await prisma.studentTutorAssignment.findFirst({ where: { studentId, tutorId: tutor.id, status: "ACTIVE" }, select: { id: true } });
  if (!assignment) {
    throw new ForbiddenError("Tutors can only record progress for assigned students.");
  }
}

async function resolveProgressTutor(prisma, request, requestedTutorId) {
  if (hasPermission(request.portalUser, "progress:manage")) {
    return optional(requestedTutorId);
  }
  const tutor = await prisma.tutor.findUnique({ where: { userId: request.portalUser.id }, select: { id: true } });
  return tutor?.id ?? null;
}

function parseResourceInput(body, createdById, stored) {
  const resourceType = parseOption(body?.resourceType || typeFromStored(stored, body?.url), resourceTypes, "Select a valid resource type.");
  if (!stored && !optional(body?.url)) {
    throw new ValidationError("Add a file or approved link for the resource.");
  }
  const status = parseOption(body?.status || "ACTIVE", resourceStatuses, "Select a valid resource status.");
  return cleanData({
    title: required(body?.title, "Resource title is required."),
    description: optional(body?.description),
    url: optional(body?.url),
    fileKey: stored?.key,
    fileName: stored?.originalName,
    fileMimeType: stored?.mimeType,
    fileSize: stored?.size,
    resourceType,
    visibility: parseOption(body?.visibility || "INTERNAL", resourceVisibility, "Select a valid resource visibility."),
    subjectId: optional(body?.subjectId),
    tutorId: optional(body?.tutorId),
    studentId: optional(body?.studentId),
    lessonId: optional(body?.lessonId),
    yearGroup: optional(body?.yearGroup),
    examPathway: optional(body?.examPathway),
    status,
    createdById,
    approvedById: status === "ACTIVE" ? createdById : null,
    approvedAt: status === "ACTIVE" ? new Date() : null,
  });
}

function buildHomeworkWhere(query, user) {
  return cleanData({
    status: query.status ? parseOption(query.status, homeworkStatuses, "Select a valid homework status.") : undefined,
    studentId: optional(query.studentId),
    tutorId: hasPermission(user, "homework:manage") ? optional(query.tutorId) : undefined,
    subjectId: optional(query.subjectId),
  });
}

function buildResourceWhere(query) {
  return cleanData({
    status: optional(query.status),
    resourceType: optional(query.resourceType),
    visibility: optional(query.visibility),
    subjectId: optional(query.subjectId),
    studentId: optional(query.studentId),
    tutorId: optional(query.tutorId),
    examPathway: optional(query.examPathway),
    yearGroup: optional(query.yearGroup),
  });
}

function buildProgressWhere(query) {
  return cleanData({
    studentId: optional(query.studentId),
    tutorId: optional(query.tutorId),
    subjectId: optional(query.subjectId),
    goalStatus: optional(query.goalStatus),
  });
}

function buildNotificationWhere(query) {
  return cleanData({
    status: optional(query.status),
    category: optional(query.category),
  });
}

function safeHomework(homework, user) {
  const familyView = hasPermission(user, "family:homework") && !hasPermission(user, "homework:manage");
  return {
    id: homework.id,
    studentId: homework.studentId,
    student: homework.student ? { id: homework.student.id, fullName: homework.student.fullName, yearGroup: homework.student.yearGroup } : null,
    tutor: homework.tutor ? { id: homework.tutor.id, fullName: homework.tutor.fullName, email: homework.tutor.email } : null,
    subject: homework.subject,
    lesson: homework.lesson,
    title: homework.title,
    details: homework.details,
    instructions: homework.instructions,
    gradingCriteria: familyView ? null : homework.gradingCriteria,
    maxMarks: homework.maxMarks,
    mark: homework.mark,
    feedback: homework.feedback,
    attachments: safeAttachments(homework.attachments),
    resources: (homework.resources ?? []).map(safeResource),
    submissions: familyView ? [] : (homework.submissions ?? []).map(safeSubmission),
    dueDate: homework.dueDate,
    status: effectiveHomeworkStatus(homework),
    publishedAt: homework.publishedAt,
    submittedAt: homework.submittedAt,
    reviewedAt: homework.reviewedAt,
    completedAt: homework.completedAt,
    createdAt: homework.createdAt,
    updatedAt: homework.updatedAt,
  };
}

function safeAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }
  return attachments.map((attachment, index) => ({
    index,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
  }));
}

function safeSubmission(submission) {
  return {
    id: submission.id,
    homeworkId: submission.homeworkId,
    studentId: submission.studentId,
    submittedBy: submission.submittedBy,
    comments: submission.comments,
    fileName: submission.fileName,
    fileMimeType: submission.fileMimeType,
    fileSize: submission.fileSize,
    hasFile: Boolean(submission.fileKey),
    status: submission.status,
    mark: submission.mark,
    feedback: submission.feedback,
    reviewedBy: submission.reviewedBy,
    reviewedAt: submission.reviewedAt,
    createdAt: submission.createdAt,
  };
}

function safeResource(resource) {
  return {
    id: resource.id,
    title: resource.title,
    description: resource.description,
    url: resource.url,
    hasFile: Boolean(resource.fileKey),
    fileName: resource.fileName,
    fileMimeType: resource.fileMimeType,
    fileSize: resource.fileSize,
    resourceType: resource.resourceType,
    visibility: resource.visibility,
    subject: resource.subject,
    tutor: resource.tutor,
    student: resource.student,
    lesson: resource.lesson,
    yearGroup: resource.yearGroup,
    examPathway: resource.examPathway,
    status: resource.status,
    createdBy: resource.createdBy,
    approvedBy: resource.approvedBy,
    approvedAt: resource.approvedAt,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
  };
}

function safeProgress(record, user) {
  const safeOnly = (hasPermission(user, "family:progress") || hasPermission(user, "student:self")) && !hasPermission(user, "progress:manage");
  return {
    id: record.id,
    student: record.student,
    tutor: record.tutor ? { id: record.tutor.id, fullName: record.tutor.fullName } : null,
    subject: record.subject,
    learningGoals: record.learningGoals,
    baselineLevel: record.baselineLevel,
    currentLevel: record.currentLevel,
    skillsAchieved: record.skillsAchieved,
    areasForImprovement: record.areasForImprovement,
    tutorComments: safeOnly ? null : record.tutorComments,
    parentSummary: record.parentSummary,
    parentVisible: record.parentVisible,
    reviewDate: record.reviewDate,
    goalStatus: record.goalStatus,
    createdBy: safeOnly ? null : record.createdBy,
    createdAt: record.createdAt,
  };
}

function effectiveHomeworkStatus(homework) {
  if (homework.status === "ASSIGNED" && isLate(homework.dueDate)) {
    return "LATE";
  }
  return homework.status;
}

function isLate(dueDate) {
  return Boolean(dueDate && startOfDay(new Date(dueDate)) < startOfDay(new Date()));
}

async function storeLearningUpload(file, folder) {
  validateUpload(file);
  const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_STORAGE_PATH || "uploads");
  const targetDir = path.join(uploadRoot, "portal", "learning", folder);
  await fs.mkdir(targetDir, { recursive: true });
  const extension = path.extname(file.originalname).toLowerCase();
  const key = `portal/learning/${folder}/${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;
  const targetPath = path.join(uploadRoot, key);
  await fs.writeFile(targetPath, file.buffer);
  return {
    key,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}

function validateUpload(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  const maxBytes = Number(process.env.LEARNING_UPLOAD_MAX_BYTES ?? process.env.UPLOAD_MAX_BYTES ?? 20 * 1024 * 1024);
  if (!allowedUploadExtensions.has(extension) || !allowedUploadMimeTypes.has(file.mimetype)) {
    throw new ValidationError("Uploads must be documents, PDFs, presentations, worksheets, images, approved text files, or supported videos.");
  }
  if (file.size > maxBytes) {
    throw new ValidationError(`Uploads must be ${Math.round(maxBytes / 1024 / 1024)}MB or smaller.`);
  }
}

async function sendStoredFile(response, fileKey, fileName) {
  const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_STORAGE_PATH || "uploads");
  const absolute = path.resolve(uploadRoot, fileKey);
  if (!absolute.startsWith(uploadRoot)) {
    throw new ForbiddenError("Invalid file path.");
  }
  await fs.access(absolute);
  response.download(absolute, fileName);
}

function typeFromStored(stored, url) {
  if (url && !stored) return "APPROVED_LINK";
  const mime = stored?.mimeType || "";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "PRESENTATION";
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  return "DOCUMENT";
}

function parseIdArray(value) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value === "string" && value.trim() !== "") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseOptionalDecimal(value) {
  const cleaned = optional(value);
  if (!cleaned) return null;
  const number = Number(cleaned);
  if (!Number.isFinite(number) || number < 0) {
    throw new ValidationError("Please enter a valid mark or points value.");
  }
  return Math.round((number + Number.EPSILON) * 100) / 100;
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

function optionalDate(value) {
  const cleaned = optional(value);
  if (!cleaned) return null;
  return parseDate(cleaned, "Please enter a valid date.");
}

function requiredDate(value, message) {
  const cleaned = required(value, message);
  return parseDate(cleaned, message);
}

function parseDate(value, message) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(message);
  }
  return date;
}

function parseBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "Yes";
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateText(value) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

function cleanData(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function handleLearningError(error, response, next) {
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
