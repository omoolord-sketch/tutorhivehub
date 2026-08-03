import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { BarChart3, ClipboardCheck, Download, RefreshCcw } from "lucide-react";
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

export function ReportsRoute() {
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [report, setReport] = useState<RecordMap | null>(null);
  const [performance, setPerformance] = useState<RecordMap[]>([]);
  const [query, setQuery] = useState<RecordMap>({});

  async function loadReports(nextQuery = query) {
    setStatus("loading");
    setMessage("");
    try {
      const search = queryString(nextQuery);
      const [reportResult, performanceResult] = await Promise.all([
        portalApi<{ report: RecordMap }>(`/api/portal/reports/summary${search}`),
        portalApi<{ performance: RecordMap[] }>(`/api/portal/tutor-performance${search}`),
      ]);
      setReport(reportResult.report);
      setPerformance(performanceResult.performance);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load management reports.");
    }
  }

  useEffect(() => {
    void loadReports({});
  }, []);

  function applyFilters(form: HTMLFormElement) {
    const nextQuery = formPayload(form);
    setQuery(nextQuery);
    void loadReports(nextQuery);
  }

  if (status === "loading") return <PortalLoadingSkeleton rows={8} />;
  if (status === "error" || !report) return <PortalAlert title="Could not load reports" tone="error">{message}</PortalAlert>;

  const exportQuery = queryString(query);
  const metrics = report.metrics ?? {};

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Management Reporting"
        eyebrow="Quality, Operations, and Finance"
        action={
          <PortalButton type="button" variant="ghost" onClick={() => loadReports()}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </PortalButton>
        }
      >
        <ReportFilters lookups={report.lookups ?? {}} onSubmit={applyFilters} />
        <div className="mt-5 flex flex-wrap gap-2">
          <DownloadLink href={`/api/portal/reports/export.csv${exportQuery}`} label="CSV Export" />
          <DownloadLink href={`/api/portal/reports/export.pdf${exportQuery}`} label="PDF Export" />
        </div>
      </PortalCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Metric label="Active students" value={metrics.activeStudents} />
        <Metric label="Active tutors" value={metrics.activeTutors} />
        <Metric label="Lessons scheduled" value={metrics.lessonsScheduled} />
        <Metric label="Lessons completed" value={metrics.lessonsCompleted} />
        <Metric label="Outstanding reports" value={metrics.outstandingLessonReports} tone={metrics.outstandingLessonReports ? "warning" : "success"} />
        <Metric label="Revenue" value={money(metrics.revenue)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PortalCard title="Attendance" eyebrow="Lesson Delivery">
          <PortalTable columns={["Metric", "Count"]} rows={Object.entries(report.attendance ?? {}).map(([key, value]) => [statusLabel(key), String(value)])} />
        </PortalCard>
        <PortalCard title="Finance and Support" eyebrow="Management Summary">
          <div className="grid gap-3 md:grid-cols-2">
            <Metric label="Invoices issued" value={metrics.invoicesIssued} />
            <Metric label="Outstanding balances" value={money(metrics.outstandingBalances)} />
            <Metric label="Payments received" value={money(metrics.paymentsReceived)} />
            <Metric label="Support requests" value={metrics.supportRequests} />
            <Metric label="Technical incidents" value={metrics.technicalIncidents} tone={metrics.technicalIncidents ? "warning" : "success"} />
            <Metric label="Tutor payroll approved" value={money(metrics.tutorPayrollApproved)} />
          </div>
        </PortalCard>
      </div>

      <PortalCard title="Tutor Workload" eyebrow="Internal">
        <PortalTable
          columns={["Tutor", "Assigned", "Completed", "Hours", "Report Rate", "Payroll"]}
          rows={(report.tutorWorkload ?? []).map((item: RecordMap) => [
            item.tutor?.fullName || "-",
            String(item.lessonsAssigned ?? 0),
            String(item.lessonsCompleted ?? 0),
            String(item.hours ?? 0),
            `${item.reportSubmissionRate ?? 0}%`,
            money(item.payroll),
          ])}
        />
      </PortalCard>

      <PortalCard title="Tutor Performance Indicators" eyebrow="Not Visible to Parents or Students">
        {performance.length === 0 ? (
          <PortalEmptyState title="No tutor performance data" message="Indicators appear after tutors have lessons, reports, homework, or quality reviews." />
        ) : (
          <PortalTable
            columns={["Tutor", "Attendance", "Punctuality", "Reports", "Homework Feedback", "Retention", "Complaints"]}
            rows={performance.map((item) => [
              item.tutor?.fullName || "-",
              `${item.attendanceRate}%`,
              `${item.punctualityRate}%`,
              `${item.reportSubmissionRate}%`,
              `${item.homeworkFeedbackRate}%`,
              `${item.studentRetention}%`,
              String(item.complaints ?? 0),
            ])}
          />
        )}
      </PortalCard>
    </div>
  );
}

