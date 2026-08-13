import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, Plus, RefreshCcw } from "lucide-react";
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
type SchedulingModule = "lessons" | "timetable";

const dayOptions = [
  { id: "0", name: "Sunday" },
  { id: "1", name: "Monday" },
  { id: "2", name: "Tuesday" },
  { id: "3", name: "Wednesday" },
  { id: "4", name: "Thursday" },
  { id: "5", name: "Friday" },
  { id: "6", name: "Saturday" },
];

const defaultTimeZone = "United Kingdom (GMT/BST)";
const commonTimeZones = [defaultTimeZone, "Nigeria (WAT)", "UTC", "Other"];
const timeZoneAliases: Record<string, string> = {
  [defaultTimeZone]: "Europe/London",
  "GMT/BST": "Europe/London",
  UK: "Europe/London",
  "United Kingdom": "Europe/London",
  "Nigeria (WAT)": "Africa/Lagos",
  WAT: "Africa/Lagos",
  Nigeria: "Africa/Lagos",
  UTC: "UTC",
};
const recurrenceOptions = ["NONE", "WEEKLY"];
const viewOptions = ["Daily", "Weekly", "Monthly", "Admin", "Tutor", "Student"];

export function SchedulingRoute({ module, routePath, currentUser }: { module: SchedulingModule; routePath: string; currentUser: PortalUser }) {
  if (module === "timetable") {
    if (routePath.startsWith("/portal/timetable/availability")) {
      return <AvailabilityPage />;
    }
    return <TimetablePage currentUser={currentUser} />;
  }

  if (routePath === "/portal/lessons/new") {
    return <LessonForm mode="create" />;
  }

  const editMatch = routePath.match(/^\/portal\/lessons\/([^/]+)\/edit$/);
  if (editMatch) {
    return <LessonForm mode="edit" lessonId={editMatch[1]} />;
  }

  const profileMatch = routePath.match(/^\/portal\/lessons\/([^/]+)$/);
  if (profileMatch) {
    return <LessonProfile lessonId={profileMatch[1]} />;
  }

  return <LessonList />;
}

function useSchedulingLookups() {
  const [lookups, setLookups] = useState<RecordMap>({});
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    portalApi<RecordMap>("/api/portal/scheduling/lookups")
      .then((result) => {
        setLookups(result);
        setStatus("success");
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Could not load scheduling data.");
      });
  }, []);

  return { lookups, status, message };
}

function LessonList() {
  const { lookups, status: lookupStatus, message: lookupMessage } = useSchedulingLookups();
  const [lessons, setLessons] = useState<RecordMap[]>([]);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const defaultRange = useMemo(() => weekRange(new Date()), []);

  async function loadLessons(filters: RecordMap = { from: defaultRange.from, to: defaultRange.to }) {
    setStatus("loading");
    setMessage("");
    try {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (String(value ?? "").trim()) {
          query.set(key, String(value));
        }
      });
      const result = await portalApi<{ lessons: RecordMap[] }>(`/api/portal/lessons${query.size ? `?${query.toString()}` : ""}`);
      setLessons(result.lessons);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load lessons.");
    }
  }

  useEffect(() => {
    void loadLessons();
  }, []);

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadLessons(Object.fromEntries(new FormData(event.currentTarget).entries()));
  }

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Lesson Scheduling"
        eyebrow="Timetable"
        action={
          <div className="flex flex-wrap gap-2">
            <PortalButton type="button" variant="ghost" onClick={() => loadLessons()}>
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </PortalButton>
            <a href="/portal/lessons/new" className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-gold-100">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Schedule Lesson
            </a>
          </div>
        }
      >
        {lookupStatus === "error" && <PortalAlert title="Could not load filters" tone="error">{lookupMessage}</PortalAlert>}
        {lookupStatus !== "error" && <LessonFilterForm lookups={lookups} defaultRange={defaultRange} onSubmit={handleFilter} />}
        {status === "loading" && <PortalLoadingSkeleton rows={6} />}
        {status === "error" && <PortalAlert title="Could not load lessons" tone="error">{message}</PortalAlert>}
        {status === "success" && lessons.length === 0 && <PortalEmptyState title="No lessons found" message="Schedule a lesson or adjust the timetable filters." />}
        {status === "success" && lessons.length > 0 && <LessonTable lessons={lessons} />}
      </PortalCard>
    </div>
  );
}

