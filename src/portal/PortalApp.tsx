import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Bell,
  BookMarked,
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderOpen,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  RefreshCcw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCircle,
  UserCog,
  UserRoundCog,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { portalApi, hasPortalPermission, type PortalRole, type PortalUser } from "./api";
import { FamilyDashboardRoute } from "./family-dashboard-pages";
import { FinanceRoute } from "./finance-pages";
import { portalFeatureFlags, type PortalFeatureKey } from "./feature-flags";
import { HomeworkRoute, NotificationsRoute, ProgressRoute, ResourcesRoute } from "./learning-pages";
import { LessonReportsRoute, LessonWorkspaceDashboard } from "./lesson-workspace-pages";
import { MasterDataRoute } from "./master-data-pages";
import { PayrollRoute } from "./payroll-pages";
import { QualityRoute, ReportsRoute, SecurityRoute } from "./phase10-pages";
import { SchedulingRoute } from "./scheduling-pages";
import {
  PortalAlert,
  PortalBadge,
  PortalButton,
  PortalCard,
  PortalEmptyState,
  PortalInput,
  PortalLoadingButton,
  PortalLoadingSkeleton,
  PortalPagination,
  PortalSelect,
  PortalTable,
} from "./design-system";

type PortalAppProps = {
  currentPath: string;
};

type PortalModule = {
  id: PortalFeatureKey;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  permission?: string | string[];
};

type LoadState = "idle" | "loading" | "success" | "error";

const portalModules: PortalModule[] = [
  { id: "dashboard", label: "Dashboard", href: "/portal", icon: LayoutDashboard, description: "Operational overview for TutorHiveHub administration." },
  { id: "reports", label: "Reports", href: "/portal/reports", icon: BarChart3, description: "Management reporting, exports, and tutor performance indicators.", permission: "reporting:read" },
  { id: "users", label: "Users", href: "/portal/users", icon: UserCog, description: "Create users, assign roles, and manage account access.", permission: "users:read" },
  { id: "students", label: "Students", href: "/portal/students", icon: GraduationCap, description: "Student records and learning profiles.", permission: "students:manage" },
  { id: "parents", label: "Parents", href: "/portal/parents", icon: Users, description: "Parent and guardian records.", permission: "parents:manage" },
  { id: "tutors", label: "Tutors", href: "/portal/tutors", icon: UserRoundCog, description: "Tutor profiles, verification, and readiness.", permission: "tutors:manage" },
  { id: "subjects", label: "Subjects", href: "/portal/subjects", icon: BookMarked, description: "Subject catalogue, categories, and exam pathways.", permission: "subjects:manage" },
  { id: "assignments", label: "Assignments", href: "/portal/assignments", icon: Users, description: "Assign tutors to students by subject with active-date tracking.", permission: "assignments:manage" },
  { id: "lessons", label: "Lessons", href: "/portal/lessons", icon: BookMarked, description: "Lesson records and delivery tracking.", permission: ["lessons:manage", "own:lessons"] },
  { id: "timetable", label: "Timetable", href: "/portal/timetable", icon: CalendarDays, description: "Scheduling and calendar planning.", permission: ["timetable:manage", "own:timetable", "family:timetable"] },
  { id: "lessonReports", label: "Lesson Reports", href: "/portal/lesson-reports", icon: FileText, description: "Daily lesson reporting and continuity notes.", permission: ["reports:manage", "own:lesson-reports", "family:lesson-updates"] },
  { id: "timesheets", label: "Timesheets", href: "/portal/timesheets", icon: Clock3, description: "Monthly tutor session breakdowns.", permission: ["timesheets:manage", "finance:manage", "own:timesheets", "own:payments"] },
  { id: "finance", label: "Finance", href: "/portal/finance", icon: WalletCards, description: "Student invoices, parent payments, receipts, and billing reports.", permission: ["finance:manage", "family:finance"] },
  { id: "homework", label: "Homework", href: "/portal/homework", icon: BookMarked, description: "Homework tasks, submissions, feedback, and completion status.", permission: ["homework:manage", "own:homework", "family:homework"] },
  { id: "resources", label: "Resources", href: "/portal/resources", icon: FolderOpen, description: "Permission-controlled learning materials and approved links.", permission: ["resources:manage", "resources:approved"] },
  { id: "progress", label: "Progress", href: "/portal/progress", icon: TrendingUp, description: "Learning goals, progress summaries, and approved parent updates.", permission: ["progress:manage", "own:progress", "family:progress"] },
  { id: "notifications", label: "Notifications", href: "/portal/notifications", icon: Bell, description: "Portal alerts and message centre.", permission: ["notifications:manage", "own:notifications"] },
  { id: "quality", label: "Quality", href: "/portal/quality", icon: ClipboardCheck, description: "Lesson observations, tutor reviews, training, acknowledgements, and improvement plans.", permission: "quality:manage" },
  { id: "security", label: "Security", href: "/portal/security", icon: ShieldCheck, description: "Security status, audit logs, data protection, and deployment readiness.", permission: "security:manage" },
  { id: "support", label: "Support", href: "/portal/support", icon: Headphones, description: "Help requests and internal support notes.", permission: "support:manage" },
  { id: "settings", label: "Settings", href: "/portal/settings", icon: Settings, description: "Account, role, and application settings.", permission: "settings:manage" },
];

