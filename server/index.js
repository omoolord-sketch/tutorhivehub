import "dotenv/config";
import express from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getSessionUser } from "./authMiddleware.js";
import { rateLimit } from "./rateLimit.js";
import { registerFamilyDashboardRoutes } from "./familyDashboardRoutes.js";
import { registerFinanceRoutes } from "./financeRoutes.js";
import { registerLearningRoutes } from "./learningRoutes.js";
import { registerLessonWorkspaceRoutes } from "./lessonWorkspaceRoutes.js";
import { registerMasterDataRoutes } from "./masterDataRoutes.js";
import { registerPayrollRoutes } from "./payrollRoutes.js";
import { registerPhase10Routes } from "./phase10Routes.js";
import { registerPortalRoutes } from "./portalRoutes.js";
import { registerSchedulingRoutes } from "./schedulingRoutes.js";
import { applySecurityHeaders, csrfProtection, csrfTokenRoute, enforceHttps } from "./securityHardening.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const app = express();
app.set("trust proxy", 1);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_BYTES ?? 10 * 1024 * 1024),
  },
});

const defaultPort = process.env.NODE_ENV === "production" ? 3000 : 4174;
const port = Number(process.env.PORT ?? defaultPort);
const parentRecipient = process.env.PARENT_FORM_TO ?? "info@tutorhivehub.com";
const tutorRecipient = process.env.TUTOR_FORM_TO ?? "admin@tutorhivehub.com";
const publicInfoEmail = process.env.PUBLIC_INFO_EMAIL ?? "info@tutorhivehub.com";
const clientBuild = ensureClientBuild();
const portalPublicRoutes = new Set([
  "/portal/login",
  "/portal/login/",
  "/portal/forgot-password",
  "/portal/forgot-password/",
  "/portal/reset-password",
  "/portal/reset-password/",
  "/portal/verify-email",
  "/portal/verify-email/",
  "/portal/access-denied",
  "/portal/access-denied/",
]);

const portalPublicRoutePattern = /^\/portal\/(?:login|forgot-password|reset-password|verify-email|access-denied)\/?$/;

function clientBuildCandidates() {
  return [
    process.env.CLIENT_DIST_DIR,
    path.join(rootDir, "server", "client"),
    path.join(rootDir, "dist"),
    path.join(process.cwd(), "dist"),
    path.join(__dirname, "..", "dist"),
    path.join(__dirname, "dist"),
  ].filter(Boolean);
}

function resolveClientBuild() {
  for (const candidate of clientBuildCandidates()) {
    const distDir = path.resolve(String(candidate));
    const indexFile = path.join(distDir, "index.html");
    if (existsSync(indexFile)) {
      return { distDir, indexFile, found: true };
    }
  }

  const distDir = path.resolve(process.env.CLIENT_DIST_DIR || path.join(rootDir, "dist"));
  return { distDir, indexFile: path.join(distDir, "index.html"), found: false };
}

function ensureClientBuild() {
  let build = resolveClientBuild();
  if (build.found || process.env.NODE_ENV !== "production") {
    return build;
  }

  buildClientAssets(`startup missing ${build.indexFile}`);

  build = resolveClientBuild();
  if (!build.found) {
    console.error(`TutorHiveHub client build is still missing. Checked: ${clientBuildCandidates().join(", ")}`);
  }

  return build;
}

function buildClientAssets(reason) {
  console.warn(`TutorHiveHub client build unavailable (${reason}). Running npm run build.`);
  const result = spawnSync("npm", ["run", "build"], {
    cwd: rootDir,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    console.error(`TutorHiveHub client build failed with status ${result.status ?? "unknown"}.`);
  }
}

function isPortalHost(request) {
  const forwardedHost = String(request.headers["x-forwarded-host"] ?? "").split(",")[0].trim();
  const rawHost = forwardedHost || String(request.headers.host ?? "");
  const hostname = rawHost.split(":")[0].toLowerCase();
  return hostname === "portal.tutorhivehub.com";
}

function sendClientApp(_request, response, next) {
  const build = resolveClientBuild();
  if (!build.found) {
    buildClientAssets(`request missing ${build.indexFile}`);
    const rebuilt = resolveClientBuild();
    if (!rebuilt.found) {
      next(new Error(`TutorHiveHub client build missing at ${rebuilt.indexFile}`));
      return;
    }

    sendIndexFile(rebuilt.indexFile, response, next, false);
    return;
  }

  sendIndexFile(build.indexFile, response, next, true);
}

function sendIndexFile(indexFile, response, next, allowRebuild) {
  response.sendFile(indexFile, (error) => {
    if (!error) {
      return;
    }

    const isMissingFile = error.status === 404 || error.code === "ENOENT";
    if (allowRebuild && isMissingFile && !response.headersSent) {
      buildClientAssets(`sendFile could not read ${indexFile}`);
      const rebuilt = resolveClientBuild();
      if (rebuilt.found) {
        sendIndexFile(rebuilt.indexFile, response, next, false);
        return;
      }
    }

    next(error);
  });
}

function requireSmtpConfig() {
  const missing = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing SMTP configuration: ${missing.join(", ")}`);
  }
}

function createTransporter() {
  requireSmtpConfig();

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function escapeHtml(value) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatLabel(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase())
    .trim();
}

function formatSubmission(fields) {
  const entries = Object.entries(fields).filter(([, value]) => String(value ?? "").trim().length > 0);
  const text = entries.map(([key, value]) => `${formatLabel(key)}: ${Array.isArray(value) ? value.join(", ") : value}`).join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; color: #102033;">
      <h2 style="color: #061C3D;">TutorHiveHub Form Submission</h2>
      <table style="border-collapse: collapse; width: 100%;">
        ${entries
          .map(
            ([key, value]) => `
              <tr>
                <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; background: #f8fafc; width: 220px;">${escapeHtml(
                  formatLabel(key),
                )}</th>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${escapeHtml(value)}</td>
              </tr>
            `,
          )
          .join("")}
      </table>
    </div>
  `;

  return { text, html };
}

