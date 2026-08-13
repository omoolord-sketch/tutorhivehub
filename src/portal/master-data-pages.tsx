import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Plus, RefreshCcw } from "lucide-react";
import { portalApi } from "./api";
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

const statuses = ["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED", "PENDING"];
const assignmentStatuses = ["ACTIVE", "PAUSED", "ENDED"];
const examPathways = ["Primary", "Secondary", "GCSE", "A-Level", "WAEC", "JAMB", "SAT", "IELTS", "NVQ", "University Admissions", "Other"];
const contactMethods = ["Email", "Phone", "WhatsApp", "SMS", "Portal"];
const teachingDeviceOptions = ["Desktop", "Laptop", "Chromebook", "Approved tablet", "Other"];
const operatingSystemOptions = ["Windows 11", "Windows 10", "macOS", "ChromeOS", "Linux", "Other"];
const internetConnectionOptions = ["Fibre Broadband", "Home Wi-Fi", "4G Mobile Data", "5G Mobile Data", "Satellite Internet", "Other"];
const speedOptions = ["Less than 10 Mbps", "10-25 Mbps", "25-50 Mbps", "50-100 Mbps", "Over 100 Mbps", "Not Sure"];
const yesNoOptions = ["Yes", "No"];
const platformOptions = ["Zoom", "Google Meet", "Microsoft Teams", "Skype", "Other"];

const entityConfig = {
  parents: { endpoint: "/api/portal/parents", singular: "Parent", plural: "Parents", listPermission: "parents:manage" },
  students: { endpoint: "/api/portal/students", singular: "Student", plural: "Students", listPermission: "students:manage" },
  tutors: { endpoint: "/api/portal/tutors", singular: "Tutor", plural: "Tutors", listPermission: "tutors:manage" },
  subjects: { endpoint: "/api/portal/subjects", singular: "Subject", plural: "Subjects", listPermission: "subjects:manage" },
  assignments: { endpoint: "/api/portal/assignments", singular: "Tutor-Pupil Allocation", plural: "Tutor-Pupil Allocations", listPermission: "assignments:manage" },
} as const;

type EntityName = keyof typeof entityConfig;

export function MasterDataRoute({ entity, routePath }: { entity: EntityName; routePath: string }) {
  const basePath = `/portal/${entity}`;
  const idEditMatch = routePath.match(new RegExp(`^${basePath}/([^/]+)/edit$`));
  const idProfileMatch = routePath.match(new RegExp(`^${basePath}/([^/]+)$`));

  if (routePath === `${basePath}/new`) {
    return <EntityForm entity={entity} mode="create" />;
  }

  if (idEditMatch) {
    return <EntityForm entity={entity} mode="edit" recordId={idEditMatch[1]} />;
  }

  if (idProfileMatch) {
    return <EntityProfile entity={entity} recordId={idProfileMatch[1]} />;
  }

  return <EntityList entity={entity} />;
}

function EntityList({ entity }: { entity: EntityName }) {
  const config = entityConfig[entity];
  const [records, setRecords] = useState<RecordMap[]>([]);
  const [filters, setFilters] = useState<RecordMap>({});
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  async function loadRecords(nextFilters = filters) {
    setStatus("loading");
    setMessage("");
    try {
      const query = new URLSearchParams();
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (String(value ?? "").trim()) {
          query.set(key, String(value));
        }
      });
      const result = await portalApi<RecordMap>(`${config.endpoint}${query.size ? `?${query.toString()}` : ""}`);
      setRecords(result[entity] ?? result.assignments ?? []);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : `Could not load ${config.plural.toLowerCase()}.`);
    }
  }

  useEffect(() => {
    void loadRecords({});
  }, [entity]);

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    setFilters(data);
    void loadRecords(data);
  }

  return (
    <div className="grid gap-6">
      <PortalCard
        title={config.plural}
        eyebrow="Master Data"
        action={
          <div className="flex flex-wrap gap-2">
            <PortalButton type="button" variant="ghost" onClick={() => loadRecords()}>
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </PortalButton>
            <a href={`/portal/${entity}/new`} className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-gold-100">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add {config.singular}
            </a>
          </div>
        }
      >
        <FilterForm entity={entity} onSubmit={handleFilter} />
        {status === "loading" && <PortalLoadingSkeleton rows={5} />}
        {status === "error" && <PortalAlert title={`Could not load ${config.plural.toLowerCase()}`} tone="error">{message}</PortalAlert>}
        {status === "success" && records.length === 0 && <PortalEmptyState title={`No ${config.plural.toLowerCase()} found`} message="Create a new record or adjust your filters." />}
        {status === "success" && records.length > 0 && <PortalTable columns={columnsFor(entity)} rows={records.map((record) => rowFor(entity, record))} />}
      </PortalCard>
    </div>
  );
}

