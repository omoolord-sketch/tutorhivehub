import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Ban, CreditCard, Download, Plus, ReceiptText, RefreshCcw, Send } from "lucide-react";
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

export function FinanceRoute({ routePath, currentUser }: { routePath: string; currentUser: PortalUser }) {
  const invoiceMatch = routePath.match(/^\/portal\/finance\/invoices\/([^/]+)$/);
  if (invoiceMatch) {
    return <InvoiceDetailPage invoiceId={invoiceMatch[1]} currentUser={currentUser} />;
  }

  if (hasPortalPermission(currentUser, "finance:manage")) {
    return <AdminFinancePage />;
  }

  return <ParentFinancePage />;
}

function AdminFinancePage() {
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [dashboard, setDashboard] = useState<RecordMap | null>(null);
  const [lookups, setLookups] = useState<RecordMap>({});
  const [invoices, setInvoices] = useState<RecordMap[]>([]);
  const [feePlans, setFeePlans] = useState<RecordMap[]>([]);
  const [payments, setPayments] = useState<RecordMap[]>([]);

  async function loadFinance() {
    setStatus("loading");
    setMessage("");
    try {
      const [dashboardResult, lookupsResult, invoicesResult, feePlansResult, paymentsResult] = await Promise.all([
        portalApi<{ dashboard: RecordMap }>("/api/portal/finance/dashboard"),
        portalApi<RecordMap>("/api/portal/finance/lookups"),
        portalApi<{ invoices: RecordMap[] }>("/api/portal/invoices"),
        portalApi<{ feePlans: RecordMap[] }>("/api/portal/fee-plans"),
        portalApi<{ payments: RecordMap[] }>("/api/portal/payments"),
      ]);
      setDashboard(dashboardResult.dashboard);
      setLookups(lookupsResult);
      setInvoices(invoicesResult.invoices);
      setFeePlans(feePlansResult.feePlans);
      setPayments(paymentsResult.payments);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load finance dashboard.");
    }
  }

  useEffect(() => {
    void loadFinance();
  }, []);

  async function submitForm(endpoint: string, form: HTMLFormElement, successMessage: string) {
    setMessage("");
    try {
      await portalApi<RecordMap>(endpoint, { method: "POST", body: JSON.stringify(formPayload(form)) });
      form.reset();
      setMessage(successMessage);
      await loadFinance();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save finance record.");
    }
  }

  if (status === "loading") return <PortalLoadingSkeleton rows={8} />;
  if (status === "error") return <PortalAlert title="Could not load finance" tone="error">{message}</PortalAlert>;

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Finance Dashboard"
        eyebrow="Student Billing"
        action={
          <PortalButton type="button" variant="ghost" onClick={loadFinance}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </PortalButton>
        }
      >
        <PortalAlert title="Student billing is separate from tutor payroll" tone="info">
          Invoices, receipts, parent payments, refunds, and corrections are managed here. Tutor timesheets remain under the Timesheets module.
        </PortalAlert>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Metric label="Total invoiced" value={money(dashboard?.totalInvoiced)} />
          <Metric label="Total received" value={money(dashboard?.totalReceived)} />
          <Metric label="Outstanding" value={money(dashboard?.outstandingBalance)} />
          <Metric label="Overdue invoices" value={String(dashboard?.overdueInvoices?.length ?? 0)} />
          <Metric label="Payments this month" value={String(dashboard?.paymentsThisMonth ?? 0)} />
          <Metric label="Refunds" value={money(dashboard?.refunds)} />
        </div>
      </PortalCard>

      {message && <PortalAlert title={message.includes("Could not") || message.includes("required") ? "Finance action failed" : "Finance action saved"} tone={message.includes("Could not") || message.includes("required") ? "error" : "success"}>{message}</PortalAlert>}

      <div className="grid gap-6 xl:grid-cols-2">
        <CreateInvoiceForm lookups={lookups} onSubmit={(form) => submitForm("/api/portal/invoices", form, "Invoice created successfully.")} />
        <FeePlanForm lookups={lookups} onSubmit={(form) => submitForm("/api/portal/fee-plans", form, "Fee plan saved successfully.")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <InvoiceList invoices={invoices} />
        <FinanceBreakdown dashboard={dashboard} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <FeePlanList feePlans={feePlans} />
        <PaymentList payments={payments} />
      </div>
    </div>
  );
}