function ReportFilters({ lookups, onSubmit }: { lookups: RecordMap; onSubmit: (form: HTMLFormElement) => void }) {
  return (
    <form className="grid gap-4 md:grid-cols-4" onSubmit={(event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit(event.currentTarget);
    }}>
      <PortalInput id="startDate" label="Start date" type="date" />
      <PortalInput id="endDate" label="End date" type="date" />
      <PortalSelect id="studentId" label="Student">
        <option value="">All students</option>
        {(lookups.students ?? []).map((student: RecordMap) => <option key={student.id} value={student.id}>{student.fullName}</option>)}
      </PortalSelect>
      <PortalSelect id="parentId" label="Parent">
        <option value="">All parents</option>
        {(lookups.parents ?? []).map((parent: RecordMap) => <option key={parent.id} value={parent.id}>{parent.fullName}</option>)}
      </PortalSelect>
      <PortalSelect id="tutorId" label="Tutor">
        <option value="">All tutors</option>
        {(lookups.tutors ?? []).map((tutor: RecordMap) => <option key={tutor.id} value={tutor.id}>{tutor.fullName}</option>)}
      </PortalSelect>
      <PortalSelect id="subjectId" label="Subject">
        <option value="">All subjects</option>
        {(lookups.subjects ?? []).map((subject: RecordMap) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
      </PortalSelect>
      <PortalSelect id="examPathway" label="Exam pathway">
        <option value="">All pathways</option>
        {(lookups.examPathways ?? []).map((pathway: string) => <option key={pathway} value={pathway}>{pathway}</option>)}
      </PortalSelect>
      <PortalSelect id="status" label="Status">
        <option value="">All statuses</option>
        {(lookups.reportStatuses ?? []).map((item: string) => <option key={item} value={item}>{statusLabel(item)}</option>)}
      </PortalSelect>
      <div className="md:col-span-4">
        <PortalButton type="submit">
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          Apply Filters
        </PortalButton>
      </div>
    </form>
  );
}

export function QualityRoute() {
  const [status, setStatus] = useState<LoadState>("loading");
  const [submitStatus, setSubmitStatus] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const [lookups, setLookups] = useState<RecordMap>({});
  const [records, setRecords] = useState<RecordMap>({});

  async function loadQuality() {
    setStatus("loading");
    setMessage("");
    try {
      const [lookupsResult, observations, reviews, training, policies, plans] = await Promise.all([
        portalApi<RecordMap>("/api/portal/quality/lookups"),
        portalApi<{ records: RecordMap[] }>("/api/portal/quality/observations"),
        portalApi<{ records: RecordMap[] }>("/api/portal/quality/tutor-reviews"),
        portalApi<{ records: RecordMap[] }>("/api/portal/quality/training-records"),
        portalApi<{ records: RecordMap[] }>("/api/portal/quality/policy-acknowledgements"),
        portalApi<{ records: RecordMap[] }>("/api/portal/quality/improvement-plans"),
      ]);
      setLookups(lookupsResult);
      setRecords({ observations: observations.records, reviews: reviews.records, training: training.records, policies: policies.records, plans: plans.records });
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load quality assurance records.");
    }
  }

  useEffect(() => {
    void loadQuality();
  }, []);

  async function submit(endpoint: string, form: HTMLFormElement, successMessage: string) {
    setSubmitStatus("loading");
    setMessage("");
    try {
      await portalApi<RecordMap>(endpoint, { method: "POST", body: JSON.stringify(formPayload(form)) });
      form.reset();
      setSubmitStatus("success");
      setMessage(successMessage);
      await loadQuality();
    } catch (error) {
      setSubmitStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save quality record.");
    }
  }

  if (status === "loading") return <PortalLoadingSkeleton rows={8} />;
  if (status === "error") return <PortalAlert title="Could not load quality assurance" tone="error">{message}</PortalAlert>;

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Quality Assurance"
        eyebrow="Internal Controls"
        action={
          <PortalButton type="button" variant="ghost" onClick={loadQuality}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </PortalButton>
        }
      >
        <PortalAlert title="Internal quality records are restricted" tone="info">
          Observations, tutor reviews, training, policy acknowledgements, and improvement plans are staff-only and are never exposed to parents or students.
        </PortalAlert>
      </PortalCard>

      {message && <PortalAlert title={submitStatus === "error" ? "Quality action failed" : "Quality action saved"} tone={submitStatus === "error" ? "error" : "success"}>{message}</PortalAlert>}

      <div className="grid gap-6 xl:grid-cols-2">
        <PortalCard title="Lesson Observation" eyebrow="QA Record">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            submit("/api/portal/quality/observations", event.currentTarget, "Lesson observation saved.");
          }}>
            <TutorSelect tutors={lookups.tutors ?? []} />
            <PortalSelect id="lessonId" label="Linked lesson">
              <option value="">No linked lesson</option>
              {(lookups.lessons ?? []).map((lesson: RecordMap) => <option key={lesson.id} value={lesson.id}>{lesson.label}</option>)}
            </PortalSelect>
            <PortalInput id="observationDate" label="Observation date" type="date" required />
            <PortalInput id="focusArea" label="Focus area" />
            <PortalInput id="rating" label="Rating" />
            <StatusSelect options={lookups.qualityStatuses ?? []} />
            <PortalTextarea id="strengths" label="Strengths" className="md:col-span-2" />
            <PortalTextarea id="improvementAreas" label="Improvement areas" className="md:col-span-2" />
            <PortalTextarea id="reviewerNotes" label="Reviewer notes" className="md:col-span-2" />
            <PortalInput id="nextReviewDate" label="Next review date" type="date" />
            <SubmitButton label="Save Observation" loading={submitStatus === "loading"} />
          </form>
        </PortalCard>

        <PortalCard title="Tutor Review" eyebrow="Performance Review">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            submit("/api/portal/quality/tutor-reviews", event.currentTarget, "Tutor review saved.");
          }}>
            <TutorSelect tutors={lookups.tutors ?? []} />
            <PortalInput id="reviewDate" label="Review date" type="date" required />
            {["lessonsAssigned", "lessonsCompleted", "attendanceRate", "punctualityRate", "reportSubmissionRate", "homeworkFeedbackRate", "studentRetention", "complaints"].map((field) => (
              <PortalInput key={field} id={field} label={statusLabel(field)} type="number" min="0" step="0.01" />
            ))}
            <PortalInput id="rating" label="Rating" />
            <PortalInput id="nextReviewDate" label="Next review date" type="date" />
            <StatusSelect options={lookups.qualityStatuses ?? []} />
            <PortalTextarea id="qualityReviewNotes" label="Quality-review notes" className="md:col-span-2" />
            <SubmitButton label="Save Tutor Review" loading={submitStatus === "loading"} />
          </form>
        </PortalCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SimpleQualityForm
          title="Training Record"
          endpoint="/api/portal/quality/training-records"
          submit={submit}
          lookups={lookups}
          fields={["title", "provider", "trainingDate", "completionDate", "expiryDate", "notes"]}
          statusOptions={lookups.trainingStatuses ?? []}
          loading={submitStatus === "loading"}
        />
        <PolicyForm lookups={lookups} submit={submit} loading={submitStatus === "loading"} />
        <SimpleQualityForm
          title="Improvement Plan"
          endpoint="/api/portal/quality/improvement-plans"
          submit={submit}
          lookups={lookups}
          fields={["title", "concernSummary", "requiredActions", "supportOffered", "dueDate", "reviewDate", "reviewerNotes"]}
          statusOptions={lookups.qualityStatuses ?? []}
          loading={submitStatus === "loading"}
        />
      </div>

      <QualityLists records={records} />
    </div>
  );
}

