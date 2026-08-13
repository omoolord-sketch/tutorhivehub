import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Bell, CheckCircle2, Download, FileUp, GraduationCap, Plus, RefreshCcw, Send, UploadCloud } from "lucide-react";
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

type LearningLookups = {
  students?: RecordMap[];
  tutors?: RecordMap[];
  subjects?: RecordMap[];
  lessons?: RecordMap[];
  resources?: RecordMap[];
  homeworkStatuses?: string[];
  reviewStatuses?: string[];
  resourceTypes?: string[];
  resourceVisibility?: string[];
  resourceStatuses?: string[];
  goalStatuses?: string[];
};

export function HomeworkRoute({ currentUser }: { currentUser: PortalUser }) {
  const canManage = hasPortalPermission(currentUser, "homework:manage") || currentUser.role?.name === "Tutor";
  const canSubmit = currentUser.role?.name === "Student" && hasPortalPermission(currentUser, "own:homework");
  const [status, setStatus] = useState<LoadState>("loading");
  const [submitStatus, setSubmitStatus] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const [lookups, setLookups] = useState<LearningLookups>({});
  const [homework, setHomework] = useState<RecordMap[]>([]);
  const [filter, setFilter] = useState("");
  const initialHomeworkValues = useMemo(() => {
    const query = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
    return {
      studentId: query.get("studentId") ?? "",
      tutorId: query.get("tutorId") ?? "",
      subjectId: query.get("subjectId") ?? "",
      lessonId: query.get("lessonId") ?? "",
    };
  }, []);

  async function loadHomework() {
    setStatus("loading");
    setMessage("");
    try {
      const query = filter ? `?status=${encodeURIComponent(filter)}` : "";
      const [lookupsResult, homeworkResult] = await Promise.all([
        portalApi<LearningLookups>("/api/portal/learning/lookups"),
        portalApi<{ homework: RecordMap[] }>(`/api/portal/homework${query}`),
      ]);
      setLookups(lookupsResult);
      setHomework(homeworkResult.homework);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load homework and assignments.");
    }
  }

  useEffect(() => {
    void loadHomework();
  }, [filter]);

  async function submitHomeworkForm(form: HTMLFormElement) {
    setSubmitStatus("loading");
    setMessage("");
    try {
      await portalApi<RecordMap>("/api/portal/homework", { method: "POST", body: new FormData(form) });
      form.reset();
      setSubmitStatus("success");
      setMessage("Assignment saved successfully.");
      await loadHomework();
    } catch (error) {
      setSubmitStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save assignment.");
    }
  }

  async function publishHomework(homeworkId: string) {
    await runAction(`/api/portal/homework/${homeworkId}/publish`, "Assignment published successfully.");
  }

  async function submitStudentWork(homeworkId: string, form: HTMLFormElement) {
    setSubmitStatus("loading");
    setMessage("");
    try {
      await portalApi<RecordMap>(`/api/portal/homework/${homeworkId}/submit`, { method: "POST", body: new FormData(form) });
      form.reset();
      setSubmitStatus("success");
      setMessage("Assignment submitted successfully.");
      await loadHomework();
    } catch (error) {
      setSubmitStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not submit assignment.");
    }
  }

  async function reviewHomework(homeworkId: string, form: HTMLFormElement) {
    await runAction(`/api/portal/homework/${homeworkId}/review`, "Assignment feedback saved successfully.", formPayload(form));
    form.reset();
  }

  async function runAction(endpoint: string, successMessage: string, body?: RecordMap) {
    setSubmitStatus("loading");
    setMessage("");
    try {
      await portalApi<RecordMap>(endpoint, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      setSubmitStatus("success");
      setMessage(successMessage);
      await loadHomework();
    } catch (error) {
      setSubmitStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not update assignment.");
    }
  }

  if (status === "loading") return <PortalLoadingSkeleton rows={8} />;
  if (status === "error") return <PortalAlert title="Could not load homework and assignments" tone="error">{message}</PortalAlert>;

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Homework & Assignments"
        eyebrow="Learning Workflow"
        action={
          <PortalButton type="button" variant="ghost" onClick={loadHomework}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </PortalButton>
        }
      >
        <PortalAlert title="Tutor-set assignment workflow is active" tone="success">
          Tutors can set work at the end of a lesson, upload resources for pupils, pupils can download and submit answers, and admins can monitor the full process.
        </PortalAlert>
        <div className="mt-5 max-w-xs">
          <PortalSelect id="homeworkStatusFilter" label="Filter by status" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="">All statuses</option>
            {(lookups.homeworkStatuses ?? []).map((item) => (
              <option key={item} value={item}>
                {statusLabel(item)}
              </option>
            ))}
          </PortalSelect>
        </div>
      </PortalCard>

      {message && <PortalAlert title={submitStatus === "error" ? "Assignment action failed" : "Assignment action saved"} tone={submitStatus === "error" ? "error" : "success"}>{message}</PortalAlert>}

      {canManage && (
        <PortalCard title="Set Homework / Assignment" eyebrow="Tutor Action">
          <HomeworkCreateForm lookups={lookups} disabled={submitStatus === "loading"} onSubmit={submitHomeworkForm} currentUser={currentUser} initialValues={initialHomeworkValues} />
        </PortalCard>
      )}

      <PortalCard title="Homework & Assignment Records" eyebrow={`${homework.length} item${homework.length === 1 ? "" : "s"}`}>
        {homework.length === 0 ? (
          <PortalEmptyState title="No homework or assignments found" message="Tutor-set pupil work will appear here once it is created or assigned." />
        ) : (
          <div className="grid gap-4">
            {homework.map((item) => (
              <HomeworkCard
                key={item.id}
                item={item}
                canManage={canManage}
                canSubmit={canSubmit}
                loading={submitStatus === "loading"}
                onPublish={() => publishHomework(item.id)}
                onSubmitWork={(form) => submitStudentWork(item.id, form)}
                onReview={(form) => reviewHomework(item.id, form)}
              />
            ))}
          </div>
        )}
      </PortalCard>
    </div>
  );
}

