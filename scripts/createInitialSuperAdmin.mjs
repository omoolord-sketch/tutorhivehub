import "dotenv/config";
import { getPrisma } from "../server/db.js";
import { syncRolesAndPermissions } from "../server/portalRoutes.js";
import { assertValidPassword, hashPassword } from "../server/security.js";

const prisma = getPrisma();

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

try {
  const email = requiredEnv("INITIAL_ADMIN_EMAIL").toLowerCase();
  const name = requiredEnv("INITIAL_ADMIN_NAME");
  const password = requiredEnv("INITIAL_ADMIN_PASSWORD");
  assertValidPassword(password);

  await syncRolesAndPermissions(prisma);

  const activeSuperAdminCount = await prisma.user.count({
    where: {
      status: "ACTIVE",
      role: { name: "Super Admin" },
    },
  });

  if (activeSuperAdminCount > 0) {
    throw new Error("An active Super Admin already exists. This setup command is only for first-time setup.");
  }

  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "Super Admin" },
  });

  const now = new Date();
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      roleId: superAdminRole.id,
      passwordHash: hashPassword(password),
      status: "ACTIVE",
      emailVerifiedAt: now,
      activatedAt: now,
      deactivatedAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      passwordChangedAt: now,
    },
    create: {
      email,
      name,
      roleId: superAdminRole.id,
      passwordHash: hashPassword(password),
      status: "ACTIVE",
      emailVerifiedAt: now,
      activatedAt: now,
      passwordChangedAt: now,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "initial_super_admin_created",
      entityType: "User",
      entityId: user.id,
      metadata: { setupCommand: true },
    },
  });

  console.log(`Initial Super Admin is ready: ${email}`);
} finally {
  await prisma.$disconnect();
}
