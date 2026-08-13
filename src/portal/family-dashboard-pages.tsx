import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ExternalLink, HelpCircle, RefreshCcw } from "lucide-react";
import { portalApi, type PortalUser } from "./api";
import {
  PortalAlert,
  PortalBadge,
  PortalButton,
  PortalCard,
  PortalEmptyState,
  PortalInput,
  PortalLoadingSkeleton,
  PortalSelect,
  PortalTable,
  PortalTextarea,
} from "./design-system";

type LoadState = "idle" | "loading" | "success" | "error";
type RecordMap = Record<string, any>;

const defaultCategories = [
  "Technical issue",
  "Schedule concern",
  "Tutor concern",
  "Payment question",
  "Academic support request",
  "General enquiry",
];

export function FamilyDashboardRoute({ routePath, currentUser }: { routePath: string; currentUser: PortalUser }) {
  const childMatch = routePath.match(/^\/portal\/children\/([^/]+)$/);
  if (childMatch) {
    return <ParentStudentView studentId={childMatch[1]} />;
  }
  if (currentUser.role?.name === "Student") {
    return <StudentDashboard />;
  }
  if (currentUser.role?.name === "Parent") {
    return <ParentDashboard />;
  }
  return null;
}

function ParentDashboard() {
  const [dashboard, setDashboard] = useState<RecordMap | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  async function loadDashboard() {
    setStatus("loading");
    setMessage("");
    try {
      const result = await portalApi<{ dashboard: RecordMap }>("/api/portal/family/dashboard");
      setDashboard(result.dashboard);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load parent dashboard.");
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  if (status === "loading") return <PortalLoadingSkeleton rows={8} />;
  if (status === "error" || !dashboard) return <PortalAlert title="Could not load parent dashboard" tone="error">{message}</PortalAlert>;

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Parent Dashboard"
        eyebrow="Family Overview"
        action={
          <PortalButton type="button" variant="ghost" onClick={loadDashboard}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </PortalButton>
        }
      >
        <PortalAlert title="Family access" tone="success">
          This dashboard only shows children linked to your TutorHiveHub parent account.
        </PortalAlert>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Children" value={String(dashboard.children?.length ?? 0)} />
          <Metric label="Upcoming lessons" value={String(dashboard.upcomingLessons?.length ?? 0)} />
          <Metric label="Outstanding invoices" value={String(dashboard.outstandingInvoices?.length ?? 0)} />
          <Metric label="Open homework" value={String(dashboard.homeworkStatus?.assigned ?? 0)} />
        </div>
      </PortalCard>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <PortalCard title="Children" eyebrow="Linked Students">
          {emptyOrList(dashboard.children, "No linked children found.", (child: RecordMap) => (
            <a key={child.id} href={`/portal/children/${child.id}`} className="block rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-gold hover:bg-gold-50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-navy">{child.fullName}</h3>
                  <p className="mt-1 text-sm font-bold text-slate-600">{[child.yearGroup, child.examPathway].filter(Boolean).join(" / ") || "Learning profile"}</p>
                </div>
                <PortalBadge tone={statusTone(child.status)}>{child.status}</PortalBadge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-650">{child.academicGoals || "Progress goals will appear here once recorded."}</p>
            </a>
          ))}
        </PortalCard>

        <SupportRequestPanel children={dashboard.children ?? []} categories={dashboard.supportCategories ?? defaultCategories} onSubmitted={loadDashboard} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LessonList title="Upcoming Lessons" lessons={dashboard.upcomingLessons ?? []} />
        <TutorList tutors={dashboard.assignedTutors ?? []} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LessonUpdates updates={dashboard.lessonUpdates ?? []} />
        <HomeworkList homework={dashboard.homework ?? []} summary={dashboard.homeworkStatus} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <AttendanceSummary summary={dashboard.attendanceSummary} />
        <FinanceSummary invoices={dashboard.outstandingInvoices ?? []} payments={dashboard.recentPayments ?? []} receipts={dashboard.receipts ?? []} />
        <NotificationsList notifications={dashboard.notifications ?? []} />
      </div>
    </div>
  );
}

function ParentStudentView({ studentId }: { studentId: string }) {
  const [studentView, setStudentView] = useState<RecordMap | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    portalApi<{ studentView: RecordMap }>(`/api/portal/family/students/${studentId}`)
      .then((result) => {
        setStudentView(result.studentView);
        setStatus("success");
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Could not load student view.");
      });
  }, [studentId]);

  if (status === "loading") return <PortalLoadingSkeleton rows={8} />;
  if (status === "error" || !studentView) return <PortalAlert title="Could not load child view" tone="error">{message}</PortalAlert>;

  const profile = studentView.profile;

  return (
    <div className="grid gap-6">
      <PortalCard
        title={profile.fullName}
        eyebrow="Parent Student View"
        action={<a href="/portal" className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:border-gold hover:bg-gold-50">Back to Dashboard</a>}
      >
        <DetailGrid
          items={[
            ["Year group", profile.yearGroup],
            ["Age", profile.age],
            ["School", profile.schoolOrInstitution],
            ["Exam pathway", profile.examPathway],
            ["Country", profile.country],
            ["Time zone", profile.timeZone],
            ["Subjects", names(profile.subjects)],
            ["Academic goals", profile.academicGoals],
            ["Learning needs", profile.learningNeeds],
          ]}
        />
      </PortalCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <LessonList title="Timetable" lessons={studentView.timetable ?? []} />
        <TutorList tutors={(studentView.assignedTutors ?? []).map((assignment: RecordMap) => ({ ...assignment.tutor, subjects: [subjectLabel(assignment.subject)].filter(Boolean), students: [profile.fullName] }))} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AttendanceSummary summary={studentView.attendance} />
        <LessonUpdates updates={studentView.lessonUpdates ?? []} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <HomeworkList homework={studentView.homework ?? []} />
        <FinanceSummary invoices={studentView.invoices ?? []} receipts={studentView.receipts ?? []} payments={[]} />
      </div>
    </div>
  );
}