function LessonFilterForm({ lookups, defaultRange, onSubmit }: { lookups: RecordMap; defaultRange: { from: string; to: string }; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="mb-6 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-4" onSubmit={onSubmit}>
      <PortalInput id="from" label="From" type="date" defaultValue={defaultRange.from} />
      <PortalInput id="to" label="To" type="date" defaultValue={defaultRange.to} />
      <LookupSelect id="tutorId" label="Tutor" records={lookups.tutors ?? []} />
      <LookupSelect id="studentId" label="Student" records={lookups.students ?? []} />
      <LookupSelect id="subjectId" label="Subject" records={lookups.subjects ?? []} />
      <PortalSelect id="lessonType" label="Lesson type" options={lookups.lessonTypes ?? []} />
      <PortalSelect id="status" label="Status" options={lookups.lessonStatuses ?? []} />
      <div className="flex items-end">
        <PortalButton type="submit" className="w-full">Apply Filters</PortalButton>
      </div>
    </form>
  );
}

function LessonTable({ lessons }: { lessons: RecordMap[] }) {
  return (
    <PortalTable
      columns={["Date", "Students", "Tutor", "Subject", "Type", "Status", "Actions"]}
      rows={lessons.map((lesson) => [
        <div>
          <p className="font-black text-navy">{dateText(lesson.scheduledStart, lesson.timeZone)}</p>
          <p className="text-xs font-bold text-slate-500">{timeRange(lesson)} - {lesson.timeZone || "No time zone"}</p>
        </div>,
        names(lesson.students?.length ? lesson.students : [lesson.student]),
        lesson.replacementTutor ? `${lesson.replacementTutor.fullName} (replacement)` : lesson.tutor?.fullName || "-",
        subjectLabel(lesson.subject) || "-",
        lesson.lessonType,
        <PortalBadge tone={lessonStatusTone(lesson.status)}>{lessonStatusLabel(lesson.status)}</PortalBadge>,
        <div className="flex flex-wrap gap-2">
          <a href={`/portal/lessons/${lesson.id}`} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50">View</a>
          <a href={`/portal/lessons/${lesson.id}/edit`} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50">Edit</a>
          <a href={`/portal/lesson-reports/lesson/${lesson.id}`} className="rounded-md bg-gold px-3 py-2 text-xs font-black text-navy transition hover:bg-gold-100">Workspace</a>
        </div>,
      ])}
    />
  );
}