const moduleByPath = new Map(portalModules.map((module) => [module.href, module]));

const authPublicRoutes = new Set([
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

const publicWebsiteHref = "https://tutorhivehub.com/";

export function PortalApp({ currentPath }: PortalAppProps) {
  useEffect(() => {
    document.title = "TutorHiveHub Portal";
    const robotsMeta = document.querySelector('meta[name="robots"]') ?? document.createElement("meta");
    robotsMeta.setAttribute("name", "robots");
    robotsMeta.setAttribute("content", "noindex,nofollow");
    document.head.appendChild(robotsMeta);
  }, []);

  if (currentPath === "/portal/login" || currentPath === "/portal/login/") {
    return <PortalLoginPage />;
  }

  if (currentPath === "/portal/forgot-password" || currentPath === "/portal/forgot-password/") {
    return <PortalForgotPasswordPage />;
  }

  if (currentPath === "/portal/reset-password" || currentPath === "/portal/reset-password/") {
    return <PortalResetPasswordPage />;
  }

  if (currentPath === "/portal/verify-email" || currentPath === "/portal/verify-email/") {
    return <PortalVerifyEmailPage />;
  }

  if (currentPath === "/portal/access-denied" || currentPath === "/portal/access-denied/") {
    return <PortalAccessDeniedPage />;
  }

  if (!authPublicRoutes.has(currentPath)) {
    return <AuthenticatedPortal currentPath={currentPath} />;
  }

  return <PortalAccessDeniedPage />;
}

function AuthenticatedPortal({ currentPath }: PortalAppProps) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");

  useEffect(() => {
    let mounted = true;
    portalApi<{ user: PortalUser }>("/api/auth/session")
      .then((result) => {
        if (mounted) {
          setUser(result.user);
          setStatus("success");
        }
      })
      .catch(() => {
        window.location.href = "/portal/login";
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (status === "loading" || !user) {
    return <PortalLoadingScreen />;
  }

  const normalisedPath = normalisePath(currentPath);
  const activeModule = resolveActiveModule(normalisedPath);

  if (!activeModule) {
    return (
      <PortalShell activeModule={portalModules[0]} user={user} onUserChange={setUser}>
        <PortalNotFoundPage />
      </PortalShell>
    );
  }

  if (!canAccessModule(user, activeModule)) {
    return (
      <PortalShell activeModule={activeModule} user={user} onUserChange={setUser}>
        <AccessDeniedContent />
      </PortalShell>
    );
  }

  return (
    <PortalShell activeModule={activeModule} user={user} onUserChange={setUser}>
      <PortalRouteContent currentPath={normalisedPath} activeModule={activeModule} currentUser={user} />
    </PortalShell>
  );
}

function PortalRouteContent({ currentPath, activeModule, currentUser }: { currentPath: string; activeModule: PortalModule; currentUser: PortalUser }) {
  if (activeModule.id === "dashboard") {
    return <PortalDashboard currentPath={currentPath} currentUser={currentUser} />;
  }

  if (activeModule.id === "reports") {
    return <ReportsRoute />;
  }

  if (activeModule.id === "users") {
    if (currentPath === "/portal/users/new") {
      return <UserFormPage mode="create" />;
    }

    const match = currentPath.match(/^\/portal\/users\/([^/]+)\/edit$/);
    if (match) {
      return <UserFormPage mode="edit" userId={match[1]} />;
    }

    return <UsersPage />;
  }

  if (activeModule.id === "parents" || activeModule.id === "students" || activeModule.id === "tutors" || activeModule.id === "subjects" || activeModule.id === "assignments") {
    return <MasterDataRoute entity={activeModule.id} routePath={currentPath} />;
  }

  if (activeModule.id === "lessons" || activeModule.id === "timetable") {
    return <SchedulingRoute module={activeModule.id} routePath={currentPath} currentUser={currentUser} />;
  }

  if (activeModule.id === "lessonReports") {
    return <LessonReportsRoute routePath={currentPath} currentUser={currentUser} />;
  }

  if (activeModule.id === "timesheets") {
    return <PayrollRoute routePath={currentPath} currentUser={currentUser} />;
  }

  if (activeModule.id === "finance") {
    return <FinanceRoute routePath={currentPath} currentUser={currentUser} />;
  }

  if (activeModule.id === "homework") {
    return <HomeworkRoute currentUser={currentUser} />;
  }

  if (activeModule.id === "resources") {
    return <ResourcesRoute currentUser={currentUser} />;
  }

  if (activeModule.id === "progress") {
    return <ProgressRoute currentUser={currentUser} />;
  }

  if (activeModule.id === "notifications") {
    return <NotificationsRoute currentUser={currentUser} />;
  }

  if (activeModule.id === "quality") {
    return <QualityRoute />;
  }

  if (activeModule.id === "security") {
    return <SecurityRoute currentUser={currentUser} />;
  }

  return <ComingLaterModule module={activeModule} />;
}

function PortalLoginPage() {
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("loading");
    setError("");

    try {
      const result = await portalApi<{ redirectTo?: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
          rememberMe: data.get("rememberMe") === "on",
        }),
      });
      window.location.href = result.redirectTo || "/portal";
    } catch (error) {
      setStatus("error");
      setError(error instanceof Error ? error.message : "Login failed.");
    }
  }

  return (
    <PortalAuthFrame title="Portal Login" badge="Secure Login">
      <PortalAlert title="Authorised users only" tone="info">
        Use your TutorHiveHub portal account. Failed login protection and secure session cookies are active on the server.
      </PortalAlert>
      <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
        <PortalInput id="email" label="Email address" type="email" autoComplete="email" required />
        <PortalInput id="password" label="Password" type="password" autoComplete="current-password" required />
        <label htmlFor="rememberMe" className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-navy">
          <input id="rememberMe" name="rememberMe" type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold focus:ring-gold" />
          <span>Remember me on this device</span>
        </label>
        {status === "error" && <PortalAlert title="Login failed" tone="error">{error}</PortalAlert>}
        <PortalButton type="submit" disabled={status === "loading"}>
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          {status === "loading" ? "Logging in..." : "Login"}
        </PortalButton>
      </form>
      <div className="mt-6 flex flex-col gap-3 text-sm font-bold sm:flex-row sm:items-center sm:justify-between">
        <a href="/portal/forgot-password" className="text-navy transition hover:text-gold">
          Forgot password
        </a>
        <a href={publicWebsiteHref} className="text-slate-500 transition hover:text-navy">
          Return to website
        </a>
      </div>
    </PortalAuthFrame>
  );
}

function PortalForgotPasswordPage() {
  const [status, setStatus] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const [devLink, setDevLink] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("loading");
    setMessage("");
    setDevLink(null);

    try {
      const result = await portalApi<{ devResetUrl?: string | null }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: data.get("email") }),
      });
      setStatus("success");
      setMessage(result.message || "If the account exists, a password reset link has been sent.");
      setDevLink(result.devResetUrl ?? null);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Password reset request failed.");
    }
  }

  return (
    <PortalAuthFrame title="Password Reset" badge="Account Recovery">
      <PortalAlert title="Reset your portal password" tone="info">
        Enter your account email and TutorHiveHub will send a secure reset link.
      </PortalAlert>
      <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
        <PortalInput id="email" label="Email address" type="email" autoComplete="email" required />
        {status === "success" && <PortalAlert title="Request received" tone="success">{message}</PortalAlert>}
        {status === "error" && <PortalAlert title="Request failed" tone="error">{message}</PortalAlert>}
        {devLink && (
          <PortalAlert title="Local development reset link" tone="warning">
            <a href={devLink} className="break-all font-black underline">
              {devLink}
            </a>
          </PortalAlert>
        )}
        <PortalButton type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Sending reset link..." : "Send Reset Link"}
        </PortalButton>
      </form>
      <a href="/portal/login" className="mt-6 inline-block text-sm font-bold text-navy transition hover:text-gold">
        Back to login
      </a>
    </PortalAuthFrame>
  );
}

