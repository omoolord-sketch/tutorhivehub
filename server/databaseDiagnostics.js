import mariadb from "mariadb";
import { checkDatabaseConnection, getDatabaseConnectionConfig, getDatabaseRuntimeSummary } from "./db.js";

const DEFAULT_TIMEOUT_MS = 4500;

const sensitiveValues = () =>
  [process.env.DB_PASSWORD, process.env.DATABASE_URL, process.env.INITIAL_ADMIN_PASSWORD, process.env.SMTP_PASS].filter(Boolean);

export async function runDatabaseDiagnostics({ includePrisma = false, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const startedAt = Date.now();
  const environment = safeCall(getDatabaseRuntimeSummary);
  const boundedTimeoutMs = boundedTimeout(timeoutMs);
  const rawConnection = await withTimeout(
    checkRawMariaDbConnection(boundedTimeoutMs),
    boundedTimeoutMs + 500,
    timeoutResult("rawConnection", boundedTimeoutMs + 500),
  );
  const prisma = includePrisma
    ? await withTimeout(
        checkPrismaConnection(),
        boundedTimeoutMs + 500,
        timeoutResult("prisma", boundedTimeoutMs + 500),
      )
    : {
        ok: null,
        skipped: true,
        message: "Add prisma=true to this diagnostic URL after rawConnection succeeds.",
      };

  return {
    ok: Boolean(rawConnection.ok && (prisma.ok || prisma.skipped)),
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    timeoutMs: boundedTimeoutMs,
    environment,
    rawConnection,
    prisma,
  };
}

async function checkRawMariaDbConnection(timeoutMs) {
  const startedAt = Date.now();
  let connection;

  try {
    const config = {
      ...connectionOnlyConfig(getDatabaseConnectionConfig()),
      connectTimeout: timeoutMs,
    };
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

async function withTimeout(promise, timeoutMs, timeoutPayload) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(timeoutPayload), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function timeoutResult(area, timeoutMs) {
  return {
    ok: false,
    timedOut: true,
    durationMs: timeoutMs,
    name: "DiagnosticTimeout",
    code: "DIAGNOSTIC_TIMEOUT",
    message: `${area} did not respond within ${timeoutMs}ms.`,
  };
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

function boundedTimeout(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1000), 10000);
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
