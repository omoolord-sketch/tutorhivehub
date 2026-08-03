import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ExternalLink, FileText, Printer, RefreshCcw } from "lucide-react";
import { hasPortalPermission, portalApi, type PortalUser } from "./api";
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

const readinessFields = [
  ["internetChecked", "Internet checked"],
  ["cameraChecked", "Camera checked"],
  ["microphoneChecked", "Microphone checked"],
  ["screenSharingChecked", "Screen sharing checked"],
  ["lessonMaterialsReady", "Lesson materials ready"],
];

const attendanceOptions = ["Present", "Absent", "Late", "Not Recorded"];
const understandingOptions = ["Excellent", "Good", "Fair", "Needs Improvement"];
const engagementOptions = ["Highly Engaged", "Participated Well", "Needed Encouragement", "Disengaged"];

export function LessonWorkspaceDashboard({ currentUser }: { currentUser: PortalUser }) {
  const canUseWorkspace = ["lessons:manage", "reports:manage", "own:lessons", "own:lesson-reports"].some((permission) => hasPortalPermission(currentUser, permission));
  const [upcomingLessons, setUpcomingLessons] = useState<RecordMap[]>([]);
  const [outstandingReports, setOutstandingReports] = useState<RecordMap[]>([]);
  const [status, setStatus] = useState<LoadState>("idle");

  useEffect(() => {
    if (!canUseWorkspace) {
      return;
    }
    setStatus("loading");
    portalApi<{ upcomingLessons: RecordMap[]; outstandingReports: RecordMap[] }>("/api/portal/lesson-workspace/dashboard")
      .then((result) => {
        setUpcomingLessons(result.upcomingLessons);
        setOutstandingReports(result.outstandingReports);
        setStatus("success");
      })
      .catch(() => setStatus("error"));
  }, [canUseWorkspace]);

  if (!canUseWorkspace) {
    return null;
  }

  return (
    <PortalCard title="Lesson Workspace" eyebrow="Today and Outstanding Reports">
      <PortalAlert title="Tutor preparation reminder" tone="info">
        Tutors are encouraged to log in at least 15 minutes before each lesson. Preparation time is not counted as lesson time unless an administrator approves it.
      </PortalAlert>
      {status === "loading" && <div className="mt-5"><PortalLoadingSkeleton rows={4} /></div>}
      {status === "error" && <div className="mt-5"><PortalAlert title="Could not load lesson workspace" tone="warning">The workspace will appear after the portal API is available.</PortalAlert></div>}
      {status === "success" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <LessonCardList title="Scheduled Lessons" lessons={upcomingLessons} empty="No upcoming lessons found." />
          <LessonCardList title="Report Outstanding" lessons={outstandingReports} empty="No outstanding reports found." reportMode />
        </div>
      )}
    </PortalCard>
  );
}

export function LessonReportsRoute({ routePath }: { routePath: string; currentUser: PortalUser }) {
  const lessonMatch = routePath.match(/^\/portal\/lesson-reports\/lesson\/([^/]+)$/);
  if (lessonMatch) {
    return <LessonWorkspacePage lessonId={lessonMatch[1]} />;
  }

  const reportMatch = routePath.match(/^\/portal\/lesson-reports\/([^/]+)$/);
  if (reportMatch) {
    return <ReportProfile reportId={reportMatch[1]} />;
  }

  return <ReportsOverview />;
}

function LessonCardList({ title, lessons, empty, reportMode = false }: { title: string; lessons: RecordMap[]; empty: string; reportMode?: boolean }) {
  return (
    <section>
      <h3 className="text-lg font-black text-navy">{title}</h3>
      {lessons.length === 0 ? (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">{empty}</p>
      ) : (
        <div className="mt-4 grid gap-4">
          {lessons.map((lesson) => (
            <LessonSummaryCard key={lesson.id} lesson={lesson} reportMode={reportMode} />
          ))}
        </div>
      )}
    </section>
  );
}