function SimpleQualityForm({ title, endpoint, submit, lookups, fields, statusOptions, loading }: { title: string; endpoint: string; submit: (endpoint: string, form: HTMLFormElement, successMessage: string) => void; lookups: RecordMap; fields: string[]; statusOptions: string[]; loading: boolean }) {
  return (
    <PortalCard title={title} eyebrow="QA Record">
      <form className="grid gap-4" onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        submit(endpoint, event.currentTarget, `${title} saved.`);
      }}>
        <TutorSelect tutors={lookups.tutors ?? []} />
        {fields.map((field) => isTextAreaField(field) ? (
          <PortalTextarea key={field} id={field} label={statusLabel(field)} />
        ) : (
          <PortalInput key={field} id={field} label={statusLabel(field)} type={field.toLowerCase().includes("date") ? "date" : "text"} required={field === "title"} />
        ))}
        <StatusSelect options={statusOptions} />
        <SubmitButton label={`Save ${title}`} loading={loading} />
      </form>
    </PortalCard>
  );
}

function PolicyForm({ lookups, submit, loading }: { lookups: RecordMap; submit: (endpoint: string, form: HTMLFormElement, successMessage: string) => void; loading: boolean }) {
  return (
    <PortalCard title="Policy Acknowledgement" eyebrow="Compliance">
      <form className="grid gap-4" onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        submit("/api/portal/quality/policy-acknowledgements", event.currentTarget, "Policy acknowledgement saved.");
      }}>
        <PortalSelect id="userId" label="User" required>
          <option value="">Select user</option>
          {(lookups.users ?? []).map((user: RecordMap) => <option key={user.id} value={user.id}>{user.name} - {user.email}</option>)}
        </PortalSelect>
        <PortalInput id="policyName" label="Policy name" required />
        <PortalInput id="policyVersion" label="Policy version" required />
        <PortalInput id="acknowledgedAt" label="Acknowledged at" type="datetime-local" />
        <PortalTextarea id="notes" label="Notes" />
        <SubmitButton label="Save Acknowledgement" loading={loading} />
      </form>
    </PortalCard>
  );
}