function ParentFinancePage() {
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [finance, setFinance] = useState<RecordMap | null>(null);

  async function loadFinance() {
    setStatus("loading");
    setMessage("");
    try {
      const result = await portalApi<{ finance: RecordMap }>("/api/portal/family/finance");
      setFinance(result.finance);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load family finance.");
    }
  }

  useEffect(() => {
    void loadFinance();
  }, []);

  if (status === "loading") return <PortalLoadingSkeleton rows={8} />;
  if (status === "error" || !finance) return <PortalAlert title="Could not load finance" tone="error">{message}</PortalAlert>;

  return (
    <div className="grid gap-6">
      <PortalCard
        title="Family Finance"
        eyebrow={finance.parent?.fullName}
        action={
          <PortalButton type="button" variant="ghost" onClick={loadFinance}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </PortalButton>
        }
      >
        <PortalAlert title="Private family billing" tone="success">
          This page only shows invoices, payments, and receipts linked to your TutorHiveHub family account.
        </PortalAlert>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total invoiced" value={money(finance.totals?.totalInvoiced)} />
          <Metric label="Paid" value={money(finance.totals?.amountPaid)} />
          <Metric label="Outstanding balance" value={money(finance.totals?.outstandingBalance)} />
          <Metric label="Overdue invoices" value={String(finance.totals?.overdueCount ?? 0)} />
        </div>
      </PortalCard>

      <PortalCard title="Invoices" eyebrow="Outstanding and History">
        {(finance.invoices ?? []).length === 0 ? (
          <PortalEmptyState title="No invoices yet" message="Invoices will appear here once TutorHiveHub issues them." />
        ) : (
          <div className="grid gap-4">
            {(finance.invoices ?? []).map((invoice: RecordMap) => (
              <article key={invoice.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-black text-navy">{invoice.invoiceNumber}</h3>
                    <p className="mt-1 text-sm font-bold text-slate-600">{invoice.service} - {invoice.student?.fullName || "Student"}</p>
                    <p className="mt-2 text-sm text-slate-650">Balance due: <span className="font-black text-navy">{money(invoice.balanceDue, invoice.currency)}</span></p>
                  </div>
                  <PortalBadge tone={invoiceTone(invoice.status)}>{statusLabel(invoice.status)}</PortalBadge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={`/portal/finance/invoices/${invoice.id}`} className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-gold-100">
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                    View or Pay
                  </a>
                  <DownloadLink href={`/api/portal/invoices/${invoice.id}/print`} label="Invoice" />
                </div>
              </article>
            ))}
          </div>
        )}
      </PortalCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <PaymentList payments={finance.payments ?? []} />
        <ReceiptList receipts={finance.receipts ?? []} />
      </div>
    </div>
  );
}

function InvoiceDetailPage({ invoiceId, currentUser }: { invoiceId: string; currentUser: PortalUser }) {
  const canManage = hasPortalPermission(currentUser, "finance:manage");
  const [invoice, setInvoice] = useState<RecordMap | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [paymentInfo, setPaymentInfo] = useState<RecordMap | null>(null);

  async function loadInvoice() {
    setStatus("loading");
    setMessage("");
    try {
      const result = await portalApi<{ invoice: RecordMap }>(`/api/portal/invoices/${invoiceId}`);
      setInvoice(result.invoice);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load invoice.");
    }
  }

  useEffect(() => {
    void loadInvoice();
  }, [invoiceId]);

  async function postJson(endpoint: string, body: RecordMap, successMessage: string) {
    setMessage("");
    setPaymentInfo(null);
    try {
      const result = await portalApi<RecordMap>(endpoint, { method: "POST", body: JSON.stringify(body) });
      if (result.invoice) setInvoice(result.invoice);
      setPaymentInfo(result);
      setMessage(successMessage || result.message || "Finance record updated.");
      await loadInvoice();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update invoice.");
    }
  }

  if (status === "loading") return <PortalLoadingSkeleton rows={8} />;
  if (status === "error" || !invoice) return <PortalAlert title="Could not load invoice" tone="error">{message}</PortalAlert>;

  return (
    <div className="grid gap-6">
      <PortalCard
        title={invoice.invoiceNumber}
        eyebrow="Invoice Detail"
        action={<a href="/portal/finance" className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-black text-navy shadow-sm transition hover:border-gold hover:bg-gold-50">Back to Finance</a>}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <PortalBadge tone={invoiceTone(invoice.status)}>{statusLabel(invoice.status)}</PortalBadge>
            <p className="mt-4 max-w-3xl leading-7 text-slate-650">{invoice.service} for {invoice.student?.fullName || "student"}.</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm font-bold text-slate-500">Balance due</p>
            <p className="text-3xl font-black text-navy">{money(invoice.balanceDue, invoice.currency)}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total" value={money(invoice.totalAmount, invoice.currency)} />
          <Metric label="Paid" value={money(invoice.amountPaid, invoice.currency)} />
          <Metric label="Due date" value={dateText(invoice.dueDate)} />
          <Metric label="Period" value={invoice.periodCovered || "-"} />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <DownloadLink href={`/api/portal/invoices/${invoice.id}/print`} label="Invoice" />
          {(invoice.receipts ?? []).map((receipt: RecordMap) => (
            <DownloadLink key={receipt.id} href={`/api/portal/receipts/${receipt.id}/print`} label={receipt.receiptNumber} />
          ))}
        </div>
      </PortalCard>

      {message && <PortalAlert title={message.includes("Could not") || message.includes("required") ? "Finance action failed" : "Finance action"} tone={message.includes("Could not") || message.includes("required") ? "error" : "success"}>{message}</PortalAlert>}
      {paymentInfo?.checkoutUrl && (
        <PortalAlert title="Continue online payment" tone="info">
          <a href={paymentInfo.checkoutUrl} className="font-black underline">Open secure payment page</a>
        </PortalAlert>
      )}
      {paymentInfo?.bankTransferDetails && <PortalAlert title="Bank transfer details" tone="warning">{paymentInfo.bankTransferDetails}</PortalAlert>}

      {canManage ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <AdminInvoiceActions invoice={invoice} onAction={postJson} />
          <RecordPaymentPanel invoice={invoice} onSubmit={(form) => postJson(`/api/portal/invoices/${invoice.id}/payments`, formPayload(form), "Payment recorded successfully.")} />
          <PaymentList payments={invoice.payments ?? []} onConfirm={(payment, form) => postJson(`/api/portal/payments/${payment.id}/confirm`, formPayload(form), "Payment confirmed and receipt generated.")} />
          <AdjustmentPanel invoice={invoice} onAction={postJson} />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <ParentPaymentPanel invoice={invoice} onPay={(form) => postJson(`/api/portal/invoices/${invoice.id}/pay`, formPayload(form), "Payment request created.")} />
          <ReceiptList receipts={invoice.receipts ?? []} />
        </div>
      )}
    </div>
  );
}

function CreateInvoiceForm({ lookups, onSubmit }: { lookups: RecordMap; onSubmit: (form: HTMLFormElement) => void }) {
  return (
    <PortalCard title="Create Invoice" eyebrow="Billing">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={submitTo(onSubmit)}>
        <LookupSelect id="parentId" label="Parent" records={lookups.parents ?? []} required />
        <LookupSelect id="studentId" label="Student" records={lookups.students ?? []} required />
        <FeePlanSelect id="feePlanId" label="Fee plan" records={lookups.feePlans ?? []} />
        <PortalInput id="service" label="Service" required placeholder="One-to-one tutoring" />
        <PortalInput id="billingPeriodStart" label="Billing period start" type="date" required />
        <PortalInput id="billingPeriodEnd" label="Billing period end" type="date" required />
        <PortalInput id="quantity" label="Quantity" type="number" min="0" step="0.25" required defaultValue="1" />
        <PortalInput id="rate" label="Rate" type="number" min="0" step="0.01" required defaultValue="0" />
        <PortalInput id="discountAmount" label="Discount" type="number" min="0" step="0.01" defaultValue="0" />
        <PortalInput id="currency" label="Currency" maxLength={3} required defaultValue="GBP" />
        <PortalInput id="taxAmount" label="Tax amount" type="number" min="0" step="0.01" defaultValue="0" />
        <PortalInput id="dueDate" label="Due date" type="date" required />
        <PortalSelect id="status" label="Initial status" options={["DRAFT", "SENT"]} required defaultValue="DRAFT" />
        <PortalTextarea id="notes" label="Notes" className="md:col-span-2" />
        <div className="md:col-span-2">
          <PortalButton type="submit">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Invoice
          </PortalButton>
        </div>
      </form>
    </PortalCard>
  );
}

function FeePlanForm({ lookups, onSubmit }: { lookups: RecordMap; onSubmit: (form: HTMLFormElement) => void }) {
  return (
    <PortalCard title="Create Fee Plan" eyebrow="Plans and Packages">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={submitTo(onSubmit)}>
        <PortalInput id="name" label="Plan name" required />
        <PortalSelect id="planType" label="Plan type" options={lookups.planTypes ?? []} required />
        <PortalInput id="service" label="Service" required placeholder="Combined tutoring and homework support" />
        <LookupSelect id="subjectId" label="Subject" records={lookups.subjects ?? []} />
        <PortalInput id="examPathway" label="Exam pathway" />
        <PortalSelect id="billingFrequency" label="Billing frequency" options={lookups.billingFrequencies ?? []} required defaultValue="Monthly" />
        <PortalInput id="defaultQuantity" label="Default quantity" type="number" min="0" step="0.25" required defaultValue="1" />
        <PortalInput id="defaultRate" label="Default rate" type="number" min="0" step="0.01" required defaultValue="0" />
        <PortalInput id="discountAmount" label="Default discount" type="number" min="0" step="0.01" defaultValue="0" />
        <PortalInput id="currency" label="Currency" maxLength={3} required defaultValue="GBP" />
        <PortalSelect id="status" label="Status" options={["ACTIVE", "INACTIVE"]} required defaultValue="ACTIVE" />
        <label htmlFor="scholarshipOrConcession" className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-navy">
          <input id="scholarshipOrConcession" name="scholarshipOrConcession" type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold focus:ring-gold" />
          Scholarship or concession
        </label>
        <PortalTextarea id="description" label="Description" className="md:col-span-2" />
        <PortalTextarea id="notes" label="Internal notes" className="md:col-span-2" />
        <div className="md:col-span-2">
          <PortalButton type="submit">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Save Fee Plan
          </PortalButton>
        </div>
      </form>
    </PortalCard>
  );
}

function InvoiceList({ invoices }: { invoices: RecordMap[] }) {
  return (
    <PortalCard title="Invoices" eyebrow="Student Billing">
      {invoices.length === 0 ? (
        <PortalEmptyState title="No invoices yet" message="Create the first student invoice when billing is ready." />
      ) : (
        <PortalTable
          columns={["Invoice", "Parent", "Student", "Status", "Balance", "Due", "Actions"]}
          rows={invoices.map((invoice) => [
            <span className="font-black text-navy">{invoice.invoiceNumber}</span>,
            invoice.parent?.fullName || "-",
            invoice.student?.fullName || "-",
            <PortalBadge tone={invoiceTone(invoice.status)}>{statusLabel(invoice.status)}</PortalBadge>,
            money(invoice.balanceDue, invoice.currency),
            dateText(invoice.dueDate),
            <div className="flex flex-wrap gap-2">
              <a href={`/portal/finance/invoices/${invoice.id}`} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-navy transition hover:border-gold hover:bg-gold-50">View</a>
              <DownloadLink href={`/api/portal/invoices/${invoice.id}/print`} label="Download" compact />
            </div>,
          ])}
        />
      )}
    </PortalCard>
  );
}

function FeePlanList({ feePlans }: { feePlans: RecordMap[] }) {
  return (
    <PortalCard title="Fee Plans" eyebrow="Plans">
      {feePlans.length === 0 ? (
        <PortalEmptyState title="No fee plans yet" message="Fee plans help standardise hourly, package, homework, and concession billing." />
      ) : (
        <PortalTable
          columns={["Plan", "Type", "Rate", "Status"]}
          rows={feePlans.slice(0, 10).map((plan) => [
            <div>
              <p className="font-black text-navy">{plan.name}</p>
              <p className="text-xs font-bold text-slate-500">{plan.service}</p>
            </div>,
            plan.planType,
            money(plan.defaultRate, plan.currency),
            <PortalBadge tone={plan.status === "ACTIVE" ? "success" : "neutral"}>{plan.status}</PortalBadge>,
          ])}
        />
      )}
    </PortalCard>
  );
}

function FinanceBreakdown({ dashboard }: { dashboard?: RecordMap | null }) {
  return (
    <PortalCard title="Revenue Breakdown" eyebrow="Confirmed Payments">
      <div className="grid gap-5">
        <MiniBreakdown title="By service" rows={dashboard?.revenueByService ?? []} />
        <MiniBreakdown title="By student" rows={dashboard?.revenueByStudent ?? []} />
        <MiniBreakdown title="By period" rows={dashboard?.revenueByPeriod ?? []} />
      </div>
    </PortalCard>
  );
}

function MiniBreakdown({ title, rows }: { title: string; rows: RecordMap[] }) {
  return (
    <div>
      <h3 className="text-sm font-black text-navy">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No confirmed revenue yet.</p>
      ) : (
        <div className="mt-2 grid gap-2">
          {rows.slice(0, 4).map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
              <span className="font-bold text-slate-700">{row.label}</span>
              <span className="font-black text-navy">{money(row.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminInvoiceActions({ invoice, onAction }: { invoice: RecordMap; onAction: (endpoint: string, body: RecordMap, message: string) => void }) {
  return (
    <PortalCard title="Invoice Actions" eyebrow="Finance Control">
      <div className="flex flex-wrap gap-3">
        <PortalButton type="button" variant="secondary" disabled={invoice.status !== "DRAFT"} onClick={() => onAction(`/api/portal/invoices/${invoice.id}/status`, { status: "SENT" }, "Invoice marked as sent.")}>
          <Send className="h-4 w-4" aria-hidden="true" />
          Mark Sent
        </PortalButton>
        <PortalButton type="button" variant="danger" disabled={invoice.status === "PAID" || invoice.status === "CANCELLED"} onClick={() => onAction(`/api/portal/invoices/${invoice.id}/status`, { status: "CANCELLED" }, "Invoice cancelled.")}>
          <Ban className="h-4 w-4" aria-hidden="true" />
          Cancel Invoice
        </PortalButton>
      </div>
    </PortalCard>
  );
}

function RecordPaymentPanel({ invoice, onSubmit }: { invoice: RecordMap; onSubmit: (form: HTMLFormElement) => void }) {
  return (
    <PortalCard title="Record Payment" eyebrow="Manual Confirmation">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={submitTo(onSubmit)}>
        <PortalInput id="amount" label="Amount" type="number" min="0" step="0.01" required defaultValue={moneyNumber(invoice.balanceDue)} />
        <PortalInput id="paidAt" label="Date received" type="date" required defaultValue={dateInput(new Date())} />
        <PortalSelect id="paymentMethod" label="Payment method" options={["Bank transfer", "Card payment", "Online payment provider", "Manual payment entry"]} required defaultValue="Bank transfer" />
        <PortalSelect id="status" label="Status" options={["COMPLETED", "PENDING", "FAILED", "CANCELLED"]} required defaultValue="COMPLETED" />
        <PortalInput id="transactionReference" label="Transaction reference" required />
        <PortalInput id="reference" label="Internal reference" />
        <PortalTextarea id="notes" label="Notes" className="md:col-span-2" />
        <div className="md:col-span-2">
          <PortalButton type="submit" disabled={invoice.status === "PAID" || invoice.status === "CANCELLED"}>
            <ReceiptText className="h-4 w-4" aria-hidden="true" />
            Record Payment
          </PortalButton>
        </div>
      </form>
    </PortalCard>
  );
}

function ParentPaymentPanel({ invoice, onPay }: { invoice: RecordMap; onPay: (form: HTMLFormElement) => void }) {
  const payable = ["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) && Number(invoice.balanceDue ?? 0) > 0;
  return (
    <PortalCard title="Pay Invoice" eyebrow="Parent Payment">
      <form className="grid gap-4" onSubmit={submitTo(onPay)}>
        <PortalInput id="amount" label="Payment amount" type="number" min="0" step="0.01" required defaultValue={moneyNumber(invoice.balanceDue)} />
        <PortalAlert title="Payment confirmation" tone="info">
          Receipts are generated only after TutorHiveHub confirms that payment has been received.
        </PortalAlert>
        <PortalButton type="submit" disabled={!payable}>
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          Pay Outstanding Invoice
        </PortalButton>
      </form>
    </PortalCard>
  );
}

function AdjustmentPanel({ invoice, onAction }: { invoice: RecordMap; onAction: (endpoint: string, body: RecordMap, message: string) => void }) {
  return (
    <PortalCard title="Refunds and Corrections" eyebrow="Authorised Finance Adjustments">
      <div className="grid gap-6">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submitTo((form) => onAction(`/api/portal/invoices/${invoice.id}/refunds`, formPayload(form), "Refund recorded successfully."))}>
          <PortalInput id="amount" label="Refund amount" type="number" min="0" step="0.01" required />
          <PortalInput id="paidAt" label="Refund date" type="date" required defaultValue={dateInput(new Date())} />
          <PortalInput id="transactionReference" label="Refund reference" required />
          <PortalTextarea id="notes" label="Refund reason" required className="md:col-span-2" />
          <div className="md:col-span-2">
            <PortalButton type="submit" variant="ghost">Record Refund</PortalButton>
          </div>
        </form>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submitTo((form) => onAction(`/api/portal/invoices/${invoice.id}/corrections`, formPayload(form), "Payment correction recorded successfully."))}>
          <PortalInput id="amount" label="Correction amount" type="number" step="0.01" required />
          <PortalInput id="paidAt" label="Correction date" type="date" required defaultValue={dateInput(new Date())} />
          <PortalInput id="transactionReference" label="Correction reference" required />
          <PortalTextarea id="notes" label="Correction reason" required className="md:col-span-2" />
          <div className="md:col-span-2">
            <PortalButton type="submit" variant="ghost">Record Correction</PortalButton>
          </div>
        </form>
      </div>
    </PortalCard>
  );
}

function PaymentList({ payments, onConfirm }: { payments: RecordMap[]; onConfirm?: (payment: RecordMap, form: HTMLFormElement) => void }) {
  return (
    <PortalCard title="Payments" eyebrow="Payment History">
      {payments.length === 0 ? (
        <PortalEmptyState title="No payments yet" message="Payments will appear here once recorded or initiated." />
      ) : (
        <div className="grid gap-4">
          {payments.slice(0, 12).map((payment) => (
            <article key={payment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-navy">{payment.invoiceNumber || payment.transactionReference || payment.reference || "Payment"}</h3>
                  <p className="mt-1 text-sm text-slate-650">{payment.paymentMethod || payment.kind} - {dateText(payment.paidAt || payment.createdAt)}</p>
                </div>
                <PortalBadge tone={payment.status === "COMPLETED" ? "success" : payment.status === "FAILED" || payment.status === "CANCELLED" ? "danger" : "warning"}>{statusLabel(payment.status)}</PortalBadge>
              </div>
              <p className="mt-3 text-xl font-black text-navy">{money(payment.amount, payment.currency)}</p>
              {payment.receipt && <DownloadLink href={`/api/portal/receipts/${payment.receipt.id}/print`} label={payment.receipt.receiptNumber} />}
              {payment.status === "PENDING" && onConfirm && (
                <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={submitTo((form) => onConfirm(payment, form))}>
                  <PortalInput id="paidAt" label="Payment date" type="date" required defaultValue={dateInput(new Date())} />
                  <PortalInput id="transactionReference" label="Transaction reference" required />
                  <PortalSelect id="paymentMethod" label="Payment method" options={["Bank transfer", "Card payment", "Online payment provider", "Manual payment entry"]} required defaultValue={payment.paymentMethod || "Bank transfer"} />
                  <PortalInput id="reference" label="Internal reference" defaultValue={payment.reference || ""} />
                  <PortalButton type="submit" className="md:col-span-2">Confirm Payment</PortalButton>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
    </PortalCard>
  );
}

function ReceiptList({ receipts }: { receipts: RecordMap[] }) {
  return (
    <PortalCard title="Receipts" eyebrow="Confirmed Payments">
      {receipts.length === 0 ? (
        <PortalEmptyState title="No receipts yet" message="Receipts are generated after confirmed payments." />
      ) : (
        <PortalTable
          columns={["Receipt", "Service", "Amount", "Date", "Download"]}
          rows={receipts.map((receipt) => [
            <span className="font-black text-navy">{receipt.receiptNumber}</span>,
            receipt.service,
            money(receipt.amount, receipt.currency),
            dateText(receipt.dateReceived),
            <DownloadLink href={`/api/portal/receipts/${receipt.id}/print`} label="Receipt" compact />,
          ])}
        />
      )}
    </PortalCard>
  );
}

function LookupSelect({ id, label, records, required = false }: { id: string; label: string; records: RecordMap[]; required?: boolean }) {
  return (
    <PortalSelect id={id} label={label} required={required}>
      <option value="">Select an option</option>
      {records.map((record) => (
        <option key={record.id} value={record.id}>
          {lookupLabel(record)} {record.email ? `- ${record.email}` : ""}
        </option>
      ))}
    </PortalSelect>
  );
}

function FeePlanSelect({ id, label, records }: { id: string; label: string; records: RecordMap[] }) {
  return (
    <PortalSelect id={id} label={label}>
      <option value="">No fee plan</option>
      {records.map((record) => (
        <option key={record.id} value={record.id}>
          {record.name} - {money(record.defaultRate, record.currency)}
        </option>
      ))}
    </PortalSelect>
  );
}

function DownloadLink({ href, label, compact = false }: { href: string; label: string; compact?: boolean }) {
  return (
    <a href={href} className={`inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white font-black text-navy shadow-sm transition hover:border-gold hover:bg-gold-50 ${compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"}`}>
      <Download className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-navy">{value}</p>
    </div>
  );
}

function submitTo(callback: (form: HTMLFormElement) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    callback(event.currentTarget);
  };
}

function formPayload(form: HTMLFormElement) {
  const payload = Object.fromEntries(new FormData(form).entries()) as RecordMap;
  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      payload[element.name] = element.checked;
    }
  }
  return payload;
}

function lookupLabel(record: RecordMap) {
  if (record.name && record.examPathway) {
    return `${record.name} - ${record.examPathway}`;
  }
  return record.fullName || record.name || "";
}

function invoiceTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "PAID") return "success";
  if (status === "CANCELLED") return "danger";
  if (status === "SENT" || status === "PARTIALLY_PAID" || status === "OVERDUE") return "warning";
  return "neutral";
}

function statusLabel(value?: string | null) {
  return String(value || "-").replace(/_/g, " ");
}

function money(value: unknown, currency = "GBP") {
  const amount = Number(value ?? 0);
  return `${currency} ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function moneyNumber(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function dateText(value?: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value)) : "-";
}

function dateInput(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
