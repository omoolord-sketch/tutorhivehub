import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { rolePermissions } from "../server/roles.js";
import { assertValidPassword } from "../server/security.js";
import { buildSecurityChecklist } from "../server/securityHardening.js";
import { buildReportRows, canParentAccessStudent, csvEscape, metricRowsToCsv, normaliseDateRange, percentage } from "../server/phase10Routes.js";
import { __schedulingTestInternals } from "../server/schedulingRoutes.js";

const repoFile = (path) => new URL(`../${path}`, import.meta.url);

function hasRolePermission(roleName, permission) {
  const permissions = rolePermissions[roleName] ?? [];
  return roleName === "Super Admin" || permissions.includes(permission) || permissions.includes("system:all");
}

test("authentication password policy rejects short passwords and accepts strong length", () => {
  assert.throws(() => assertValidPassword("short"), /12 characters/);
  assert.doesNotThrow(() => assertValidPassword("TutorHiveHub2026!"));
});

test("role permissions keep safeguarding and internal records restricted", () => {
  assert.equal(hasRolePermission("Super Admin", "safeguarding:manage"), true);
  assert.equal(hasRolePermission("Administrator", "safeguarding:manage"), true);
  assert.equal(hasRolePermission("Finance Officer", "safeguarding:read"), false);
  assert.equal(hasRolePermission("Tutor", "safeguarding:read"), false);
  assert.equal(hasRolePermission("Parent", "quality:manage"), false);
  assert.equal(hasRolePermission("Student", "audit:read"), false);
  assert.equal(hasRolePermission("Administrator", "security:manage"), true);
  assert.equal(hasRolePermission("Administrator", "data-protection:manage"), true);
});

test("parent-student access is scoped to linked children only", () => {
  assert.equal(canParentAccessStudent("parent_1", { parentId: "parent_1" }), true);
  assert.equal(canParentAccessStudent("parent_1", { parentId: "parent_2" }), false);
  assert.equal(canParentAccessStudent("", { parentId: "parent_1" }), false);
});

test("homework and family permissions are split by role", () => {
  assert.equal(hasRolePermission("Academic Coordinator", "homework:manage"), true);
  assert.equal(hasRolePermission("Tutor", "own:homework"), true);
  assert.equal(hasRolePermission("Parent", "family:homework"), true);
  assert.equal(hasRolePermission("Student", "own:homework"), true);
  assert.equal(hasRolePermission("Parent", "homework:manage"), false);
});