function LessonSummaryCard({ lesson, reportMode = false }: { lesson: RecordMap; reportMode?: boolean }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-navy">{names(lesson.students?.length ? lesson.students : [lesson.student])}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{lesson.subject?.name || "Subject"} - {dateText(lesson.scheduledStart)} {timeRange(lesson)}</p>
        </div>
        <PortalBadge tone={lesson.reportOutstanding || reportMode ? "warning" : statusTone(lesson.status)}>{lesson.reportOutstanding || reportMode ? "Report Outstanding" : labelStatus(lesson.status)}</PortalBadge>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-650">
        <p><span className="font-black text-navy">Duration:</span> {lesson.durationMinutes ? `${lesson.durationMinutes} minutes` : "-"}</p>
        <p><span className="font-black text-navy">Objective:</span> {lesson.lessonObjective || "-"}</p>
        <p><span className="font-black text-navy">Previous summary:</span> {lesson.previousLessonSummary || "-"}</p>
        <p><span className="font-black text-navy">Outstanding homework:</span> {homeworkSummary(lesson.outstandingHomework)}</p>
        <p><span className="font-black text-navy">Academic goals:</span> {lesson.studentAcademicGoals || "-"}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {lesson.meetingLink && (
          <a href={lesson.meetingLink} className="inline-flex items-center justify-center gap-2 rounded-md bg-navy px-3 py-2 text-xs font-black text-white transition hover:bg-navy-700">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Join Lesson
          </a>
        )}
        <a href={`/portal/lesson-reports/lesson/${lesson.id}`} className="inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50">
          Start Preparation
        </a>
        <a href={`/portal/lesson-reports/lesson/${lesson.id}`} className="inline-flex items-center justify-center rounded-md bg-gold px-3 py-2 text-xs font-black text-navy transition hover:bg-gold-100">
          Complete Lesson Report
        </a>
      </div>
    </article>
  );
}

function LessonWorkspacePage({ lessonId }: { lessonId: string }) {
  const [lesson, setLesson] = useState<RecordMap | null>(null);
  const [timeline, setTimeline] = useState<RecordMap[]>([]);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  async function loadLesson() {
    setStatus("loading");
    setMessage("");
    try {
      const result = await portalApi<{ lesson: RecordMap; timeline: RecordMap[] }>(`/api/portal/lesson-workspace/lessons/${lessonId}`);
      setLesson(result.lesson);
      setTimeline(result.timeline);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load lesson workspace.");
    }
  }

  useEffect(() => {
    void loadLesson();
  }, [lessonId]);

  async function postForm(endpoint: string, form: HTMLFormElement, successMessage: string) {
    setMessage("");
    try {
      const result = await portalApi<RecordMap>(endpoint, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      if (result.lesson) setLesson(result.lesson);
      if (result.report && lesson) setLesson({ ...lesson, report: result.report, reportStatus: "SUBMITTED" });
      setMessage(successMessage);
      if (endpoint === "/api/portal/lesson-reports") {
        form.reset();
        await loadLesson();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    }
  }

  if (status === "loading") {
    return <PortalLoadingSkeleton rows={8} />;
  }

  if (status === "error" || !lesson) {
    return <PortalAlert title="Could not load lesson workspace" tone="error">{message}</PortalAlert>;
  }

  return (
    <div className="grid gap-6">
      <PortalCard
        title={`${lesson.subject?.name ?? "Lesson"} Workspace`}
        eyebrow="Lesson Delivery"
        action={<a href="/portal/lesson-reports" className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:border-gold hover:bg-gold-50">Back to Reports</a>}
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <DetailGrid
            items={[
              ["Student", names(lesson.students?.length ? lesson.students : [lesson.student])],
              ["Tutor", lesson.replacementTutor ? `${lesson.replacementTutor.fullName} (replacement)` : lesson.tutor?.fullName],
              ["Date and time", `${dateText(lesson.scheduledStart)} ${timeRange(lesson)}`],
              ["Duration", lesson.durationMinutes ? `${lesson.durationMinutes} minutes` : "-"],
              ["Meeting link", lesson.meetingLink ? <a className="break-all underline" href={lesson.meetingLink}>{lesson.meetingLink}</a> : "-"],
              ["Lesson objective", lesson.lessonObjective],
              ["Previous lesson summary", lesson.previousLessonSummary],
              ["Outstanding homework", homeworkSummary(lesson.outstandingHomework)],
              ["Academic goals", lesson.studentAcademicGoals],
              ["Report status", lesson.reportStatus],
            ]}
          />
          <div className="grid gap-4">
            <PortalAlert title="Preparation time" tone="info">
              Tutor preparation should begin at least 15 minutes before the lesson. It is not counted as lesson time unless an administrator approves it.
            </PortalAlert>
            {lesson.reportOutstanding && <PortalAlert title="Report outstanding" tone="warning">This completed lesson still needs a daily lesson report.</PortalAlert>}
            {message && <PortalAlert title={message.includes("Could not") || message.includes("required") ? "Workspace warning" : "Workspace updated"} tone={message.includes("Could not") || message.includes("required") ? "warning" : "success"}>{message}</PortalAlert>}
          </div>
        </div>
      </PortalCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <ReadinessForm lesson={lesson} onSubmit={(form) => postForm(`/api/portal/lesson-workspace/lessons/${lesson.id}/ready`, form, "Tutor readiness saved.")} />
        <AttendanceForm lesson={lesson} onSubmit={(form) => postForm(`/api/portal/lesson-workspace/lessons/${lesson.id}/attendance`, form, "Attendance saved.")} />
      </div>

      <DailyReportForm lesson={lesson} onSubmit={(form) => postForm("/api/portal/lesson-reports", form, "Daily lesson report submitted.")} />
      <TimelineCard timeline={timeline} />
    </div>
  );
}

function ReadinessForm({ lesson, onSubmit }: { lesson: RecordMap; onSubmit: (form: HTMLFormElement) => void }) {
  const checklist = lesson.readinessChecklist ?? {};
  return (
    <PortalCard title="Tutor Preparation" eyebrow="Technical Readiness">
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); onSubmit(event.currentTarget); }}>
        {readinessFields.map(([id, label]) => (
          <label key={id} className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-navy">
            <input name={id} type="checkbox" defaultChecked={Boolean(checklist[id])} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold focus:ring-gold" />
            <span>{label}</span>
          </label>
        ))}
        <PortalButton type="submit">Tutor Ready</PortalButton>
      </form>
    </PortalCard>
  );
}

