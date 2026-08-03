export type PortalRole = {
  id: string;
  name: string;
  permissions: Array<{ key: string; description?: string | null }> | string[];
};

export type PortalUser = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  role: {
    id: string;
    name: string;
    permissions: string[];
  } | null;
  emailVerifiedAt?: string | null;
  activatedAt?: string | null;
  deactivatedAt?: string | null;
  lastLoginAt?: string | null;
  lockedUntil?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ApiResult<T> = T & {
  ok: boolean;
  message?: string;
  devResetUrl?: string | null;
  devVerifyUrl?: string | null;
};

let csrfTokenPromise: Promise<string> | null = null;

export async function portalApi<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(options.headers);
  const isFormData = options.body instanceof FormData;
  const method = String(options.method ?? "GET").toUpperCase();

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", await getCsrfToken());
  }

  if (!isFormData && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });
  const result = (await response.json().catch(() => ({ ok: false, message: "TutorHiveHub could not process this request." }))) as ApiResult<T>;

  if (!response.ok) {
    throw new Error(result.message || "TutorHiveHub could not process this request.");
  }

  return result;
}

async function getCsrfToken() {
  csrfTokenPromise ??= fetch("/api/security/csrf", { credentials: "include" })
    .then(async (response) => {
      const result = (await response.json().catch(() => null)) as { csrfToken?: string } | null;
      if (!response.ok || !result?.csrfToken) {
        throw new Error("TutorHiveHub could not start a secure form session.");
      }
      return result.csrfToken;
    })
    .catch((error) => {
      csrfTokenPromise = null;
      throw error;
    });

  return csrfTokenPromise;
}

export function hasPortalPermission(user: PortalUser | null, permission: string) {
  if (!user?.role) {
    return false;
  }

  if (user.role.name === "Super Admin") {
    return true;
  }

  return user.role.permissions.includes(permission) || user.role.permissions.includes("system:all");
}