function QualityLists({ records }: { records: RecordMap }) {
  const sections = [
    { title: "Observations", items: records.observations ?? [], dateKey: "observationDate" },
    { title: "Tutor Reviews", items: records.reviews ?? [], dateKey: "reviewDate" },
    { title: "Training", items: records.training ?? [], dateKey: "completionDate" },
    { title: "Policies", items: records.policies ?? [], dateKey: "acknowledgedAt" },
    { title: "Improvement Plans", items: records.plans ?? [], dateKey: "dueDate" },
  ];
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {sections.map((section) => (
        <PortalCard key={section.title} title={section.title} eyebrow={`${section.items.length} record${section.items.length === 1 ? "" : "s"}`}>
          {section.items.length === 0 ? (
            <PortalEmptyState title={`No ${section.title.toLowerCase()} yet`} message="Records will appear here after they are saved." />
          ) : (
            <PortalTable
              columns={["Person", "Status", "Date", "Notes"]}
              rows={section.items.slice(0, 8).map((item: RecordMap) => [
                item.tutor?.fullName || item.user?.name || "-",
                <PortalBadge tone={item.status === "COMPLETED" ? "success" : "warning"}>{statusLabel(item.status || "Recorded")}</PortalBadge>,
                dateText(item[section.dateKey]),
                item.reviewerNotes || item.qualityReviewNotes || item.notes || item.policyName || "-",
              ])}
            />
          )}
        </PortalCard>
      ))}
    </div>
  );
}