function AttendanceForm({ lesson, onSubmit }: { lesson: RecordMap; onSubmit: (form: HTMLFormElement) => void }) {
  return (
    <PortalCard title="Attendance" eyebrow="Lesson Record">
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); onSubmit(event.currentTarget); }}>
        <PortalSelect id="tutorAttendance" label="Tutor attendance" required options={attendanceOptions} defaultValue={lesson.tutorAttendance ?? "Present"} />
        <PortalSelect id="studentAttendance" label="Student attendance" required options={attendanceOptions} defaultValue={lesson.studentAttendance ?? "Not Recorded"} />
        <PortalInput id="arrivalTime" label="Arrival time" type="datetime-local" defaultValue={dateTimeLocalInput(lesson.arrivalTime)} />
        <PortalInput id="minutesLate" label="Minutes late" type="number" min="0" max="600" defaultValue={lesson.minutesLate ?? ""} />
        <PortalInput id="absenceReason" label="Absence reason" defaultValue={lesson.absenceReason ?? ""} />
        <PortalTextarea id="attendanceNotes" label="Attendance notes" defaultValue={lesson.attendanceNotes ?? ""} />
        <PortalButton type="submit">Save Attendance</PortalButton>
      </form>
    </PortalCard>
  );
}

function DailyReportForm({ lesson, onSubmit }: { lesson: RecordMap; onSubmit: (form: HTMLFormElement) => void }) {
  return (
    <PortalCard title="Daily Lesson Report" eyebrow="Academic Continuity">
      <form className="grid gap-5 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); onSubmit(event.currentTarget); }}>
        <input type="hidden" name="lessonId" value={lesson.id} />
        <PortalSelect id="studentId" label="Student" required defaultValue={lesson.report?.studentId ?? lesson.studentId}>
          {(lesson.students?.length ? lesson.students : [lesson.student]).map((student: RecordMap) => (
            <option key={student.id} value={student.id}>{student.fullName}</option>
          ))}
        </PortalSelect>
        <PortalInput id="topicCovered" label="Topic covered" required defaultValue={lesson.report?.topicCovered ?? ""} />
        <PortalTextarea id="lessonSummary" label="Lesson summary" required defaultValue={lesson.report?.lessonSummary ?? ""} />
        <PortalSelect id="studentUnderstanding" label="Student understanding" required options={understandingOptions} defaultValue={lesson.report?.studentUnderstanding ?? ""} />
        <PortalSelect id="studentParticipation" label="Student engagement" required options={engagementOptions} defaultValue={lesson.report?.studentParticipation ?? ""} />
        <PortalTextarea id="strengthsObserved" label="Strengths observed" defaultValue={lesson.report?.strengthsObserved ?? ""} />
        <PortalTextarea id="areasNeedingSupport" label="Areas requiring support" defaultValue={lesson.report?.areasNeedingSupport ?? ""} />
        <PortalTextarea id="homeworkOrTaskGiven" label="Homework assigned" defaultValue={lesson.report?.homeworkOrTaskGiven ?? ""} />
        <PortalInput id="homeworkDueDate" label="Homework due date" type="date" defaultValue={dateInput(lesson.report?.homeworkDueDate)} />
        <PortalTextarea id="nextLessonRecommendation" label="Next lesson recommendation" defaultValue={lesson.report?.nextLessonRecommendation ?? ""} />
        <PortalTextarea id="resourcesRequired" label="Resources required" defaultValue={lesson.report?.resourcesRequired ?? ""} />
        <PortalTextarea id="parentFriendlyUpdate" label="Parent-friendly update" required defaultValue={lesson.report?.parentFriendlyUpdate ?? ""} />
        <PortalSelect id="technicalIssuesReported" label="Technical issues" options={["No", "Yes"]} defaultValue={lesson.report?.technicalIssuesReported ? "Yes" : "No"} />
        <PortalTextarea id="technicalIssueDetails" label="Technical issue details" defaultValue={lesson.report?.technicalIssueDetails ?? ""} />
        <PortalSelect id="safeguardingConcernRaised" label="Safeguarding or welfare concern" options={["No", "Yes"]} defaultValue={lesson.report?.safeguardingConcernRaised ? "Yes" : "No"} />
        <PortalTextarea id="safeguardingConcernDetails" label="Safeguarding concern details" />
        <PortalTextarea id="internalTutorNotes" label="Internal tutor notes" defaultValue={lesson.report?.internalTutorNotes ?? ""} />
        <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-navy">
          <input type="hidden" name="parentVisible" value="false" />
          <input name="parentVisible" type="checkbox" value="true" defaultChecked={lesson.report?.parentVisible ?? true} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold focus:ring-gold" />
          <span>Parent-friendly content may be visible to parents</span>
        </label>
        <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-navy md:col-span-2">
          <input name="tutorDeclaration" type="checkbox" required defaultChecked={lesson.report?.tutorDeclaration ?? false} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold focus:ring-gold" />
          <span>I confirm that this report accurately reflects the lesson delivered.</span>
        </label>
        <div className="md:col-span-2">
          <PortalAlert title="Safeguarding reminder" tone="warning">
            Safeguarding concerns are stored separately with restricted access and trigger urgent TutorHiveHub administration alerts.
          </PortalAlert>
        </div>
        <div className="md:col-span-2">
          <PortalButton type="submit">Submit Daily Lesson Report</PortalButton>
        </div>
      </form>
    </PortalCard>
  );
}

