import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Download, Plus, RefreshCcw } from "lucide-react";
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

const months = [
  ["1", "January"],
  ["2", "February"],
  ["3", "March"],
  ["4", "April"],
  ["5", "May"],
  ["6", "June"],
  ["7", "July"],
  ["8", "August"],
  ["9", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
];

const tutorFlagTypes = [
  ["MISSING_LESSON", "Missing lesson"],
  ["INCORRECT_DURATION", "Incorrect duration"],
  ["INCORRECT_RATE", "Incorrect rate"],
  ["OTHER", "Other"],
];

export function PayrollRoute({ routePath, currentUser }: { routePath: string; currentUser: PortalUser }) {
  const match = routePath.match(/^\/portal\/timesheets\/([^/]+)$/);
  if (match) {
    return <TimesheetDetail timesheetId={match[1]} currentUser={currentUser} />;
  }
  return <TimesheetsOverview currentUser={currentUser} />;
}

function TimesheetsOverview({ currentUser }: { currentUser: PortalUser }) {
  const canManage = canManagePayroll(currentUser);
  const [lookups, setLookups] = useState<RecordMap>({});
  const [timesheets, setTimesheets] = useState<RecordMap[]>([]);
  const [rates, setRates] = useState<RecordMap[]>([]);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const now = useMemo(() => new Date(), []);

  async function loadData(filters: RecordMap = {}) {
    setStatus("loading");
    setMessage("");
    try {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (String(value ?? "").trim()) {
          query.set(key, String(value));
        }
      });
      const [lookupsResult, timesheetsResult, ratesResult] = await Promise.all([
        portalApi<RecordMap>("/api/portal/payroll/lookups"),
        portalApi<{ timesheets: RecordMap[] }>(`/api/portal/timesheets${query.size ? `?${query.toString()}` : ""}`),
        portalApi<{ rates: RecordMap[] }>("/api/portal/tutor-rates"),
      ]);
      setLookups(lookupsResult);
      setTimesheets(timesheetsResult.timesheets ?? []);
      setRates(ratesResult.rates ?? []);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load timesheets.");
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function submitJson(endpoint: string, form: HTMLFormElement, successMessage: string) {
    setMessage("");
    try {
      await portalApi<RecordMap>(endpoint, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      form.reset();
      setMessage(successMessage);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save payroll record.");
    }
  }

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadData(Object.fromEntries(new FormData(event.currentTarget).entries()));
  }

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Monthly Timesheets"
        eyebrow="Tutor Payroll"
        action={
          <PortalButton type="button" variant="ghost" onClick={() => loadData()}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </PortalButton>
        }
      >
        <PortalAlert title="Daily reports remain separate" tone="info">
          Monthly timesheets are generated from completed lesson records for payment verification. Missing daily lesson reports are flagged for review.
        </PortalAlert>
        {message && (
          <div className="mt-5">
            <PortalAlert title={message.includes("Could not") || message.includes("required") || message.includes("Access") ? "Timesheet warning" : "Payroll updated"} tone={message.includes("Could not") || message.includes("required") || message.includes("Access") ? "warning" : "success"}>
              {message}
            </PortalAlert>
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <GenerateTimesheetForm
            canManage={canManage}
            lookups={lookups}
            defaultMonth={now.getMonth() + 1}
            defaultYear={now.getFullYear()}
            onSubmit={(form) => submitJson("/api/portal/timesheets/generate", form, "Timesheet generated from lesson records.")}
          />
          <TimesheetFilterForm lookups={lookups} canManage={canManage} onSubmit={handleFilter} />
        </div>

        <div className="mt-6">
          {status === "loading" && <PortalLoadingSkeleton rows={6} />}
          {status === "error" && <PortalAlert title="Could not load timesheets" tone="error">{message}</PortalAlert>}
          {status === "success" && timesheets.length === 0 && <PortalEmptyState title="No monthly timesheets yet" message="Generate a monthly timesheet after completed lesson records exist." />}
          {status === "success" && timesheets.length > 0 && <TimesheetListTable timesheets={timesheets} />}
        </div>
      </PortalCard>

      {canManage && (
        <TutorRateManager
          lookups={lookups}
          rates={rates}
          onSubmit={(form) => submitJson("/api/portal/tutor-rates", form, "Tutor rate history saved. Historical rates are retained.")}
        />
      )}
    </div>
  );
}

function GenerateTimesheetForm({
  canManage,
  lookups,
  defaultMonth,
  defaultYear,
  onSubmit,
}: {
  canManage: boolean;
  lookups: RecordMap;
  defaultMonth: number;
  defaultYear: number;
  onSubmit: (form: HTMLFormElement) => void;
}) {
  return (
    <form className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); onSubmit(event.currentTarget); }}>
      <h3 className="text-lg font-black text-navy md:col-span-2">Generate Monthly Timesheet</h3>
      {canManage && <LookupSelect id="tutorId" label="Tutor" records={lookups.tutors ?? []} required />}
      <PortalSelect id="month" label="Month covered" required defaultValue={String(defaultMonth)}>
        {months.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </PortalSelect>
      <PortalInput id="year" label="Year" type="number" min="2020" max="2200" required defaultValue={defaultYear} />
      <div className="md:col-span-2">
        <PortalButton type="submit">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Generate from Completed Lessons
        </PortalButton>
      </div>
    </form>
  );
}