function PortalResetPasswordPage() {
  const [status, setStatus] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const result = await portalApi<Record<string, never>>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setStatus("success");
      setMessage(result.message || "Your password has been reset. You can now log in.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Password reset failed.");
    }
  }

  return (
    <PortalAuthFrame title="Set New Password" badge="Secure Reset">
      {!token && <PortalAlert title="Missing reset token" tone="error">Please use the reset link sent to your email.</PortalAlert>}
      <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
        <PortalInput id="password" label="New password" type="password" autoComplete="new-password" required minLength={12} />
        <PortalInput id="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required minLength={12} />
        {status === "success" && <PortalAlert title="Password updated" tone="success">{message}</PortalAlert>}
        {status === "error" && <PortalAlert title="Reset failed" tone="error">{message}</PortalAlert>}
        <PortalButton type="submit" disabled={status === "loading" || !token}>
          {status === "loading" ? "Saving password..." : "Save New Password"}
        </PortalButton>
      </form>
      <a href="/portal/login" className="mt-6 inline-block text-sm font-bold text-navy transition hover:text-gold">
        Back to login
      </a>
    </PortalAuthFrame>
  );
}

function PortalVerifyEmailPage() {
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing.");
      return;
    }

    portalApi<Record<string, never>>("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((result) => {
        setStatus("success");
        setMessage(result.message || "Email verified successfully.");
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Email verification failed.");
      });
  }, [token]);

  return (
    <PortalAuthFrame title="Email Verification" badge="Account Security">
      {status === "loading" && <PortalLoadingSkeleton rows={2} />}
      {status === "success" && <PortalAlert title="Email verified" tone="success">{message}</PortalAlert>}
      {status === "error" && <PortalAlert title="Verification failed" tone="error">{message}</PortalAlert>}
      <a href="/portal/login" className="mt-6 inline-block text-sm font-bold text-navy transition hover:text-gold">
        Go to login
      </a>
    </PortalAuthFrame>
  );
}