export function SecurityRoute({ currentUser }: { currentUser: PortalUser }) {
  const [status, setStatus] = useState<LoadState>("loading");
  const [submitStatus, setSubmitStatus] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const [security, setSecurity] = useState<RecordMap | null>(null);
  const [logs, setLogs] = useState<RecordMap[]>([]);
  const [dataProtection, setDataProtection] = useState<RecordMap>({});
  const [lookups, setLookups] = useState<RecordMap>({});

  async function loadSecurity() {
    setStatus("loading");
    setMessage("");
    try {
      const [securityResult, logsResult, dataResult, reportResult] = await Promise.all([
        portalApi<{ security: RecordMap }>("/api/portal/security/status"),
        portalApi<{ logs: RecordMap[] }>("/api/portal/audit-logs"),
        portalApi<RecordMap>("/api/portal/data-protection"),
        portalApi<{ report: RecordMap }>("/api/portal/reports/summary"),
      ]);
      setSecurity(securityResult.security);
      setLogs(logsResult.logs);
      setDataProtection(dataResult);
      setLookups({
        ...(reportResult.report?.lookups ?? {}),
        users: dataResult.users ?? [],
        parents: dataResult.parents ?? reportResult.report?.lookups?.parents ?? [],
        students: dataResult.students ?? reportResult.report?.lookups?.students ?? [],
      });
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load security and deployment records.");
    }
  }

  useEffect(() => {
    void loadSecurity();
  }, []);

  async function submit(endpoint: string, form: HTMLFormElement, successMessage: string) {
    setSubmitStatus("loading");
    setMessage("");
    try {
      await portalApi<RecordMap>(endpoint, { method: "POST", body: JSON.stringify(formPayload(form)) });
      form.reset();
      setSubmitStatus("success");
      setMessage(successMessage);
      await loadSecurity();
    } catch (error) {
      setSubmitStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save security record.");
    }
  }

  if (status === "loading") return <PortalLoadingSkeleton rows={8} />;
  if (status === "error" || !security) return <PortalAlert title="Could not load security" tone="error">{message}</PortalAlert>;

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Security and Deployment"
        eyebrow="Final Readiness"
        action={
          <PortalButton type="button" variant="ghost" onClick={loadSecurity}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </PortalButton>
        }
      >
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Audit logs" value={security.totals?.auditCount} />
          <Metric label="Active sessions" value={security.totals?.activeSessions} />
          <Metric label="Data requests" value={security.totals?.pendingDataRequests} tone={security.totals?.pendingDataRequests ? "warning" : "success"} />
          <Metric label="Safeguarding open" value={security.totals?.openSafeguarding} tone={security.totals?.openSafeguarding ? "warning" : "success"} />
        </div>
      </PortalCard>

      {message && <PortalAlert title={submitStatus === "error" ? "Security action failed" : "Security action saved"} tone={submitStatus === "error" ? "error" : "success"}>{message}</PortalAlert>}

      <div className="grid gap-6 xl:grid-cols-2">
        <ChecklistCard title="Security Checklist" items={security.checklist ?? []} />
        <ChecklistCard title="Deployment Checklist" items={security.deployment ?? []} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <PortalCard title="Record Consent" eyebrow="Data Protection">
          <form className="grid gap-4" onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            submit("/api/portal/data-protection/consents", event.currentTarget, "Consent recorded.");
          }}>
            <UserSelect id="userId" label="User" users={lookups.users ?? []} />
            <ParentSelect parents={lookups.parents ?? []} />
            <StudentSelect students={lookups.students ?? []} />
            <PortalInput id="consentType" label="Consent type" required />
            <PortalSelect id="granted" label="Granted" defaultValue="true">
              <option value="true">Yes</option>
              <option value="false">No</option>
            </PortalSelect>
            <PortalInput id="legalBasis" label="Legal basis" />
            <PortalInput id="expiryDate" label="Expiry date" type="date" />
            <PortalTextarea id="notes" label="Notes" />
            <SubmitButton label="Record Consent" loading={submitStatus === "loading"} />
          </form>
        </PortalCard>

        <PortalCard title="Retention Rule" eyebrow="Data Retention">
          <form className="grid gap-4" onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            submit("/api/portal/data-protection/retention", event.currentTarget, "Retention rule saved.");
          }}>
            <PortalInput id="recordType" label="Record type" required />
            <PortalInput id="retentionMonths" label="Retention months" type="number" min="1" required />
            <PortalSelect id="action" label="Action" options={dataProtection.retentionActions ?? []} required />
            <PortalInput id="legalBasis" label="Legal basis" />
            <PortalSelect id="active" label="Active" defaultValue="true">
              <option value="true">Yes</option>
              <option value="false">No</option>
            </PortalSelect>
            <PortalTextarea id="notes" label="Notes" />
            <SubmitButton label="Save Rule" loading={submitStatus === "loading"} />
          </form>
        </PortalCard>

        <PortalCard title="Data Request" eyebrow="Export or Anonymisation Workflow">
          <form className="grid gap-4" onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            submit("/api/portal/data-protection/requests", event.currentTarget, "Data protection request created.");
          }}>
            <UserSelect users={lookups.users ?? []} />
            <ParentSelect parents={lookups.parents ?? []} />
            <StudentSelect students={lookups.students ?? []} />
            <PortalSelect id="requestType" label="Request type" options={dataProtection.dataRequestTypes ?? []} required />
            <PortalSelect id="status" label="Status" options={dataProtection.dataRequestStatuses ?? []} required />
            <PortalInput id="dueAt" label="Due date" type="date" />
            <PortalTextarea id="scope" label="Scope" />
            <PortalTextarea id="internalNotes" label="Internal notes" />
            <SubmitButton label="Create Request" loading={submitStatus === "loading"} />
          </form>
        </PortalCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PortalCard title="Data Protection Requests" eyebrow="Workflow">
          <PortalTable
            columns={["Type", "Subject", "Status", "Due"]}
            rows={(dataProtection.requests ?? []).slice(0, 10).map((item: RecordMap) => [
              statusLabel(item.requestType),
              item.parent?.fullName || item.student?.fullName || item.requester?.name || "-",
              <PortalBadge tone={item.status === "COMPLETED" ? "success" : "warning"}>{statusLabel(item.status)}</PortalBadge>,
              dateText(item.dueAt),
            ])}
          />
        </PortalCard>

        <PortalCard title="Audit Logs" eyebrow="Immutable Records">
          <div className="mb-4 flex flex-wrap gap-2">
            <DownloadLink href="/api/portal/audit-logs/export.csv" label="CSV Export" />
            <DownloadLink href="/api/portal/audit-logs/export.pdf" label="PDF Export" />
          </div>
          <PortalTable
            columns={["Date", "Actor", "Action", "Entity"]}
            rows={logs.slice(0, 12).map((log) => [
              dateTimeText(log.createdAt),
              log.actor?.email || "-",
              log.action,
              `${log.entityType}${log.entityId ? ` ${log.entityId}` : ""}`,
            ])}
          />
        </PortalCard>
      </div>
    </div>
  );
}

