import crypto from "node:crypto";

const SESSION_COOKIE_NAME = "thh_session";
const PASSWORD_ALGORITHM = "scrypt";
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_COST = 16384;
const DEFAULT_SESSION_HOURS = 8;
const REMEMBER_SESSION_DAYS = 30;

export function requireAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a strong value of at least 32 characters.");
  }
  return secret;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derived = crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH, { N: PASSWORD_COST }).toString("base64url");
  return `${PASSWORD_ALGORITHM}:${PASSWORD_COST}:${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return false;
  }

  const [algorithm, costText, salt, expected] = storedHash.split(":");
  if (algorithm !== PASSWORD_ALGORITHM || !costText || !salt || !expected) {
    return false;
  }

  const derived = crypto.scryptSync(password, salt, Buffer.from(expected, "base64url").length, { N: Number(costText) }).toString("base64url");
  return timingSafeEqualText(derived, expected);
}

export function assertValidPassword(password) {
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("Password must be at least 12 characters long.");
  }
}

export function createOpaqueToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function signToken(token) {
  const signature = crypto.createHmac("sha256", requireAuthSecret()).update(token).digest("base64url");
  return `${token}.${signature}`;
}

export function verifySignedToken(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const [token, signature] = value.split(".");
  if (!token || !signature) {
    return null;
  }

  const expected = crypto.createHmac("sha256", requireAuthSecret()).update(token).digest("base64url");
  return timingSafeEqualText(signature, expected) ? token : null;
}

export function createSessionExpiry(rememberMe = false) {
  const expiresAt = new Date();
  if (rememberMe) {
    expiresAt.setDate(expiresAt.getDate() + REMEMBER_SESSION_DAYS);
  } else {
    expiresAt.setHours(expiresAt.getHours() + DEFAULT_SESSION_HOURS);
  }
  return expiresAt;
}

export function parseCookies(header = "") {
  return header.split(";").reduce((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName && rawValue.length > 0) {
      cookies[decodeURIComponent(rawName)] = decodeURIComponent(rawValue.join("="));
    }
    return cookies;
  }, {});
}

export function readSessionCookie(request) {
  const cookies = parseCookies(request.headers.cookie ?? "");
  return verifySignedToken(cookies[SESSION_COOKIE_NAME]);
}

export function setSessionCookie(response, token, expiresAt) {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(signToken(token))}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ];

  if (secure) {
    parts.push("Secure");
  }

  response.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`);
}

export function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

export function getRequestIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return request.socket.remoteAddress ?? null;
}
