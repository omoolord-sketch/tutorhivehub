import { getPrisma } from "./db.js";
import { auditLog, getSessionUser, requireSession, sessionResponse } from "./authMiddleware.js";
import { rateLimit } from "./rateLimit.js";
import { permissions, roleNames, rolePermissions, safeUser } from "./roles.js";
import {
  assertValidPassword,
  clearSessionCookie,
  createOpaqueToken,
  createSessionExpiry,
  getRequestIp,
  hashPassword,
  hashToken,
  readSessionCookie,
  setSessionCookie,
  verifyPassword,
} from "./security.js";

const LOGIN_LOCK_MINUTES = 15;
const MAX_FAILED_LOGINS = 5;
const RESET_TOKEN_MINUTES = 60;
const VERIFY_TOKEN_HOURS = 24;

export function registerPortalRoutes(app, { sendPortalEmail }) {
  app.get("/api/auth/session", async (request, response, next) => {
    try {
      const sessionContext = await getSessionUser(request);
      if (!sessionContext) {
        response.status(401).json({ ok: false, message: "Authentication required." });
        return;
      }
      response.json(sessionResponse(sessionContext.user));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: "login" }), async (request, response, next) => {
    try {
      const email = normaliseEmail(request.body?.email);
      const password = String(request.body?.password ?? "");
      const rememberMe = request.body?.rememberMe === true || request.body?.rememberMe === "true";

      if (!email || !password) {
        response.status(422).json({ ok: false, message: "Please enter your email and password." });
        return;
      }

      const prisma = getPrisma();
      const user = await prisma.user.findUnique({
        where: { email },
        include: { role: { include: { permissions: true } } },
      });

      const genericMessage = "Invalid email or password.";
      if (!user) {
        await auditLog({ request, action: "login_failed", entityType: "User", metadata: { email, reason: "not_found" } });
        response.status(401).json({ ok: false, message: genericMessage });
        return;
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        await auditLog({ request, actorId: user.id, action: "login_blocked_locked", entityType: "User", entityId: user.id });
        response.status(423).json({ ok: false, message: "Account is temporarily locked. Please try again later or reset your password." });
        return;
      }

      if (user.status !== "ACTIVE") {
        await auditLog({ request, actorId: user.id, action: "login_blocked_inactive", entityType: "User", entityId: user.id, metadata: { status: user.status } });
        response.status(403).json({ ok: false, message: "This account is not active. Please contact TutorHiveHub administration." });
        return;
      }

      if (!user.emailVerifiedAt) {
        await auditLog({ request, actorId: user.id, action: "login_blocked_unverified", entityType: "User", entityId: user.id });
        response.status(403).json({ ok: false, message: "Please verify your email before logging in." });
        return;
      }

      if (!verifyPassword(password, user.passwordHash)) {
        const failedLoginCount = user.failedLoginCount + 1;
        const lockedUntil = failedLoginCount >= MAX_FAILED_LOGINS ? addMinutes(new Date(), LOGIN_LOCK_MINUTES) : null;
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount, lockedUntil },
        });
        await auditLog({ request, actorId: user.id, action: "login_failed", entityType: "User", entityId: user.id, metadata: { reason: "password", failedLoginCount } });
        response.status(401).json({ ok: false, message: genericMessage });
        return;
      }

      const token = createOpaqueToken();
      const expiresAt = createSessionExpiry(rememberMe);
      await prisma.session.create({
        data: {
          userId: user.id,
          sessionTokenHash: hashToken(token),
          rememberMe,
          ipAddress: getRequestIp(request),
          userAgent: request.headers["user-agent"] ?? null,
          expiresAt,
        },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await auditLog({ request, actorId: user.id, action: "login_success", entityType: "User", entityId: user.id });
      setSessionCookie(response, token, expiresAt);

      response.json({ ok: true, user: safeUser({ ...user, failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }), redirectTo: "/portal" });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/logout", async (request, response, next) => {
    try {
      const token = readSessionCookie(request);
      const sessionContext = token ? await getSessionUser(request).catch(() => null) : null;
      if (token) {
        const prisma = getPrisma();
        const session = await prisma.session.updateMany({
          where: { sessionTokenHash: hashToken(token), revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await auditLog({
          request,
          actorId: sessionContext?.user?.id ?? null,
          action: "logout",
          entityType: "Session",
          metadata: { revokedSessions: session.count },
        });
      }
      clearSessionCookie(response);
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/forgot-password", rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "forgot-password" }), async (request, response, next) => {
    try {
      const email = normaliseEmail(request.body?.email);
      const prisma = getPrisma();
      const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

      let devResetUrl = null;
      if (user && user.status !== "ARCHIVED") {
        const token = createOpaqueToken();
        const expiresAt = addMinutes(new Date(), RESET_TOKEN_MINUTES);
        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(token),
            expiresAt,
          },
        });
        const resetUrl = portalUrl(`/portal/reset-password?token=${encodeURIComponent(token)}`);
        const delivered = await sendPasswordEmail(sendPortalEmail, user.email, user.name, resetUrl);
        if (!delivered && process.env.NODE_ENV !== "production") {
          devResetUrl = resetUrl;
        }
        await auditLog({ request, actorId: user.id, action: "password_reset_requested", entityType: "User", entityId: user.id });
      } else {
        await auditLog({ request, action: "password_reset_requested_unknown", entityType: "User", metadata: { email } });
      }

      response.json({
        ok: true,
        message: "If the account exists, a password reset link has been sent.",
        devResetUrl,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/reset-password", rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "reset-password" }), async (request, response, next) => {
    try {
      const token = String(request.body?.token ?? "");
      const password = String(request.body?.password ?? "");
      assertValidPassword(password);

      const prisma = getPrisma();
      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: true },
      });

      if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date() || resetToken.user.status === "ARCHIVED" || resetToken.user.status === "SUSPENDED") {
        response.status(422).json({ ok: false, message: "This reset link is invalid or has expired." });
        return;
      }

      const now = new Date();
      await prisma.$transaction([
        prisma.user.update({
          where: { id: resetToken.userId },
          data: {
            passwordHash: hashPassword(password),
            passwordChangedAt: now,
            emailVerifiedAt: resetToken.user.emailVerifiedAt ?? now,
            activatedAt: resetToken.user.activatedAt ?? now,
            status: resetToken.user.status === "INVITED" ? "ACTIVE" : resetToken.user.status,
            failedLoginCount: 0,
            lockedUntil: null,
          },
        }),
        prisma.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt: now },
        }),
        prisma.session.updateMany({
          where: { userId: resetToken.userId, revokedAt: null },
          data: { revokedAt: now },
        }),
      ]);

      await auditLog({ request, actorId: resetToken.userId, action: "password_reset_completed", entityType: "User", entityId: resetToken.userId });
      response.json({ ok: true, message: "Your password has been reset. You can now log in." });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Password must")) {
        response.status(422).json({ ok: false, message: error.message });
        return;
      }
      next(error);
    }
  });

  app.post("/api/auth/verify-email", rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "verify-email" }), async (request, response, next) => {
    try {
      const token = String(request.body?.token ?? "");
      const prisma = getPrisma();
      const verificationToken = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: true },
      });

      if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt <= new Date() || verificationToken.user.status === "ARCHIVED") {
        response.status(422).json({ ok: false, message: "This verification link is invalid or has expired." });
        return;
      }

      const now = new Date();
      await prisma.$transaction([
        prisma.user.update({
          where: { id: verificationToken.userId },
          data: { emailVerifiedAt: verificationToken.user.emailVerifiedAt ?? now },
        }),
        prisma.emailVerificationToken.update({
          where: { id: verificationToken.id },
          data: { usedAt: now },
        }),
      ]);
      await auditLog({ request, actorId: verificationToken.userId, action: "email_verified", entityType: "User", entityId: verificationToken.userId });
      response.json({ ok: true, message: "Email verified successfully." });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/roles", requireSession("users:read"), async (_request, response, next) => {
    try {
      const prisma = getPrisma();
      const roles = await prisma.role.findMany({
        orderBy: { name: "asc" },
        include: { permissions: true },
      });
      response.json({ ok: true, roles });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/users", requireSession("users:read"), async (_request, response, next) => {
    try {
      const prisma = getPrisma();
      const users = await prisma.user.findMany({
        orderBy: [{ createdAt: "desc" }],
        include: { role: { include: { permissions: true } } },
        take: 100,
      });
      response.json({ ok: true, users: users.map(safeUser) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/users", requireSession("users:manage"), async (request, response, next) => {
    try {
      const input = parseUserInput(request.body);
      const prisma = getPrisma();
      const role = await prisma.role.findUnique({ where: { id: input.roleId } });
      if (!role) {
        response.status(422).json({ ok: false, message: "Please select a valid role." });
        return;
      }

      const existing = await prisma.user.findUnique({ where: { email: input.email } });
      if (existing) {
        response.status(409).json({ ok: false, message: "A user with this email already exists." });
        return;
      }

      const now = new Date();
      const user = await prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          phone: input.phone,
          roleId: input.roleId,
          status: input.status,
          passwordHash: input.password ? hashPassword(input.password) : null,
          passwordChangedAt: input.password ? now : null,
          emailVerifiedAt: input.password ? now : null,
          failedLoginCount: 0,
          lockedUntil: null,
          activatedAt: input.status === "ACTIVE" ? now : null,
          deactivatedAt: input.status === "SUSPENDED" ? now : null,
        },
        include: { role: { include: { permissions: true } } },
      });

      let resetUrl = null;
      let verifyUrl = null;
      let delivered = false;
      if (input.password) {
        delivered = await sendWelcomeEmail(sendPortalEmail, user.email, user.name, { passwordSet: true });
      } else {
        const resetToken = await createPasswordResetToken(prisma, user.id);
        const verifyToken = await createEmailVerificationToken(prisma, user.id);
        resetUrl = portalUrl(`/portal/reset-password?token=${encodeURIComponent(resetToken)}`);
        verifyUrl = portalUrl(`/portal/verify-email?token=${encodeURIComponent(verifyToken)}`);
        delivered = await sendWelcomeEmail(sendPortalEmail, user.email, user.name, { resetUrl, verifyUrl });
      }

      await auditLog({
        request,
        actorId: request.portalUser.id,
        action: "user_created",
        entityType: "User",
        entityId: user.id,
        metadata: { role: role.name, status: input.status, initialPasswordSet: Boolean(input.password) },
      });

      response.status(201).json({
        ok: true,
        user: safeUser(user),
        devResetUrl: resetUrl && !delivered && process.env.NODE_ENV !== "production" ? resetUrl : null,
        devVerifyUrl: verifyUrl && !delivered && process.env.NODE_ENV !== "production" ? verifyUrl : null,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        response.status(422).json({ ok: false, message: error.message });
        return;
      }
      next(error);
    }
  });

  app.get("/api/portal/users/:id", requireSession("users:read"), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const user = await prisma.user.findUnique({
        where: { id: request.params.id },
        include: { role: { include: { permissions: true } } },
      });
      if (!user) {
        response.status(404).json({ ok: false, message: "User not found." });
        return;
      }
      response.json({ ok: true, user: safeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/portal/users/:id", requireSession("users:manage"), async (request, response, next) => {
    try {
      const input = parseUserInput(request.body);
      const prisma = getPrisma();
      const role = await prisma.role.findUnique({ where: { id: input.roleId } });
      if (!role) {
        response.status(422).json({ ok: false, message: "Please select a valid role." });
        return;
      }

      await ensureNotRemovingLastSuperAdmin(prisma, request.params.id, role.name, input.status);
      const now = new Date();
      const passwordUpdate = input.password
        ? {
            passwordHash: hashPassword(input.password),
            passwordChangedAt: now,
            emailVerifiedAt: now,
            failedLoginCount: 0,
            lockedUntil: null,
            sessions: { updateMany: { where: { revokedAt: null }, data: { revokedAt: now } } },
          }
        : {};
      const user = await prisma.user.update({
        where: { id: request.params.id },
        data: {
          email: input.email,
          name: input.name,
          phone: input.phone,
          roleId: input.roleId,
          status: input.status,
          activatedAt: input.status === "ACTIVE" ? now : undefined,
          deactivatedAt: input.status === "SUSPENDED" ? now : null,
          ...passwordUpdate,
        },
        include: { role: { include: { permissions: true } } },
      });

      await auditLog({
        request,
        actorId: request.portalUser.id,
        action: "user_updated",
        entityType: "User",
        entityId: user.id,
        metadata: { role: role.name, status: input.status, passwordChanged: Boolean(input.password) },
      });

      response.json({ ok: true, user: safeUser(user) });
    } catch (error) {
      if (error instanceof ValidationError) {
        response.status(422).json({ ok: false, message: error.message });
        return;
      }
      next(error);
    }
  });

  app.post("/api/portal/users/:id/activate", requireSession("users:manage"), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const user = await prisma.user.update({
        where: { id: request.params.id },
        data: { status: "ACTIVE", activatedAt: new Date(), deactivatedAt: null },
        include: { role: { include: { permissions: true } } },
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "user_activated", entityType: "User", entityId: user.id });
      response.json({ ok: true, user: safeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/users/:id/deactivate", requireSession("users:manage"), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      await ensureNotRemovingLastSuperAdmin(prisma, request.params.id, null, "SUSPENDED");
      const user = await prisma.user.update({
        where: { id: request.params.id },
        data: { status: "SUSPENDED", deactivatedAt: new Date(), sessions: { updateMany: { where: { revokedAt: null }, data: { revokedAt: new Date() } } } },
        include: { role: { include: { permissions: true } } },
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "user_deactivated", entityType: "User", entityId: user.id });
      response.json({ ok: true, user: safeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/users/:id/reset-password", requireSession("users:manage"), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const user = await prisma.user.findUnique({ where: { id: request.params.id } });
      if (!user || user.status === "ARCHIVED") {
        response.status(404).json({ ok: false, message: "User not found." });
        return;
      }

      const token = await createPasswordResetToken(prisma, user.id);
      const resetUrl = portalUrl(`/portal/reset-password?token=${encodeURIComponent(token)}`);
      const delivered = await sendPasswordEmail(sendPortalEmail, user.email, user.name, resetUrl);
      await auditLog({ request, actorId: request.portalUser.id, action: "user_password_reset_sent", entityType: "User", entityId: user.id });
      response.json({
        ok: true,
        message: "Password reset link created.",
        devResetUrl: !delivered && process.env.NODE_ENV !== "production" ? resetUrl : null,
      });
    } catch (error) {
      next(error);
    }
  });
}

export async function syncRolesAndPermissions(prisma) {
  const permissionRecords = {};
  for (const permission of permissions) {
    permissionRecords[permission.key] = await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const roleName of roleNames) {
    const keys = rolePermissions[roleName] ?? [];
    await prisma.role.upsert({
      where: { name: roleName },
      update: {
        permissions: {
          set: keys.map((key) => ({ id: permissionRecords[key].id })),
        },
      },
      create: {
        name: roleName,
        permissions: {
          connect: keys.map((key) => ({ id: permissionRecords[key].id })),
        },
      },
    });
  }
}

async function createPasswordResetToken(prisma, userId) {
  const token = createOpaqueToken();
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: addMinutes(new Date(), RESET_TOKEN_MINUTES),
    },
  });
  return token;
}