function HomeworkCreateForm({
  lookups,
  disabled,
  onSubmit,
  currentUser,
  initialValues,
}: {
  lookups: LearningLookups;
  disabled: boolean;
  onSubmit: (form: HTMLFormElement) => void;
  currentUser: PortalUser;
  initialValues: RecordMap;
}) {
  const isAdmin = hasPortalPermission(currentUser, "homework:manage");
  return (
    <form className="grid gap-5 md:grid-cols-2" onSubmit={(event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit(event.currentTarget);
    }}>
      <PortalSelect id="studentId" label="Student / Pupil" required defaultValue={initialValues.studentId ?? ""}>
        <option value="">Select student</option>
        {(lookups.students ?? []).map((student) => (
          <option key={student.id} value={student.id}>
            {student.fullName}
          </option>
        ))}
      </PortalSelect>
      {isAdmin && (
        <PortalSelect id="tutorId" label="Tutor" defaultValue={initialValues.tutorId ?? ""}>
          <option value="">Select tutor</option>
          {(lookups.tutors ?? []).map((tutor) => (
            <option key={tutor.id} value={tutor.id}>
              {tutor.fullName}
            </option>
          ))}
        </PortalSelect>
      )}
      <PortalSelect id="subjectId" label="Subject" defaultValue={initialValues.subjectId ?? ""}>
        <option value="">Select subject</option>
        {(lookups.subjects ?? []).map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.name}
          </option>
        ))}
      </PortalSelect>
      <PortalSelect id="lessonId" label="Linked lesson" defaultValue={initialValues.lessonId ?? ""}>
        <option value="">No linked lesson</option>
        {(lookups.lessons ?? []).map((lesson) => (
          <option key={lesson.id} value={lesson.id}>
            {dateText(lesson.scheduledStart)} - {lesson.lessonType}
          </option>
        ))}
      </PortalSelect>
      <PortalInput id="title" label="Homework / assignment title" required />
      <PortalInput id="dueDate" label="Due date" type="date" />
      <PortalTextarea id="instructions" label="Instructions" required className="md:col-span-2" />
      <PortalTextarea id="gradingCriteria" label="Marks or grading criteria" className="md:col-span-2" />
      <PortalInput id="maxMarks" label="Maximum marks" type="number" min="0" step="0.01" />
      <PortalSelect id="status" label="Save as" required defaultValue="ASSIGNED">
        <option value="ASSIGNED">Publish to student</option>
        <option value="DRAFT">Save draft</option>
      </PortalSelect>
      <div className="md:col-span-2">
        <PortalSelect id="resourceIds" label="Attach library resources" multiple size={Math.min(6, Math.max(3, (lookups.resources ?? []).length))}>
          {(lookups.resources ?? []).map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.title}
            </option>
          ))}
        </PortalSelect>
        <p className="mt-2 text-xs font-bold text-slate-500">Hold Ctrl or Cmd to select multiple resources.</p>
      </div>
      <div className="md:col-span-2">
        <label htmlFor="attachment" className="text-sm font-bold text-navy">
          Upload attachment
        </label>
        <input id="attachment" name="attachment" type="file" className="mt-2 w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-ink shadow-sm" />
        <p className="mt-2 text-xs font-bold text-slate-500">Allowed: documents, PDFs, presentations, worksheets, images, text files, and supported videos.</p>
      </div>
      <div className="flex flex-wrap gap-3 md:col-span-2">
        <PortalButton type="submit" disabled={disabled}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {disabled ? "Saving..." : "Save Assignment"}
        </PortalButton>
      </div>
    </form>
  );
}