function ReportsOverview() {
  const [view, setView] = useState("outstanding");
  const [reports, setReports] = useState<RecordMap[]>([]);
  const [lessons, setLessons] = useState<RecordMap[]>([]);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  async function loadReports(nextView = view) {
    setStatus("loading");
    setMessage("");
    try {
      const result = await portalApi<{ reports: RecordMap[]; lessons: RecordMap[] }>(`/api/portal/lesson-reports?view=${encodeURIComponent(nextView)}`);
      setReports(result.reports ?? []);
      setLessons(result.lessons ?? []);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load lesson reports.");
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  function changeView(nextView: string) {
    setView(nextView);
    void loadReports(nextView);
  }

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Daily Lesson Reports"
        eyebrow="Academic Continuity"
        action={
          <PortalButton type="button" variant="ghost" onClick={() => loadReports()}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </PortalButton>
        }
      >
        <div className="mb-6 flex flex-wrap gap-2">
          {["outstanding", "overdue", "submitted"].map((item) => (
            <button key={item} type="button" className={`rounded-md px-4 py-2 text-sm font-black ${view === item ? "bg-gold text-navy" : "border border-slate-200 bg-white text-navy"}`} onClick={() => changeView(item)}>
              {item === "outstanding" ? "Outstanding" : item === "overdue" ? "Overdue" : "Submitted"}
            </button>
          ))}
        </div>
        {status === "loading" && <PortalLoadingSkeleton rows={6} />}
        {status === "error" && <PortalAlert title="Could not load reports" tone="error">{message}</PortalAlert>}
        {status === "success" && view !== "submitted" && lessons.length === 0 && <PortalEmptyState title="No outstanding lesson reports" message="Completed lessons with missing reports will appear here." />}
        {status === "success" && view !== "submitted" && lessons.length > 0 && <LessonTableForReports lessons={lessons} />}
        {status === "success" && view === "submitted" && reports.length === 0 && <PortalEmptyState title="No submitted reports" message="Submitted daily lesson reports will appear here." />}
        {status === "success" && view === "submitted" && reports.length > 0 && <ReportTable reports={reports} />}
      </PortalCard>
    </div>
  );
}

function LessonTableForReports({ lessons }: { lessons: RecordMap[] }) {
  return (
    <PortalTable
      columns={["Lesson", "Tutor", "Attendance", "Status", "Action"]}
      rows={lessons.map((lesson) => [
        <div>
          <p className="font-black text-navy">{names(lesson.students?.length ? lesson.students : [lesson.student])}</p>
          <p className="text-xs font-bold text-slate-500">{lesson.subject?.name} - {dateText(lesson.scheduledStart)}</p>
        </div>,
        lesson.replacementTutor ? `${lesson.replacementTutor.fullName} (replacement)` : lesson.tutor?.fullName || "-",
        [lesson.studentAttendance, lesson.minutesLate ? `${lesson.minutesLate} minutes late` : null].filter(Boolean).join(" - ") || "-",
        <PortalBadge tone="warning">Report Outstanding</PortalBadge>,
        <a href={`/portal/lesson-reports/lesson/${lesson.id}`} className="rounded-md bg-gold px-3 py-2 text-xs font-black text-navy transition hover:bg-gold-100">Complete Report</a>,
      ])}
    />
  );
}

function ReportTable({ reports }: { reports: RecordMap[] }) {
  return (
    <PortalTable
      columns={["Report", "Tutor", "Understanding", "Engagement", "Submitted", "Actions"]}
      rows={reports.map((report) => [
        <div>
          <p className="font-black text-navy">{report.student?.fullName || report.lesson?.student?.fullName}</p>
          <p className="text-xs font-bold text-slate-500">{report.lesson?.subject?.name} - {report.topicCovered}</p>
        </div>,
        report.tutor?.fullName || report.lesson?.tutor?.fullName || "-",
        report.studentUnderstanding,
        report.studentParticipation,
        dateText(report.submittedAt),
        <a href={`/portal/lesson-reports/${report.id}`} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50">View</a>,
      ])}
    />
  );
}

function ReportProfile({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<RecordMap | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    portalApi<{ report: RecordMap }>(`/api/portal/lesson-reports/${reportId}`)
      .then((result) => {
        setReport(result.report);
        setStatus("success");
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Could not load report.");
      });
  }, [reportId]);

  if (status === "loading") return <PortalLoadingSkeleton rows={7} />;
  if (status === "error" || !report) return <PortalAlert title="Could not load report" tone="error">{message}</PortalAlert>;

  const exportText = reportExportText(report);

  return (
    <PortalCard
      title="Daily Lesson Report"
      eyebrow={dateText(report.lesson?.scheduledStart)}
      action={
        <div className="flex flex-wrap gap-2">
          <PortalButton type="button" variant="ghost" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print
          </PortalButton>
          <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-gold-100" onClick={() => exportReport(exportText, report)}>
            <FileText className="h-4 w-4" aria-hidden="true" />
            Export
          </button>
        </div>
      }
    >
      <DetailGrid
        items={[
          ["Student", report.student?.fullName || report.lesson?.student?.fullName],
          ["Tutor", report.tutor?.fullName],
          ["Subject", report.lesson?.subject?.name],
          ["Topic", report.topicCovered],
          ["Understanding", report.studentUnderstanding],
          ["Engagement", report.studentParticipation],
          ["Summary", report.lessonSummary],
          ["Strengths", report.strengthsObserved],
          ["Areas requiring support", report.areasNeedingSupport],
          ["Homework", report.homeworkOrTaskGiven],
          ["Homework due", dateText(report.homeworkDueDate)],
          ["Next lesson recommendation", report.nextLessonRecommendation],
          ["Resources required", report.resourcesRequired],
          ["Parent-friendly update", report.parentFriendlyUpdate],
          ["Technical issues", report.technicalIssuesReported ? report.technicalIssueDetails || "Yes" : "No"],
          ["Internal tutor notes", report.internalTutorNotes],
          ["Safeguarding", report.safeguardingConcernRaised ? "Restricted safeguarding concern recorded" : "No concern recorded"],
        ]}
      />
    </PortalCard>
  );
}