function FilterForm({ entity, onSubmit }: { entity: EntityName; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="mb-6 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-4" onSubmit={onSubmit}>
      {entity !== "assignments" && <PortalInput id="name" label="Name" type="search" />}
      {entity !== "subjects" && <PortalSelect id="status" label="Status" options={entity === "assignments" ? assignmentStatuses : statuses} />}
      {(entity === "students" || entity === "subjects") && <PortalSelect id="examPathway" label="Exam pathway" options={examPathways} />}
      {(entity === "students" || entity === "tutors") && <PortalInput id="subject" label="Subject" type="search" />}
      {entity === "students" && <PortalInput id="yearGroup" label="Year group" type="search" />}
      {(entity === "students" || entity === "assignments") && <PortalInput id="tutor" label="Tutor" type="search" />}
      {entity === "assignments" && <PortalInput id="student" label="Student" type="search" />}
      {(entity === "parents" || entity === "students" || entity === "tutors") && <PortalInput id="country" label="Country" type="search" />}
      {(entity === "parents" || entity === "students" || entity === "tutors") && <PortalInput id="timeZone" label="Time zone" type="search" />}
      {entity === "subjects" && <PortalInput id="category" label="Category" type="search" />}
      {entity === "subjects" && <PortalSelect id="status" label="Status" options={["ACTIVE", "INACTIVE"]} />}
      <div className="flex items-end">
        <PortalButton type="submit" className="w-full">
          Apply Filters
        </PortalButton>
      </div>
    </form>
  );
}

function EntityProfile({ entity, recordId }: { entity: EntityName; recordId: string }) {
  const config = entityConfig[entity];
  const [record, setRecord] = useState<RecordMap | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    portalApi<{ record: RecordMap }>(`${config.endpoint}/${recordId}`)
      .then((result) => {
        setRecord(result.record);
        setStatus("success");
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : `Could not load ${config.singular.toLowerCase()}.`);
      });
  }, [config.endpoint, config.singular, recordId]);

  if (status === "loading") {
    return <PortalLoadingSkeleton rows={6} />;
  }

  if (status === "error" || !record) {
    return <PortalAlert title={`Could not load ${config.singular.toLowerCase()}`} tone="error">{message}</PortalAlert>;
  }

  return (
    <PortalCard
      title={displayName(entity, record)}
      eyebrow={`${config.singular} Profile`}
      action={
        <a href={`/portal/${entity}/${recordId}/edit`} className="inline-flex items-center justify-center rounded-md bg-gold px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-gold-100">
          Edit
        </a>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <DetailGrid items={detailItems(entity, record)} />
        <RelatedSummary entity={entity} record={record} />
      </div>
    </PortalCard>
  );
}

