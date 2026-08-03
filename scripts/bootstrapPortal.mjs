import "dotenv/config";
import { spawnSync } from "node:child_process";
import { getPrisma } from "../server/db.js";
import { syncRolesAndPermissions } from "../server/portalRoutes.js";
import { assertValidPassword, hashPassword } from "../server/security.js";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status ?? "unknown"}.`);
  }
}

async function ensureInitialSuperAdmin(prisma) {
  const email = requiredEnv("INITIAL_ADMIN_EMAIL").toLowerCase();
  const name = requiredEnv("INITIAL_ADMIN_NAME");
  const password = requiredEnv("INITIAL_ADMIN_PASSWORD");
  assertValidPassword(password);

  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "Super Admin" },
  });

  const existingActiveSuperAdmin = await prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      roleId: superAdminRole.id,
    },
  });

  if (existingActiveSuperAdmin) {
    console.log(`Active Super Admin already exists: ${existingActiveSuperAdmin.email}`);
    return;
  }

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
      metadata: { setupCommand: "portal:bootstrap" },
    },
  });

  console.log(`Initial Super Admin is ready: ${email}`);
}

async function main() {
  console.log("Applying TutorHiveHub portal database migrations...");
  run("npx", ["prisma", "migrate", "deploy"]);

  const prisma = getPrisma();

  try {
    console.log("Syncing TutorHiveHub portal roles and permissions...");
    await syncRolesAndPermissions(prisma);
    await ensureInitialSuperAdmin(prisma);
    console.log("TutorHiveHub portal bootstrap complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