async function sendSubmissionEmail({ formName, recipient, fields, file }) {
  const transporter = createTransporter();
  const { text, html } = formatSubmission(fields);
  const replyTo = fields.parentEmail || fields.tutorEmail || publicInfoEmail;
  const attachments = file
    ? [
        {
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype,
        },
      ]
    : [];

  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? `TutorHiveHub Website <${process.env.SMTP_USER}>`,
    to: recipient,
    replyTo,
    subject: `TutorHiveHub ${formName} submission`,
    text,
    html,
    attachments,
  });
}

async function sendPortalEmail({ to, subject, text, html }) {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_SENDER ?? process.env.MAIL_FROM ?? `TutorHiveHub Portal <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
    console.warn("TutorHiveHub portal email not sent in local/dev mode", error instanceof Error ? error.message : error);
    return false;
  }
}

function handleSubmission({ formName, recipient }) {
  return async (request, response) => {
    try {
      await sendSubmissionEmail({
        formName,
        recipient,
        fields: request.body,
        file: request.file,
      });

      response.json({ ok: true });
    } catch (error) {
      console.error(`TutorHiveHub ${formName} email failed`, error);
      response.status(500).json({
        ok: false,
        message: "TutorHiveHub could not send this submission. Please email us directly.",
      });
    }
  };
}

app.use(enforceHttps);
app.use(applySecurityHeaders);
app.get("/api/security/csrf", csrfTokenRoute);
app.use(csrfProtection);
app.use("/api/portal", rateLimit({ windowMs: 60 * 1000, max: 300, keyPrefix: "portal-api" }));
app.use(express.json({ limit: "1mb" }));

registerPortalRoutes(app, { sendPortalEmail });
registerMasterDataRoutes(app, upload);
registerSchedulingRoutes(app, { sendPortalEmail });
registerLessonWorkspaceRoutes(app, { sendPortalEmail });
registerPayrollRoutes(app, { sendPortalEmail });
registerFinanceRoutes(app, { sendPortalEmail });
registerLearningRoutes(app, upload, { sendPortalEmail });
registerPhase10Routes(app);
registerFamilyDashboardRoutes(app, { sendPortalEmail });

app.post("/api/parent-enquiry", upload.none(), handleSubmission({ formName: "parent enquiry", recipient: parentRecipient }));
app.post("/api/tutor-application", upload.single("cvUpload"), handleSubmission({ formName: "tutor application", recipient: tutorRecipient }));

app.get("/", (request, response, next) => {
  if (isPortalHost(request)) {
    response.redirect(302, "/portal/login");
    return;
  }
  next();
});

app.get(portalPublicRoutePattern, sendClientApp);

app.get(/^\/portal(?:\/.*)?$/, async (request, response, next) => {
  const pathName = request.path;
  if (portalPublicRoutes.has(pathName)) {
    next();
    return;
  }

  try {
    const sessionContext = await getSessionUser(request);
    if (!sessionContext) {
      response.redirect("/portal/login");
      return;
    }
    next();
  } catch (error) {
    response.redirect("/portal/login");
  }
});

app.use("/api", (_request, response) => {
  response.status(404).json({ ok: false, message: "Not found." });
});

app.use(express.static(clientBuild.distDir));

app.get(/.*/, sendClientApp);

app.use((error, _request, response, _next) => {
  console.error("TutorHiveHub server error", error);
  response.status(500).json({ ok: false, message: "Something went wrong. Please try again." });
});

app.listen(port, () => {
  console.log(`TutorHiveHub server listening on http://127.0.0.1:${port}`);
});