function LessonForm({ mode, lessonId }: { mode: "create" | "edit"; lessonId?: string }) {
  const { lookups, status: lookupStatus, message: lookupMessage } = useSchedulingLookups();
  const [lesson, setLesson] = useState<RecordMap | null>(null);
  const [status, setStatus] = useState<LoadState>(mode === "edit" ? "loading" : "success");
  const [submitStatus, setSubmitStatus] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (mode !== "edit" || !lessonId) {
      return;
    }
    portalApi<{ lesson: RecordMap }>(`/api/portal/lessons/${lessonId}`)
      .then((result) => {
        setLesson(result.lesson);
        setStatus("success");
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Could not load lesson.");
      });
  }, [mode, lessonId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitStatus("loading");
    setMessage("");
    try {
      const endpoint = mode === "edit" && lessonId ? `/api/portal/lessons/${lessonId}` : "/api/portal/lessons";
      const result = await portalApi<RecordMap>(endpoint, { method: mode === "edit" ? "PATCH" : "POST", body: JSON.stringify(lessonPayload(form)) });
      setSubmitStatus("success");
      setLesson(result.lesson ?? result.lessons?.[0] ?? null);
      setMessage(mode === "edit" ? "Lesson updated successfully." : `${result.lessons?.length ?? 1} lesson scheduled successfully.`);
      if (mode === "create") {
        form.reset();
      }
    } catch (error) {
      setSubmitStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save lesson.");
    }
  }

  if (lookupStatus === "loading" || status === "loading") {
    return <PortalLoadingSkeleton rows={8} />;
  }

  if (lookupStatus === "error" || status === "error") {
    return <PortalAlert title="Could not load lesson form" tone="error">{lookupMessage || message}</PortalAlert>;
  }

  return (
    <PortalCard title={mode === "edit" ? "Edit Lesson" : "Schedule Lesson"} eyebrow="Lesson Scheduling">
      <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
        <MultiSelect id="studentIds" label="Student or students" options={lookups.students ?? []} defaultValues={(lesson?.students ?? []).map((student: RecordMap) => student.id)} />
        <LookupSelect id="tutorId" label="Tutor" records={lookups.tutors ?? []} required defaultValue={lesson?.tutorId ?? ""} />
        <LookupSelect id="replacementTutorId" label="Replacement tutor" records={lookups.tutors ?? []} defaultValue={lesson?.replacementTutorId ?? ""} />
        <LookupSelect id="subjectId" label="Subject" records={lookups.subjects ?? []} required defaultValue={lesson?.subjectId ?? ""} />
        <PortalSelect id="lessonType" label="Lesson type" required options={lookups.lessonTypes ?? []} defaultValue={lesson?.lessonType ?? "One-to-One Tutoring"} />
        <PortalSelect id="status" label="Lesson status" required options={lookups.lessonStatuses ?? []} defaultValue={lesson?.status ?? "SCHEDULED"} />
        <PortalInput id="date" label="Date" type="date" required defaultValue={dateInput(lesson?.scheduledStart, lesson?.timeZone)} />
        <PortalInput id="startTime" label="Start time" type="time" required defaultValue={timeInput(lesson?.scheduledStart, lesson?.timeZone)} />
        <PortalInput id="endTime" label="End time" type="time" required defaultValue={timeInput(lesson?.scheduledEnd, lesson?.timeZone)} />
        <PortalSelect id="timeZone" label="Time zone" required options={commonTimeZones} defaultValue={lesson?.timeZone ?? defaultTimeZone} />
        <PortalSelect id="recurrencePattern" label="Recurrence pattern" options={recurrenceOptions} defaultValue={lesson?.recurrencePattern ?? "NONE"} />
        <PortalInput id="occurrenceCount" label="Weekly occurrences" type="number" min="2" max="52" placeholder="Only for weekly recurrence" />
        <PortalInput id="recurrenceEndDate" label="Recurrence end date" type="date" />
        <PortalInput id="meetingLink" label="Meeting link" type="url" defaultValue={lesson?.meetingLink ?? ""} />
        <PortalTextarea id="lessonObjective" label="Lesson objective" defaultValue={lesson?.lessonObjective ?? ""} />
        <PortalTextarea id="notes" label="Notes" defaultValue={lesson?.notes ?? ""} />
        <div className="md:col-span-2">
          {submitStatus === "success" && <PortalAlert title="Saved" tone="success">{message}</PortalAlert>}
          {submitStatus === "error" && <PortalAlert title={message.startsWith("Conflict warning") ? "Conflict warning" : "Could not save"} tone={message.startsWith("Conflict warning") ? "warning" : "error"}>{message}</PortalAlert>}
        </div>
        <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row">
          <PortalButton type="submit" disabled={submitStatus === "loading"}>{submitStatus === "loading" ? "Checking schedule..." : "Save Lesson"}</PortalButton>
          <a href="/portal/lessons" className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:border-gold hover:bg-gold-50">
            Back to Lessons
          </a>
        </div>
      </form>
    </PortalCard>
  );
}