function PortalAuthFrame({ title, badge, children }: { title: string; badge: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft lg:grid-cols-[1fr_0.9fr]">
          <div className="bg-navy p-8 text-white sm:p-10">
            <BrandLogo light />
            <div className="mt-16 max-w-md">
              <PortalBadge tone="gold">{badge}</PortalBadge>
              <h1 className="mt-5 text-4xl font-black leading-tight">{title}</h1>
              <p className="mt-5 leading-8 text-white/75">
                TutorHiveHub portal access is reserved for authorised administrators, tutors, families, and students.
              </p>
            </div>
          </div>
          <div className="p-6 sm:p-10">{children}</div>
        </section>
      </div>
    </main>
  );
}

function PortalAccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-ink">
      <section className="w-full max-w-xl rounded-lg border border-amber-200 bg-white p-8 shadow-soft">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <ShieldAlert className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-3xl font-black text-navy">Access denied</h1>
        <p className="mt-4 leading-7 text-slate-650">This portal area is restricted to authorised TutorHiveHub users.</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a
            href="/portal/login"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-5 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-gold-100 focus:outline-none focus:ring-4 focus:ring-gold/30"
          >
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            Go to Login
          </a>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-5 py-3 text-sm font-black text-navy shadow-sm transition hover:border-gold hover:bg-gold-50 focus:outline-none focus:ring-4 focus:ring-gold/20"
          >
            Return Home
          </a>
        </div>
      </section>
    </main>
  );
}

