import mariadb from "mariadb";
import { checkDatabaseConnection, getDatabaseConnectionConfig, getDatabaseRuntimeSummary } from "./db.js";

const sensitiveValues = () =>
  [process.env.DB_PASSWORD, process.env.DATABASE_URL, process.env.INITIAL_ADMIN_PASSWORD, process.env.SMTP_PASS].filter(Boolean);

export async function runDatabaseDiagnostics() {
  const startedAt = Date.now();
  const environment = safeCall(getDatabaseRuntimeSummary);
  const rawConnection = await checkRawMariaDbConnection();
  const prisma = await checkPrismaConnection();

  return {
    ok: Boolean(rawConnection.ok && prisma.ok),
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    environment,
    rawConnection,
    prisma,
  };
}

async function checkRawMariaDbConnection() {
  const startedAt = Date.now();
  let connection;

  try {
    const config = connectionOnlyConfig(getDatabaseConnectionConfig());
    connection = await mariadb.createConnection(config);
    const rows = await connection.query("SELECT DATABASE() AS databaseName, CURRENT_USER() AS currentUser, VERSION() AS serverVersion");
    const firstRow = Array.isArray(rows) ? rows[0] : rows;

    return {
      ok: true,
      durationMs: Date.now() - startedAt,
      databaseName: firstRow?.databaseName || "",
      currentUser: firstRow?.currentUser || "",
      serverVersion: firstRow?.serverVersion || "",
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      ...safeError(error),
    };
  } finally {
    if (connection) {
      await connection.end().catch(() => {});
    }
  }
}

async function checkPrismaConnection() {
  const startedAt = Date.now();

  try {
    await checkDatabaseConnection();
    return {
      ok: true,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      ...safeError(error),
    };
  }
}

function connectionOnlyConfig(config) {
  const {
    acquireTimeout,
    connectionLimit,
    idleTimeout,
    initializationTimeout,
    minimumIdle,
    ...connectionConfig
  } = config;

  return connectionConfig;
}

function safeCall(callback) {
  try {
    return callback();
  } catch (error) {
    return {
      error: safeError(error).message,
    };
  }
}

function safeError(error) {
  return {
    name: error?.name || "Error",
    code: error?.code || "",
    errno: error?.errno || "",
    sqlState: error?.sqlState || "",
    message: redact(error instanceof Error ? error.message : String(error)),
  };
}

function redact(value) {
  let output = String(value || "");
  for (const sensitive of sensitiveValues()) {
    output = output.replaceAll(sensitive, "[redacted]");
  }
  return output;
}