function LessonProfile({ lessonId }: { lessonId: string }) {
  const { lookups } = useSchedulingLookups();
  const [lesson, setLesson] = useState<RecordMap | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  async function loadLesson() {
    setStatus("loading");
    setMessage("");
    try {
      const result = await portalApi<{ lesson: RecordMap }>(`/api/portal/lessons/${lessonId}`);
      setLesson(result.lesson);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load lesson.");
    }
  }

  useEffect(() => {
    void loadLesson();
  }, [lessonId]);

  async function postAction(path: string, body: RecordMap, successMessage: string) {
    setMessage("");
    try {
      const result = await portalApi<RecordMap>(path, { method: "POST", body: JSON.stringify(body) });
      if (result.lesson) {
        setLesson(result.lesson);
      }
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    }
  }

  if (status === "loading") {
    return <PortalLoadingSkeleton rows={8} />;
  }

  if (status === "error" || !lesson) {
    return <PortalAlert title="Could not load lesson" tone="error">{message}</PortalAlert>;
  }

  return (
    <div className="grid gap-6">
      <PortalCard
        title={`${subjectLabel(lesson.subject) || "Lesson"} - ${dateText(lesson.scheduledStart, lesson.timeZone)}`}
        eyebrow="Lesson Profile"
        action={
          <div className="flex flex-wrap gap-2">
            <a href={`/portal/lesson-reports/lesson/${lesson.id}`} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:border-gold hover:bg-gold-50">Workspace</a>
            <a href={`/portal/lessons/${lesson.id}/edit`} className="inline-flex items-center justify-center rounded-md bg-gold px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-gold-100">Edit</a>
          </div>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <DetailGrid
            items={[
              ["Students", names(lesson.students?.length ? lesson.students : [lesson.student])],
              ["Tutor", lesson.replacementTutor ? `${lesson.replacementTutor.fullName} (replacement)` : lesson.tutor?.fullName],
              ["Subject", subjectLabel(lesson.subject)],
              ["Lesson type", lesson.lessonType],
              ["Status", <PortalBadge tone={lessonStatusTone(lesson.status)}>{lessonStatusLabel(lesson.status)}</PortalBadge>],
              ["Time", `${dateText(lesson.scheduledStart, lesson.timeZone)} ${timeRange(lesson)}`],
              ["Time zone", lesson.timeZone],
              ["Duration", lesson.durationMinutes ? `${lesson.durationMinutes} minutes` : "-"],
              ["Meeting link", lesson.meetingLink ? <a className="break-all underline" href={lesson.meetingLink}>{lesson.meetingLink}</a> : "-"],
              ["Objective", lesson.lessonObjective],
              ["Recurrence", lesson.recurrencePattern],
              ["Notes", lesson.notes],
              ["Cancellation", [lesson.cancellationInitiatedBy, lesson.cancellationReason].filter(Boolean).join(" / ")],
            ]}
          />
          <LessonActions lesson={lesson} lookups={lookups} onAction={postAction} />
        </div>
        {message && <div className="mt-6"><PortalAlert title={message.includes("failed") || message.includes("Conflict") ? "Action warning" : "Action completed"} tone={message.includes("failed") || message.includes("Conflict") ? "warning" : "success"}>{message}</PortalAlert></div>}
      </PortalCard>
    </div>
  );
}

function LessonActions({ lesson, lookups, onAction }: { lesson: RecordMap; lookups: RecordMap; onAction: (path: string, body: RecordMap, successMessage: string) => void }) {
  function handleStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onAction(`/api/portal/lessons/${lesson.id}/status`, { status: data.get("status") }, "Lesson status updated.");
  }

  function handleCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onAction(`/api/portal/lessons/${lesson.id}/cancel`, Object.fromEntries(data.entries()), "Lesson cancelled and notifications queued.");
  }

  function handleReschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    onAction(`/api/portal/lessons/${lesson.id}/reschedule`, lessonPayload(form), "Replacement or rescheduled lesson created.");
  }

  return (
    <div className="grid gap-5">
      <form className="rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={handleStatus}>
        <h3 className="text-lg font-black text-navy">Update Status</h3>
        <PortalSelect id="status" label="Lesson status" options={lookups.lessonStatuses ?? []} defaultValue={lesson.status} />
        <PortalButton type="submit" className="mt-4 w-full">Update Status</PortalButton>
      </form>

      <form className="rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={handleCancel}>
        <h3 className="text-lg font-black text-navy">Cancel Lesson</h3>
        <PortalInput id="cancellationInitiatedBy" label="Initiated by" required placeholder="Parent, tutor, student, or TutorHiveHub" />
        <PortalTextarea id="cancellationReason" label="Cancellation reason" required />
        <PortalButton type="submit" variant="danger" className="mt-4 w-full">Cancel Lesson</PortalButton>
      </form>

      <form className="rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={handleReschedule}>
        <h3 className="text-lg font-black text-navy">Reschedule or Replace</h3>
        <PortalInput id="date" label="New date" type="date" required />
        <PortalInput id="startTime" label="New start time" type="time" required />
        <PortalInput id="endTime" label="New end time" type="time" required />
        <PortalSelect id="timeZone" label="Time zone" required options={commonTimeZones} defaultValue={lesson.timeZone ?? defaultTimeZone} />
        <LookupSelect id="replacementTutorId" label="Replacement tutor" records={lookups.tutors ?? []} />
        <PortalInput id="meetingLink" label="Meeting link" type="url" defaultValue={lesson.meetingLink ?? ""} />
        <PortalTextarea id="notes" label="Notes" defaultValue={lesson.notes ?? ""} />
        <PortalButton type="submit" className="mt-4 w-full">Create Rescheduled Lesson</PortalButton>
      </form>

      <PortalButton type="button" variant="ghost" onClick={() => onAction(`/api/portal/lessons/${lesson.id}/send-reminder`, {}, "Lesson reminder queued.")}>
        Send Reminder
      </PortalButton>
    </div>
  );
}