function HomeworkCard({
  item,
  canManage,
  canSubmit,
  loading,
  onPublish,
  onSubmitWork,
  onReview,
}: {
  item: RecordMap;
  canManage: boolean;
  canSubmit: boolean;
  loading: boolean;
  onPublish: () => void;
  onSubmitWork: (form: HTMLFormElement) => void;
  onReview: (form: HTMLFormElement) => void;
}) {
  const isDraft = item.status === "DRAFT";
  const latestSubmission = item.submissions?.[0];
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-navy">{item.title}</h3>
          <p className="mt-1 text-sm font-bold text-slate-600">
            {item.student?.fullName || "Student"} {item.subject?.name ? `- ${item.subject.name}` : ""}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-650">{item.instructions || item.details}</p>
        </div>
        <PortalBadge tone={homeworkTone(item.status)}>{statusLabel(item.status)}</PortalBadge>
      </div>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <Detail label="Tutor" value={item.tutor?.fullName || "Not assigned"} />
        <Detail label="Due date" value={dateText(item.dueDate)} />
        <Detail label="Marks" value={item.maxMarks ? `${item.mark ?? "-"} / ${item.maxMarks}` : item.mark ?? "-"} />
      </div>
      {item.gradingCriteria && <p className="mt-4 rounded-md bg-white p-3 text-sm leading-6 text-slate-650"><span className="font-black text-navy">Criteria:</span> {item.gradingCriteria}</p>}
      {item.feedback && <PortalAlert title="Feedback available" tone="success">{item.feedback}</PortalAlert>}
      <HomeworkLinks item={item} />
      {latestSubmission && (
        <div className="mt-4 rounded-md border border-slate-200 bg-white p-3 text-sm">
          <p className="font-black text-navy">Latest submission: {statusLabel(latestSubmission.status)} on {dateText(latestSubmission.createdAt)}</p>
          {latestSubmission.comments && <p className="mt-2 leading-6 text-slate-650">{latestSubmission.comments}</p>}
          {latestSubmission.hasFile && (
            <a href={`/api/portal/homework-submissions/${latestSubmission.id}/download`} className="mt-3 inline-flex items-center gap-2 text-sm font-black text-navy hover:text-gold">
              <Download className="h-4 w-4" aria-hidden="true" />
              Download submission
            </a>
          )}
        </div>
      )}
      {canManage && isDraft && (
        <div className="mt-4">
          <PortalButton type="button" disabled={loading} onClick={onPublish}>
            <Send className="h-4 w-4" aria-hidden="true" />
            Publish Assignment
          </PortalButton>
        </div>
      )}
      {canSubmit && ["ASSIGNED", "LATE", "RESUBMISSION_REQUIRED", "SUBMITTED"].includes(item.status) && (
        <form className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4" onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSubmitWork(event.currentTarget);
        }}>
          <PortalTextarea id={`comments-${item.id}`} name="comments" label="Submission comments" />
          <label htmlFor={`submissionFile-${item.id}`} className="text-sm font-bold text-navy">
            Upload answer file
          </label>
          <input id={`submissionFile-${item.id}`} name="submissionFile" type="file" className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-ink shadow-sm" />
          <PortalButton type="submit" disabled={loading}>
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            Submit Assignment
          </PortalButton>
        </form>
      )}
      {canManage && ["SUBMITTED", "LATE", "REVIEWED", "RESUBMISSION_REQUIRED"].includes(item.status) && (
        <form className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-3" onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onReview(event.currentTarget);
        }}>
          <PortalSelect id={`status-${item.id}`} name="status" label="Review status" required defaultValue="REVIEWED">
            <option value="REVIEWED">Reviewed</option>
            <option value="RESUBMISSION_REQUIRED">Resubmission Required</option>
            <option value="COMPLETED">Completed</option>
          </PortalSelect>
          <PortalInput id={`mark-${item.id}`} name="mark" label="Mark" type="number" min="0" step="0.01" defaultValue={item.mark ?? ""} />
          <div className="md:col-span-3">
            <PortalTextarea id={`feedback-${item.id}`} name="feedback" label="Written feedback" required defaultValue={item.feedback ?? ""} />
          </div>
          <div className="md:col-span-3">
            <PortalButton type="submit" disabled={loading}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Save Feedback
            </PortalButton>
          </div>
        </form>
      )}
    </article>
  );
}