function EntityForm({ entity, mode, recordId }: { entity: EntityName; mode: "create" | "edit"; recordId?: string }) {
  const config = entityConfig[entity];
  const [record, setRecord] = useState<RecordMap | null>(null);
  const [lookups, setLookups] = useState<RecordMap>({});
  const [loadStatus, setLoadStatus] = useState<LoadState>("loading");
  const [submitStatus, setSubmitStatus] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const lookupResult = await portalApi<RecordMap>("/api/portal/lookups");
        const recordResult = mode === "edit" && recordId ? await portalApi<{ record: RecordMap }>(`${config.endpoint}/${recordId}`) : null;
        if (mounted) {
          setLookups(lookupResult);
          setRecord(recordResult?.record ?? null);
          setLoadStatus("success");
        }
      } catch (error) {
        if (mounted) {
          setLoadStatus("error");
          setMessage(error instanceof Error ? error.message : "Could not load form.");
        }
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [config.endpoint, mode, recordId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitStatus("loading");
    setMessage("");

    try {
      const endpoint = mode === "edit" && recordId ? `${config.endpoint}/${recordId}` : config.endpoint;
      const method = mode === "edit" ? "PATCH" : "POST";
      const body = buildPayload(entity, form, confirmDuplicate);
      const result = await portalApi<RecordMap>(endpoint, { method, body });
      setRecord(result[singularKey(entity)] ?? result.record ?? null);
      setSubmitStatus("success");
      setConfirmDuplicate(false);
      setMessage(`${config.singular} saved successfully.`);
      if (mode === "create") {
        form.reset();
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : `Could not save ${config.singular.toLowerCase()}.`;
      setSubmitStatus("error");
      setMessage(text);
      if (text.includes("already exists")) {
        setConfirmDuplicate(true);
      }
    }
  }

  if (loadStatus === "loading") {
    return <PortalLoadingSkeleton rows={7} />;
  }

  if (loadStatus === "error") {
    return <PortalAlert title="Could not load form" tone="error">{message}</PortalAlert>;
  }

  return (
    <PortalCard title={mode === "edit" ? `Edit ${config.singular}` : `Add ${config.singular}`} eyebrow="Master Data">
      <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit} encType={entity === "tutors" ? "multipart/form-data" : undefined}>
        {formFields(entity, record, lookups)}
        {confirmDuplicate && (
          <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 md:col-span-2">
            <input name="allowDuplicateActive" type="checkbox" defaultChecked className="mt-0.5 h-4 w-4 rounded border-amber-300 text-gold focus:ring-gold" />
            <span>Confirm duplicate active allocation for the same student, tutor, and subject.</span>
          </label>
        )}
        <div className="md:col-span-2">
          {submitStatus === "success" && <PortalAlert title="Saved" tone="success">{message}</PortalAlert>}
          {submitStatus === "error" && <PortalAlert title="Could not save" tone={confirmDuplicate ? "warning" : "error"}>{message}</PortalAlert>}
        </div>
        <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row">
          <PortalButton type="submit" disabled={submitStatus === "loading"}>
            {submitStatus === "loading" ? "Saving..." : confirmDuplicate ? "Save Confirmed Duplicate" : "Save"}
          </PortalButton>
          <a href={`/portal/${entity}`} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:border-gold hover:bg-gold-50">
            Back to {config.plural}
          </a>
        </div>
      </form>
    </PortalCard>
  );
}