function TimelineCard({ timeline }: { timeline: RecordMap[] }) {
  return (
    <PortalCard title="Student Academic Timeline" eyebrow="Chronological Record">
      {timeline.length === 0 ? (
        <PortalEmptyState title="No previous timeline entries" message="Submitted lesson reports will build this student timeline." />
      ) : (
        <div className="grid gap-4">
          {timeline.map((item) => (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-navy">{item.topic}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">{dateText(item.lessonDate)} - {item.tutor} - {item.subject}</p>
                </div>
                <PortalBadge tone="neutral">{item.attendance || "Attendance not recorded"}</PortalBadge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-650">{item.summary}</p>
              <p className="mt-3 text-sm"><span className="font-black text-navy">Homework:</span> {item.homework || "-"}</p>
              <p className="mt-1 text-sm"><span className="font-black text-navy">Next steps:</span> {item.nextSteps || "-"}</p>
            </article>
          ))}
        </div>
      )}
    </PortalCard>
  );
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

function reportExportText(report: RecordMap) {
  return [
    "TutorHiveHub Daily Lesson Report",
    `Student: ${report.student?.fullName || report.lesson?.student?.fullName || "-"}`,
    `Tutor: ${report.tutor?.fullName || "-"}`,
    `Subject: ${report.lesson?.subject?.name || "-"}`,
    `Date: ${dateText(report.lesson?.scheduledStart)}`,
    `Topic: ${report.topicCovered || "-"}`,
    `Summary: ${report.lessonSummary || "-"}`,
    `Understanding: ${report.studentUnderstanding || "-"}`,
    `Engagement: ${report.studentParticipation || "-"}`,
    `Strengths: ${report.strengthsObserved || "-"}`,
    `Support Needed: ${report.areasNeedingSupport || "-"}`,
    `Homework: ${report.homeworkOrTaskGiven || "-"}`,
    `Next Steps: ${report.nextLessonRecommendation || "-"}`,
    `Parent Update: ${report.parentFriendlyUpdate || "-"}`,
  ].join("\n");
}

function exportReport(text: string, report: RecordMap) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tutorhivehub-lesson-report-${report.id}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function homeworkSummary(items: RecordMap[] = []) {
  if (!items.length) return "-";
  return items.map((item) => `${item.title}${item.dueDate ? ` due ${dateText(item.dueDate)}` : ""}`).join("; ");
}

function names(items: RecordMap[] = []) {
  return items.map((item) => item?.fullName || item?.name).filter(Boolean).join(", ") || "-";
}

function labelStatus(status: string) {
  return String(status || "").replace(/_/g, " ");
}

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED" || status === "STUDENT_ABSENT" || status === "TUTOR_ABSENT") return "danger";
  if (status === "TUTOR_READY" || status === "IN_PROGRESS") return "warning";
  return "neutral";
}

function dateInput(value?: string | null) {
  return value ? formatDate(new Date(value)) : "";
}

function dateTimeLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return `${formatDate(date)}T${timeInput(value)}`;
}

function timeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function timeRange(lesson: RecordMap) {
  return `${timeInput(lesson.scheduledStart)} - ${timeInput(lesson.scheduledEnd)}`;
}

function dateText(value?: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value)) : "-";
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