function TimetablePage({ currentUser }: { currentUser: PortalUser }) {
  const { lookups, status: lookupStatus, message: lookupMessage } = useSchedulingLookups();
  const [lessons, setLessons] = useState<RecordMap[]>([]);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [view, setView] = useState("Weekly");
  const [anchorDate, setAnchorDate] = useState(dateInput(new Date().toISOString(), defaultTimeZone));

  async function loadTimetable(filters: RecordMap = {}) {
    setStatus("loading");
    setMessage("");
    const range = rangeForView(String(filters.view || view), String(filters.anchorDate || anchorDate));
    try {
      const query = new URLSearchParams({ from: range.from, to: range.to });
      ["tutorId", "studentId", "subjectId", "status"].forEach((key) => {
        if (String(filters[key] ?? "").trim()) query.set(key, String(filters[key]));
      });
      const result = await portalApi<{ lessons: RecordMap[] }>(`/api/portal/lessons?${query.toString()}`);
      setLessons(result.lessons);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load timetable.");
    }
  }

  useEffect(() => {
    void loadTimetable();
  }, []);

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    setView(String(data.view || "Weekly"));
    setAnchorDate(String(data.anchorDate || anchorDate));
    void loadTimetable(data);
  }

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Timetable"
        eyebrow="Lesson Calendar"
        action={
          <div className="flex flex-wrap gap-2">
            <a href="/portal/timetable/availability" className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:border-gold hover:bg-gold-50">
              Tutor Availability
            </a>
            <a href="/portal/lessons/new" className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-gold-100">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Schedule Lesson
            </a>
          </div>
        }
      >
        <PortalAlert title="Timetable access" tone="info">
          Showing timetable data available to {currentUser.role?.name || "your account"}. Server-side permissions keep tutor and family timetable data scoped.
        </PortalAlert>
        {lookupStatus === "error" && <div className="mt-5"><PortalAlert title="Could not load filters" tone="error">{lookupMessage}</PortalAlert></div>}
        {lookupStatus !== "error" && <TimetableFilterForm lookups={lookups} view={view} anchorDate={anchorDate} onSubmit={handleFilter} />}
        {status === "loading" && <PortalLoadingSkeleton rows={6} />}
        {status === "error" && <PortalAlert title="Could not load timetable" tone="error">{message}</PortalAlert>}
        {status === "success" && lessons.length === 0 && <PortalEmptyState title="No lessons in this timetable range" message="Try another view, date, tutor, or student filter." />}
        {status === "success" && lessons.length > 0 && <TimetableGrid lessons={lessons} />}
      </PortalCard>
    </div>
  );
}

function TimetableFilterForm({ lookups, view, anchorDate, onSubmit }: { lookups: RecordMap; view: string; anchorDate: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="my-6 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-4" onSubmit={onSubmit}>
      <PortalSelect id="view" label="View" options={viewOptions} defaultValue={view} />
      <PortalInput id="anchorDate" label="Date" type="date" defaultValue={anchorDate} />
      <LookupSelect id="tutorId" label="Tutor timetable" records={lookups.tutors ?? []} />
      <LookupSelect id="studentId" label="Student timetable" records={lookups.students ?? []} />
      <LookupSelect id="subjectId" label="Subject" records={lookups.subjects ?? []} />
      <PortalSelect id="status" label="Status" options={lookups.lessonStatuses ?? []} />
      <div className="flex items-end">
        <PortalButton type="submit" className="w-full">Load Timetable</PortalButton>
      </div>
    </form>
  );
}

