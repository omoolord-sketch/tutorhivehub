import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

let prisma;

export function getPrisma() {
  if (!process.env.DATABASE_URL && !hasSeparateDatabaseConfig()) {
    throw new Error("DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME is required before using the TutorHiveHub portal database.");
  }

  if (!prisma) {
    const adapter = new PrismaMariaDb(mysqlConnectionConfig());
    prisma = new PrismaClient({ adapter });
  }

  return prisma;
}

export async function checkDatabaseConnection() {
  const client = getPrisma();
  await client.$queryRaw`SELECT 1`;
  return true;
}

export function getDatabaseConnectionConfig() {
  if (!process.env.DATABASE_URL && !hasSeparateDatabaseConfig()) {
    throw new Error("DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME is required before using the TutorHiveHub portal database.");
  }

  return mysqlConnectionConfig();
}

export function getDatabaseRuntimeSummary() {
  const separateConfigPresent = hasSeparateDatabaseConfig();
  const summary = {
    source: separateConfigPresent ? "DB_* variables" : "DATABASE_URL",
    separateConfig: {
      configured: separateConfigPresent,
      host: process.env.DB_HOST || "",
      port: positiveInteger(process.env.DB_PORT, 3306),
      user: process.env.DB_USER || "",
      database: process.env.DB_NAME || "",
      passwordConfigured: Boolean(process.env.DB_PASSWORD),
      passwordLength: process.env.DB_PASSWORD?.length || 0,
    },
    databaseUrl: summarizeDatabaseUrl(process.env.DATABASE_URL),
    pool: {
      connectionLimit: positiveInteger(process.env.DB_CONNECTION_LIMIT, 1),
      acquireTimeoutMs: positiveInteger(process.env.DB_ACQUIRE_TIMEOUT_MS, 30000),
      connectTimeoutMs: positiveInteger(process.env.DB_CONNECT_TIMEOUT_MS, 10000),
      idleTimeoutSeconds: positiveInteger(process.env.DB_IDLE_TIMEOUT_SECONDS, 30),
    },
  };

  return summary;
}

function mysqlConnectionConfig() {
  if (hasSeparateDatabaseConfig()) {
    return mysqlConnectionFromEnv();
  }

  return mysqlConnectionFromUrl(process.env.DATABASE_URL);
}

function hasSeparateDatabaseConfig() {
  return Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);
}

function mysqlConnectionFromEnv() {
  return withPoolOptions({
    host: process.env.DB_HOST || "localhost",
    port: positiveInteger(process.env.DB_PORT, 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
  });
}

function mysqlConnectionFromUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    throw new Error("DATABASE_URL must use mysql:// for Hostinger MySQL/MariaDB.");
  }

  return withPoolOptions({
    host: url.hostname || "localhost",
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
  });
}

function withPoolOptions(config) {
  const connectionLimit = positiveInteger(process.env.DB_CONNECTION_LIMIT, 1);
  const acquireTimeout = positiveInteger(process.env.DB_ACQUIRE_TIMEOUT_MS, 30000);

  return {
    ...config,
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

function summarizeDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    return { configured: false, parses: false };
  }

  try {
    const url = new URL(databaseUrl);
    return {
      configured: true,
      parses: true,
      protocol: url.protocol.replace(":", ""),
      host: url.hostname,
      port: url.port || "3306",
      user: decodeURIComponent(url.username || ""),
      database: decodeURIComponent(url.pathname.replace(/^\//, "")),
      passwordConfigured: Boolean(url.password),
      passwordLength: decodeURIComponent(url.password || "").length,
    };
  } catch (error) {
    return {
      configured: true,
      parses: false,
      error: error instanceof Error ? error.message : "Invalid DATABASE_URL",
    };
  }
}