function HomeworkLinks({ item }: { item: RecordMap }) {
  const attachments = item.attachments ?? [];
  const resources = item.resources ?? [];
  if (attachments.length === 0 && resources.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {attachments.map((attachment: RecordMap) => (
        <a key={`attachment-${attachment.index}`} href={`/api/portal/homework/${item.id}/attachments/${attachment.index}/download`} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-navy hover:border-gold hover:bg-gold-50">
          <Download className="h-4 w-4" aria-hidden="true" />
          {attachment.originalName || "Attachment"}
        </a>
      ))}
      {resources.map((resource: RecordMap) => (
        <a key={resource.id} href={resource.hasFile ? `/api/portal/resources/${resource.id}/download` : resource.url} target={resource.hasFile ? undefined : "_blank"} rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-navy hover:border-gold hover:bg-gold-50">
          <Download className="h-4 w-4" aria-hidden="true" />
          {resource.title}
        </a>
      ))}
    </div>
  );
}

export function ResourcesRoute({ currentUser }: { currentUser: PortalUser }) {
  const canManage = hasPortalPermission(currentUser, "resources:manage");
  const [status, setStatus] = useState<LoadState>("loading");
  const [submitStatus, setSubmitStatus] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const [lookups, setLookups] = useState<LearningLookups>({});
  const [resources, setResources] = useState<RecordMap[]>([]);

  async function loadResources() {
    setStatus("loading");
    setMessage("");
    try {
      const [lookupsResult, resourceResult] = await Promise.all([
        portalApi<LearningLookups>("/api/portal/learning/lookups"),
        portalApi<{ resources: RecordMap[] }>("/api/portal/resources"),
      ]);
      setLookups(lookupsResult);
      setResources(resourceResult.resources);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load resources.");
    }
  }

  useEffect(() => {
    void loadResources();
  }, []);

  async function submitResource(form: HTMLFormElement) {
    setSubmitStatus("loading");
    setMessage("");
    try {
      await portalApi<RecordMap>("/api/portal/resources", { method: "POST", body: new FormData(form) });
      form.reset();
      setSubmitStatus("success");
      setMessage("Resource saved successfully.");
      await loadResources();
    } catch (error) {
      setSubmitStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save resource.");
    }
  }

  if (status === "loading") return <PortalLoadingSkeleton rows={8} />;
  if (status === "error") return <PortalAlert title="Could not load resources" tone="error">{message}</PortalAlert>;

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Resource Library"
        eyebrow="Approved Learning Materials"
        action={
          <PortalButton type="button" variant="ghost" onClick={loadResources}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </PortalButton>
        }
      >
        <PortalAlert title="Permission-controlled resources" tone="info">
          Files and approved links are organised by subject, year group, pathway, tutor, student, lesson, and resource type.
        </PortalAlert>
      </PortalCard>

      {message && <PortalAlert title={submitStatus === "error" ? "Resource action failed" : "Resource action saved"} tone={submitStatus === "error" ? "error" : "success"}>{message}</PortalAlert>}

      {canManage && (
        <PortalCard title="Add Resource" eyebrow="Library Management">
          <form className="grid gap-5 md:grid-cols-2" onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            submitResource(event.currentTarget);
          }}>
            <PortalInput id="title" label="Resource title" required />
            <PortalSelect id="resourceType" label="Resource type" required options={lookups.resourceTypes ?? []} />
            <PortalSelect id="visibility" label="Visibility" required defaultValue="STUDENTS" options={lookups.resourceVisibility ?? []} />
            <PortalSelect id="status" label="Status" required defaultValue="ACTIVE" options={lookups.resourceStatuses ?? []} />
            <PortalSelect id="subjectId" label="Subject">
              <option value="">All subjects</option>
              {(lookups.subjects ?? []).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </PortalSelect>
            <PortalInput id="yearGroup" label="Year group" />
            <PortalInput id="examPathway" label="Exam pathway" />
            <PortalSelect id="studentId" label="Student">
              <option value="">No student restriction</option>
              {(lookups.students ?? []).map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName}
                </option>
              ))}
            </PortalSelect>
            <PortalSelect id="tutorId" label="Tutor">
              <option value="">No tutor restriction</option>
              {(lookups.tutors ?? []).map((tutor) => (
                <option key={tutor.id} value={tutor.id}>
                  {tutor.fullName}
                </option>
              ))}
            </PortalSelect>
            <PortalInput id="url" label="Approved link or video URL" type="url" />
            <PortalTextarea id="description" label="Description" className="md:col-span-2" />
            <div className="md:col-span-2">
              <label htmlFor="file" className="text-sm font-bold text-navy">
                Resource file
              </label>
              <input id="file" name="file" type="file" className="mt-2 w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-ink shadow-sm" />
              <p className="mt-2 text-xs font-bold text-slate-500">Files are validated by size and type before storage.</p>
            </div>
            <div className="md:col-span-2">
              <PortalButton type="submit" disabled={submitStatus === "loading"}>
                <FileUp className="h-4 w-4" aria-hidden="true" />
                {submitStatus === "loading" ? "Saving..." : "Save Resource"}
              </PortalButton>
            </div>
          </form>
        </PortalCard>
      )}

      <ResourceList resources={resources} />
    </div>
  );
}