function PortalShell({
  activeModule,
  children,
  user,
  onUserChange,
}: {
  activeModule: PortalModule;
  children: ReactNode;
  user: PortalUser;
  onUserChange: (user: PortalUser | null) => void;
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const breadcrumbs = useMemo(() => ["Portal", activeModule.label], [activeModule.label]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await portalApi<Record<string, never>>("/api/auth/logout", { method: "POST" });
    } finally {
      onUserChange(null);
      window.location.href = "/portal/login";
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-ink">
      <div className="lg:flex">
        <aside className="hidden min-h-screen w-72 shrink-0 border-r border-white/10 bg-navy text-white lg:sticky lg:top-0 lg:block">
          <PortalSidebar activeModule={activeModule} user={user} />
        </aside>

        {isMobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" className="absolute inset-0 bg-navy/70" aria-label="Close menu" onClick={() => setIsMobileOpen(false)} />
            <aside className="relative h-full w-[min(22rem,85vw)] bg-navy text-white shadow-soft">
              <PortalSidebar activeModule={activeModule} user={user} onNavigate={() => setIsMobileOpen(false)} />
            </aside>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-navy lg:hidden"
                  aria-label="Open portal menu"
                  onClick={() => setIsMobileOpen(true)}
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
                <div className="min-w-0">
                  <nav className="flex items-center gap-2 text-xs font-bold text-slate-500" aria-label="Breadcrumb">
                    {breadcrumbs.map((crumb, index) => (
                      <span key={crumb} className="flex items-center gap-2">
                        {index > 0 && <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                        <span className={index === breadcrumbs.length - 1 ? "truncate text-navy" : ""}>{crumb}</span>
                      </span>
                    ))}
                  </nav>
                  <h1 className="mt-1 truncate text-lg font-black text-navy">{activeModule.label}</h1>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-navy transition hover:border-gold hover:bg-gold-50"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" aria-hidden="true" />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-gold" />
                </button>
                <div className="hidden items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 sm:flex">
                  <UserCircle className="h-6 w-6 text-navy" aria-hidden="true" />
                  <div className="leading-tight">
                    <p className="text-xs font-black text-navy">{user.name}</p>
                    <p className="text-[11px] font-bold text-slate-500">{user.role?.name || "No role"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-navy transition hover:border-gold hover:bg-gold-50 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Logout"
                  disabled={isLoggingOut}
                  onClick={handleLogout}
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </header>
          <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

function PortalSidebar({ activeModule, user, onNavigate }: { activeModule: PortalModule; user: PortalUser; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 p-5">
        <a href="/portal" aria-label="TutorHiveHub portal home" onClick={onNavigate}>
          <BrandLogo light />
        </a>
        {onNavigate && (
          <button type="button" className="rounded-md p-2 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Close menu" onClick={onNavigate}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <nav className="grid gap-1 overflow-y-auto p-4" aria-label="Portal navigation">
        {portalModules.map((module) => {
          const Icon = module.icon;
          const isActive = module.id === activeModule.id;
          const isEnabled = portalFeatureFlags[module.id];
          const canAccess = canAccessModule(user, module);

          return (
            <a
              key={module.id}
              href={module.href}
              onClick={onNavigate}
              className={`flex items-center justify-between gap-3 rounded-md px-3 py-3 text-sm font-bold transition ${
                isActive ? "bg-gold text-navy" : "text-white/75 hover:bg-white/10 hover:text-white"
              } ${canAccess ? "" : "opacity-60"}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="truncate">{module.label}</span>
              </span>
              {!isEnabled && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase text-white/65">Later</span>}
              {isEnabled && !canAccess && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase text-white/65">Restricted</span>}
            </a>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-white/10 p-4">
        <div className="rounded-lg bg-white/8 p-4">
          <p className="text-sm font-black text-white">{user.name}</p>
          <p className="mt-2 text-xs leading-5 text-white/65">{user.email}</p>
        </div>
      </div>
    </div>
  );
}

function PortalDashboard({ currentPath, currentUser }: { currentPath: string; currentUser: PortalUser }) {
  if (currentUser.role?.name === "Parent" || currentUser.role?.name === "Student") {
    return <FamilyDashboardRoute routePath={currentPath} currentUser={currentUser} />;
  }

  const rows = portalModules.map((module) => [
    <span className="font-black text-navy">{module.label}</span>,
    module.description,
    portalFeatureFlags[module.id] ? <PortalBadge tone="success">Enabled</PortalBadge> : <PortalBadge tone="warning">Coming Later</PortalBadge>,
  ]);

  return (
    <div className="grid gap-6">
      <PortalAlert title="Secure portal session active" tone="success">
        You are logged in as {currentUser.role?.name || "a portal user"}. Server-side API permission checks and audit logging are active.
      </PortalAlert>

      <LessonWorkspaceDashboard currentUser={currentUser} />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Current role" value={currentUser.role?.name || "None"} detail="Role permissions are loaded from the database." />
        <MetricCard label="Account status" value={currentUser.status} detail={currentUser.lastLoginAt ? `Last login: ${formatDate(currentUser.lastLoginAt)}` : "No previous login recorded"} />
        <MetricCard label="Enabled modules" value="19" detail="Core portal, reporting, scheduling, reports, payroll, finance, learning, quality, and security modules are active." />
        <MetricCard label="Safeguarding" value="Restricted" detail="Only authorised roles can access safeguarding data." />
      </div>

      <PortalCard title="Module Readiness" eyebrow="Feature Flags">
        <PortalTable columns={["Module", "Purpose", "Status"]} rows={rows} />
        <div className="mt-5">
          <PortalPagination page={1} totalPages={1} />
        </div>
      </PortalCard>
    </div>
  );
}

function UsersPage() {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  async function loadUsers() {
    setStatus("loading");
    setMessage("");
    try {
      const result = await portalApi<{ users: PortalUser[] }>("/api/portal/users");
      setUsers(result.users);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load users.");
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function runUserAction(userId: string, action: "activate" | "deactivate" | "reset-password") {
    setMessage("");
    try {
      const result = await portalApi<{ user?: PortalUser; devResetUrl?: string | null }>(`/api/portal/users/${userId}/${action}`, { method: "POST" });
      if (result.user) {
        setUsers((current) => current.map((user) => (user.id === result.user?.id ? result.user : user)));
      }
      setMessage(action === "reset-password" ? `Password reset link created.${result.devResetUrl ? ` Local link: ${result.devResetUrl}` : ""}` : "User updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "User action failed.");
    }
  }

  const rows = users.map((user) => [
    <div>
      <p className="font-black text-navy">{user.name}</p>
      <p className="text-xs font-bold text-slate-500">{user.email}</p>
    </div>,
    user.role?.name || "No role",
    <PortalBadge tone={statusTone(user.status)}>{user.status}</PortalBadge>,
    user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never",
    <div className="flex flex-wrap gap-2">
      <a href={`/portal/users/${user.id}/edit`} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50">
        Edit
      </a>
      {user.status === "ACTIVE" ? (
        <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50" onClick={() => runUserAction(user.id, "deactivate")}>
          Deactivate
        </button>
      ) : (
        <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50" onClick={() => runUserAction(user.id, "activate")}>
          Activate
        </button>
      )}
      <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50" onClick={() => runUserAction(user.id, "reset-password")}>
        Reset Password
      </button>
    </div>,
  ]);

  return (
    <div className="grid gap-6">
      <PortalCard
        title="User Management"
        eyebrow="Administration"
        action={
          <div className="flex gap-2">
            <PortalButton type="button" variant="ghost" onClick={loadUsers}>
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </PortalButton>
            <a className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-gold-100" href="/portal/users/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create User
            </a>
          </div>
        }
      >
        {message && <div className="mb-5"><PortalAlert title="User action" tone={message.includes("failed") || message.includes("required") ? "error" : "success"}>{message}</PortalAlert></div>}
        {status === "loading" && <PortalLoadingSkeleton rows={5} />}
        {status === "error" && <PortalAlert title="Could not load users" tone="error">{message}</PortalAlert>}
        {status === "success" && users.length === 0 && <PortalEmptyState title="No users yet" message="Create the first portal users after the Super Admin setup is complete." />}
        {status === "success" && users.length > 0 && <PortalTable columns={["User", "Role", "Status", "Last Login", "Actions"]} rows={rows} />}
      </PortalCard>
    </div>
  );
}

function UserFormPage({ mode, userId }: { mode: "create" | "edit"; userId?: string }) {
  const [roles, setRoles] = useState<PortalRole[]>([]);
  const [user, setUser] = useState<PortalUser | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");
  const [submitStatus, setSubmitStatus] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const [devLinks, setDevLinks] = useState<{ reset?: string | null; verify?: string | null }>({});

  useEffect(() => {
    let mounted = true;

    async function load() {
      setStatus("loading");
      try {
        const rolesResult = await portalApi<{ roles: PortalRole[] }>("/api/portal/roles");
        const userResult = mode === "edit" && userId ? await portalApi<{ user: PortalUser }>(`/api/portal/users/${userId}`) : null;
        if (mounted) {
          setRoles(rolesResult.roles);
          setUser(userResult?.user ?? null);
          setStatus("success");
        }
      } catch (error) {
        if (mounted) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Could not load user form.");
        }
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [mode, userId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");
    setSubmitStatus("loading");
    setMessage("");
    setDevLinks({});

    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        setSubmitStatus("error");
        setMessage("Passwords do not match.");
        return;
      }
    }

    try {
      const endpoint = mode === "edit" && userId ? `/api/portal/users/${userId}` : "/api/portal/users";
      const method = mode === "edit" ? "PATCH" : "POST";
      const result = await portalApi<{ user: PortalUser; devResetUrl?: string | null; devVerifyUrl?: string | null }>(endpoint, {
        method,
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          roleId: data.get("roleId"),
          status: data.get("status"),
          password,
          confirmPassword,
        }),
      });
      setUser(result.user);
      setDevLinks({ reset: result.devResetUrl, verify: result.devVerifyUrl });
      setSubmitStatus("success");
      setMessage(
        password
          ? mode === "edit"
            ? "User updated and password changed successfully."
            : "User created with an initial password. Share it securely; TutorHiveHub does not email passwords."
          : mode === "edit"
            ? "User updated successfully."
            : "User created successfully.",
      );
      if (mode === "create") {
        form.reset();
      }
    } catch (error) {
      setSubmitStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save user.");
    }
  }

  if (status === "loading") {
    return <PortalLoadingSkeleton rows={6} />;
  }

  if (status === "error") {
    return <PortalAlert title="Could not load user" tone="error">{message}</PortalAlert>;
  }

  return (
    <PortalCard title={mode === "edit" ? "Edit User" : "Create User"} eyebrow="User Management">
      <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
        <PortalInput id="name" label="Full name" type="text" required defaultValue={user?.name ?? ""} />
        <PortalInput id="email" label="Email address" type="email" autoComplete="email" required defaultValue={user?.email ?? ""} />
        <PortalInput id="phone" label="Phone number" type="tel" defaultValue={user?.phone ?? ""} />
        <PortalSelect id="roleId" label="Role" required defaultValue={user?.role?.id ?? ""}>
          <option value="">Select an option</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </PortalSelect>
        <PortalSelect id="status" label="Account status" required options={["INVITED", "ACTIVE", "SUSPENDED", "ARCHIVED"]} defaultValue={user?.status ?? "INVITED"} />
        <div className="md:col-span-2">
          <PortalAlert title="Password access" tone="info">
            {mode === "create"
              ? "Set an optional initial password if this user should receive login access straight away. Leave it blank to send the normal password setup email. Users can later change their password using Forgot password, and admins can use Reset Password from the user list."
              : "Enter a new password only when you want to change this user's password. Leave both password fields blank to keep the current password."}
          </PortalAlert>
        </div>
        <PortalInput id="password" label={mode === "create" ? "Initial password (optional)" : "New password (optional)"} type="password" autoComplete="new-password" minLength={12} />
        <PortalInput id="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" minLength={12} />
        <div className="md:col-span-2">
          {submitStatus === "success" && <PortalAlert title="Saved" tone="success">{message}</PortalAlert>}
          {submitStatus === "error" && <PortalAlert title="Could not save" tone="error">{message}</PortalAlert>}
          {(devLinks.reset || devLinks.verify) && (
            <div className="mt-4 grid gap-3">
              {devLinks.reset && <PortalAlert title="Local reset link" tone="warning"><a href={devLinks.reset} className="break-all font-black underline">{devLinks.reset}</a></PortalAlert>}
              {devLinks.verify && <PortalAlert title="Local verify link" tone="warning"><a href={devLinks.verify} className="break-all font-black underline">{devLinks.verify}</a></PortalAlert>}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row">
          <PortalButton type="submit" disabled={submitStatus === "loading"}>
            {submitStatus === "loading" ? "Saving..." : "Save User"}
          </PortalButton>
          <a href="/portal/users" className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:border-gold hover:bg-gold-50">
            Back to Users
          </a>
        </div>
      </form>
    </PortalCard>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <PortalCard className="min-h-36">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-black text-navy">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-650">{detail}</p>
    </PortalCard>
  );
}

function ComingLaterModule({ module }: { module: PortalModule }) {
  return (
    <div className="grid gap-6">
      <PortalAlert title="Coming in a later phase" tone="warning">
        {module.label} is visible in the portal navigation now, but its operational functionality has not been implemented in the current phase.
      </PortalAlert>
      <PortalCard title={module.label} eyebrow="Portal Module">
        <PortalEmptyState title={`${module.label} is not active yet`} message={module.description} />
      </PortalCard>
    </div>
  );
}

function AccessDeniedContent() {
  return (
    <PortalCard title="Access denied" eyebrow="Restricted">
      <PortalAlert title="You do not have permission to access this module" tone="error">
        Role permissions are checked on the server for portal API requests. Contact a Super Admin if you need access.
      </PortalAlert>
    </PortalCard>
  );
}

function PortalNotFoundPage() {
  return (
    <PortalCard title="Portal page not found" eyebrow="404">
      <p className="leading-7 text-slate-650">The requested portal route is not available.</p>
      <a
        href="/portal"
        className="mt-6 inline-flex items-center justify-center rounded-md bg-gold px-5 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-gold-100 focus:outline-none focus:ring-4 focus:ring-gold/30"
      >
        Return to Dashboard
      </a>
    </PortalCard>
  );
}

function PortalLoadingScreen() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-ink">
      <div className="mx-auto max-w-3xl">
        <PortalCard title="Loading Portal" eyebrow="TutorHiveHub">
          <PortalLoadingSkeleton rows={4} />
        </PortalCard>
      </div>
    </main>
  );
}

function resolveActiveModule(path: string) {
  if (path.startsWith("/portal/users")) {
    return moduleByPath.get("/portal/users");
  }

  if (path.startsWith("/portal/reports")) {
    return moduleByPath.get("/portal/reports");
  }

  if (path.startsWith("/portal/parents")) {
    return moduleByPath.get("/portal/parents");
  }

  if (path.startsWith("/portal/students")) {
    return moduleByPath.get("/portal/students");
  }

  if (path.startsWith("/portal/tutors")) {
    return moduleByPath.get("/portal/tutors");
  }

  if (path.startsWith("/portal/subjects")) {
    return moduleByPath.get("/portal/subjects");
  }

  if (path.startsWith("/portal/assignments")) {
    return moduleByPath.get("/portal/assignments");
  }

  if (path.startsWith("/portal/lessons")) {
    return moduleByPath.get("/portal/lessons");
  }

  if (path.startsWith("/portal/timetable")) {
    return moduleByPath.get("/portal/timetable");
  }

  if (path.startsWith("/portal/lesson-reports")) {
    return moduleByPath.get("/portal/lesson-reports");
  }

  if (path.startsWith("/portal/timesheets")) {
    return moduleByPath.get("/portal/timesheets");
  }

  if (path.startsWith("/portal/finance")) {
    return moduleByPath.get("/portal/finance");
  }

  if (path.startsWith("/portal/homework")) {
    return moduleByPath.get("/portal/homework");
  }

  if (path.startsWith("/portal/resources")) {
    return moduleByPath.get("/portal/resources");
  }

  if (path.startsWith("/portal/progress")) {
    return moduleByPath.get("/portal/progress");
  }

  if (path.startsWith("/portal/notifications")) {
    return moduleByPath.get("/portal/notifications");
  }

  if (path.startsWith("/portal/quality")) {
    return moduleByPath.get("/portal/quality");
  }

  if (path.startsWith("/portal/security")) {
    return moduleByPath.get("/portal/security");
  }

  if (path.startsWith("/portal/children")) {
    return moduleByPath.get("/portal");
  }

  return moduleByPath.get(path === "/portal" ? "/portal" : path);
}

function canAccessModule(user: PortalUser, module: PortalModule) {
  if (!module.permission) {
    return true;
  }
  const permissions = Array.isArray(module.permission) ? module.permission : [module.permission];
  return permissions.some((permission) => hasPortalPermission(user, permission));
}

function normalisePath(path: string) {
  if (path !== "/portal/" && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path.replace(/\/$/, "") || "/portal";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusTone(status: PortalUser["status"]): "success" | "warning" | "danger" {
  if (status === "ACTIVE") {
    return "success";
  }
  if (status === "SUSPENDED" || status === "ARCHIVED") {
    return "danger";
  }
  return "warning";
}
