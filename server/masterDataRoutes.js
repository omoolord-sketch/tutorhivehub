import fs from "node:fs/promises";
import path from "node:path";
import { getPrisma } from "./db.js";
import { auditLog, requireAnyPermission, requireSession } from "./authMiddleware.js";

const examPathways = ["Primary", "Secondary", "GCSE", "A-Level", "WAEC", "JAMB", "SAT", "IELTS", "NVQ", "University Admissions", "Other"];
const activeStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED", "PENDING"];
const assignmentStatuses = ["ACTIVE", "PAUSED", "ENDED"];
const allowedUploadExtensions = new Set([".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"]);
const allowedUploadMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

const masterDataPermissions = ["parents:manage", "students:manage", "tutors:manage", "subjects:manage", "assignments:manage"];

const parentInclude = {
  students: {
    select: { id: true, fullName: true, yearGroup: true, status: true },
    orderBy: { fullName: "asc" },
  },
};

const studentInclude = {
  user: { select: { id: true, name: true, email: true, status: true } },
  parent: { select: { id: true, fullName: true, email: true } },
  subjects: { select: { id: true, name: true, examPathway: true, isActive: true } },
  tutorAssignments: {
    include: {
      tutor: { select: { id: true, fullName: true, email: true } },
      subject: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "desc" },
  },
};

const tutorInclude = {
  subjects: { select: { id: true, name: true, examPathway: true, isActive: true } },
  studentAssignments: {
    include: {
      student: { select: { id: true, fullName: true, yearGroup: true } },
      subject: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "desc" },
  },
};

const subjectInclude = {
  _count: {
    select: {
      students: true,
      tutors: true,
      assignments: true,
    },
  },
};

const assignmentInclude = {
  student: { select: { id: true, fullName: true, yearGroup: true, status: true } },
  tutor: { select: { id: true, fullName: true, email: true, status: true } },
  subject: { select: { id: true, name: true, examPathway: true, isActive: true } },
};