function StudentDashboard() {
  const [dashboard, setDashboard] = useState<RecordMap | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  async function loadDashboard() {
    setStatus("loading");
    setMessage("");
    try {
      const result = await portalApi<{ dashboard: RecordMap }>("/api/portal/student/dashboard");
      setDashboard(result.dashboard);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load student dashboard.");
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  if (status === "loading") return <PortalLoadingSkeleton rows={8} />;
  if (status === "error" || !dashboard) return <PortalAlert title="Could not load student dashboard" tone="error">{message}</PortalAlert>;

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Student Dashboard"
        eyebrow={dashboard.student?.fullName}
        action={
          <PortalButton type="button" variant="ghost" onClick={loadDashboard}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </PortalButton>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Today lessons" value={String(dashboard.todayLessons?.length ?? 0)} />
          <Metric label="Upcoming lessons" value={String(dashboard.upcomingLessons?.length ?? 0)} />
          <Metric label="Homework" value={String(dashboard.homework?.length ?? 0)} />
          <Metric label="Resources" value={String(dashboard.resources?.length ?? 0)} />
        </div>
      </PortalCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <LessonList title="Today's Lesson" lessons={dashboard.todayLessons ?? []} />
        <SupportRequestPanel categories={dashboard.supportCategories ?? defaultCategories} onSubmitted={loadDashboard} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LessonList title="Upcoming Timetable" lessons={dashboard.upcomingLessons ?? []} />
        <TutorList tutors={(dashboard.assignedTutors ?? []).map((assignment: RecordMap) => ({ ...assignment.tutor, subjects: [subjectLabel(assignment.subject)].filter(Boolean), students: [dashboard.student?.fullName] }))} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <HomeworkList homework={dashboard.homework ?? []} />
        <ResourcesList resources={dashboard.resources ?? []} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LessonUpdates title="Tutor Feedback" updates={dashboard.tutorFeedback ?? []} />
        <LearningProgress goals={dashboard.learningGoals} progress={dashboard.progress} />
      </div>

      <NotificationsList notifications={dashboard.notifications ?? []} />
    </div>
  );
}

function SupportRequestPanel({ children = [], categories, onSubmitted }: { children?: RecordMap[]; categories: string[]; onSubmitted: () => void }) {
  const [status, setStatus] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("loading");
    setMessage("");
    try {
      await portalApi<RecordMap>("/api/portal/support-requests", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      form.reset();
      setStatus("success");
      setMessage("Support request submitted successfully.");
      onSubmitted();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not submit support request.");
    }
  }

  return (
    <PortalCard title="Support Request" eyebrow="Help Desk">
      <form className="grid gap-4" onSubmit={handleSubmit}>
        {children.length > 0 && (
          <PortalSelect id="studentId" label="Related child">
            <option value="">General family request</option>
            {children.map((child) => <option key={child.id} value={child.id}>{child.fullName}</option>)}
          </PortalSelect>
        )}
        <PortalSelect id="category" label="Category" required>
          <option value="">Select an option</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </PortalSelect>
        <PortalInput id="subject" label="Subject" required />
        <PortalTextarea id="message" label="Details" required />
        {status === "success" && <PortalAlert title="Submitted" tone="success">{message}</PortalAlert>}
        {status === "error" && <PortalAlert title="Could not submit" tone="error">{message}</PortalAlert>}
        <PortalButton type="submit" disabled={status === "loading"}>
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
          {status === "loading" ? "Submitting..." : "Submit Support Request"}
        </PortalButton>
      </form>
    </PortalCard>
  );
}

function LessonList({ title, lessons }: { title: string; lessons: RecordMap[] }) {
  return (
    <PortalCard title={title} eyebrow="Timetable">
      {lessons.length === 0 ? (
        <PortalEmptyState title="No lessons found" message="Lessons will appear here once they are scheduled." />
      ) : (
        <div className="grid gap-4">
          {lessons.map((lesson) => (
            <article key={lesson.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-navy">{subjectLabel(lesson.subject) || "Lesson"}</h3>
                  <p className="mt-1 text-sm font-bold text-slate-600">{dateTimeText(lesson.scheduledStart)} - {timeText(lesson.scheduledEnd)}</p>
                </div>
                <PortalBadge tone={lesson.joinAvailable ? "success" : "neutral"}>{lesson.joinAvailable ? "Join Available" : statusLabel(lesson.status)}</PortalBadge>
              </div>
              <p className="mt-3 text-sm text-slate-650">{lesson.lessonType} with {lesson.tutor?.fullName || "TutorHiveHub"}</p>
              {lesson.joinAvailable && lesson.meetingLink && (
                <a href={lesson.meetingLink} className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-gold-100">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Join Lesson
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </PortalCard>
  );
}

function TutorList({ tutors }: { tutors: RecordMap[] }) {
  return (
    <PortalCard title="Assigned Tutors" eyebrow="Teaching Team">
      {emptyOrList(tutors, "Assigned tutors will appear here.", (tutor) => (
        <article key={tutor.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-black text-navy">{tutor.fullName}</h3>
          <p className="mt-1 text-sm text-slate-650">{tutor.email || "TutorHiveHub tutor"}</p>
          <p className="mt-3 text-sm font-bold text-slate-700">Subjects: {Array.isArray(tutor.subjects) ? tutor.subjects.join(", ") : tutor.mainSubjectAreas || "-"}</p>
          {Array.isArray(tutor.students) && <p className="mt-1 text-xs font-bold text-slate-500">Students: {tutor.students.join(", ")}</p>}
        </article>
      ))}
    </PortalCard>
  );
}

function LessonUpdates({ updates, title = "Parent-Friendly Lesson Updates" }: { updates: RecordMap[]; title?: string }) {
  return (
    <PortalCard title={title} eyebrow="Progress Notes">
      {emptyOrList(updates, "Lesson updates will appear after reports are submitted.", (update) => (
        <article key={update.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-black text-navy">{update.topicCovered || subjectLabel(update.subject) || "Lesson update"}</h3>
              <p className="mt-1 text-xs font-bold text-slate-500">{update.student?.fullName} - {dateText(update.lessonDate)}</p>
            </div>
            <PortalBadge tone="neutral">{update.studentUnderstanding || "Update"}</PortalBadge>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-650">{update.parentFriendlyUpdate || update.lessonSummary}</p>
          {update.nextLessonRecommendation && <p className="mt-3 text-sm"><span className="font-black text-navy">Next:</span> {update.nextLessonRecommendation}</p>}
        </article>
      ))}
    </PortalCard>
  );
}

function HomeworkList({ homework, summary }: { homework: RecordMap[]; summary?: RecordMap }) {
  return (
    <PortalCard title="Homework" eyebrow="Tasks">
      {summary && (
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          <Metric label="Assigned" value={String(summary.assigned ?? 0)} compact />
          <Metric label="Submitted" value={String(summary.submitted ?? 0)} compact />
          <Metric label="Reviewed" value={String(summary.reviewed ?? 0)} compact />
          <Metric label="Overdue" value={String(summary.overdue ?? 0)} compact />
        </div>
      )}
      {emptyOrList(homework, "Homework tasks will appear here.", (item) => (
        <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="font-black text-navy">{item.title}</h3>
            <PortalBadge tone={homeworkTone(item.status)}>{statusLabel(item.status)}</PortalBadge>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-650">{item.details}</p>
          <p className="mt-3 text-xs font-bold text-slate-500">{subjectLabel(item.subject) || "Subject"}{item.dueDate ? ` - Due ${dateText(item.dueDate)}` : ""}</p>
        </article>
      ))}
    </PortalCard>
  );
}

function AttendanceSummary({ summary }: { summary?: RecordMap }) {
  return (
    <PortalCard title="Attendance" eyebrow="Summary">
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="Recorded" value={String(summary?.totalRecorded ?? 0)} compact />
        <Metric label="Present" value={String(summary?.present ?? 0)} compact />
        <Metric label="Late" value={String(summary?.late ?? 0)} compact />
        <Metric label="Absent" value={String(summary?.absent ?? 0)} compact />
      </div>
    </PortalCard>
  );
}

function FinanceSummary({ invoices, payments = [], receipts = [] }: { invoices: RecordMap[]; payments?: RecordMap[]; receipts?: RecordMap[] }) {
  return (
    <PortalCard
      title="Finance"
      eyebrow="Invoices and Receipts"
      action={<a href="/portal/finance" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50">Open Finance</a>}
    >
      <div className="grid gap-3">
        <Metric label="Outstanding invoices" value={String(invoices.length)} compact />
        <Metric label="Recent payments" value={String(payments.length)} compact />
        <Metric label="Receipts" value={String(receipts.length)} compact />
      </div>
      {invoices.length > 0 && (
        <div className="mt-5">
          <PortalTable
            columns={["Invoice", "Status", "Balance", "Due"]}
            rows={invoices.slice(0, 5).map((invoice) => [invoice.invoiceNumber, <PortalBadge tone={invoiceTone(invoice.status)}>{statusLabel(invoice.status)}</PortalBadge>, money(invoice.balanceDue ?? invoice.totalAmount, invoice.currency), dateText(invoice.dueDate)])}
          />
        </div>
      )}
    </PortalCard>
  );
}

function NotificationsList({ notifications }: { notifications: RecordMap[] }) {
  return (
    <PortalCard title="Notifications" eyebrow="Recent Alerts">
      {emptyOrList(notifications, "No recent notifications.", (item) => (
        <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="font-black text-navy">{item.title}</h3>
            <PortalBadge tone={item.status === "UNREAD" ? "warning" : "neutral"}>{statusLabel(item.status)}</PortalBadge>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-650">{item.message}</p>
        </article>
      ))}
    </PortalCard>
  );
}

function ResourcesList({ resources }: { resources: RecordMap[] }) {
  return (
    <PortalCard title="Resources" eyebrow="Learning Materials">
      {emptyOrList(resources, "Approved student resources will appear here.", (resource) => (
        <article key={resource.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-black text-navy">{resource.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-650">{resource.description || subjectLabel(resource.subject) || "TutorHiveHub resource"}</p>
          {resource.url && <a href={resource.url} className="mt-3 inline-block text-sm font-black text-navy underline">Open resource</a>}
        </article>
      ))}
    </PortalCard>
  );
}

function LearningProgress({ goals, progress }: { goals?: RecordMap; progress?: RecordMap }) {
  return (
    <PortalCard title="Learning Goals and Progress" eyebrow="Academic Summary">
      <DetailGrid
        items={[
          ["Academic goals", goals?.academicGoals],
          ["Learning needs", goals?.learningNeeds],
          ["Total updates", progress?.totalUpdates],
          ["Latest update", progress?.latest?.parentFriendlyUpdate],
        ]}
      />
    </PortalCard>
  );
}

function DetailGrid({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <dt className="text-xs font-black uppercase text-slate-500">{label}</dt>
          <dd className="mt-2 text-sm font-bold text-navy">{value || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className={`${compact ? "text-lg" : "text-2xl"} mt-2 font-black text-navy`}>{value}</p>
    </div>
  );
}

function emptyOrList(items: RecordMap[] = [], message: string, render: (item: RecordMap) => ReactNode) {
  if (items.length === 0) {
    return <PortalEmptyState title="Nothing to show yet" message={message} />;
  }
  return <div className="grid gap-4">{items.map(render)}</div>;
}

function names(items: RecordMap[] = []) {
  return items.map((item) => subjectLabel(item) || item?.fullName).filter(Boolean).join(", ") || "-";
}

function subjectLabel(subject?: RecordMap | null) {
  if (!subject?.name) {
    return "";
  }
  return subject.examPathway ? `${subject.name} - ${subject.examPathway}` : subject.name;
}

function statusLabel(value?: string | null) {
  return String(value || "-").replace(/_/g, " ");
}

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "ACTIVE" || status === "COMPLETED") return "success";
  if (status === "SUSPENDED" || status === "ARCHIVED" || status === "INACTIVE") return "danger";
  return "warning";
}

function homeworkTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "REVIEWED") return "success";
  if (status === "CANCELLED") return "danger";
  if (status === "SUBMITTED") return "warning";
  return "neutral";
}

function invoiceTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "PAID") return "success";
  if (status === "VOID" || status === "CANCELLED") return "danger";
  if (status === "SENT" || status === "PART_PAID" || status === "PARTIALLY_PAID" || status === "OVERDUE") return "warning";
  return "neutral";
}

function money(value: unknown, currency = "GBP") {
  const amount = Number(value ?? 0);
  return `${currency} ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function dateText(value?: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value)) : "-";
}

function timeText(value?: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "-";
}

function dateTimeText(value?: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
}