async function createEmailVerificationToken(prisma, userId) {
  const token = createOpaqueToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + VERIFY_TOKEN_HOURS);
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });
  return token;
}

async function sendWelcomeEmail(sendPortalEmail, to, name, { resetUrl, verifyUrl, passwordSet = false }) {
  if (passwordSet) {
    return sendPortalEmail({
      to,
      subject: "TutorHiveHub Portal Account",
      text: `Hello ${name},\n\nYour TutorHiveHub portal account has been created.\n\nTutorHiveHub administration has set an initial password for your account. For security, passwords are not sent by email. Please contact TutorHiveHub administration if you did not receive your login details.\n\nPortal login: ${portalUrl("/portal/login")}\n\nIf you did not expect this email, please contact TutorHiveHub administration.`,
      html: `<p>Hello ${escapeHtml(name)},</p><p>Your TutorHiveHub portal account has been created.</p><p>TutorHiveHub administration has set an initial password for your account. For security, passwords are not sent by email. Please contact TutorHiveHub administration if you did not receive your login details.</p><p><a href="${escapeHtml(portalUrl("/portal/login"))}">Open portal login</a></p><p>If you did not expect this email, please contact TutorHiveHub administration.</p>`,
    });
  }

  return sendPortalEmail({
    to,
    subject: "TutorHiveHub Portal Account",
    text: `Hello ${name},\n\nYour TutorHiveHub portal account has been created.\n\nSet your password: ${resetUrl}\nVerify your email: ${verifyUrl}\n\nIf you did not expect this email, please contact TutorHiveHub administration.`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>Your TutorHiveHub portal account has been created.</p><p><a href="${escapeHtml(resetUrl)}">Set your password</a></p><p><a href="${escapeHtml(verifyUrl)}">Verify your email</a></p><p>If you did not expect this email, please contact TutorHiveHub administration.</p>`,
  });
}

async function sendPasswordEmail(sendPortalEmail, to, name, resetUrl) {
  return sendPortalEmail({
    to,
    subject: "TutorHiveHub Portal Password Reset",
    text: `Hello ${name},\n\nUse this secure link to reset your TutorHiveHub portal password:\n${resetUrl}\n\nThis link expires in ${RESET_TOKEN_MINUTES} minutes.`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>Use this secure link to reset your TutorHiveHub portal password:</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p><p>This link expires in ${RESET_TOKEN_MINUTES} minutes.</p>`,
  });
}