export function registerMasterDataRoutes(app, upload) {
  app.get("/api/portal/lookups", requireAnyPermission(masterDataPermissions), async (_request, response, next) => {
    try {
      const prisma = getPrisma();
      const [parents, students, tutors, subjects, users] = await Promise.all([
        prisma.parent.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, email: true, status: true } }),
        prisma.student.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, yearGroup: true, status: true } }),
        prisma.tutor.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, email: true, status: true } }),
        prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, category: true, examPathway: true, isActive: true } }),
        prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, status: true, role: { select: { name: true } } } }),
      ]);
      response.json({ ok: true, parents, students, tutors, subjects, users, examPathways });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/parents", requireSession("parents:manage"), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const where = buildParentWhere(request.query);
      const parents = await prisma.parent.findMany({ where, include: parentInclude, orderBy: { fullName: "asc" }, take: 200 });
      response.json({ ok: true, parents });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/parents/:id", requireSession("parents:manage"), async (request, response, next) => {
    try {
      const parent = await getPrisma().parent.findUnique({ where: { id: request.params.id }, include: parentInclude });
      sendRecord(response, parent, "Parent not found.");
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/parents", requireSession("parents:manage"), async (request, response, next) => {
    try {
      const data = parseParentInput(request.body);
      const parent = await getPrisma().parent.create({ data, include: parentInclude });
      await auditLog({ request, actorId: request.portalUser.id, action: "parent_created", entityType: "Parent", entityId: parent.id });
      response.status(201).json({ ok: true, parent });
    } catch (error) {
      handleValidation(error, response, next);
    }
  });

  app.patch("/api/portal/parents/:id", requireSession("parents:manage"), async (request, response, next) => {
    try {
      const data = parseParentInput(request.body);
      const parent = await getPrisma().parent.update({ where: { id: request.params.id }, data, include: parentInclude });
      await auditLog({ request, actorId: request.portalUser.id, action: "parent_updated", entityType: "Parent", entityId: parent.id });
      response.json({ ok: true, parent });
    } catch (error) {
      handleValidation(error, response, next);
    }
  });

  app.get("/api/portal/students", requireSession("students:manage"), async (request, response, next) => {
    try {
      const students = await getPrisma().student.findMany({
        where: buildStudentWhere(request.query),
        include: studentInclude,
        orderBy: { fullName: "asc" },
        take: 200,
      });
      response.json({ ok: true, students });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/students/:id", requireSession("students:manage"), async (request, response, next) => {
    try {
      const student = await getPrisma().student.findUnique({ where: { id: request.params.id }, include: studentInclude });
      sendRecord(response, student, "Student not found.");
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/students", requireSession("students:manage"), async (request, response, next) => {
    try {
      const { subjectIds, data } = parseStudentInput(request.body);
      const student = await getPrisma().student.create({
        data: { ...data, subjects: { connect: subjectIds.map((id) => ({ id })) } },
        include: studentInclude,
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "student_created", entityType: "Student", entityId: student.id });
      response.status(201).json({ ok: true, student });
    } catch (error) {
      handleValidation(error, response, next);
    }
  });

  app.patch("/api/portal/students/:id", requireSession("students:manage"), async (request, response, next) => {
    try {
      const { subjectIds, data } = parseStudentInput(request.body);
      const student = await getPrisma().student.update({
        where: { id: request.params.id },
        data: { ...data, subjects: { set: subjectIds.map((id) => ({ id })) } },
        include: studentInclude,
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "student_updated", entityType: "Student", entityId: student.id });
      response.json({ ok: true, student });
    } catch (error) {
      handleValidation(error, response, next);
    }
  });

  const tutorUpload = upload.fields([
    { name: "cv", maxCount: 1 },
    { name: "certificates", maxCount: 5 },
  ]);

  app.get("/api/portal/tutors", requireSession("tutors:manage"), async (request, response, next) => {
    try {
      const tutors = await getPrisma().tutor.findMany({
        where: buildTutorWhere(request.query),
        include: tutorInclude,
        orderBy: { fullName: "asc" },
        take: 200,
      });
      response.json({ ok: true, tutors });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/tutors/:id", requireSession("tutors:manage"), async (request, response, next) => {
    try {
      const tutor = await getPrisma().tutor.findUnique({ where: { id: request.params.id }, include: tutorInclude });
      sendRecord(response, tutor, "Tutor not found.");
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/tutors", requireSession("tutors:manage"), tutorUpload, async (request, response, next) => {
    try {
      const { subjectIds, data } = parseTutorInput(request.body);
      const uploads = await storeTutorUploads(request.files);
      const tutor = await getPrisma().tutor.create({
        data: {
          ...data,
          ...uploads,
          subjects: { connect: subjectIds.map((id) => ({ id })) },
        },
        include: tutorInclude,
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "tutor_created", entityType: "Tutor", entityId: tutor.id });
      response.status(201).json({ ok: true, tutor });
    } catch (error) {
      handleValidation(error, response, next);
    }
  });

  app.patch("/api/portal/tutors/:id", requireSession("tutors:manage"), tutorUpload, async (request, response, next) => {
    try {
      const { subjectIds, data } = parseTutorInput(request.body);
      const uploads = await storeTutorUploads(request.files);
      const tutor = await getPrisma().tutor.update({
        where: { id: request.params.id },
        data: {
          ...data,
          ...uploads,
          subjects: { set: subjectIds.map((id) => ({ id })) },
        },
        include: tutorInclude,
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "tutor_updated", entityType: "Tutor", entityId: tutor.id });
      response.json({ ok: true, tutor });
    } catch (error) {
      handleValidation(error, response, next);
    }
  });

  app.get("/api/portal/subjects", requireSession("subjects:manage"), async (request, response, next) => {
    try {
      const subjects = await getPrisma().subject.findMany({
        where: buildSubjectWhere(request.query),
        include: subjectInclude,
        orderBy: { name: "asc" },
        take: 200,
      });
      response.json({ ok: true, subjects });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/subjects/:id", requireSession("subjects:manage"), async (request, response, next) => {
    try {
      const subject = await getPrisma().subject.findUnique({ where: { id: request.params.id }, include: subjectInclude });
      sendRecord(response, subject, "Subject not found.");
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/subjects", requireSession("subjects:manage"), async (request, response, next) => {
    try {
      const subject = await getPrisma().subject.create({ data: parseSubjectInput(request.body), include: subjectInclude });
      await auditLog({ request, actorId: request.portalUser.id, action: "subject_created", entityType: "Subject", entityId: subject.id });
      response.status(201).json({ ok: true, subject });
    } catch (error) {
      handleValidation(error, response, next);
    }
  });

  app.patch("/api/portal/subjects/:id", requireSession("subjects:manage"), async (request, response, next) => {
    try {
      const subject = await getPrisma().subject.update({ where: { id: request.params.id }, data: parseSubjectInput(request.body), include: subjectInclude });
      await auditLog({ request, actorId: request.portalUser.id, action: "subject_updated", entityType: "Subject", entityId: subject.id });
      response.json({ ok: true, subject });
    } catch (error) {
      handleValidation(error, response, next);
    }
  });

  app.get("/api/portal/assignments", requireSession("assignments:manage"), async (request, response, next) => {
    try {
      const assignments = await getPrisma().studentTutorAssignment.findMany({
        where: buildAssignmentWhere(request.query),
        include: assignmentInclude,
        orderBy: { startDate: "desc" },
        take: 200,
      });
      response.json({ ok: true, assignments });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/assignments/:id", requireSession("assignments:manage"), async (request, response, next) => {
    try {
      const assignment = await getPrisma().studentTutorAssignment.findUnique({ where: { id: request.params.id }, include: assignmentInclude });
      sendRecord(response, assignment, "Assignment not found.");
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/assignments", requireSession("assignments:manage"), async (request, response, next) => {
    try {
      const { allowDuplicateActive, data } = parseAssignmentInput(request.body);
      await assertNoDuplicateActiveAssignment(data, allowDuplicateActive);
      const assignment = await getPrisma().studentTutorAssignment.create({ data, include: assignmentInclude });
      await auditLog({ request, actorId: request.portalUser.id, action: "assignment_created", entityType: "StudentTutorAssignment", entityId: assignment.id });
      response.status(201).json({ ok: true, assignment });
    } catch (error) {
      handleValidation(error, response, next);
    }
  });

  app.patch("/api/portal/assignments/:id", requireSession("assignments:manage"), async (request, response, next) => {
    try {
      const { allowDuplicateActive, data } = parseAssignmentInput(request.body);
      await assertNoDuplicateActiveAssignment(data, allowDuplicateActive, request.params.id);
      const assignment = await getPrisma().studentTutorAssignment.update({ where: { id: request.params.id }, data, include: assignmentInclude });
      await auditLog({ request, actorId: request.portalUser.id, action: "assignment_updated", entityType: "StudentTutorAssignment", entityId: assignment.id });
      response.json({ ok: true, assignment });
    } catch (error) {
      handleValidation(error, response, next);
    }
  });
}

function buildParentWhere(query) {
  return {
    ...(query.name ? { fullName: contains(query.name) } : {}),
    ...(query.status ? { status: String(query.status) } : {}),
    ...(query.country ? { country: contains(query.country) } : {}),
    ...(query.timeZone ? { timeZone: contains(query.timeZone) } : {}),
  };
}

function buildStudentWhere(query) {
  return {
    ...(query.name ? { fullName: contains(query.name) } : {}),
    ...(query.status ? { status: String(query.status) } : {}),
    ...(query.yearGroup ? { yearGroup: contains(query.yearGroup) } : {}),
    ...(query.examPathway ? { examPathway: String(query.examPathway) } : {}),
    ...(query.country ? { country: contains(query.country) } : {}),
    ...(query.timeZone ? { timeZone: contains(query.timeZone) } : {}),
    ...(query.subject ? { subjects: { some: { name: contains(query.subject) } } } : {}),
    ...(query.tutor ? { tutorAssignments: { some: { tutor: { fullName: contains(query.tutor) } } } } : {}),
  };
}

function buildTutorWhere(query) {
  return {
    ...(query.name ? { fullName: contains(query.name) } : {}),
    ...(query.status ? { status: String(query.status) } : {}),
    ...(query.country ? { country: contains(query.country) } : {}),
    ...(query.timeZone ? { timeZone: contains(query.timeZone) } : {}),
    ...(query.subject ? { subjects: { some: { name: contains(query.subject) } } } : {}),
  };
}

function buildSubjectWhere(query) {
  return {
    ...(query.name ? { name: contains(query.name) } : {}),
    ...(query.category ? { category: contains(query.category) } : {}),
    ...(query.examPathway ? { examPathway: String(query.examPathway) } : {}),
    ...(query.status === "ACTIVE" ? { isActive: true } : {}),
    ...(query.status === "INACTIVE" ? { isActive: false } : {}),
  };
}

function buildAssignmentWhere(query) {
  return {
    ...(query.status ? { status: String(query.status) } : {}),
    ...(query.subject ? { subject: { name: contains(query.subject) } } : {}),
    ...(query.tutor ? { tutor: { fullName: contains(query.tutor) } } : {}),
    ...(query.student ? { student: { fullName: contains(query.student) } } : {}),
  };
}

function contains(value) {
  return { contains: String(value), mode: "insensitive" };
}

function parseParentInput(body) {
  const fullName = required(body.fullName, "Parent full name is required.");
  const email = required(body.email, "Parent email is required.").toLowerCase();
  return cleanData({
    fullName,
    email,
    phone: optional(body.phone),
    preferredContactMethod: optional(body.preferredContactMethod),
    country: optional(body.country),
    timeZone: optional(body.timeZone),
    emergencyContactName: optional(body.emergencyContactName),
    emergencyContactPhone: optional(body.emergencyContactPhone),
    emergencyContactRelationship: optional(body.emergencyContactRelationship),
    status: parseStatus(body.status),
    notes: optional(body.notes),
  });
}

function parseStudentInput(body) {
  const fullName = required(body.fullName, "Student full name is required.");
  const subjectIds = parseIdArray(body.subjectIds);
  return {
    subjectIds,
    data: cleanData({
      fullName,
      userId: optional(body.userId),
      parentId: optional(body.parentId),
      dateOfBirth: optionalDate(body.dateOfBirth),
      age: optionalInt(body.age),
      yearGroup: optional(body.yearGroup),
      country: optional(body.country),
      timeZone: optional(body.timeZone),
      schoolOrInstitution: optional(body.schoolOrInstitution),
      examPathway: parseExamPathway(body.examPathway),
      academicGoals: optional(body.academicGoals),
      learningNeeds: optional(body.learningNeeds),
      status: parseStatus(body.status),
      directLoginDisabled: optionalBoolean(body.directLoginDisabled) ?? false,
      startDate: optionalDate(body.startDate),
      importantNotes: optional(body.importantNotes),
    }),
  };
}

function parseTutorInput(body) {
  const fullName = required(body.fullName, "Tutor full name is required.");
  const email = required(body.email, "Tutor email is required.").toLowerCase();
  const subjectIds = parseIdArray(body.subjectIds);
  return {
    subjectIds,
    data: cleanData({
      fullName,
      email,
      phone: optional(body.phone),
      country: optional(body.country),
      timeZone: optional(body.timeZone),
      qualifications: optional(body.qualifications),
      mainSubjectAreas: optional(body.mainSubjectAreas),
      teachingExperience: optional(body.teachingExperience),
      availability: optional(body.availability),
      status: parseStatus(body.status),
      startDate: optionalDate(body.startDate),
      rateInformation: optional(body.rateInformation),
      internalPerformanceNotes: optional(body.internalPerformanceNotes),
      primaryTeachingDevice: optional(body.primaryTeachingDevice),
      operatingSystem: optional(body.operatingSystem),
      internetConnectionType: optional(body.internetConnectionType),
      averageInternetSpeed: optional(body.averageInternetSpeed),
      backupInternet: optionalBoolean(body.backupInternet),
      webcamAvailable: optionalBoolean(body.webcamAvailable),
      headsetMicrophoneAvailable: optionalBoolean(body.headsetMicrophoneAvailable),
      quietTeachingEnvironment: optionalBoolean(body.quietTeachingEnvironment),
      onlineTeachingPlatforms: optional(body.onlineTeachingPlatforms),
    }),
  };
}

function parseSubjectInput(body) {
  return cleanData({
    name: required(body.name, "Subject name is required."),
    category: optional(body.category),
    examPathway: parseExamPathway(body.examPathway),
    isActive: optionalBoolean(body.isActive) ?? true,
    description: optional(body.description),
  });
}

function parseAssignmentInput(body) {
  const status = String(body.status ?? "ACTIVE");
  if (!assignmentStatuses.includes(status)) {
    throw new ValidationError("Please select a valid assignment status.");
  }

  return {
    allowDuplicateActive: body.allowDuplicateActive === true || body.allowDuplicateActive === "true",
    data: cleanData({
      studentId: required(body.studentId, "Student is required."),
      tutorId: required(body.tutorId, "Tutor is required."),
      subjectId: required(body.subjectId, "Subject is required."),
      startDate: requiredDate(body.startDate, "Start date is required."),
      endDate: optionalDate(body.endDate),
      status,
      notes: optional(body.notes),
    }),
  };
}

async function assertNoDuplicateActiveAssignment(data, allowDuplicateActive, currentAssignmentId = null) {
  if (data.status !== "ACTIVE") {
    return;
  }

  const existing = await getPrisma().studentTutorAssignment.findFirst({
    where: {
      studentId: data.studentId,
      tutorId: data.tutorId,
      subjectId: data.subjectId,
      status: "ACTIVE",
      ...(currentAssignmentId ? { id: { not: currentAssignmentId } } : {}),
    },
  });

  if (existing && !allowDuplicateActive) {
    throw new ConflictError("An active assignment already exists for this student, tutor, and subject. Confirm duplicate assignment to continue.");
  }
}

async function storeTutorUploads(files = {}) {
  const result = {};
  const cv = files.cv?.[0];
  const certificates = files.certificates ?? [];

  if (cv) {
    const stored = await storeUpload(cv, "cv");
    result.cvFileKey = stored.key;
    result.cvFileName = stored.originalName;
  }

  if (certificates.length > 0) {
    result.certificateFiles = [];
    for (const file of certificates) {
      result.certificateFiles.push(await storeUpload(file, "certificates"));
    }
  }

  return result;
}

async function storeUpload(file, folder) {
  validateUpload(file);
  const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_STORAGE_PATH || "uploads");
  const targetDir = path.join(uploadRoot, "portal", "tutors", folder);
  await fs.mkdir(targetDir, { recursive: true });
  const extension = path.extname(file.originalname).toLowerCase();
  const key = `${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;
  const targetPath = path.join(targetDir, key);
  await fs.writeFile(targetPath, file.buffer);
  return {
    key: path.relative(uploadRoot, targetPath).replace(/\\/g, "/"),
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}

function validateUpload(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!allowedUploadExtensions.has(extension) || !allowedUploadMimeTypes.has(file.mimetype)) {
    throw new ValidationError("Uploads must be PDF, DOC, DOCX, JPG, or PNG files.");
  }
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

function parseStatus(value) {
  const status = String(value || "ACTIVE");
  if (!activeStatuses.includes(status)) {
    throw new ValidationError("Please select a valid status.");
  }
  return status;
}

function parseExamPathway(value) {
  const pathway = optional(value);
  if (!pathway) {
    return null;
  }
  if (!examPathways.includes(pathway)) {
    throw new ValidationError("Please select a valid exam pathway.");
  }
  return pathway;
}

function required(value, message) {
  const cleaned = optional(value);
  if (!cleaned) {
    throw new ValidationError(message);
  }
  return cleaned;
}

function requiredDate(value, message) {
  const parsed = optionalDate(value);
  if (!parsed) {
    throw new ValidationError(message);
  }
  return parsed;
}

function optional(value) {
  const cleaned = String(value ?? "").trim();
  return cleaned || null;
}

function optionalDate(value) {
  const cleaned = optional(value);
  if (!cleaned) {
    return null;
  }
  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Please enter a valid date.");
  }
  return date;
}

function optionalInt(value) {
  const cleaned = optional(value);
  if (!cleaned) {
    return null;
  }
  const number = Number.parseInt(cleaned, 10);
  if (!Number.isInteger(number) || number < 0 || number > 120) {
    throw new ValidationError("Please enter a valid age.");
  }
  return number;
}

function optionalBoolean(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return value === true || value === "true" || value === "Yes" || value === "on";
}

function cleanData(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function sendRecord(response, record, notFoundMessage) {
  if (!record) {
    response.status(404).json({ ok: false, message: notFoundMessage });
    return;
  }
  response.json({ ok: true, record });
}

function handleValidation(error, response, next) {
  if (error instanceof ConflictError) {
    response.status(409).json({ ok: false, message: error.message, requiresConfirmation: true });
    return;
  }
  if (error instanceof ValidationError) {
    response.status(422).json({ ok: false, message: error.message });
    return;
  }
  next(error);
}

class ValidationError extends Error {}
class ConflictError extends Error {}