function TimesheetFilterForm({ lookups, canManage, onSubmit }: { lookups: RecordMap; canManage: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={onSubmit}>
      <h3 className="text-lg font-black text-navy md:col-span-2 xl:col-span-4">Filter Timesheets</h3>
      {canManage && <LookupSelect id="tutorId" label="Tutor" records={lookups.tutors ?? []} />}
      <PortalSelect id="month" label="Month">
        <option value="">Any month</option>
        {months.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </PortalSelect>
      <PortalInput id="year" label="Year" type="number" min="2020" max="2200" />
      <PortalSelect id="status" label="Status" options={lookups.timesheetStatuses ?? []} />
      <div className="flex items-end">
        <PortalButton type="submit" className="w-full">Apply Filters</PortalButton>
      </div>
    </form>
  );
}

function TimesheetListTable({ timesheets }: { timesheets: RecordMap[] }) {
  return (
    <PortalTable
      columns={["Month", "Tutor", "Status", "Lessons", "Hours", "Final Payable", "Actions"]}
      rows={timesheets.map((timesheet) => [
        `${monthName(timesheet.monthCovered)} ${timesheet.yearCovered}`,
        <div>
          <p className="font-black text-navy">{timesheet.tutor?.fullName || "-"}</p>
          <p className="text-xs font-bold text-slate-500">{timesheet.tutor?.email || ""}</p>
        </div>,
        <PortalBadge tone={timesheetStatusTone(timesheet.status)}>{statusLabel(timesheet.status)}</PortalBadge>,
        String(timesheet.totalLessons ?? 0),
        money(timesheet.totalHours, ""),
        money(timesheet.finalAmountPayable),
        <a href={`/portal/timesheets/${timesheet.id}`} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50">Review</a>,
      ])}
    />
  );
}

function TutorRateManager({ lookups, rates, onSubmit }: { lookups: RecordMap; rates: RecordMap[]; onSubmit: (form: HTMLFormElement) => void }) {
  return (
    <PortalCard title="Tutor Rate History" eyebrow="Finance Controls">
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <form className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); onSubmit(event.currentTarget); }}>
          <h3 className="text-lg font-black text-navy md:col-span-2">Add Approved Rate</h3>
          <LookupSelect id="tutorId" label="Tutor" records={lookups.tutors ?? []} required />
          <RateTypeSelect id="rateType" label="Rate type" rateTypes={lookups.rateTypes ?? []} required />
          <PortalInput id="amount" label="Amount" type="number" step="0.01" min="0" required />
          <PortalInput id="currency" label="Currency" maxLength={3} required defaultValue="GBP" />
          <PortalInput id="effectiveDate" label="Effective date" type="date" required defaultValue={dateInput(new Date())} />
          <PortalInput id="endDate" label="End date" type="date" />
          <PortalTextarea id="notes" label="Notes" className="md:col-span-2" />
          <div className="md:col-span-2">
            <PortalButton type="submit">Save Rate History</PortalButton>
          </div>
        </form>

        <div>
          {rates.length === 0 ? (
            <PortalEmptyState title="No tutor rates yet" message="Add approved rate history before generating payable timesheets." />
          ) : (
            <PortalTable
              columns={["Tutor", "Rate Type", "Amount", "Effective", "Approved By"]}
              rows={rates.map((rate) => [
                rate.tutor?.fullName || "-",
                rateTypeLabel(rate.rateType, lookups.rateTypes ?? []),
                money(rate.amount, rate.currency),
                `${dateText(rate.effectiveDate)}${rate.endDate ? ` to ${dateText(rate.endDate)}` : ""}`,
                rate.approvedBy?.name || "-",
              ])}
            />
          )}
        </div>
      </div>
    </PortalCard>
  );
}