function parseUserInput(body) {
  const email = normaliseEmail(body?.email);
  const name = String(body?.name ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const roleId = String(body?.roleId ?? "").trim();
  const status = String(body?.status ?? "INVITED").trim();
  const password = String(body?.password ?? "");
  const confirmPassword = String(body?.confirmPassword ?? "");

  if (!name || !email || !roleId) {
    throw new ValidationError("Please complete all required user fields.");
  }

  if (!["INVITED", "ACTIVE", "SUSPENDED", "ARCHIVED"].includes(status)) {
    throw new ValidationError("Please select a valid account status.");
  }

  if (password || confirmPassword) {
    if (password !== confirmPassword) {
      throw new ValidationError("Passwords do not match.");
    }
    try {
      assertValidPassword(password);
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : "Please enter a valid password.");
    }
  }

  return {
    email,
    name,
    phone: phone || null,
    roleId,
    status,
    password: password || null,
  };
}

async function ensureNotRemovingLastSuperAdmin(prisma, userId, newRoleName, newStatus) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user || user.role?.name !== "Super Admin") {
    return;
  }

  const remainsSuperAdmin = newRoleName === null || newRoleName === "Super Admin";
  const remainsActive = newStatus === "ACTIVE";
  if (remainsSuperAdmin && remainsActive) {
    return;
  }

  const activeSuperAdminCount = await prisma.user.count({
    where: {
      status: "ACTIVE",
      role: { name: "Super Admin" },
      id: { not: userId },
    },
  });

  if (activeSuperAdminCount === 0) {
    throw new ValidationError("At least one active Super Admin account is required.");
  }
}

function normaliseEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function addMinutes(date, minutes) {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

function portalUrl(path) {
  const base = process.env.PORTAL_URL || `${process.env.APP_URL || "http://127.0.0.1:5173"}/portal`;
  if (path.startsWith("/portal")) {
    return `${base.replace(/\/portal\/?$/, "")}${path}`;
  }
  return `${base.replace(/\/$/, "")}${path}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

class ValidationError extends Error {}
