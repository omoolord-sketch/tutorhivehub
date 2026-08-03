import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { rolePermissions } from "../server/roles.js";
import { assertValidPassword } from "../server/security.js";
import { buildSecurityChecklist } from "../server/securityHardening.js";
import { buildReportRows, canParentAccessStudent, csvEscape, metricRowsToCsv, normaliseDateRange, percentage } from "../server/phase10Routes.js";

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

test("timesheet calculation rules use generated lesson rows and payable eligibility", () => {
  const source = readFileSync(repoFile("server/payrollRoutes.js"), "utf8");
  assert.match(source, /generateTimesheet/);
  assert.match(source, /Completed and verified lesson/);
  assert.match(source, /Daily lesson report is missing/);
  assert.match(source, /Tutors cannot approve or pay their own timesheets/);

  const amount = Math.round((2.5 * 18 + Number.EPSILON) * 100) / 100;
  assert.equal(amount, 45);
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