function formFields(entity: EntityName, record: RecordMap | null, lookups: RecordMap) {
  if (entity === "parents") {
    return (
      <>
        <PortalInput id="fullName" label="Parent full name" required defaultValue={record?.fullName ?? ""} />
        <PortalInput id="email" label="Email address" type="email" required defaultValue={record?.email ?? ""} />
        <PortalSelect id="userId" label="Parent portal account" defaultValue={record?.userId ?? ""}>
          <option value="">No linked parent login</option>
          {usersForRole(lookups, "Parent").map((user: RecordMap) => (
            <option key={user.id} value={user.id}>{user.name} - {user.email}</option>
          ))}
        </PortalSelect>
        <PortalInput id="phone" label="Phone number" type="tel" defaultValue={record?.phone ?? ""} />
        <PortalSelect id="preferredContactMethod" label="Preferred contact method" options={contactMethods} defaultValue={record?.preferredContactMethod ?? ""} />
        <PortalInput id="country" label="Country" defaultValue={record?.country ?? ""} />
        <PortalInput id="timeZone" label="Time zone" defaultValue={record?.timeZone ?? ""} />
        <PortalInput id="emergencyContactName" label="Emergency contact name" defaultValue={record?.emergencyContactName ?? ""} />
        <PortalInput id="emergencyContactPhone" label="Emergency contact phone" defaultValue={record?.emergencyContactPhone ?? ""} />
        <PortalInput id="emergencyContactRelationship" label="Emergency contact relationship" defaultValue={record?.emergencyContactRelationship ?? ""} />
        <PortalSelect id="status" label="Account status" options={statuses} defaultValue={record?.status ?? "ACTIVE"} />
        <PortalTextarea id="notes" label="Notes" className="md:col-span-2" defaultValue={record?.notes ?? ""} />
      </>
    );
  }

  if (entity === "students") {
    return (
      <>
        <PortalInput id="fullName" label="Student full name" required defaultValue={record?.fullName ?? ""} />
        <PortalSelect id="parentId" label="Parent / guardian" defaultValue={record?.parentId ?? ""}>
          <option value="">Select an option</option>
          {(lookups.parents ?? []).map((parent: RecordMap) => (
            <option key={parent.id} value={parent.id}>{parent.fullName}</option>
          ))}
        </PortalSelect>
        <PortalSelect id="userId" label="Student portal account" defaultValue={record?.userId ?? ""}>
          <option value="">No direct student login</option>
          {(lookups.users ?? []).map((user: RecordMap) => (
            <option key={user.id} value={user.id}>{user.name} - {user.email}</option>
          ))}
        </PortalSelect>
        <PortalInput id="dateOfBirth" label="Date of birth" type="date" defaultValue={dateInput(record?.dateOfBirth)} />
        <PortalInput id="age" label="Age" type="number" min="0" max="120" defaultValue={record?.age ?? ""} />
        <PortalInput id="yearGroup" label="Year group / class" defaultValue={record?.yearGroup ?? ""} />
        <PortalInput id="country" label="Country" defaultValue={record?.country ?? ""} />
        <PortalInput id="timeZone" label="Time zone" defaultValue={record?.timeZone ?? ""} />
        <PortalInput id="schoolOrInstitution" label="School or institution" defaultValue={record?.schoolOrInstitution ?? ""} />
        <PortalSelect id="examPathway" label="Exam pathway" options={examPathways} required defaultValue={record?.examPathway ?? ""} />
        <PortalSelect id="status" label="Status" options={statuses} defaultValue={record?.status ?? "ACTIVE"} />
        <PortalSelect id="directLoginDisabled" label="Disable direct student login" options={yesNoOptions} defaultValue={booleanSelect(record?.directLoginDisabled) || "No"} />
        <PortalInput id="startDate" label="Start date" type="date" defaultValue={dateInput(record?.startDate)} />
        <MultiSelect id="subjectIds" label="Subjects" options={lookups.subjects ?? []} defaultValues={(record?.subjects ?? []).map((subject: RecordMap) => subject.id)} />
        <PortalTextarea id="academicGoals" label="Academic goals" defaultValue={record?.academicGoals ?? ""} />
        <PortalTextarea id="learningNeeds" label="Learning needs" defaultValue={record?.learningNeeds ?? ""} />
        <PortalTextarea id="importantNotes" label="Important notes" className="md:col-span-2" defaultValue={record?.importantNotes ?? ""} />
      </>
    );
  }

  if (entity === "tutors") {
    return (
      <>
        <PortalInput id="fullName" label="Tutor full name" required defaultValue={record?.fullName ?? ""} />
        <PortalInput id="email" label="Email address" type="email" required defaultValue={record?.email ?? ""} />
        <PortalSelect id="userId" label="Tutor portal account" defaultValue={record?.userId ?? ""}>
          <option value="">No linked tutor login</option>
          {usersForRole(lookups, "Tutor").map((user: RecordMap) => (
            <option key={user.id} value={user.id}>{user.name} - {user.email}</option>
          ))}
        </PortalSelect>
        <PortalInput id="phone" label="Phone number" type="tel" defaultValue={record?.phone ?? ""} />
        <PortalInput id="country" label="Country" defaultValue={record?.country ?? ""} />
        <PortalInput id="timeZone" label="Time zone" defaultValue={record?.timeZone ?? ""} />
        <PortalSelect id="status" label="Tutor status" options={statuses} defaultValue={record?.status ?? "ACTIVE"} />
        <PortalInput id="startDate" label="Start date" type="date" defaultValue={dateInput(record?.startDate)} />
        <PortalInput id="mainSubjectAreas" label="Main subject area(s)" defaultValue={record?.mainSubjectAreas ?? ""} />
        <MultiSelect id="subjectIds" label="Subjects taught" options={lookups.subjects ?? []} defaultValues={(record?.subjects ?? []).map((subject: RecordMap) => subject.id)} />
        <PortalTextarea id="qualifications" label="Qualifications" defaultValue={record?.qualifications ?? ""} />
        <PortalTextarea id="teachingExperience" label="Teaching experience" defaultValue={record?.teachingExperience ?? ""} />
        <PortalTextarea id="availability" label="Availability" defaultValue={record?.availability ?? ""} />
        <PortalTextarea id="rateInformation" label="Rate information" defaultValue={record?.rateInformation ?? ""} />
        <PortalInput id="cv" label="CV upload" type="file" accept=".pdf,.doc,.docx" />
        <PortalInput id="certificates" label="Certificates" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" multiple />
        <PortalSelect id="primaryTeachingDevice" label="Primary teaching device" options={teachingDeviceOptions} defaultValue={record?.primaryTeachingDevice ?? ""} />
        <PortalSelect id="operatingSystem" label="Operating system" options={operatingSystemOptions} defaultValue={record?.operatingSystem ?? ""} />
        <PortalSelect id="internetConnectionType" label="Internet connection type" options={internetConnectionOptions} defaultValue={record?.internetConnectionType ?? ""} />
        <PortalSelect id="averageInternetSpeed" label="Average internet speed" options={speedOptions} defaultValue={record?.averageInternetSpeed ?? ""} />
        <PortalSelect id="backupInternet" label="Backup internet" options={yesNoOptions} defaultValue={booleanSelect(record?.backupInternet)} />
        <PortalSelect id="webcamAvailable" label="Webcam" options={yesNoOptions} defaultValue={booleanSelect(record?.webcamAvailable)} />
        <PortalSelect id="headsetMicrophoneAvailable" label="Headset and microphone" options={yesNoOptions} defaultValue={booleanSelect(record?.headsetMicrophoneAvailable)} />
        <PortalSelect id="quietTeachingEnvironment" label="Quiet teaching environment" options={yesNoOptions} defaultValue={booleanSelect(record?.quietTeachingEnvironment)} />
        <MultiSelect id="onlineTeachingPlatforms" label="Online teaching platforms used" options={platformOptions.map((name) => ({ id: name, name }))} defaultValues={String(record?.onlineTeachingPlatforms ?? "").split(",").map((item) => item.trim()).filter(Boolean)} />
        <PortalTextarea id="internalPerformanceNotes" label="Internal performance notes" className="md:col-span-2" defaultValue={record?.internalPerformanceNotes ?? ""} />
      </>
    );
  }

  if (entity === "subjects") {
    return (
      <>
        <PortalInput id="name" label="Subject name" required defaultValue={record?.name ?? ""} />
        <PortalInput id="category" label="Subject category" defaultValue={record?.category ?? ""} />
        <PortalSelect id="examPathway" label="Exam pathway" options={examPathways} defaultValue={record?.examPathway ?? ""} />
        <PortalSelect id="isActive" label="Status" options={["ACTIVE", "INACTIVE"]} defaultValue={record?.isActive === false ? "INACTIVE" : "ACTIVE"} />
        <PortalTextarea id="description" label="Description" className="md:col-span-2" defaultValue={record?.description ?? ""} />
      </>
    );
  }

  return (
    <>
      <PortalSelect id="studentId" label="Student" required defaultValue={record?.studentId ?? ""}>
        <option value="">Select an option</option>
        {(lookups.students ?? []).map((student: RecordMap) => (
          <option key={student.id} value={student.id}>{student.fullName}</option>
        ))}
      </PortalSelect>
      <PortalSelect id="tutorId" label="Tutor" required defaultValue={record?.tutorId ?? ""}>
        <option value="">Select an option</option>
        {(lookups.tutors ?? []).map((tutor: RecordMap) => (
          <option key={tutor.id} value={tutor.id}>{tutor.fullName}</option>
        ))}
      </PortalSelect>
      <PortalSelect id="subjectId" label="Subject" required defaultValue={record?.subjectId ?? ""}>
        <option value="">Select an option</option>
        {(lookups.subjects ?? []).map((subject: RecordMap) => (
          <option key={subject.id} value={subject.id}>{subjectLabel(subject)}</option>
        ))}
      </PortalSelect>
      <PortalInput id="startDate" label="Start date" type="date" required defaultValue={dateInput(record?.startDate)} />
      <PortalInput id="endDate" label="End date" type="date" defaultValue={dateInput(record?.endDate)} />
      <PortalSelect id="status" label="Allocation status" options={assignmentStatuses} defaultValue={record?.status ?? "ACTIVE"} />
      <PortalTextarea id="notes" label="Notes" className="md:col-span-2" defaultValue={record?.notes ?? ""} />
    </>
  );
}

