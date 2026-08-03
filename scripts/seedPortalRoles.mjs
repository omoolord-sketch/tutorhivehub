import "dotenv/config";
import { getPrisma } from "../server/db.js";
import { syncRolesAndPermissions } from "../server/portalRoutes.js";

const prisma = getPrisma();

try {
  await syncRolesAndPermissions(prisma);
  console.log("TutorHiveHub portal roles and permissions are ready.");
} finally {
  await prisma.$disconnect();
}