function TimetableGrid({ lessons }: { lessons: RecordMap[] }) {
  const grouped = lessons.reduce<Record<string, RecordMap[]>>((groups, lesson) => {
    const key = dateText(lesson.scheduledStart, lesson.timeZone);
    groups[key] = groups[key] ?? [];
    groups[key].push(lesson);
    return groups;
  }, {});

  return (
    <div className="grid gap-5">
      {Object.entries(grouped).map(([date, items]) => (
        <section key={date} className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <CalendarDays className="h-5 w-5 text-gold" aria-hidden="true" />
            <h3 className="font-black text-navy">{date}</h3>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {items.map((lesson) => (
              <a key={lesson.id} href={`/portal/lessons/${lesson.id}`} className="grid gap-2 rounded-md border border-slate-200 p-4 transition hover:border-gold hover:bg-gold-50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-navy">{timeRange(lesson)}</p>
                  <PortalBadge tone={lessonStatusTone(lesson.status)}>{lessonStatusLabel(lesson.status)}</PortalBadge>
                </div>
                <p className="text-sm font-bold text-slate-700">{subjectLabel(lesson.subject) || "Subject"} - {lesson.lessonType}</p>
                <p className="text-sm text-slate-650">{names(lesson.students?.length ? lesson.students : [lesson.student])}</p>
                <p className="text-xs font-bold text-slate-500">{lesson.replacementTutor ? `${lesson.replacementTutor.fullName} (replacement)` : lesson.tutor?.fullName} - {lesson.timeZone || "No time zone"}</p>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AvailabilityPage() {
  const { lookups, status: lookupStatus, message: lookupMessage } = useSchedulingLookups();
  const [availability, setAvailability] = useState<RecordMap[]>([]);
  const [exceptions, setExceptions] = useState<RecordMap[]>([]);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  async function loadAvailability() {
    setStatus("loading");
    setMessage("");
    try {
      const [availabilityResult, exceptionResult] = await Promise.all([
        portalApi<{ availability: RecordMap[] }>("/api/portal/tutor-availability"),
        portalApi<{ exceptions: RecordMap[] }>("/api/portal/tutor-availability-exceptions"),
      ]);
      setAvailability(availabilityResult.availability);
      setExceptions(exceptionResult.exceptions);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load tutor availability.");
    }
  }

  useEffect(() => {
    void loadAvailability();
  }, []);

  async function submitAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAvailabilityForm("/api/portal/tutor-availability", event.currentTarget);
  }

  async function submitException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAvailabilityForm("/api/portal/tutor-availability-exceptions", event.currentTarget);
  }

  async function submitAvailabilityForm(endpoint: string, form: HTMLFormElement) {
    setMessage("");
    try {
      await portalApi<RecordMap>(endpoint, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      form.reset();
      setMessage("Availability saved.");
      await loadAvailability();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save availability.");
    }
  }

  async function approve(endpoint: string, id: string, override = false) {
    setMessage("");
    try {
      await portalApi<RecordMap>(`${endpoint}/${id}/approve`, { method: "POST", body: JSON.stringify({ override }) });
      setMessage(override ? "Availability overridden." : "Availability approved.");
      await loadAvailability();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approval failed.");
    }
  }

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Tutor Availability"
        eyebrow="Timetable"
        action={<a href="/portal/timetable" className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:border-gold hover:bg-gold-50">Back to Timetable</a>}
      >
        {lookupStatus === "error" && <PortalAlert title="Could not load tutors" tone="error">{lookupMessage}</PortalAlert>}
        {message && <div className="mb-5"><PortalAlert title={message.includes("Could not") || message.includes("failed") ? "Availability warning" : "Availability updated"} tone={message.includes("Could not") || message.includes("failed") ? "warning" : "success"}>{message}</PortalAlert></div>}
        <div className="grid gap-6 xl:grid-cols-2">
          <AvailabilityRuleForm lookups={lookups} onSubmit={submitAvailability} />
          <AvailabilityExceptionForm lookups={lookups} onSubmit={submitException} />
        </div>
      </PortalCard>

      <PortalCard title="Weekly Availability" eyebrow="Approved Hours">
        {status === "loading" && <PortalLoadingSkeleton rows={5} />}
        {status === "error" && <PortalAlert title="Could not load availability" tone="error">{message}</PortalAlert>}
        {status === "success" && availability.length === 0 && <PortalEmptyState title="No weekly availability yet" message="Tutors can submit availability and administrators can approve or override it." />}
        {status === "success" && availability.length > 0 && (
          <PortalTable
            columns={["Tutor", "Day", "Times", "Time zone", "Status", "Actions"]}
            rows={availability.map((item) => [
              item.tutor?.fullName || "-",
              dayName(item.dayOfWeek),
              `${item.startTime} - ${item.endTime}`,
              item.timeZone,
              <PortalBadge tone={availabilityTone(item.status)}>{item.status}</PortalBadge>,
              availabilityActions(() => approve("/api/portal/tutor-availability", item.id), () => approve("/api/portal/tutor-availability", item.id, true)),
            ])}
          />
        )}
      </PortalCard>

      <PortalCard title="Unavailable, Holiday, and Temporary Changes" eyebrow="Exceptions">
        {status === "loading" && <PortalLoadingSkeleton rows={5} />}
        {status === "success" && exceptions.length === 0 && <PortalEmptyState title="No availability exceptions yet" message="Use this for unavailable dates, holidays, and temporary teaching changes." />}
        {status === "success" && exceptions.length > 0 && (
          <PortalTable
            columns={["Tutor", "Date", "Type", "Times", "Status", "Actions"]}
            rows={exceptions.map((item) => [
              item.tutor?.fullName || "-",
              dateText(item.exceptionDate, item.timeZone),
              item.exceptionType,
              item.startTime && item.endTime ? `${item.startTime} - ${item.endTime}` : "All day",
              <PortalBadge tone={availabilityTone(item.status)}>{item.status}</PortalBadge>,
              availabilityActions(() => approve("/api/portal/tutor-availability-exceptions", item.id), () => approve("/api/portal/tutor-availability-exceptions", item.id, true)),
            ])}
          />
        )}
      </PortalCard>
    </div>
  );
}

function AvailabilityRuleForm({ lookups, onSubmit }: { lookups: RecordMap; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={onSubmit}>
      <h3 className="text-lg font-black text-navy">Weekly Availability</h3>
      <LookupSelect id="tutorId" label="Tutor" records={lookups.tutors ?? []} />
      <PortalSelect id="dayOfWeek" label="Available day" required>
        <option value="">Select an option</option>
        {dayOptions.map((day) => <option key={day.id} value={day.id}>{day.name}</option>)}
      </PortalSelect>
      <PortalInput id="startTime" label="Start time" type="time" required />
      <PortalInput id="endTime" label="End time" type="time" required />
      <PortalSelect id="timeZone" label="Time zone" required options={commonTimeZones} defaultValue={defaultTimeZone} />
      <PortalSelect id="status" label="Status" options={lookups.availabilityStatuses ?? []} defaultValue="PENDING" />
      <PortalTextarea id="notes" label="Notes" />
      <PortalButton type="submit">Save Availability</PortalButton>
    </form>
  );
}

function AvailabilityExceptionForm({ lookups, onSubmit }: { lookups: RecordMap; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={onSubmit}>
      <h3 className="text-lg font-black text-navy">Unavailable or Temporary Change</h3>
      <LookupSelect id="tutorId" label="Tutor" records={lookups.tutors ?? []} />
      <PortalInput id="exceptionDate" label="Date" type="date" required />
      <PortalSelect id="exceptionType" label="Type" required options={lookups.availabilityExceptionTypes ?? []} />
      <PortalInput id="startTime" label="Start time" type="time" />
      <PortalInput id="endTime" label="End time" type="time" />
      <PortalSelect id="timeZone" label="Time zone" required options={commonTimeZones} defaultValue={defaultTimeZone} />
      <PortalSelect id="status" label="Status" options={lookups.availabilityStatuses ?? []} defaultValue="PENDING" />
      <PortalTextarea id="notes" label="Notes" />
      <PortalButton type="submit">Save Change</PortalButton>
    </form>
  );
}

function LookupSelect({ id, label, records, required = false, defaultValue = "" }: { id: string; label: string; records: RecordMap[]; required?: boolean; defaultValue?: string }) {
  return (
    <PortalSelect id={id} label={label} required={required} defaultValue={defaultValue}>
      <option value="">Select an option</option>
      {records.map((record) => (
        <option key={record.id} value={record.id}>
          {lookupLabel(record)}
        </option>
      ))}
    </PortalSelect>
  );
}

function MultiSelect({ id, label, options, defaultValues = [] }: { id: string; label: string; options: RecordMap[]; defaultValues?: string[] }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold text-navy">{label}</label>
      <select id={id} name={id} multiple required defaultValue={defaultValues} className="mt-2 min-h-36 w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/20">
        {options.map((option) => (
          <option key={option.id} value={option.id}>{lookupLabel(option)}</option>
        ))}
      </select>
      <p className="mt-1 text-xs font-bold text-slate-500">Hold Ctrl or Cmd to select multiple students for group lessons.</p>
    </div>
  );
}

function lessonPayload(form: HTMLFormElement) {
  const data = Object.fromEntries(new FormData(form).entries()) as RecordMap;
  data.studentIds = selectedValues(form, "studentIds");
  return data;
}

function selectedValues(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name) as HTMLSelectElement | null;
  if (!field) return [];
  return Array.from(field.selectedOptions).map((option) => option.value).filter(Boolean);
}

function lookupLabel(record: RecordMap) {
  if (record.name && record.examPathway) {
    return `${record.name} - ${record.examPathway}`;
  }
  return record.fullName || record.name || "";
}

function subjectLabel(subject?: RecordMap | null) {
  return lookupLabel(subject ?? {});
}

function DetailGrid({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <dt className="text-xs font-black uppercase text-slate-500">{label}</dt>
          <dd className="mt-2 text-sm font-bold text-navy">{value || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

function availabilityActions(onApprove: () => void, onOverride: () => void) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50" onClick={onApprove}>Approve</button>
      <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50" onClick={onOverride}>Override</button>
    </div>
  );
}

function rangeForView(view: string, anchorDate: string) {
  const date = new Date(`${anchorDate}T00:00:00`);
  if (view === "Daily") {
    return { from: formatDate(date), to: formatDate(date) };
  }
  if (view === "Monthly") {
    return { from: formatDate(new Date(date.getFullYear(), date.getMonth(), 1)), to: formatDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)) };
  }
  return weekRange(date);
}

function weekRange(date: Date) {
  const monday = new Date(date);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: formatDate(monday), to: formatDate(sunday) };
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateInput(value?: string | null, timeZone?: string | null) {
  const parts = zonedDateTimeParts(value, timeZone);
  return parts ? `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}` : "";
}

function timeInput(value?: string | null, timeZone?: string | null) {
  const parts = zonedDateTimeParts(value, timeZone);
  return parts ? `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}` : "";
}

function dateText(value?: string | null, timeZone?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: resolveTimeZone(timeZone) }).format(date);
}

function timeRange(lesson: RecordMap) {
  return `${timeInput(lesson.scheduledStart, lesson.timeZone)} - ${timeInput(lesson.scheduledEnd, lesson.timeZone)}`;
}

function zonedDateTimeParts(value?: string | null, timeZone?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const values: Record<string, string> = {};
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }
  return {
    year: Number.parseInt(values.year, 10),
    month: Number.parseInt(values.month, 10),
    day: Number.parseInt(values.day, 10),
    hour: Number.parseInt(values.hour, 10),
    minute: Number.parseInt(values.minute, 10),
  };
}

function resolveTimeZone(value?: string | null) {
  const cleaned = String(value ?? "").trim() || defaultTimeZone;
  const candidate = timeZoneAliases[cleaned] || inferTimeZone(cleaned);
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "UTC";
  }
}

function inferTimeZone(value: string) {
  const lowered = value.toLowerCase();
  if (lowered.includes("united kingdom") || lowered.includes("gmt/bst") || lowered.includes("london")) {
    return "Europe/London";
  }
  if (lowered.includes("nigeria") || lowered.includes("wat") || lowered.includes("lagos")) {
    return "Africa/Lagos";
  }
  if (lowered === "other") {
    return "UTC";
  }
  return value;
}

function names(items: RecordMap[] = []) {
  return items.map((item) => item?.fullName || item?.name).filter(Boolean).join(", ") || "-";
}

function dayName(value: number | string) {
  return dayOptions.find((day) => day.id === String(value))?.name || "-";
}

function lessonStatusLabel(status: string) {
  return String(status || "").replace(/_/g, " ");
}

function lessonStatusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED" || status === "STUDENT_ABSENT" || status === "TUTOR_ABSENT") return "danger";
  if (status === "RESCHEDULED") return "warning";
  return "neutral";
}

function availabilityTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "APPROVED" || status === "OVERRIDDEN") return "success";
  if (status === "REJECTED") return "danger";
  if (status === "PENDING") return "warning";
  return "neutral";
}
