import { getPrisma } from "./db.js";
import { auditLog, requireAnyPermission } from "./authMiddleware.js";
import { hasPermission } from "./roles.js";

const familyPermissions = ["family:children", "family:timetable", "family:attendance", "family:lesson-updates", "family:homework", "family:progress", "family:finance", "own:notifications"];
const studentPermissions = ["student:self", "own:lessons", "own:timetable", "own:homework", "own:progress", "own:notifications", "resources:approved"];
const supportPermissions = ["own:support", "student:self", "family:children"];
const supportCategories = [
  "Technical issue",
  "Schedule concern",
  "Tutor concern",
  "Payment question",
  "Academic support request",
  "General enquiry",
];
const activeLessonStatuses = ["SCHEDULED", "TUTOR_READY", "IN_PROGRESS"];
const completedLessonStatuses = ["COMPLETED", "STUDENT_ABSENT", "TUTOR_ABSENT", "CANCELLED"];

export function registerFamilyDashboardRoutes(app, { sendPortalEmail }) {
  app.get("/api/portal/family/dashboard", requireAnyPermission(familyPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const parent = await requireParentProfile(prisma, request);
      const children = await prisma.student.findMany({
        where: { parentId: parent.id },
        include: {
          subjects: { select: { id: true, name: true, examPathway: true } },
          tutorAssignments: {
            where: { status: "ACTIVE" },
            include: {
              tutor: { select: { id: true, fullName: true, email: true, mainSubjectAreas: true } },
              subject: { select: { id: true, name: true, examPathway: true } },
            },
            orderBy: { startDate: "desc" },
          },
        },
        orderBy: { fullName: "asc" },
      });
      const childIds = children.map((child) => child.id);

      const [upcomingLessons, recentReports, homework, progressRecords, invoices, notifications, supportRequests, completedLessons] = await Promise.all([
        lessonsForStudents(prisma, childIds, { upcoming: true, take: 12 }),
        reportsForStudents(prisma, childIds, 12),
        homeworkForStudents(prisma, childIds),
        progressForStudents(prisma, childIds),
        invoicesForParent(prisma, parent.id),
        notificationsForUser(prisma, request.portalUser.id),
        supportForUser(prisma, request.portalUser.id),
        lessonsForStudents(prisma, childIds, { completed: true, take: 200 }),
      ]);

      response.json({
        ok: true,
        dashboard: {
          parent: safeParent(parent),
          children: children.map(safeStudent),
          upcomingLessons: decorateLessons(upcomingLessons),
          assignedTutors: assignedTutorSummary(children),
          subjects: subjectSummary(children),
          attendanceSummary: attendanceSummary(completedLessons),
          lessonUpdates: recentReports.map(safeReport),
          homeworkStatus: homeworkSummary(homework),
          homework: homework.map(safeHomework),
          academicProgress: progressSummary(recentReports, progressRecords),
          progressRecords: progressRecords.map(safeProgressRecord),
          outstandingInvoices: invoices.filter((invoice) => !["PAID", "CANCELLED"].includes(normaliseInvoiceStatus(invoice.status))).map(safeInvoice),
          recentPayments: paymentsFromInvoices(invoices).slice(0, 8),
          receipts: receiptsFromInvoices(invoices).slice(0, 8),
          notifications,
          supportRequests,
          supportCategories,
        },
      });
    } catch (error) {
      handleDashboardError(error, response, next);
    }
  });

  app.get("/api/portal/family/students/:id", requireAnyPermission(familyPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const parent = await requireParentProfile(prisma, request);
      const student = await prisma.student.findFirst({
        where: { id: request.params.id, parentId: parent.id },
        include: {
          subjects: { select: { id: true, name: true, examPathway: true } },
          tutorAssignments: {
            include: {
              tutor: { select: { id: true, fullName: true, email: true, mainSubjectAreas: true, qualifications: true } },
              subject: { select: { id: true, name: true, examPathway: true } },
            },
            orderBy: { startDate: "desc" },
          },
        },
      });
      if (!student) {
        throw new NotFoundError("Student not found.");
      }

      const [upcomingLessons, completedLessons, reports, homework, progressRecords, invoices] = await Promise.all([
        lessonsForStudents(prisma, [student.id], { upcoming: true, take: 20 }),
        lessonsForStudents(prisma, [student.id], { completed: true, take: 200 }),
        reportsForStudents(prisma, [student.id], 20),
        homeworkForStudents(prisma, [student.id]),
        progressForStudents(prisma, [student.id]),
        invoicesForParent(prisma, parent.id),
      ]);

      response.json({
        ok: true,
        studentView: {
          profile: safeStudent(student),
          timetable: decorateLessons(upcomingLessons),
          assignedTutors: student.tutorAssignments.map(safeAssignment),
          subjects: student.subjects,
          attendance: attendanceSummary(completedLessons),
          lessonUpdates: reports.map(safeReport),
          homework: homework.map(safeHomework),
          progressGoals: {
            academicGoals: student.academicGoals,
            learningNeeds: student.learningNeeds,
            latestProgress: progressSummary(reports, progressRecords),
          },
          progressRecords: progressRecords.map(safeProgressRecord),
          invoices: invoices.map(safeInvoice),
          receipts: receiptsFromInvoices(invoices),
        },
      });
    } catch (error) {
      handleDashboardError(error, response, next);
    }
  });

  app.get("/api/portal/student/dashboard", requireAnyPermission(studentPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const student = await requireStudentProfile(prisma, request);
      const [todayLessons, upcomingLessons, reports, homework, progressRecords, resources, notifications, supportRequests] = await Promise.all([
        lessonsForStudents(prisma, [student.id], { today: true, take: 4 }),
        lessonsForStudents(prisma, [student.id], { upcoming: true, take: 10 }),
        reportsForStudents(prisma, [student.id], 8),
        homeworkForStudents(prisma, [student.id]),
        progressForStudents(prisma, [student.id]),
        resourcesForStudent(prisma, student),
        notificationsForUser(prisma, request.portalUser.id),
        supportForUser(prisma, request.portalUser.id),
      ]);

      response.json({
        ok: true,
        dashboard: {
          student: safeStudent(student),
          todayLessons: decorateLessons(todayLessons),
          upcomingLessons: decorateLessons(upcomingLessons),
          assignedTutors: student.tutorAssignments.map(safeAssignment),
          subjects: student.subjects,
          homework: homework.map(safeHomework),
          resources: resources.map(safeDashboardResource),
          tutorFeedback: reports.map(safeReport),
          learningGoals: {
            academicGoals: student.academicGoals,
            learningNeeds: student.learningNeeds,
          },
          progress: progressSummary(reports, progressRecords),
          progressRecords: progressRecords.map(safeProgressRecord),
          notifications,
          supportRequests,
          supportCategories,
        },
      });
    } catch (error) {
      handleDashboardError(error, response, next);
    }
  });

  app.post("/api/portal/support-requests", requireAnyPermission(supportPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const context = await supportContext(prisma, request);
      const category = parseOption(request.body?.category, supportCategories, "Select a valid support category.");
      const subject = required(request.body?.subject, "Support request subject is required.");
      const message = required(request.body?.message, "Support request details are required.");
      const studentId = await scopedSupportStudentId(prisma, request, context, request.body?.studentId);

      const supportRequest = await prisma.supportRequest.create({
        data: {
          requesterId: request.portalUser.id,
          parentId: context.parentId,
          studentId,
          category,
          subject,
          message,
          priority: category === "Tutor concern" || category === "Technical issue" ? "HIGH" : "NORMAL",
        },
        include: {
          student: { select: { id: true, fullName: true } },
          parent: { select: { id: true, fullName: true } },
        },
      });

      await notifySupportStaff({ prisma, request, supportRequest, sendPortalEmail });
      await auditLog({ request, actorId: request.portalUser.id, action: "support_request_created", entityType: "SupportRequest", entityId: supportRequest.id, metadata: { category, studentId } });
      response.status(201).json({ ok: true, supportRequest: safeSupportRequest(supportRequest), message: "Support request submitted successfully." });
    } catch (error) {
      handleDashboardError(error, response, next);
    }
  });
}