function ChecklistCard({ title, items }: { title: string; items: RecordMap[] }) {
  return (
    <PortalCard title={title} eyebrow="Readiness">
      <div className="grid gap-3">
        {items.map((item) => (
          <div key={item.area || item.item} className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <PortalBadge tone={item.status || item.done ? "success" : "warning"}>{item.status || item.done ? "Ready" : "Action"}</PortalBadge>
            <div>
              <p className="font-black text-navy">{item.area || item.item}</p>
              <p className="mt-1 text-sm leading-6 text-slate-650">{item.detail || "Review before production release."}</p>
            </div>
          </div>
        ))}
      </div>
    </PortalCard>
  );
}

function TutorSelect({ tutors }: { tutors: RecordMap[] }) {
  return (
    <PortalSelect id="tutorId" label="Tutor" required>
      <option value="">Select tutor</option>
      {tutors.map((tutor) => <option key={tutor.id} value={tutor.id}>{tutor.fullName}</option>)}
    </PortalSelect>
  );
}

function UserSelect({ users, id = "userId", label = "User" }: { users: RecordMap[]; id?: string; label?: string }) {
  return (
    <PortalSelect id={id} label={label}>
      <option value="">No user</option>
      {users.map((user) => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}
    </PortalSelect>
  );
}

function ParentSelect({ parents }: { parents: RecordMap[] }) {
  return (
    <PortalSelect id="parentId" label="Parent">
      <option value="">No parent</option>
      {parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.fullName}</option>)}
    </PortalSelect>
  );
}

function StudentSelect({ students }: { students: RecordMap[] }) {
  return (
    <PortalSelect id="studentId" label="Student">
      <option value="">No student</option>
      {students.map((student) => <option key={student.id} value={student.id}>{student.fullName}</option>)}
    </PortalSelect>
  );
}

function StatusSelect({ options }: { options: string[] }) {
  return <PortalSelect id="status" label="Status" required options={options} />;
}

function SubmitButton({ label, loading }: { label: string; loading: boolean }) {
  return (
    <div className="md:col-span-2">
      <PortalButton type="submit" disabled={loading}>
        <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
        {loading ? "Saving..." : label}
      </PortalButton>
    </div>
  );
}

function Metric({ label, value, tone = "gold" }: { label: string; value: ReactNode; tone?: "gold" | "success" | "warning" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-500">{label}</p>
        <PortalBadge tone={tone}>{tone === "success" ? "OK" : tone === "warning" ? "Review" : "Live"}</PortalBadge>
      </div>
      <p className="mt-3 text-2xl font-black text-navy">{value ?? 0}</p>
    </div>
  );
}

function DownloadLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:border-gold hover:bg-gold-50">
      <Download className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}

function formPayload(form: HTMLFormElement) {
  return Object.fromEntries(Array.from(new FormData(form).entries()).filter(([, value]) => String(value ?? "").trim() !== ""));
}

function queryString(values: RecordMap) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (String(value ?? "").trim()) query.set(key, String(value));
  }
  return query.size ? `?${query.toString()}` : "";
}

function isTextAreaField(field: string) {
  return ["notes", "concernSummary", "requiredActions", "supportOffered", "reviewerNotes"].includes(field);
}

function money(value: unknown, currency = "GBP") {
  const number = Number(value ?? 0);
  return `${currency} ${Number.isFinite(number) ? number.toFixed(2) : "0.00"}`;
}

function statusLabel(value?: string | null) {
  if (!value) return "-";
  return String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function dateText(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

function dateTimeText(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