function ResourceList({ resources }: { resources: RecordMap[] }) {
  if (resources.length === 0) {
    return (
      <PortalCard title="Resources" eyebrow="Library">
        <PortalEmptyState title="No resources available" message="Approved resources will appear here when they match your portal permissions." />
      </PortalCard>
    );
  }

  const rows = resources.map((resource) => [
    <div>
      <p className="font-black text-navy">{resource.title}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{resource.description || "No description"}</p>
    </div>,
    statusLabel(resource.resourceType),
    resource.subject?.name || "All",
    <PortalBadge tone={resource.status === "ACTIVE" ? "success" : "warning"}>{statusLabel(resource.status)}</PortalBadge>,
    <div className="flex flex-wrap gap-2">
      {resource.hasFile && <DownloadLink href={`/api/portal/resources/${resource.id}/download`} label="Download" />}
      {resource.url && <DownloadLink href={resource.url} label="Open link" external />}
    </div>,
  ]);

  return (
    <PortalCard title="Resources" eyebrow={`${resources.length} record${resources.length === 1 ? "" : "s"}`}>
      <PortalTable columns={["Title", "Type", "Subject", "Status", "Access"]} rows={rows} />
    </PortalCard>
  );
}

export function ProgressRoute({ currentUser }: { currentUser: PortalUser }) {
  const canManage = hasPortalPermission(currentUser, "progress:manage") || currentUser.role?.name === "Tutor";
  const [status, setStatus] = useState<LoadState>("loading");
  const [submitStatus, setSubmitStatus] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const [lookups, setLookups] = useState<LearningLookups>({});
  const [progress, setProgress] = useState<RecordMap[]>([]);

  async function loadProgress() {
    setStatus("loading");
    setMessage("");
    try {
      const [lookupsResult, progressResult] = await Promise.all([
        portalApi<LearningLookups>("/api/portal/learning/lookups"),
        portalApi<{ progress: RecordMap[] }>("/api/portal/progress"),
      ]);
      setLookups(lookupsResult);
      setProgress(progressResult.progress);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load progress records.");
    }
  }

  useEffect(() => {
    void loadProgress();
  }, []);

  async function submitProgress(form: HTMLFormElement) {
    setSubmitStatus("loading");
    setMessage("");
    try {
      await portalApi<RecordMap>("/api/portal/progress", { method: "POST", body: JSON.stringify(formPayload(form)) });
      form.reset();
      setSubmitStatus("success");
      setMessage("Progress record saved successfully.");
      await loadProgress();
    } catch (error) {
      setSubmitStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save progress record.");
    }
  }

  const summaries = useMemo(() => progressSummaryCards(progress), [progress]);

  if (status === "loading") return <PortalLoadingSkeleton rows={8} />;
  if (status === "error") return <PortalAlert title="Could not load progress" tone="error">{message}</PortalAlert>;

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Progress Tracking"
        eyebrow="Learning Goals"
        action={
          <PortalButton type="button" variant="ghost" onClick={loadProgress}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </PortalButton>
        }
      >
        <div className="grid gap-4 md:grid-cols-4">
          {summaries.map((summary) => (
            <Metric key={summary.label} label={summary.label} value={summary.value} />
          ))}
        </div>
      </PortalCard>

      {message && <PortalAlert title={submitStatus === "error" ? "Progress action failed" : "Progress action saved"} tone={submitStatus === "error" ? "error" : "success"}>{message}</PortalAlert>}

      {canManage && (
        <PortalCard title="Record Progress" eyebrow="Academic Update">
          <form className="grid gap-5 md:grid-cols-2" onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            submitProgress(event.currentTarget);
          }}>
            <PortalSelect id="studentId" label="Student" required>
              <option value="">Select student</option>
              {(lookups.students ?? []).map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName}
                </option>
              ))}
            </PortalSelect>
            {hasPortalPermission(currentUser, "progress:manage") && (
              <PortalSelect id="tutorId" label="Tutor">
                <option value="">Select tutor</option>
                {(lookups.tutors ?? []).map((tutor) => (
                  <option key={tutor.id} value={tutor.id}>
                    {tutor.fullName}
                  </option>
                ))}
              </PortalSelect>
            )}
            <PortalSelect id="subjectId" label="Subject">
              <option value="">Select subject</option>
              {(lookups.subjects ?? []).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </PortalSelect>
            <PortalSelect id="goalStatus" label="Goal status" required defaultValue="IN_PROGRESS" options={lookups.goalStatuses ?? []} />
            <PortalInput id="baselineLevel" label="Baseline level" />
            <PortalInput id="currentLevel" label="Current level" />
            <PortalInput id="reviewDate" label="Review date" type="date" required defaultValue={dateInput(new Date())} />
            <label htmlFor="parentVisible" className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-navy">
              <input id="parentVisible" name="parentVisible" type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold focus:ring-gold" />
              <span>Approved for parent and student view</span>
            </label>
            <PortalTextarea id="learningGoals" label="Learning goals" required className="md:col-span-2" />
            <PortalTextarea id="skillsAchieved" label="Skills achieved" className="md:col-span-2" />
            <PortalTextarea id="areasForImprovement" label="Areas for improvement" className="md:col-span-2" />
            <PortalTextarea id="tutorComments" label="Internal tutor comments" className="md:col-span-2" />
            <PortalTextarea id="parentSummary" label="Parent-friendly progress summary" className="md:col-span-2" />
            <div className="md:col-span-2">
              <PortalButton type="submit" disabled={submitStatus === "loading"}>
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
                {submitStatus === "loading" ? "Saving..." : "Save Progress"}
              </PortalButton>
            </div>
          </form>
        </PortalCard>
      )}

      <PortalCard title="Progress Records" eyebrow={`${progress.length} update${progress.length === 1 ? "" : "s"}`}>
        {progress.length === 0 ? (
          <PortalEmptyState title="No progress records yet" message="Approved progress updates will appear here once recorded." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {progress.map((record) => (
              <article key={record.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-black text-navy">{record.student?.fullName || "Student"}</h3>
                    <p className="mt-1 text-sm font-bold text-slate-600">{record.subject?.name || "General progress"} - {dateText(record.reviewDate)}</p>
                  </div>
                  <PortalBadge tone={progressTone(record.goalStatus)}>{statusLabel(record.goalStatus)}</PortalBadge>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-650">{record.learningGoals}</p>
                {record.parentSummary && <p className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-slate-650"><span className="font-black text-navy">Parent summary:</span> {record.parentSummary}</p>}
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                  <Detail label="Baseline" value={record.baselineLevel || "-"} />
                  <Detail label="Current" value={record.currentLevel || "-"} />
                  <Detail label="Skills achieved" value={record.skillsAchieved || "-"} />
                  <Detail label="Further support" value={record.areasForImprovement || "-"} />
                </div>
                {record.tutorComments && <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><span className="font-black">Internal note:</span> {record.tutorComments}</p>}
              </article>
            ))}
          </div>
        )}
      </PortalCard>
    </div>
  );
}