async function requireParentProfile(prisma, request) {
  const parent = await prisma.parent.findUnique({ where: { userId: request.portalUser.id }, select: { id: true, fullName: true, email: true, phone: true, preferredContactMethod: true, country: true, timeZone: true, status: true } });
  if (!parent || parent.status !== "ACTIVE") {
    throw new ForbiddenError("No active parent profile is linked to this portal account.");
  }
  return parent;
}

async function requireStudentProfile(prisma, request) {
  const student = await prisma.student.findUnique({
    where: { userId: request.portalUser.id },
    include: {
      subjects: { select: { id: true, name: true, examPathway: true } },
      tutorAssignments: {
        where: { status: "ACTIVE" },
        include: {
          tutor: { select: { id: true, fullName: true, email: true, mainSubjectAreas: true } },
          subject: { select: { id: true, name: true, examPathway: true } },
        },
        orderBy: { startDate: "desc" },
      },
    },
  });
  if (!student || student.status !== "ACTIVE") {
    throw new ForbiddenError("No active student profile is linked to this portal account.");
  }
  if (student.directLoginDisabled) {
    throw new ForbiddenError("Direct student login is disabled for this account. Please use the parent account.");
  }
  return student;
}

async function lessonsForStudents(prisma, studentIds, options = {}) {
  if (studentIds.length === 0) {
    return [];
  }
  const now = new Date();
  const where = {
    OR: [{ studentId: { in: studentIds } }, { students: { some: { id: { in: studentIds } } } }],
  };
  if (options.upcoming) {
    where.scheduledStart = { gte: addMinutes(now, -15) };
    where.status = { in: activeLessonStatuses };
  }
  if (options.today) {
    where.scheduledStart = { gte: startOfDay(now), lt: addDays(startOfDay(now), 1) };
    where.status = { in: activeLessonStatuses };
  }
  if (options.completed) {
    where.status = { in: completedLessonStatuses };
  }
  return prisma.lesson.findMany({
    where,
    include: {
      student: { select: { id: true, fullName: true } },
      students: { select: { id: true, fullName: true } },
      tutor: { select: { id: true, fullName: true, email: true } },
      replacementTutor: { select: { id: true, fullName: true, email: true } },
      subject: { select: { id: true, name: true, examPathway: true } },
    },
    orderBy: options.completed ? { scheduledStart: "desc" } : { scheduledStart: "asc" },
    take: options.take ?? 20,
  });
}

