import { getPrisma } from "./db.js";
import { hasPermission, safeUser } from "./roles.js";
import { getRequestIp, hashToken, readSessionCookie } from "./security.js";

const sessionUserInclude = {
  role: {
    include: {
      permissions: true,
    },
  },
};

export async function getSessionUser(request) {
  const token = readSessionCookie(request);
  if (!token) {
    return null;
  }

  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { sessionTokenHash: hashToken(token) },
    include: {
      user: {
        include: sessionUserInclude,
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }

  if (!session.user || session.user.status !== "ACTIVE") {
    return null;
  }

  return { session, user: session.user };
}

export function requireSession(permission) {
  return async (request, response, next) => {
    try {
      const sessionContext = await getSessionUser(request);
      if (!sessionContext) {
        response.status(401).json({ ok: false, message: "Authentication required." });
        return;
      }

      if (permission && !hasPermission(sessionContext.user, permission)) {
        await auditLog({
          request,
          actorId: sessionContext.user.id,
          action: "access_denied",
          entityType: "PortalRoute",
          metadata: { permission, path: request.path },
        });
        response.status(403).json({ ok: false, message: "Access denied." });
        return;
      }

      request.portalSession = sessionContext.session;
      request.portalUser = sessionContext.user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAnyPermission(permissions = []) {
  return async (request, response, next) => {
    try {
      const sessionContext = await getSessionUser(request);
      if (!sessionContext) {
        response.status(401).json({ ok: false, message: "Authentication required." });
        return;
      }

      if (permissions.length > 0 && !permissions.some((permission) => hasPermission(sessionContext.user, permission))) {
        await auditLog({
          request,
          actorId: sessionContext.user.id,
          action: "access_denied",
          entityType: "PortalRoute",
          metadata: { permissions, path: request.path },
        });
        response.status(403).json({ ok: false, message: "Access denied." });
        return;
      }

      request.portalSession = sessionContext.session;
      request.portalUser = sessionContext.user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function auditLog({ request, actorId = null, action, entityType, entityId = null, metadata = null }) {
  try {
    const prisma = getPrisma();
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        metadata,
        ipAddress: request ? getRequestIp(request) : null,
        userAgent: request?.headers["user-agent"] ?? null,
      },
    });
  } catch (error) {
    console.error("Audit log failed", error);
  }
}

export function sessionResponse(user) {
  return {
    ok: true,
    user: safeUser(user),
  };
}