export function NotificationsRoute({ currentUser }: { currentUser: PortalUser }) {
  const canViewAll = hasPortalPermission(currentUser, "notifications:manage");
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [notifications, setNotifications] = useState<RecordMap[]>([]);
  const [scope, setScope] = useState(canViewAll ? "mine" : "mine");
  const [statusFilter, setStatusFilter] = useState("");

  async function loadNotifications() {
    setStatus("loading");
    setMessage("");
    try {
      const params = new URLSearchParams();
      if (scope === "all" && canViewAll) params.set("scope", "all");
      if (statusFilter) params.set("status", statusFilter);
      const result = await portalApi<{ notifications: RecordMap[] }>(`/api/portal/notifications${params.size ? `?${params}` : ""}`);
      setNotifications(result.notifications);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load notifications.");
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, [scope, statusFilter]);

  async function markRead(id: string) {
    setMessage("");
    try {
      await portalApi<RecordMap>(`/api/portal/notifications/${id}/read`, { method: "POST" });
      setMessage("Notification marked as read.");
      await loadNotifications();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update notification.");
    }
  }

  async function markAllRead() {
    setMessage("");
    try {
      await portalApi<RecordMap>("/api/portal/notifications/read-all", { method: "POST" });
      setMessage("Notifications marked as read.");
      await loadNotifications();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update notifications.");
    }
  }

  if (status === "loading") return <PortalLoadingSkeleton rows={8} />;
  if (status === "error") return <PortalAlert title="Could not load notifications" tone="error">{message}</PortalAlert>;

  const unreadCount = notifications.filter((notification) => notification.status === "UNREAD").length;

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Notifications"
        eyebrow="Message Centre"
        action={
          <div className="flex flex-wrap gap-2">
            <PortalButton type="button" variant="ghost" onClick={loadNotifications}>
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </PortalButton>
            <PortalButton type="button" onClick={markAllRead}>
              <Bell className="h-4 w-4" aria-hidden="true" />
              Mark Mine Read
            </PortalButton>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Notifications shown" value={String(notifications.length)} />
          <Metric label="Unread" value={String(unreadCount)} />
          <Metric label="Scope" value={scope === "all" ? "All users" : "My inbox"} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {canViewAll && (
            <PortalSelect id="notificationScope" label="Scope" value={scope} onChange={(event) => setScope(event.target.value)}>
              <option value="mine">My notifications</option>
              <option value="all">All notifications</option>
            </PortalSelect>
          )}
          <PortalSelect id="notificationStatus" label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="UNREAD">Unread</option>
            <option value="READ">Read</option>
          </PortalSelect>
        </div>
      </PortalCard>

      {message && <PortalAlert title={message.includes("Could not") ? "Notification action failed" : "Notification updated"} tone={message.includes("Could not") ? "error" : "success"}>{message}</PortalAlert>}

      <PortalCard title="Notification Feed" eyebrow="In App Alerts">
        {notifications.length === 0 ? (
          <PortalEmptyState title="No notifications" message="New lesson, homework, finance, support, and safeguarding alerts will appear here." />
        ) : (
          <div className="grid gap-3">
            {notifications.map((notification) => (
              <article key={notification.id} className={`rounded-lg border p-4 ${notification.status === "UNREAD" ? "border-gold bg-gold-50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-black text-navy">{notification.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-650">{notification.message}</p>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      {notification.category ? statusLabel(notification.category) : "General"} - {dateText(notification.createdAt)}
                      {notification.recipient?.name ? ` - ${notification.recipient.name}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PortalBadge tone={notification.status === "UNREAD" ? "warning" : "success"}>{statusLabel(notification.status)}</PortalBadge>
                    {notification.status === "UNREAD" && (
                      <PortalButton type="button" variant="ghost" onClick={() => markRead(notification.id)}>
                        Mark Read
                      </PortalButton>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </PortalCard>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md bg-white p-3">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-bold text-navy">{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-navy">{value}</p>
    </div>
  );
}

function DownloadLink({ href, label, external = false }: { href: string; label: string; external?: boolean }) {
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50">
      <Download className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}

function formPayload(form: HTMLFormElement) {
  const formData = new FormData(form);
  const payload: RecordMap = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    if (payload[key]) {
      payload[key] = Array.isArray(payload[key]) ? [...payload[key], value] : [payload[key], value];
    } else {
      payload[key] = value;
    }
  }
  return payload;
}

function progressSummaryCards(progress: RecordMap[]) {
  const students = new Set(progress.map((record) => record.student?.id).filter(Boolean));
  const subjects = new Set(progress.map((record) => record.subject?.id).filter(Boolean));
  const visible = progress.filter((record) => record.parentVisible).length;
  return [
    { label: "Progress records", value: String(progress.length) },
    { label: "Students tracked", value: String(students.size) },
    { label: "Subjects covered", value: String(subjects.size) },
    { label: "Parent visible", value: String(visible) },
  ];
}

function homeworkTone(status: string): "neutral" | "success" | "warning" | "danger" | "gold" {
  if (status === "COMPLETED" || status === "REVIEWED") return "success";
  if (status === "LATE" || status === "RESUBMISSION_REQUIRED") return "warning";
  if (status === "CANCELLED") return "danger";
  if (status === "DRAFT") return "neutral";
  return "gold";
}

function progressTone(status: string): "neutral" | "success" | "warning" | "danger" | "gold" {
  if (status === "ACHIEVED") return "success";
  if (status === "NEEDS_REVIEW" || status === "PAUSED") return "warning";
  if (status === "ARCHIVED") return "neutral";
  return "gold";
}

function statusLabel(value?: string | null) {
  if (!value) return "-";
  return String(value)
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function dateText(value?: string | Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

function dateInput(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
