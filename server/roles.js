export const roleNames = [
  "Super Admin",
  "Administrator",
  "Academic Coordinator",
  "Finance Officer",
  "Tutor",
  "Parent",
  "Student",
];

export const permissions = [
  { key: "system:all", description: "Full system access" },
  { key: "users:read", description: "View portal users" },
  { key: "users:manage", description: "Create, edit, activate, deactivate, and reset portal users" },
  { key: "students:manage", description: "Manage student academic records" },
  { key: "parents:manage", description: "Manage parent records" },
  { key: "tutors:manage", description: "Manage tutor records and assignments" },
  { key: "subjects:manage", description: "Manage subjects and academic pathways" },
  { key: "assignments:manage", description: "Manage student, tutor, and subject assignments" },
  { key: "lessons:manage", description: "Manage lessons and assignments" },
  { key: "timetable:manage", description: "Manage timetables" },
  { key: "reports:manage", description: "Manage lesson reports" },
  { key: "timesheets:manage", description: "Manage tutor timesheets and payroll checks" },
  { key: "finance:manage", description: "Manage invoices, payments, rates, and payroll" },
  { key: "reporting:read", description: "View management reports and exports" },
  { key: "quality:manage", description: "Manage quality assurance records and tutor performance indicators" },
  { key: "audit:read", description: "View immutable audit logs" },
  { key: "security:manage", description: "Manage security, deployment, and compliance settings" },
  { key: "data-protection:manage", description: "Manage consent, retention, export, and anonymisation workflows" },
  { key: "homework:manage", description: "Manage homework tasks" },
  { key: "resources:manage", description: "Manage learning resources" },
  { key: "progress:manage", description: "Manage student progress records" },
  { key: "notifications:manage", description: "Manage notifications" },
  { key: "support:manage", description: "Manage support requests" },
  { key: "settings:manage", description: "Manage portal settings" },
  { key: "safeguarding:read", description: "View restricted safeguarding records" },
  { key: "safeguarding:manage", description: "Manage restricted safeguarding records" },
  { key: "own:students", description: "Access assigned or owned students only" },
  { key: "own:lessons", description: "Access own lessons only" },
  { key: "own:timetable", description: "Access own timetable only" },
  { key: "own:lesson-reports", description: "Access own lesson reports only" },
  { key: "own:homework", description: "Access own homework only" },
  { key: "own:progress", description: "Access own progress records only" },
  { key: "own:notifications", description: "Access own notifications only" },
  { key: "resources:approved", description: "Access approved resources only" },
  { key: "own:timesheets", description: "Access own timesheets only" },
  { key: "own:payments", description: "Access own payment records only" },
  { key: "own:profile", description: "Access own profile only" },
  { key: "own:support", description: "Access own support requests only" },
  { key: "family:children", description: "Access own children only" },
  { key: "family:timetable", description: "Access own family timetable only" },
  { key: "family:attendance", description: "Access own child attendance only" },
  { key: "family:lesson-updates", description: "Access parent-friendly updates only" },
  { key: "family:homework", description: "Access own child homework only" },
  { key: "family:progress", description: "Access approved child progress records only" },
  { key: "family:finance", description: "Access own family invoices, receipts, and payments only" },
  { key: "student:self", description: "Access own student portal data only" },
];

export const rolePermissions = {
  "Super Admin": ["system:all"],
  Administrator: [
    "users:read",
    "users:manage",
    "students:manage",
    "parents:manage",
    "tutors:manage",
    "subjects:manage",
    "assignments:manage",
    "lessons:manage",
    "timetable:manage",
    "reports:manage",
    "timesheets:manage",
    "finance:manage",
    "reporting:read",
    "quality:manage",
    "audit:read",
    "security:manage",
    "data-protection:manage",
    "homework:manage",
    "resources:manage",
    "progress:manage",
    "notifications:manage",
    "support:manage",
    "settings:manage",
    "safeguarding:read",
    "safeguarding:manage",
  ],
  "Academic Coordinator": [
    "students:manage",
    "parents:manage",
    "tutors:manage",
    "subjects:manage",
    "assignments:manage",
    "lessons:manage",
    "timetable:manage",
    "reports:manage",
    "reporting:read",
    "quality:manage",
    "homework:manage",
    "resources:manage",
    "progress:manage",
    "support:manage",
  ],
  "Finance Officer": ["users:read", "timesheets:manage", "finance:manage", "reporting:read", "audit:read", "support:manage"],
  Tutor: [
    "own:students",
    "own:lessons",
    "own:timetable",
    "own:lesson-reports",
    "own:homework",
    "own:progress",
    "own:notifications",
    "resources:approved",
    "own:timesheets",
    "own:payments",
    "own:profile",
    "own:support",
  ],
  Parent: [
    "family:children",
    "family:timetable",
    "family:attendance",
    "family:lesson-updates",
    "family:homework",
    "family:progress",
    "family:finance",
    "own:notifications",
    "own:support",
    "own:profile",
  ],
  Student: ["student:self", "resources:approved", "own:lessons", "own:timetable", "own:homework", "own:progress", "own:notifications", "own:profile", "own:support"],
};

export function hasPermission(user, permission) {
  if (!user?.role) {
    return false;
  }

  if (user.role.name === "Super Admin") {
    return true;
  }

  return user.role.permissions?.some((item) => item.key === permission || item.key === "system:all") ?? false;
}

export function safeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    status: user.status,
    role: user.role
      ? {
          id: user.role.id,
          name: user.role.name,
          permissions: user.role.permissions?.map((permission) => permission.key) ?? [],
        }
      : null,
    emailVerifiedAt: user.emailVerifiedAt,
    activatedAt: user.activatedAt,
    deactivatedAt: user.deactivatedAt,
    lastLoginAt: user.lastLoginAt,
    lockedUntil: user.lockedUntil,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