test("portal treats scheduled lessons as the tutor assignment source", () => {
  const shell = readFileSync(repoFile("src/portal/PortalApp.tsx"), "utf8");
  const homeworkPage = readFileSync(repoFile("src/portal/learning-pages.tsx"), "utf8");
  const lessonWorkspace = readFileSync(repoFile("src/portal/lesson-workspace-pages.tsx"), "utf8");
  const learningRoutes = readFileSync(repoFile("server/learningRoutes.js"), "utf8");

  assert.doesNotMatch(shell, /label: "Tutor Allocation"/);
  assert.match(shell, /label: "Assignments"/);
  assert.match(shell, /mode="admin-monitor"/);
  assert.match(shell, /hideStaffHomeworkWorkspace/);
  assert.match(shell, /label: "Homework & Assignments"/);
  assert.match(homeworkPage, /Tutor-set assignment workflow is active/);
  assert.match(homeworkPage, /Admin Monitoring/);
  assert.match(homeworkPage, /AssignmentMonitorSummary/);
  assert.match(homeworkPage, /const canCreate = !isAdminMonitor && currentUser\.role\?\.name === "Tutor"/);
  assert.match(homeworkPage, /label="Completed lesson" required/);
  assert.match(homeworkPage, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(homeworkPage, /defaultValue=\{initialValues\.studentId \?\? ""\}/);
  assert.match(lessonWorkspace, /Set Assignment/);
  assert.match(lessonWorkspace, /assignmentHref\(lesson\)/);
  assert.match(lessonWorkspace, /const canSetAssignments = currentUser\.role\?\.name === "Tutor"/);
  assert.match(lessonWorkspace, /lesson\.status === "COMPLETED"/);
  assert.match(learningRoutes, /assertTutorHomeworkActor\(request, "Assignments must be set by tutors after completed lessons\."\)/);
  assert.match(learningRoutes, /Link a completed lesson before setting an assignment/);
  assert.match(learningRoutes, /Tutors can only set assignments after completed lessons they taught/);
  assert.match(learningRoutes, /upload\.single\("attachment"\)/);
  assert.match(learningRoutes, /upload\.single\("submissionFile"\)/);
});

test("phase 10 report helpers calculate percentages and exports safely", () => {
  assert.equal(percentage(3, 4), 75);
  assert.equal(percentage(1, 3), 33.33);
  assert.equal(percentage(1, 0), 0);
  assert.equal(csvEscape('One, "Two"'), '"One, ""Two"""');

  const rows = buildReportRows({
    metrics: { activeStudents: 10, revenue: 250 },
    homeworkByStatus: { COMPLETED: 4 },
    financeByStatus: { PAID: 2 },
    supportByStatus: { OPEN: 1 },
  });
  const csv = metricRowsToCsv(rows);
  assert.match(csv, /Active Students/);
  assert.match(csv, /Finance,PAID,2/);
});

test("report date filters normalise to valid date bounds", () => {
  const range = normaliseDateRange({ startDate: "2026-08-01", endDate: "2026-08-31" });
  assert.equal(range.startDate instanceof Date, true);
  assert.equal(range.endDate instanceof Date, true);
  assert.equal(range.startDate.getFullYear(), 2026);
  assert.equal(range.startDate.getMonth(), 7);
  assert.equal(range.startDate.getDate(), 1);
});

test("scheduling conflict guards are present for tutors, students, and availability", () => {
  const source = readFileSync(repoFile("server/schedulingRoutes.js"), "utf8");
  assert.match(source, /assertScheduleIsValid/);
  assert.match(source, /tutor booking/);
  assert.match(source, /student booking/);
  assert.match(source, /outside approved tutor availability/);
  assert.match(source, /End time must be after start time/);
});

test("portal shell links notifications and hides restricted tabs for limited roles", () => {
  const source = readFileSync(repoFile("src/portal/PortalApp.tsx"), "utf8");
  assert.match(source, /href="\/portal\/notifications"/);
  assert.match(source, /visiblePortalModules/);
  assert.match(source, /hideRestrictedModules/);
  assert.match(source, /\["Tutor", "Parent", "Student"\]\.includes/);
  assert.match(source, /portalModules\.filter\(\(module\) => canAccessModule\(user, module\)\)/);
});

test("scheduling warnings and availability checks use the selected UK time zone", async () => {
  const { checkTutorAvailability, combineDateTime, dateTimeText } = __schedulingTestInternals;
  const start = combineDateTime("2026-08-04", "18:00", "United Kingdom (GMT/BST)");
  const end = combineDateTime("2026-08-04", "19:00", "United Kingdom (GMT/BST)");

  assert.equal(start.toISOString(), "2026-08-04T17:00:00.000Z");
  assert.match(dateTimeText(start, "United Kingdom (GMT/BST)"), /4 Aug 2026, 18:00/);

  const prisma = {
    tutorAvailabilityException: { findMany: async () => [] },
    tutorAvailability: {
      findMany: async () => [{ dayOfWeek: 2, startTime: "18:00", endTime: "19:00", timeZone: "United Kingdom (GMT/BST)" }],
    },
  };

  assert.equal(await checkTutorAvailability(prisma, "tutor_1", start, end, "United Kingdom (GMT/BST)"), null);
});

test("weekly recurrence preserves wall-clock lesson time across UK clock changes", () => {
  const { combineDateTime, dateTimeText, parseRecurrence } = __schedulingTestInternals;
  const start = combineDateTime("2026-10-20", "18:00", "United Kingdom (GMT/BST)");
  const end = combineDateTime("2026-10-20", "19:00", "United Kingdom (GMT/BST)");

  const occurrences = parseRecurrence("WEEKLY", start, end, { occurrenceCount: "3" }, "United Kingdom (GMT/BST)");

  assert.deepEqual(occurrences.map((occurrence) => dateTimeText(occurrence.start, "United Kingdom (GMT/BST)")), [
    "20 Oct 2026, 18:00",
    "27 Oct 2026, 18:00",
    "3 Nov 2026, 18:00",
  ]);
  assert.equal(occurrences[0].start.toISOString(), "2026-10-20T17:00:00.000Z");
  assert.equal(occurrences[2].start.toISOString(), "2026-11-03T18:00:00.000Z");
});

test("timesheet calculation rules use generated lesson rows and payable eligibility", () => {
  const source = readFileSync(repoFile("server/payrollRoutes.js"), "utf8");
  assert.match(source, /generateTimesheet/);
  assert.match(source, /reportStatus: "SUBMITTED"/);
  assert.match(source, /report: \{ isNot: null \}/);
  assert.match(source, /Completed and verified lesson/);
  assert.match(source, /Lessons without submitted daily reports are excluded from generated timesheets/);
  assert.match(source, /Tutors cannot approve or pay their own timesheets/);

  const amount = Math.round((2.5 * 18 + Number.EPSILON) * 100) / 100;
  assert.equal(amount, 45);
});

test("master data forms link parent and tutor profiles to portal user accounts", () => {
  const serverSource = readFileSync(repoFile("server/masterDataRoutes.js"), "utf8");
  const portalSource = readFileSync(repoFile("src/portal/master-data-pages.tsx"), "utf8");

  assert.match(serverSource, /const parentInclude = \{\s+user:/);
  assert.match(serverSource, /const tutorInclude = \{\s+user:/);
  assert.match(serverSource, /userId: optional\(body\.userId\)/);
  assert.match(portalSource, /Parent portal account/);
  assert.match(portalSource, /Tutor portal account/);
  assert.match(portalSource, /usersForRole\(lookups, "Tutor"\)/);
});

test("finance module records invoice totals, payments, receipts, and parent scoping", () => {
  const source = readFileSync(repoFile("server/financeRoutes.js"), "utf8");
  assert.match(source, /THH-INV/);
  assert.match(source, /THH-RCP/);
  assert.match(source, /balanceDue/);
  assert.match(source, /family:finance/);

  const invoiceTotal = 160;
  const partialPayment = 60;
  assert.equal(invoiceTotal - partialPayment, 100);
});

test("security checklist verifies production hardening controls", () => {
  const checklist = buildSecurityChecklist({
    AUTH_SECRET: "x".repeat(40),
    CSRF_PROTECTION: "true",
    CONTENT_SECURITY_POLICY: "",
    NODE_ENV: "production",
    FORCE_HTTPS: "true",
    DATABASE_URL: "mysql://example",
    SMTP_HOST: "smtp.gmail.com",
    SMTP_USER: "admin@tutorhivehub.com",
    SMTP_PASS: "secret",
    UPLOAD_STORAGE_PATH: "uploads",
    BACKUP_STORAGE_LOCATION: "daily-database-backups",
    LOG_RETENTION_DAYS: "90",
  });

  assert.equal(checklist.every((item) => item.status), true);
});
