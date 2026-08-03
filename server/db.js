import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

let prisma;

export function getPrisma() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required before using the TutorHiveHub portal database.");
  }

  if (!prisma) {
    const adapter = new PrismaMariaDb(mysqlConnectionFromUrl(process.env.DATABASE_URL));
    prisma = new PrismaClient({ adapter });
  }

  return prisma;
}

export async function checkDatabaseConnection() {
  const client = getPrisma();
  await client.$queryRaw`SELECT 1`;
  return true;
}

function mysqlConnectionFromUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    throw new Error("DATABASE_URL must use mysql:// for Hostinger MySQL/MariaDB.");
  }

  const connectionLimit = positiveInteger(process.env.DB_CONNECTION_LIMIT, 1);
  const acquireTimeout = positiveInteger(process.env.DB_ACQUIRE_TIMEOUT_MS, 30000);

  return {
    host: url.hostname || "localhost",
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    connectionLimit,
    minimumIdle: 0,
    acquireTimeout,
    initializationTimeout: Math.max(100, acquireTimeout - 100),
    connectTimeout: positiveInteger(process.env.DB_CONNECT_TIMEOUT_MS, 10000),
    idleTimeout: positiveInteger(process.env.DB_IDLE_TIMEOUT_SECONDS, 30),
  };
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