function MultiSelect({ id, label, options, defaultValues = [] }: { id: string; label: string; options: RecordMap[]; defaultValues?: string[] }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold text-navy">
        {label}
      </label>
      <select
        id={id}
        name={id}
        multiple
        defaultValue={defaultValues}
        className="mt-2 min-h-32 w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/20"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs font-bold text-slate-500">Hold Ctrl or Cmd to select multiple.</p>
    </div>
  );
}

function buildPayload(entity: EntityName, form: HTMLFormElement, allowDuplicateActive: boolean) {
  if (entity === "tutors") {
    const data = new FormData(form);
    data.set("subjectIds", JSON.stringify(selectedValues(form, "subjectIds")));
    data.set("onlineTeachingPlatforms", selectedValues(form, "onlineTeachingPlatforms").join(", "));
    return data;
  }

  const data = Object.fromEntries(new FormData(form).entries()) as RecordMap;
  if (entity === "students") {
    data.subjectIds = selectedValues(form, "subjectIds");
  }
  if (entity === "assignments") {
    data.allowDuplicateActive = allowDuplicateActive || new FormData(form).get("allowDuplicateActive") === "on";
  }
  if (entity === "subjects") {
    data.isActive = data.isActive === "ACTIVE";
  }
  return JSON.stringify(data);
}