function decorateLessons(lessons) {
  return lessons.map((lesson) => {
    const joinAvailable = isJoinAvailable(lesson);
    return {
      id: lesson.id,
      students: lesson.students?.length ? lesson.students : [lesson.student].filter(Boolean),
      tutor: lesson.replacementTutor ? { ...lesson.replacementTutor, replacement: true } : lesson.tutor,
      subject: lesson.subject,
      lessonType: lesson.lessonType,
      scheduledStart: lesson.scheduledStart,
      scheduledEnd: lesson.scheduledEnd,
      timeZone: lesson.timeZone,
      durationMinutes: lesson.durationMinutes,
      status: lesson.status,
      attendance: {
        studentAttendance: lesson.studentAttendance,
        minutesLate: lesson.minutesLate,
      },
      joinAvailable,
      meetingLink: joinAvailable ? lesson.meetingLink : null,
    };
  });
}

async function reportsForStudents(prisma, studentIds, take) {
  if (studentIds.length === 0) {
    return [];
  }
  return prisma.lessonReport.findMany({
    where: { studentId: { in: studentIds }, parentVisible: true },
    select: {
      id: true,
      studentId: true,
      topicCovered: true,
      lessonSummary: true,
      studentParticipation: true,
      studentUnderstanding: true,
      homeworkOrTaskGiven: true,
      homeworkDueDate: true,
      nextLessonRecommendation: true,
      parentFriendlyUpdate: true,
      submittedAt: true,
      student: { select: { id: true, fullName: true } },
      tutor: { select: { id: true, fullName: true } },
      lesson: {
        select: {
          scheduledStart: true,
          subject: { select: { id: true, name: true, examPathway: true } },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
    take,
  });
}

function safeReport(report) {
  return {
    id: report.id,
    studentId: report.studentId,
    student: report.student,
    tutor: report.tutor,
    subject: report.lesson?.subject,
    lessonDate: report.lesson?.scheduledStart,
    topicCovered: report.topicCovered,
    lessonSummary: report.lessonSummary,
    studentParticipation: report.studentParticipation,
    studentUnderstanding: report.studentUnderstanding,
    homeworkOrTaskGiven: report.homeworkOrTaskGiven,
    homeworkDueDate: report.homeworkDueDate,
    nextLessonRecommendation: report.nextLessonRecommendation,
    parentFriendlyUpdate: report.parentFriendlyUpdate,
    submittedAt: report.submittedAt,
  };
}

async function homeworkForStudents(prisma, studentIds) {
  if (studentIds.length === 0) {
    return [];
  }
  return prisma.homework.findMany({
    where: { studentId: { in: studentIds } },
    include: {
      student: { select: { id: true, fullName: true } },
      tutor: { select: { id: true, fullName: true } },
      subject: { select: { id: true, name: true, examPathway: true } },
      resources: { select: { id: true, title: true, resourceType: true, url: true, fileName: true } },
      submissions: {
        select: {
          id: true,
          status: true,
          comments: true,
          mark: true,
          feedback: true,
          fileName: true,
          createdAt: true,
          reviewedAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    take: 100,
  });
}

function safeHomework(item) {
  return {
    id: item.id,
    title: item.title,
    details: item.details,
    dueDate: item.dueDate,
    status: item.status,
    student: item.student,
    tutor: item.tutor,
    subject: item.subject,
    resources: item.resources ?? [],
    submissions: item.submissions ?? [],
    mark: item.mark,
    feedback: item.feedback,
  };
}

async function progressForStudents(prisma, studentIds) {
  if (studentIds.length === 0) {
    return [];
  }
  return prisma.progressRecord.findMany({
    where: { studentId: { in: studentIds }, parentVisible: true },
    include: {
      student: { select: { id: true, fullName: true } },
      tutor: { select: { id: true, fullName: true } },
      subject: { select: { id: true, name: true, examPathway: true } },
    },
    orderBy: { reviewDate: "desc" },
    take: 100,
  });
}

function safeProgressRecord(record) {
  return {
    id: record.id,
    student: record.student,
    tutor: record.tutor,
    subject: record.subject,
    learningGoals: record.learningGoals,
    baselineLevel: record.baselineLevel,
    currentLevel: record.currentLevel,
    skillsAchieved: record.skillsAchieved,
    areasForImprovement: record.areasForImprovement,
    parentSummary: record.parentSummary,
    reviewDate: record.reviewDate,
    goalStatus: record.goalStatus,
    createdAt: record.createdAt,
  };
}

async function invoicesForParent(prisma, parentId) {
  return prisma.invoice.findMany({
    where: { parentId },
    include: {
      payments: { orderBy: { createdAt: "desc" } },
      receipts: { orderBy: { dateReceived: "desc" } },
      student: { select: { id: true, fullName: true, yearGroup: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

function safeInvoice(invoice) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: effectiveInvoiceStatus(invoice),
    service: invoice.service,
    periodCovered: periodText(invoice),
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
    amountPaid: invoice.amountPaid,
    balanceDue: invoice.balanceDue,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    issuedAt: invoice.issuedAt,
    student: invoice.student,
    payments: invoice.payments?.map(safePayment) ?? [],
    receipts: invoice.receipts?.map(safeReceipt) ?? [],
  };
}

function paymentsFromInvoices(invoices) {
  return invoices.flatMap((invoice) => (invoice.payments ?? []).map((payment) => ({ ...safePayment(payment), invoiceNumber: invoice.invoiceNumber }))).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function receiptsFromInvoices(invoices) {
  return invoices.flatMap((invoice) => (invoice.receipts ?? []).map((receipt) => ({ ...safeReceipt(receipt), invoiceNumber: invoice.invoiceNumber }))).sort((a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime());
}

function safePayment(payment) {
  return {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    kind: payment.kind,
    paymentMethod: payment.paymentMethod,
    provider: payment.provider,
    reference: payment.reference,
    transactionReference: payment.transactionReference,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  };
}

function safeReceipt(receipt) {
  return {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    amount: receipt.amount,
    currency: receipt.currency,
    paymentMethod: receipt.paymentMethod,
    transactionReference: receipt.transactionReference,
    dateReceived: receipt.dateReceived,
    service: receipt.service,
    periodCovered: receipt.periodCovered,
  };
}

async function resourcesForStudent(prisma, student) {
  const subjectIds = student.subjects.map((subject) => subject.id);
  return prisma.resource.findMany({
    where: {
      status: "ACTIVE",
      visibility: "STUDENTS",
      OR: [{ subjectId: null }, { subjectId: { in: subjectIds } }],
    },
    include: { subject: { select: { id: true, name: true, examPathway: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

function safeDashboardResource(resource) {
  return {
    id: resource.id,
    title: resource.title,
    description: resource.description,
    url: resource.url,
    hasFile: Boolean(resource.fileKey),
    fileName: resource.fileName,
    fileMimeType: resource.fileMimeType,
    resourceType: resource.resourceType,
    subject: resource.subject,
    yearGroup: resource.yearGroup,
    examPathway: resource.examPathway,
    createdAt: resource.createdAt,
  };
}

async function notificationsForUser(prisma, userId) {
  return prisma.notification.findMany({
    where: { recipientId: userId },
    select: { id: true, title: true, message: true, status: true, createdAt: true, readAt: true },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
}

async function supportForUser(prisma, userId) {
  const requests = await prisma.supportRequest.findMany({
    where: { requesterId: userId },
    include: {
      student: { select: { id: true, fullName: true } },
      parent: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  return requests.map(safeSupportRequest);
}

function safeSupportRequest(request) {
  return {
    id: request.id,
    category: request.category,
    subject: request.subject,
    message: request.message,
    status: request.status,
    priority: request.priority,
    student: request.student,
    parent: request.parent,
    createdAt: request.createdAt,
  };
}

function homeworkSummary(homework) {
  const counts = { assigned: 0, submitted: 0, reviewed: 0, resubmissionRequired: 0, completed: 0, overdue: 0 };
  const today = startOfDay(new Date());
  for (const item of homework) {
    if (item.status === "ASSIGNED") counts.assigned += 1;
    if (item.status === "SUBMITTED" || item.status === "LATE") counts.submitted += 1;
    if (item.status === "REVIEWED") counts.reviewed += 1;
    if (item.status === "RESUBMISSION_REQUIRED") counts.resubmissionRequired += 1;
    if (item.status === "COMPLETED") counts.completed += 1;
    if (item.dueDate && !["REVIEWED", "COMPLETED", "CANCELLED"].includes(item.status) && new Date(item.dueDate) < today) counts.overdue += 1;
  }
  return counts;
}

function attendanceSummary(lessons) {
  const summary = { totalRecorded: lessons.length, present: 0, late: 0, absent: 0, cancelled: 0 };
  for (const lesson of lessons) {
    if (lesson.status === "CANCELLED") {
      summary.cancelled += 1;
    } else if (lesson.studentAttendance === "Late" || Number(lesson.minutesLate ?? 0) > 0) {
      summary.late += 1;
    } else if (lesson.status === "STUDENT_ABSENT" || lesson.studentAttendance === "Absent") {
      summary.absent += 1;
    } else if (lesson.status === "COMPLETED" || lesson.studentAttendance === "Present") {
      summary.present += 1;
    }
  }
  return summary;
}

function progressSummary(reports, progressRecords = []) {
  const latest = reports[0] ? safeReport(reports[0]) : null;
  const latestProgress = progressRecords[0] ? safeProgressRecord(progressRecords[0]) : null;
  const understandingCounts = {};
  const engagementCounts = {};
  const goalStatusCounts = {};
  for (const report of reports) {
    understandingCounts[report.studentUnderstanding] = (understandingCounts[report.studentUnderstanding] ?? 0) + 1;
    engagementCounts[report.studentParticipation] = (engagementCounts[report.studentParticipation] ?? 0) + 1;
  }
  for (const record of progressRecords) {
    goalStatusCounts[record.goalStatus] = (goalStatusCounts[record.goalStatus] ?? 0) + 1;
  }
  return {
    latest,
    latestProgress,
    totalUpdates: reports.length,
    totalProgressRecords: progressRecords.length,
    understandingCounts,
    engagementCounts,
    goalStatusCounts,
  };
}

function assignedTutorSummary(children) {
  const map = new Map();
  for (const child of children) {
    for (const assignment of child.tutorAssignments ?? []) {
      const tutor = assignment.tutor;
      if (!tutor) continue;
      const existing = map.get(tutor.id) ?? { ...tutor, students: [], subjects: [] };
      existing.students.push(child.fullName);
      const subject = subjectLabel(assignment.subject);
      if (subject) existing.subjects.push(subject);
      map.set(tutor.id, existing);
    }
  }
  return Array.from(map.values()).map((item) => ({ ...item, students: unique(item.students), subjects: unique(item.subjects) }));
}

function subjectSummary(children) {
  const map = new Map();
  for (const child of children) {
    for (const subject of child.subjects ?? []) {
      const existing = map.get(subject.id) ?? { ...subject, students: [] };
      existing.students.push(child.fullName);
      map.set(subject.id, existing);
    }
  }
  return Array.from(map.values()).map((item) => ({ ...item, students: unique(item.students) }));
}

function subjectLabel(subject) {
  if (!subject?.name) {
    return "";
  }
  return subject.examPathway ? `${subject.name} - ${subject.examPathway}` : subject.name;
}

function safeParent(parent) {
  return {
    id: parent.id,
    fullName: parent.fullName,
    email: parent.email,
    phone: parent.phone,
    preferredContactMethod: parent.preferredContactMethod,
    country: parent.country,
    timeZone: parent.timeZone,
    status: parent.status,
  };
}

function safeStudent(student) {
  return {
    id: student.id,
    fullName: student.fullName,
    age: student.age,
    yearGroup: student.yearGroup,
    country: student.country,
    timeZone: student.timeZone,
    schoolOrInstitution: student.schoolOrInstitution,
    examPathway: student.examPathway,
    academicGoals: student.academicGoals,
    learningNeeds: student.learningNeeds,
    status: student.status,
    startDate: student.startDate,
    subjects: student.subjects ?? [],
    assignedTutors: (student.tutorAssignments ?? []).map(safeAssignment),
  };
}

function safeAssignment(assignment) {
  return {
    id: assignment.id,
    status: assignment.status,
    startDate: assignment.startDate,
    endDate: assignment.endDate,
    tutor: assignment.tutor,
    subject: assignment.subject,
  };
}

async function supportContext(prisma, request) {
  if (hasPermission(request.portalUser, "family:children")) {
    const parent = await requireParentProfile(prisma, request);
    return { parentId: parent.id, studentId: null, childScope: true };
  }
  const student = await requireStudentProfile(prisma, request);
  return { parentId: student.parentId, studentId: student.id, childScope: false };
}

async function scopedSupportStudentId(prisma, request, context, requestedStudentId) {
  if (!requestedStudentId) {
    return context.studentId;
  }
  if (!context.childScope) {
    if (requestedStudentId !== context.studentId) {
      throw new ForbiddenError("Students can only submit support requests for their own profile.");
    }
    return context.studentId;
  }
  const child = await prisma.student.findFirst({ where: { id: String(requestedStudentId), parentId: context.parentId }, select: { id: true } });
  if (!child) {
    throw new ForbiddenError("Parents can only submit support requests for linked children.");
  }
  return child.id;
}

async function notifySupportStaff({ prisma, request, supportRequest, sendPortalEmail }) {
  const staff = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: {
        permissions: {
          some: { key: { in: ["system:all", "support:manage"] } },
        },
      },
    },
    select: { id: true, email: true },
  });
  const title = `TutorHiveHub support request - ${supportRequest.category}`;
  const message = `${request.portalUser.name} submitted a ${supportRequest.category.toLowerCase()} request: ${supportRequest.subject}`;
  for (const user of staff) {
    await prisma.notification.create({
      data: {
        recipientId: user.id,
        createdById: request.portalUser.id,
        title,
        message,
      },
    });
  }
  if (sendPortalEmail) {
    const emailTargets = new Set(staff.map((user) => user.email).filter(Boolean));
    if (process.env.ADMIN_EMAIL) emailTargets.add(process.env.ADMIN_EMAIL);
    for (const email of emailTargets) {
      try {
        await sendPortalEmail({ to: email, subject: title, text: message, html: `<p>${escapeHtml(message)}</p>` });
      } catch (error) {
        await auditLog({ request, actorId: request.portalUser.id, action: "support_request_email_failed", entityType: "SupportRequest", entityId: supportRequest.id, metadata: { email, error: error instanceof Error ? error.message : String(error) } });
      }
    }
  }
}

function isJoinAvailable(lesson) {
  const now = new Date();
  return now >= addMinutes(new Date(lesson.scheduledStart), -15) && now <= addMinutes(new Date(lesson.scheduledEnd), 30) && Boolean(lesson.meetingLink);
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

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normaliseInvoiceStatus(status) {
  if (status === "PART_PAID") return "PARTIALLY_PAID";
  if (status === "VOID") return "CANCELLED";
  return status;
}

function effectiveInvoiceStatus(invoice) {
  const status = normaliseInvoiceStatus(invoice.status);
  if (!["DRAFT", "PAID", "CANCELLED"].includes(status) && Number(invoice.balanceDue ?? 0) > 0 && invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
    return "OVERDUE";
  }
  return status;
}

function periodText(invoice) {
  const start = dateText(invoice.billingPeriodStart);
  const end = dateText(invoice.billingPeriodEnd);
  if (start === "-" && end === "-") return "-";
  if (start === end || end === "-") return start;
  if (start === "-") return end;
  return `${start} to ${end}`;
}

function dateText(value) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value)) : "-";
}

function handleDashboardError(error, response, next) {
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