function TimesheetDetail({ timesheetId, currentUser }: { timesheetId: string; currentUser: PortalUser }) {
  const canManage = canManagePayroll(currentUser);
  const canPay = hasPortalPermission(currentUser, "finance:manage");
  const [timesheet, setTimesheet] = useState<RecordMap | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [flagEntry, setFlagEntry] = useState<RecordMap | null>(null);

  async function loadTimesheet() {
    setStatus("loading");
    setMessage("");
    try {
      const result = await portalApi<{ timesheet: RecordMap }>(`/api/portal/timesheets/${timesheetId}`);
      setTimesheet(result.timesheet);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load timesheet.");
    }
  }

  useEffect(() => {
    void loadTimesheet();
  }, [timesheetId]);

  async function postJson(endpoint: string, body: RecordMap, successMessage: string) {
    setMessage("");
    try {
      const result = await portalApi<{ timesheet: RecordMap }>(endpoint, { method: "POST", body: JSON.stringify(body) });
      setTimesheet(result.timesheet);
      setMessage(successMessage);
      setFlagEntry(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    }
  }

  function submitForm(endpoint: string, form: HTMLFormElement, successMessage: string) {
    void postJson(endpoint, Object.fromEntries(new FormData(form).entries()), successMessage);
  }

  if (status === "loading") {
    return <PortalLoadingSkeleton rows={8} />;
  }

  if (status === "error" || !timesheet) {
    return <PortalAlert title="Could not load timesheet" tone="error">{message}</PortalAlert>;
  }

  const entries = timesheet.entries ?? [];
  const missingReports = entries.filter((entry: RecordMap) => !entry.lessonReportSubmitted || entry.reportStatus !== "SUBMITTED");
  const reviewRows = entries.filter((entry: RecordMap) => entry.paymentEligibility === "REVIEW");

  return (
    <div className="grid gap-6">
      <PortalCard
        title={`${monthName(timesheet.monthCovered)} ${timesheet.yearCovered} Timesheet`}
        eyebrow={timesheet.tutor?.fullName || "Tutor Payroll"}
        action={
          <div className="flex flex-wrap gap-2">
            <a href="/portal/timesheets" className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:border-gold hover:bg-gold-50">Back</a>
            <a href={`/api/portal/timesheets/${timesheet.id}/statement`} className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-gold-100">
              <Download className="h-4 w-4" aria-hidden="true" />
              Statement
            </a>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Status" value={statusLabel(timesheet.status)} />
          <MetricCard label="Lessons" value={String(timesheet.totalLessons ?? 0)} />
          <MetricCard label="Hours" value={money(timesheet.totalHours, "")} />
          <MetricCard label="Final Payable" value={money(timesheet.finalAmountPayable)} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <PortalAlert title="Payment rules" tone="info">
            Only completed and verified lessons are payable by default. Missing reports and student no-shows are marked for review.
          </PortalAlert>
          {missingReports.length > 0 && (
            <PortalAlert title="Missing daily lesson reports" tone="warning">
              {missingReports.length} row{missingReports.length === 1 ? "" : "s"} may delay payment until daily lesson reports are submitted.
            </PortalAlert>
          )}
          {reviewRows.length > 0 && (
            <PortalAlert title="Rows need review" tone="warning">
              {reviewRows.length} row{reviewRows.length === 1 ? "" : "s"} require finance or admin verification.
            </PortalAlert>
          )}
          {message && (
            <PortalAlert title={message.includes("failed") || message.includes("required") || message.includes("Access") ? "Action warning" : "Action completed"} tone={message.includes("failed") || message.includes("required") || message.includes("Access") ? "warning" : "success"}>
              {message}
            </PortalAlert>
          )}
        </div>
      </PortalCard>

      <TimesheetTotalsCard timesheet={timesheet} />

      <PortalCard title="Generated Lesson Rows" eyebrow="Payment Calculation">
        {entries.length === 0 ? (
          <PortalEmptyState title="No generated rows" message="Generate this timesheet from completed lessons to create payment rows." />
        ) : (
          <>
            <div className="grid gap-4 lg:hidden">
              {entries.map((entry: RecordMap) => <TimesheetEntryCard key={entry.id} entry={entry} onFlag={() => setFlagEntry(entry)} />)}
            </div>
            <div className="hidden lg:block">
              <TimesheetEntryTable entries={entries} onFlag={setFlagEntry} />
            </div>
          </>
        )}
      </PortalCard>

      {flagEntry && (
        <PortalCard title="Flag Timesheet Row" eyebrow={flagEntry.studentName}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); submitForm(`/api/portal/timesheets/${timesheet.id}/flag-entry`, event.currentTarget, "Timesheet row flagged for review."); }}>
            <input type="hidden" name="entryId" value={flagEntry.id} />
            <PortalSelect id="flagType" label="Flag type" required>
              <option value="">Select an option</option>
              {tutorFlagTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </PortalSelect>
            <PortalTextarea id="note" label="Flag note" required className="md:col-span-2" />
            <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row">
              <PortalButton type="submit">Submit Flag</PortalButton>
              <PortalButton type="button" variant="ghost" onClick={() => setFlagEntry(null)}>Cancel</PortalButton>
            </div>
          </form>
        </PortalCard>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <TutorSubmitPanel timesheet={timesheet} onSubmit={(form) => submitForm(`/api/portal/timesheets/${timesheet.id}/submit`, form, "Timesheet submitted for approval.")} />
        {canManage && <AdminReviewPanel timesheet={timesheet} canPay={canPay} onAction={(body, successMessage) => postJson(`/api/portal/timesheets/${timesheet.id}/status`, body, successMessage)} />}
      </div>

      {canManage && (
        <AdminAdjustmentPanel timesheet={timesheet} onSubmit={(form) => submitForm(`/api/portal/timesheets/${timesheet.id}/adjustments`, form, "Authorised adjustment added.")} />
      )}
    </div>
  );
}

function TimesheetTotalsCard({ timesheet }: { timesheet: RecordMap }) {
  return (
    <PortalCard title="Totals" eyebrow="Payroll Summary">
      <DetailGrid
        items={[
          ["Total lessons delivered", timesheet.totalLessons],
          ["Total students taught", timesheet.totalStudents],
          ["Total subjects taught", timesheet.totalSubjects],
          ["Total hours completed", money(timesheet.totalHours, "")],
          ["Standard tutoring total", money(timesheet.standardTutoringTotal)],
          ["Shadow-session total", money(timesheet.shadowSessionTotal)],
          ["NVQ-support total", money(timesheet.nvqSupportTotal)],
          ["Subtotal payable", money(timesheet.totalAmountDue)],
          ["Adjustments", money(timesheet.adjustmentsTotal)],
          ["Final amount payable", money(timesheet.finalAmountPayable)],
          ["Tutor notes", timesheet.tutorNotes],
          ["Payment reference", timesheet.transactionReference],
        ]}
      />
      {timesheet.adjustments?.length > 0 && (
        <div className="mt-6">
          <PortalTable
            columns={["Amount", "Reason", "Approved By", "Date"]}
            rows={timesheet.adjustments.map((adjustment: RecordMap) => [
              money(adjustment.amount, adjustment.currency),
              adjustment.reason,
              adjustment.approvedBy?.name || "-",
              dateText(adjustment.createdAt),
            ])}
          />
        </div>
      )}
    </PortalCard>
  );
}

function TimesheetEntryTable({ entries, onFlag }: { entries: RecordMap[]; onFlag: (entry: RecordMap) => void }) {
  return (
    <PortalTable
      columns={["Date", "Student", "Subject", "Type", "Hours", "Rate", "Amount", "Eligibility", "Report", "Action"]}
      rows={entries.map((entry) => [
        <div>
          <p className="font-black text-navy">{dateText(entry.date)}</p>
          <p className="text-xs font-bold text-slate-500">{entry.lessonTime}</p>
        </div>,
        entry.studentName,
        entry.subject,
        entry.lessonType,
        money(entry.hoursTaught, ""),
        `${money(entry.rate, entry.currency)} ${rateTypeShort(entry.rateType)}`,
        money(entry.amountDue, entry.currency),
        <div>
          <PortalBadge tone={eligibilityTone(entry.paymentEligibility)}>{statusLabel(entry.paymentEligibility)}</PortalBadge>
          <p className="mt-2 text-xs font-bold text-slate-500">{entry.eligibilityReason}</p>
        </div>,
        entry.lessonReportSubmitted ? <PortalBadge tone="success">Submitted</PortalBadge> : <PortalBadge tone="warning">Missing</PortalBadge>,
        <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50" onClick={() => onFlag(entry)}>Flag</button>,
      ])}
    />
  );
}

function TimesheetEntryCard({ entry, onFlag }: { entry: RecordMap; onFlag: () => void }) {
  return (
    <article className={`rounded-lg border p-4 ${entry.paymentEligibility === "REVIEW" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-navy">{entry.studentName}</h3>
          <p className="mt-1 text-xs font-bold text-slate-500">{dateText(entry.date)} - {entry.lessonTime}</p>
        </div>
        <PortalBadge tone={eligibilityTone(entry.paymentEligibility)}>{statusLabel(entry.paymentEligibility)}</PortalBadge>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <p><span className="font-black text-navy">Subject:</span> {entry.subject}</p>
        <p><span className="font-black text-navy">Type:</span> {entry.lessonType}</p>
        <p><span className="font-black text-navy">Hours:</span> {money(entry.hoursTaught, "")}</p>
        <p><span className="font-black text-navy">Rate:</span> {money(entry.rate, entry.currency)} {rateTypeShort(entry.rateType)}</p>
        <p><span className="font-black text-navy">Amount:</span> {money(entry.amountDue, entry.currency)}</p>
        <p><span className="font-black text-navy">Attendance:</span> {entry.attendanceStatus || "-"}</p>
        <p><span className="font-black text-navy">Report:</span> {entry.lessonReportSubmitted ? "Submitted" : "Missing"}</p>
        {entry.eligibilityReason && <p className="font-bold text-amber-800">{entry.eligibilityReason}</p>}
        {entry.tutorFlagNote && <p><span className="font-black text-navy">Tutor flag:</span> {entry.tutorFlagNote}</p>}
      </div>
      <PortalButton type="button" variant="ghost" className="mt-4 w-full" onClick={onFlag}>Flag Row</PortalButton>
    </article>
  );
}

function TutorSubmitPanel({ timesheet, onSubmit }: { timesheet: RecordMap; onSubmit: (form: HTMLFormElement) => void }) {
  const canSubmit = timesheet.status === "DRAFT" || timesheet.status === "RETURNED";
  return (
    <PortalCard title="Tutor Submission" eyebrow="Tutor Action">
      {!canSubmit && <PortalAlert title="Timesheet already submitted" tone="info">This timesheet is not currently editable by the tutor submission flow.</PortalAlert>}
      {timesheet.returnReason && <PortalAlert title="Returned for correction" tone="warning">{timesheet.returnReason}</PortalAlert>}
      <form className="mt-5 grid gap-4" onSubmit={(event) => { event.preventDefault(); onSubmit(event.currentTarget); }}>
        <PortalTextarea id="tutorNotes" label="Additional notes for admin" defaultValue={timesheet.tutorNotes ?? ""} />
        <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-navy">
          <input name="declaration" type="checkbox" required disabled={!canSubmit} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold focus:ring-gold" />
          <span>I confirm that this monthly timesheet is accurate and only includes completed lessons delivered during the month stated above.</span>
        </label>
        <PortalButton type="submit" disabled={!canSubmit}>Submit Timesheet for Approval</PortalButton>
      </form>
    </PortalCard>
  );
}

function AdminReviewPanel({ timesheet, canPay, onAction }: { timesheet: RecordMap; canPay: boolean; onAction: (body: RecordMap, message: string) => void }) {
  return (
    <PortalCard title="Admin Review" eyebrow="Finance Approval">
      <div className="grid gap-4">
        <PortalAlert title="Approval responsibility" tone="warning">
          Tutors cannot approve their own payment. Missing reports and review rows should be checked before approval.
        </PortalAlert>
        <div className="flex flex-wrap gap-2">
          <PortalButton type="button" variant="ghost" onClick={() => onAction({ status: "UNDER_REVIEW" }, "Timesheet marked under review.")}>Under Review</PortalButton>
          <PortalButton type="button" onClick={() => onAction({ status: "APPROVED" }, "Timesheet approved.")}>Approve</PortalButton>
        </div>
        <form className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={(event) => { event.preventDefault(); const body = Object.fromEntries(new FormData(event.currentTarget).entries()); onAction(body, body.status === "RETURNED" ? "Timesheet returned for correction." : "Timesheet rejected."); }}>
          <PortalSelect id="status" label="Correction action" required>
            <option value="RETURNED">Return for correction</option>
            <option value="REJECTED">Reject</option>
          </PortalSelect>
          <PortalTextarea id="reason" label="Reason" required />
          <PortalButton type="submit" variant="ghost">Save Review Decision</PortalButton>
        </form>
        {canPay && (
          <form className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={(event) => { event.preventDefault(); const body = Object.fromEntries(new FormData(event.currentTarget).entries()); onAction({ ...body, status: "PAID" }, "Timesheet marked as paid."); }}>
            <PortalInput id="paymentDate" label="Payment date" type="date" required defaultValue={dateInput(new Date())} />
            <PortalInput id="transactionReference" label="Transaction reference" required />
            <PortalButton type="submit" variant="secondary" disabled={timesheet.status !== "APPROVED"}>Mark as Paid</PortalButton>
          </form>
        )}
      </div>
    </PortalCard>
  );
}

function AdminAdjustmentPanel({ timesheet, onSubmit }: { timesheet: RecordMap; onSubmit: (form: HTMLFormElement) => void }) {
  return (
    <PortalCard title="Authorised Adjustment" eyebrow="Manual Finance Control">
      <form className="grid gap-4 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); onSubmit(event.currentTarget); }}>
        <PortalInput id="amount" label="Adjustment amount" type="number" step="0.01" required disabled={timesheet.status === "PAID"} />
        <PortalInput id="currency" label="Currency" maxLength={3} required defaultValue="GBP" disabled={timesheet.status === "PAID"} />
        <PortalTextarea id="reason" label="Reason" required className="md:col-span-3" disabled={timesheet.status === "PAID"} />
        <div className="md:col-span-3">
          <PortalButton type="submit" disabled={timesheet.status === "PAID"}>Add Authorised Adjustment</PortalButton>
        </div>
      </form>
    </PortalCard>
  );
}

function LookupSelect({ id, label, records, required = false }: { id: string; label: string; records: RecordMap[]; required?: boolean }) {
  return (
    <PortalSelect id={id} label={label} required={required}>
      <option value="">Select an option</option>
      {records.map((record) => (
        <option key={record.id} value={record.id}>{record.fullName || record.name}</option>
      ))}
    </PortalSelect>
  );
}

function RateTypeSelect({ id, label, rateTypes, required = false }: { id: string; label: string; rateTypes: RecordMap[]; required?: boolean }) {
  return (
    <PortalSelect id={id} label={label} required={required}>
      <option value="">Select an option</option>
      {rateTypes.map((rateType) => (
        <option key={rateType.key} value={rateType.key}>{rateType.label}</option>
      ))}
    </PortalSelect>
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-navy">{value}</p>
    </div>
  );
}

function canManagePayroll(user: PortalUser) {
  return hasPortalPermission(user, "timesheets:manage") || hasPortalPermission(user, "finance:manage");
}

function rateTypeLabel(value: string, rateTypes: RecordMap[]) {
  return rateTypes.find((rateType) => rateType.key === value)?.label || statusLabel(value);
}

function rateTypeShort(value?: string | null) {
  if (value === "STANDARD_HOURLY") return "hourly";
  if (value === "SHADOW_SESSION_FLAT") return "flat shadow";
  if (value === "NVQ_PER_UNIT") return "per unit";
  if (value === "CUSTOM") return "custom";
  return "no rate";
}

function timesheetStatusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "APPROVED" || status === "PAID") return "success";
  if (status === "RETURNED" || status === "SUBMITTED" || status === "UNDER_REVIEW") return "warning";
  if (status === "REJECTED") return "danger";
  return "neutral";
}

function eligibilityTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "PAYABLE") return "success";
  if (status === "NOT_PAYABLE") return "danger";
  if (status === "REVIEW") return "warning";
  return "neutral";
}

function statusLabel(value?: string | null) {
  return String(value || "-").replace(/_/g, " ");
}

function money(value: unknown, currency = "GBP") {
  const number = Number(value ?? 0);
  const amount = Number.isFinite(number) ? number.toFixed(2) : "0.00";
  return currency ? `${currency} ${amount}` : amount;
}

function dateInput(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function dateText(value?: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value)) : "-";
}

function monthName(value: number | string) {
  return months.find(([month]) => month === String(value))?.[1] || String(value);
}