function selectedValues(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name) as HTMLSelectElement | null;
  if (!field) {
    return [];
  }
  return Array.from(field.selectedOptions).map((option) => option.value).filter(Boolean);
}

function usersForRole(lookups: RecordMap, roleName: string) {
  return (lookups.users ?? []).filter((user: RecordMap) => user.role?.name === roleName);
}

function columnsFor(entity: EntityName) {
  if (entity === "parents") return ["Parent", "Contact", "Country", "Children", "Status", "Actions"];
  if (entity === "students") return ["Student", "Parent", "Year", "Pathway", "Subjects", "Status", "Actions"];
  if (entity === "tutors") return ["Tutor", "Subjects", "Country", "Technical", "Status", "Actions"];
  if (entity === "subjects") return ["Subject", "Category", "Pathway", "Usage", "Status", "Actions"];
  return ["Student", "Tutor", "Subject", "Dates", "Status", "Actions"];
}

function rowFor(entity: EntityName, record: RecordMap): ReactNode[] {
  if (entity === "parents") {
    return [
      titleCell(record.fullName, record.email),
      `${record.preferredContactMethod || "No preference"}${record.phone ? ` / ${record.phone}` : ""}`,
      countryCell(record),
      String(record.students?.length ?? 0),
      <PortalBadge tone={statusTone(record.status)}>{record.status}</PortalBadge>,
      actions(entity, record.id),
    ];
  }
  if (entity === "students") {
    return [
      titleCell(record.fullName, record.schoolOrInstitution),
      record.parent?.fullName || "Not linked",
      record.yearGroup || record.age || "-",
      record.examPathway || "-",
      names(record.subjects),
      <PortalBadge tone={statusTone(record.status)}>{record.status}</PortalBadge>,
      actions(entity, record.id),
    ];
  }
  if (entity === "tutors") {
    return [
      titleCell(record.fullName, record.email),
      names(record.subjects),
      countryCell(record),
      record.primaryTeachingDevice || "-",
      <PortalBadge tone={statusTone(record.status)}>{record.status}</PortalBadge>,
      actions(entity, record.id),
    ];
  }
  if (entity === "subjects") {
    return [
      titleCell(record.name, record.description),
      record.category || "-",
      record.examPathway || "-",
      `${record._count?.students ?? 0} students / ${record._count?.tutors ?? 0} tutors`,
      <PortalBadge tone={record.isActive ? "success" : "warning"}>{record.isActive ? "ACTIVE" : "INACTIVE"}</PortalBadge>,
      actions(entity, record.id),
    ];
  }
  return [
    record.student?.fullName || "-",
    record.tutor?.fullName || "-",
    subjectLabel(record.subject) || "-",
    `${dateText(record.startDate)}${record.endDate ? ` - ${dateText(record.endDate)}` : ""}`,
    <PortalBadge tone={statusTone(record.status)}>{record.status}</PortalBadge>,
    actions(entity, record.id),
  ];
}

