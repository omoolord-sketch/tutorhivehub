import { createOpaqueToken, parseCookies, signToken, timingSafeEqualText, verifySignedToken } from "./security.js";

const CSRF_COOKIE_NAME = "thh_csrf";
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function applySecurityHeaders(request, response, next) {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' http://127.0.0.1:4174 http://127.0.0.1:5173",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  if (process.env.CONTENT_SECURITY_POLICY !== "false") {
    response.setHeader("Content-Security-Policy", process.env.CONTENT_SECURITY_POLICY || csp);
  }
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  if (request.path?.startsWith("/portal")) {
    response.setHeader("X-Robots-Tag", "noindex, nofollow");
  }

  if (process.env.NODE_ENV === "production" || process.env.FORCE_HTTPS === "true") {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
}

export function enforceHttps(request, response, next) {
  if (process.env.FORCE_HTTPS !== "true") {
    next();
    return;
  }

  const forwardedProto = request.headers["x-forwarded-proto"];
  const isHttps = request.secure || forwardedProto === "https";
  if (isHttps) {
    next();
    return;
  }

  response.redirect(308, `https://${request.headers.host}${request.originalUrl}`);
}

export function csrfTokenRoute(_request, response) {
  const token = createOpaqueToken();
  response.setHeader("Set-Cookie", csrfCookie(token));
  response.json({ ok: true, csrfToken: token });
}

export function csrfProtection(request, response, next) {
  if (process.env.CSRF_PROTECTION === "false" || !shouldProtectCsrf(request)) {
    next();
    return;
  }

  const cookies = parseCookies(request.headers.cookie ?? "");
  const cookieToken = verifySignedToken(cookies[CSRF_COOKIE_NAME]);
  const headerToken = String(request.headers["x-csrf-token"] ?? "");

  if (!cookieToken || !headerToken || !timingSafeEqualText(cookieToken, headerToken)) {
    response.status(403).json({ ok: false, message: "Security check failed. Please refresh the page and try again." });
    return;
  }

  next();
}

export function buildSecurityChecklist(env = process.env) {
  return [
    { area: "Authentication secret", status: Boolean(env.AUTH_SECRET && env.AUTH_SECRET.length >= 32), detail: "AUTH_SECRET must be at least 32 characters." },
    { area: "CSRF protection", status: env.CSRF_PROTECTION !== "false", detail: "Portal and auth write requests require a CSRF token." },
    { area: "Content Security Policy", status: env.CONTENT_SECURITY_POLICY !== "false", detail: "CSP headers are applied by the server." },
    { area: "Secure cookies", status: env.NODE_ENV === "production", detail: "Session cookies are marked Secure in production." },
    { area: "HTTPS enforcement", status: env.FORCE_HTTPS === "true" || env.NODE_ENV === "production", detail: "Enable FORCE_HTTPS=true behind production TLS." },
    { area: "Database", status: Boolean(env.DATABASE_URL), detail: "DATABASE_URL must point to production Hostinger MySQL/MariaDB." },
    { area: "Email provider", status: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS), detail: "SMTP credentials are required for portal email delivery." },
    { area: "File storage", status: Boolean(env.UPLOAD_STORAGE_PATH), detail: "Uploads must be stored outside source control and backed up." },
    { area: "Backup procedure", status: Boolean(env.BACKUP_PROCEDURE_URL || env.BACKUP_STORAGE_LOCATION), detail: "Document backup destination, schedule, and restore test." },
    { area: "Error monitoring", status: Boolean(env.ERROR_MONITORING_DSN || env.LOG_RETENTION_DAYS), detail: "Configure monitoring or log retention before launch." },
  ];
}

function shouldProtectCsrf(request) {
  if (!unsafeMethods.has(String(request.method).toUpperCase())) {
    return false;
  }
  return request.path?.startsWith("/api/portal") || request.path?.startsWith("/api/auth");
}

function csrfCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${CSRF_COOKIE_NAME}=${encodeURIComponent(signToken(token))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200${secure}`;
}