function actions(entity: EntityName, id: string) {
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`/portal/${entity}/${id}`} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50">View</a>
      <a href={`/portal/${entity}/${id}/edit`} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50">Edit</a>
    </div>
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

function RelatedSummary({ entity, record }: { entity: EntityName; record: RecordMap }) {
  if (entity === "parents") {
    return relatedCard("Linked students", record.students);
  }
  if (entity === "students") {
    return relatedCard("Assigned tutors", record.tutorAssignments?.map((assignment: RecordMap) => ({ id: assignment.id, name: `${assignment.tutor?.fullName} - ${subjectLabel(assignment.subject)}`, status: assignment.status })));
  }
  if (entity === "tutors") {
    return relatedCard("Assigned students", record.studentAssignments?.map((assignment: RecordMap) => ({ id: assignment.id, name: `${assignment.student?.fullName} - ${subjectLabel(assignment.subject)}`, status: assignment.status })));
  }
  if (entity === "subjects") {
    return relatedCard("Usage", [
      { id: "students", name: `${record._count?.students ?? 0} linked students` },
      { id: "tutors", name: `${record._count?.tutors ?? 0} linked tutors` },
      { id: "assignments", name: `${record._count?.assignments ?? 0} allocations` },
    ]);
  }
  return relatedCard("Allocation details", [
    { id: "student", name: `Student: ${record.student?.fullName ?? "-"}` },
    { id: "tutor", name: `Tutor: ${record.tutor?.fullName ?? "-"}` },
    { id: "subject", name: `Subject: ${subjectLabel(record.subject) || "-"}` },
  ]);
}

function relatedCard(title: string, items: RecordMap[] = []) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black text-navy">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-4 text-sm font-bold text-slate-500">No linked records yet.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-md bg-slate-50 p-3 text-sm font-bold text-navy">
              {item.fullName || item.name}
              {item.status && <span className="ml-2 text-xs text-slate-500">{item.status}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function detailItems(entity: EntityName, record: RecordMap): Array<[string, ReactNode]> {
  if (entity === "parents") {
    return [
      ["Email", record.email],
      ["Portal account", record.user ? `${record.user.name} / ${record.user.email}` : "Not linked"],
      ["Phone", record.phone],
      ["Preferred contact", record.preferredContactMethod],
      ["Country", record.country],
      ["Time zone", record.timeZone],
      ["Emergency contact", [record.emergencyContactName, record.emergencyContactPhone, record.emergencyContactRelationship].filter(Boolean).join(" / ")],
      ["Status", record.status],
      ["Notes", record.notes],
    ];
  }
  if (entity === "students") {
    return [
      ["Parent", record.parent?.fullName],
      ["Portal account", record.user ? `${record.user.name} / ${record.user.email}` : "No direct student login"],
      ["Direct login disabled", yesNo(record.directLoginDisabled)],
      ["Date of birth", dateText(record.dateOfBirth)],
      ["Age", record.age],
      ["Year group", record.yearGroup],
      ["Country", record.country],
      ["Time zone", record.timeZone],
      ["School", record.schoolOrInstitution],
      ["Exam pathway", record.examPathway],
      ["Subjects", names(record.subjects)],
      ["Start date", dateText(record.startDate)],
      ["Status", record.status],
      ["Goals", record.academicGoals],
      ["Learning needs", record.learningNeeds],
      ["Important notes", record.importantNotes],
    ];
  }
  if (entity === "tutors") {
    return [
      ["Email", record.email],
      ["Portal account", record.user ? `${record.user.name} / ${record.user.email}` : "Not linked"],
      ["Phone", record.phone],
      ["Country", record.country],
      ["Time zone", record.timeZone],
      ["Subjects", names(record.subjects)],
      ["Qualifications", record.qualifications],
      ["Experience", record.teachingExperience],
      ["Availability", record.availability],
      ["Rate information", record.rateInformation],
      ["CV", record.cvFileName],
      ["Primary device", record.primaryTeachingDevice],
      ["Operating system", record.operatingSystem],
      ["Internet", record.internetConnectionType],
      ["Speed", record.averageInternetSpeed],
      ["Backup internet", yesNo(record.backupInternet)],
      ["Webcam", yesNo(record.webcamAvailable)],
      ["Headset", yesNo(record.headsetMicrophoneAvailable)],
      ["Quiet environment", yesNo(record.quietTeachingEnvironment)],
      ["Platforms", record.onlineTeachingPlatforms],
      ["Internal notes", record.internalPerformanceNotes],
    ];
  }
  if (entity === "subjects") {
    return [
      ["Name", record.name],
      ["Category", record.category],
      ["Exam pathway", record.examPathway],
      ["Status", record.isActive ? "ACTIVE" : "INACTIVE"],
      ["Description", record.description],
    ];
  }
  return [
    ["Student", record.student?.fullName],
    ["Tutor", record.tutor?.fullName],
    ["Subject", subjectLabel(record.subject)],
    ["Start date", dateText(record.startDate)],
    ["End date", dateText(record.endDate)],
    ["Status", record.status],
    ["Notes", record.notes],
  ];
}

function titleCell(title: ReactNode, subtitle?: ReactNode) {
  return (
    <div>
      <p className="font-black text-navy">{title}</p>
      {subtitle && <p className="text-xs font-bold text-slate-500">{subtitle}</p>}
    </div>
  );
}

function displayName(entity: EntityName, record: RecordMap) {
  if (entity === "subjects") return subjectLabel(record);
  if (entity === "assignments") return `${record.student?.fullName ?? "Student"} / ${record.tutor?.fullName ?? "Tutor"}`;
  return record.fullName;
}

function names(items: RecordMap[] = []) {
  return items.map(optionLabel).filter(Boolean).join(", ") || "-";
}

function optionLabel(item?: RecordMap | null) {
  return subjectLabel(item) || item?.fullName || item?.name || "";
}

function subjectLabel(subject?: RecordMap | null) {
  if (!subject?.name) {
    return "";
  }
  return subject.examPathway ? `${subject.name} - ${subject.examPathway}` : subject.name;
}

function countryCell(record: RecordMap) {
  return [record.country, record.timeZone].filter(Boolean).join(" / ") || "-";
}

function dateInput(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function dateText(value?: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value)) : "-";
}

function booleanSelect(value?: boolean | null) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "";
}

function yesNo(value?: boolean | null) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "-";
}

function statusTone(status: string): "success" | "warning" | "danger" {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED" || status === "ARCHIVED" || status === "INACTIVE") return "danger";
  return "warning";
}

function singularKey(entity: EntityName) {
  if (entity === "parents") return "parent";
  if (entity === "students") return "student";
  if (entity === "tutors") return "tutor";
  if (entity === "subjects") return "subject";
  return "assignment";
}
