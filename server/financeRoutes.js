import { getPrisma } from "./db.js";
import { auditLog, requireAnyPermission } from "./authMiddleware.js";
import { hasPermission } from "./roles.js";

const financeAccessPermissions = ["finance:manage", "family:finance"];
const financeManagePermissions = ["finance:manage"];
const planTypes = [
  "Hourly tutoring plan",
  "Monthly lesson plan",
  "Subject package",
  "Exam-preparation package",
  "Homework-support plan",
  "Combined support plan",
  "Custom plan",
  "Discount",
  "Scholarship or concession",
];
const billingFrequencies = ["Hourly", "Weekly", "Monthly", "Per package", "Per subject", "Per exam pathway", "Custom"];
const invoiceStatuses = ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"];
const legacyInvoiceStatuses = ["PART_PAID", "VOID"];
const paymentMethods = ["Bank transfer", "Card payment", "Online payment provider", "Manual payment entry", "Refund", "Payment correction"];
const paymentKinds = ["PAYMENT", "REFUND", "CORRECTION"];
const paymentStatuses = ["PENDING", "COMPLETED", "FAILED", "REFUNDED", "CORRECTED", "CANCELLED"];
const activeInvoiceStatuses = ["SENT", "PARTIALLY_PAID", "OVERDUE"];

const invoiceInclude = {
  parent: { select: { id: true, fullName: true, email: true, phone: true, country: true, userId: true, user: { select: { id: true, email: true, name: true } } } },
  student: { select: { id: true, fullName: true, yearGroup: true, parentId: true } },
  feePlan: { select: { id: true, name: true, planType: true, service: true } },
  payments: { orderBy: { createdAt: "desc" } },
  receipts: { orderBy: { dateReceived: "desc" } },
};

const feePlanInclude = {
  subject: { select: { id: true, name: true, examPathway: true } },
};

export function registerFinanceRoutes(app, { sendPortalEmail } = {}) {
  app.get("/api/portal/finance/lookups", requireAnyPermission(financeManagePermissions), async (_request, response, next) => {
    try {
      const prisma = getPrisma();
      const [parents, students, subjects, feePlans] = await Promise.all([
        prisma.parent.findMany({
          orderBy: { fullName: "asc" },
          select: { id: true, fullName: true, email: true, status: true },
        }),
        prisma.student.findMany({
          orderBy: { fullName: "asc" },
          select: { id: true, fullName: true, parentId: true, yearGroup: true, status: true },
        }),
        prisma.subject.findMany({
          orderBy: [{ name: "asc" }, { examPathway: "asc" }],
          select: { id: true, name: true, category: true, examPathway: true, isActive: true },
        }),
        prisma.feePlan.findMany({ where: { status: "ACTIVE" }, include: feePlanInclude, orderBy: { name: "asc" } }),
      ]);
      response.json({
        ok: true,
        parents,
        students,
        subjects,
        feePlans: feePlans.map(safeFeePlan),
        planTypes,
        billingFrequencies,
        invoiceStatuses,
        paymentMethods,
        paymentKinds,
        paymentStatuses,
        paymentProvider: paymentProviderSummary(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/finance/dashboard", requireAnyPermission(financeManagePermissions), async (_request, response, next) => {
    try {
      const prisma = getPrisma();
      const [invoices, payments] = await Promise.all([
        prisma.invoice.findMany({
          where: { status: { notIn: ["CANCELLED", "VOID"] } },
          include: {
            parent: { select: { id: true, fullName: true } },
            student: { select: { id: true, fullName: true } },
            payments: true,
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
        prisma.payment.findMany({
          where: { status: "COMPLETED" },
          include: {
            invoice: {
              select: {
                id: true,
                service: true,
                currency: true,
                student: { select: { id: true, fullName: true } },
              },
            },
          },
          orderBy: { paidAt: "desc" },
          take: 1000,
        }),
      ]);
      response.json({ ok: true, dashboard: buildFinanceDashboard(invoices, payments) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/portal/fee-plans", requireAnyPermission(financeManagePermissions), async (request, response, next) => {
    try {
      const feePlans = await getPrisma().feePlan.findMany({
        where: buildFeePlanWhere(request.query),
        include: feePlanInclude,
        orderBy: [{ status: "asc" }, { name: "asc" }],
        take: 200,
      });
      response.json({ ok: true, feePlans: feePlans.map(safeFeePlan) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/portal/fee-plans", requireAnyPermission(financeManagePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const feePlan = await prisma.feePlan.create({
        data: parseFeePlanInput(request.body, request.portalUser.id),
        include: feePlanInclude,
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "fee_plan_created", entityType: "FeePlan", entityId: feePlan.id });
      response.status(201).json({ ok: true, feePlan: safeFeePlan(feePlan) });
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.patch("/api/portal/fee-plans/:id", requireAnyPermission(financeManagePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const feePlan = await prisma.feePlan.update({
        where: { id: request.params.id },
        data: parseFeePlanInput(request.body, request.portalUser.id),
        include: feePlanInclude,
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "fee_plan_updated", entityType: "FeePlan", entityId: feePlan.id });
      response.json({ ok: true, feePlan: safeFeePlan(feePlan) });
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.get("/api/portal/family/finance", requireAnyPermission(["family:finance"]), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const parent = await requireParentProfile(prisma, request);
      const invoices = await prisma.invoice.findMany({
        where: { parentId: parent.id },
        include: invoiceInclude,
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      response.json({
        ok: true,
        finance: {
          parent,
          invoices: invoices.map(safeInvoice),
          payments: paymentsFromInvoices(invoices),
          receipts: receiptsFromInvoices(invoices),
          totals: parentFinanceTotals(invoices),
          paymentProvider: paymentProviderSummary(),
        },
      });
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.get("/api/portal/invoices", requireAnyPermission(financeAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const scope = await invoiceScopeWhere(prisma, request);
      const invoices = await prisma.invoice.findMany({
        where: { AND: [scope, buildInvoiceWhere(request.query)] },
        include: invoiceInclude,
        orderBy: [{ createdAt: "desc" }, { invoiceNumber: "desc" }],
        take: 200,
      });
      response.json({ ok: true, invoices: invoices.map(safeInvoice) });
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.post("/api/portal/invoices", requireAnyPermission(financeManagePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const invoice = await createInvoice({ prisma, request });
      await auditLog({ request, actorId: request.portalUser.id, action: "invoice_created", entityType: "Invoice", entityId: invoice.id, metadata: { invoiceNumber: invoice.invoiceNumber } });
      response.status(201).json({ ok: true, invoice: safeInvoice(invoice) });
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.get("/api/portal/invoices/:id/print", requireAnyPermission(financeAccessPermissions), async (request, response, next) => {
    try {
      const invoice = await findInvoiceForRequest(getPrisma(), request, request.params.id);
      sendPrintableHtml(response, `${invoice.invoiceNumber}.html`, invoiceDocumentHtml(invoice));
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.get("/api/portal/receipts/:id/print", requireAnyPermission(financeAccessPermissions), async (request, response, next) => {
    try {
      const receipt = await findReceiptForRequest(getPrisma(), request, request.params.id);
      sendPrintableHtml(response, `${receipt.receiptNumber}.html`, receiptDocumentHtml(receipt));
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.get("/api/portal/invoices/:id", requireAnyPermission(financeAccessPermissions), async (request, response, next) => {
    try {
      const invoice = await findInvoiceForRequest(getPrisma(), request, request.params.id);
      response.json({ ok: true, invoice: safeInvoice(invoice) });
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.patch("/api/portal/invoices/:id", requireAnyPermission(financeManagePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const existing = await findInvoiceForRequest(prisma, request, request.params.id, true);
      if (existing.status === "PAID" || existing.status === "CANCELLED" || existing.status === "VOID") {
        throw new ValidationError("Paid or cancelled invoices cannot be edited.");
      }
      const parsed = await parseInvoiceInput(prisma, request.body, request.portalUser.id, existing.invoiceNumber);
      const invoice = await prisma.invoice.update({
        where: { id: existing.id },
        data: parsed,
        include: invoiceInclude,
      });
      const refreshed = await refreshInvoiceFinancials(prisma, invoice.id);
      await auditLog({ request, actorId: request.portalUser.id, action: "invoice_updated", entityType: "Invoice", entityId: invoice.id });
      response.json({ ok: true, invoice: safeInvoice(refreshed) });
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.post("/api/portal/invoices/:id/status", requireAnyPermission(financeManagePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const existing = await findInvoiceForRequest(prisma, request, request.params.id, true);
      const status = parseOption(request.body?.status, ["DRAFT", "SENT", "CANCELLED"], "Select a valid invoice status action.");
      const now = new Date();
      const data = { status };
      if (status === "SENT") {
        data.issuedAt = existing.issuedAt ?? now;
        data.sentAt = now;
      }
      if (status === "CANCELLED") {
        data.cancelledAt = now;
      }
      const invoice = await prisma.invoice.update({ where: { id: existing.id }, data, include: invoiceInclude });
      await auditLog({ request, actorId: request.portalUser.id, action: "invoice_status_updated", entityType: "Invoice", entityId: invoice.id, metadata: { status } });
      if (status === "SENT") {
        await notifyParentFinanceEvent({ prisma, request, invoice, sendPortalEmail, category: "INVOICE_ISSUED", title: "TutorHiveHub invoice issued", message: `Invoice ${invoice.invoiceNumber} has been issued for ${invoice.student?.fullName || "your student"}.` });
      }
      response.json({ ok: true, invoice: safeInvoice(invoice) });
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.post("/api/portal/invoices/:id/payments", requireAnyPermission(financeManagePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const invoice = await findInvoiceForRequest(prisma, request, request.params.id, true);
      const payment = await recordPayment({ prisma, request, invoice });
      const refreshed = await refreshInvoiceFinancials(prisma, invoice.id);
      await auditLog({ request, actorId: request.portalUser.id, action: "payment_recorded", entityType: "Payment", entityId: payment.id, metadata: { invoiceId: invoice.id, amount: payment.amount, status: payment.status } });
      response.status(201).json({ ok: true, payment: safePayment(payment), invoice: safeInvoice(refreshed) });
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.post("/api/portal/invoices/:id/pay", requireAnyPermission(["family:finance"]), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const invoice = await findInvoiceForRequest(prisma, request, request.params.id);
      if (!activeInvoiceStatuses.includes(normaliseInvoiceStatus(invoice.status))) {
        throw new ValidationError("Only sent or overdue invoices can be paid online.");
      }
      const balanceDue = decimalNumber(invoice.balanceDue);
      if (balanceDue <= 0) {
        throw new ValidationError("This invoice has no outstanding balance.");
      }
      const amount = parseOptionalMoney(request.body?.amount, balanceDue);
      if (amount <= 0 || amount > balanceDue) {
        throw new ValidationError("Payment amount must be greater than zero and no more than the outstanding balance.");
      }
      const config = paymentProviderSummary();
      const payment = await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          kind: "PAYMENT",
          amount,
          currency: invoice.currency,
          status: "PENDING",
          paymentMethod: config.onlineConfigured ? "Online payment provider" : "Bank transfer",
          provider: config.provider,
          reference: `PENDING-${invoice.invoiceNumber}-${Date.now()}`,
          transactionReference: null,
          metadata: {
            initiatedBy: request.portalUser.id,
            invoiceNumber: invoice.invoiceNumber,
            paymentInstructions: config.onlineConfigured ? "Redirect parent to configured payment provider." : "Await bank-transfer confirmation from finance.",
          },
        },
      });
      await auditLog({ request, actorId: request.portalUser.id, action: "parent_payment_started", entityType: "Payment", entityId: payment.id, metadata: { invoiceId: invoice.id, amount } });
      response.status(201).json({
        ok: true,
        payment: safePayment(payment),
        checkoutUrl: config.onlineConfigured ? checkoutUrlForInvoice(config, invoice, amount, payment.id) : null,
        bankTransferDetails: config.onlineConfigured ? null : config.bankTransferDetails,
        message: config.onlineConfigured ? "Payment started. Continue with the configured payment provider." : "Payment noted. Please complete the bank transfer using the details provided.",
      });
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.post("/api/portal/payments/:id/confirm", requireAnyPermission(financeManagePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const payment = await prisma.payment.findUnique({ where: { id: request.params.id }, include: { invoice: { include: invoiceInclude } } });
      if (!payment) {
        throw new NotFoundError("Payment not found.");
      }
      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "COMPLETED",
          paidAt: requiredDate(request.body?.paidAt || dateInput(new Date()), "Payment date is required."),
          transactionReference: required(request.body?.transactionReference || payment.transactionReference || payment.reference, "Transaction reference is required."),
          reference: optional(request.body?.reference) || payment.reference,
          paymentMethod: optional(request.body?.paymentMethod) || payment.paymentMethod || "Manual payment entry",
          receivedById: request.portalUser.id,
          notes: optional(request.body?.notes) || payment.notes,
        },
        include: { invoice: { include: invoiceInclude }, receipt: true },
      });
      await ensureReceiptForPayment(prisma, updated, request.portalUser.id);
      const invoice = await refreshInvoiceFinancials(prisma, updated.invoiceId);
      await auditLog({ request, actorId: request.portalUser.id, action: "payment_confirmed", entityType: "Payment", entityId: updated.id, metadata: { invoiceId: updated.invoiceId } });
      await notifyParentFinanceEvent({ prisma, request, invoice, sendPortalEmail, category: "PAYMENT_RECEIVED", title: "TutorHiveHub payment received", message: `Payment has been recorded for invoice ${invoice.invoiceNumber}.` });
      response.json({ ok: true, payment: safePayment(updated), invoice: safeInvoice(invoice) });
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.post("/api/portal/invoices/:id/refunds", requireAnyPermission(financeManagePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const invoice = await findInvoiceForRequest(prisma, request, request.params.id, true);
      const amount = parseMoney(request.body?.amount, "Refund amount is required.");
      if (amount <= 0 || amount > decimalNumber(invoice.amountPaid)) {
        throw new ValidationError("Refund amount must be greater than zero and no more than the confirmed amount paid.");
      }
      const payment = await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          kind: "REFUND",
          amount,
          currency: invoice.currency,
          status: "COMPLETED",
          paymentMethod: "Refund",
          reference: optional(request.body?.reference),
          transactionReference: required(request.body?.transactionReference, "Refund transaction reference is required."),
          receivedById: request.portalUser.id,
          paidAt: requiredDate(request.body?.paidAt || dateInput(new Date()), "Refund date is required."),
          notes: required(request.body?.notes, "Refund reason is required."),
        },
      });
      const refreshed = await refreshInvoiceFinancials(prisma, invoice.id);
      await auditLog({ request, actorId: request.portalUser.id, action: "refund_recorded", entityType: "Payment", entityId: payment.id, metadata: { invoiceId: invoice.id, amount } });
      response.status(201).json({ ok: true, payment: safePayment(payment), invoice: safeInvoice(refreshed) });
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.post("/api/portal/invoices/:id/corrections", requireAnyPermission(financeManagePermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const invoice = await findInvoiceForRequest(prisma, request, request.params.id, true);
      const amount = parseSignedMoney(request.body?.amount, "Correction amount is required.");
      if (amount === 0) {
        throw new ValidationError("Correction amount cannot be zero.");
      }
      const payment = await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          kind: "CORRECTION",
          amount,
          currency: invoice.currency,
          status: "COMPLETED",
          paymentMethod: "Payment correction",
          reference: optional(request.body?.reference),
          transactionReference: required(request.body?.transactionReference, "Correction reference is required."),
          receivedById: request.portalUser.id,
          paidAt: requiredDate(request.body?.paidAt || dateInput(new Date()), "Correction date is required."),
          notes: required(request.body?.notes, "Correction reason is required."),
        },
      });
      const refreshed = await refreshInvoiceFinancials(prisma, invoice.id);
      await auditLog({ request, actorId: request.portalUser.id, action: "payment_correction_recorded", entityType: "Payment", entityId: payment.id, metadata: { invoiceId: invoice.id, amount } });
      response.status(201).json({ ok: true, payment: safePayment(payment), invoice: safeInvoice(refreshed) });
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.get("/api/portal/payments", requireAnyPermission(financeAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const invoiceScope = await invoiceScopeWhere(prisma, request);
      const payments = await prisma.payment.findMany({
        where: { invoice: invoiceScope },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              service: true,
              parent: { select: { id: true, fullName: true } },
              student: { select: { id: true, fullName: true } },
            },
          },
          receipt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      response.json({ ok: true, payments: payments.map(safePayment) });
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });

  app.get("/api/portal/receipts", requireAnyPermission(financeAccessPermissions), async (request, response, next) => {
    try {
      const prisma = getPrisma();
      const receiptScope = await receiptScopeWhere(prisma, request);
      const receipts = await prisma.receipt.findMany({
        where: receiptScope,
        include: receiptInclude(),
        orderBy: { dateReceived: "desc" },
        take: 200,
      });
      response.json({ ok: true, receipts: receipts.map(safeReceipt) });
    } catch (error) {
      handleFinanceError(error, response, next);
    }
  });
}

async function createInvoice({ prisma, request }) {
  const invoiceNumber = await nextNumber(prisma.invoice, "invoiceNumber", "THH-INV");
  const parsed = await parseInvoiceInput(prisma, request.body, request.portalUser.id, invoiceNumber);
  const invoice = await prisma.invoice.create({
    data: parsed,
    include: invoiceInclude,
  });
  return refreshInvoiceFinancials(prisma, invoice.id);
}

async function parseInvoiceInput(prisma, body, createdById, invoiceNumber) {
  const parentId = required(body?.parentId, "Parent is required.");
  const studentId = required(body?.studentId, "Student is required.");
  await assertStudentBelongsToParent(prisma, studentId, parentId);

  const feePlan = body?.feePlanId
    ? await prisma.feePlan.findUnique({ where: { id: String(body.feePlanId) } })
    : null;
  if (body?.feePlanId && !feePlan) {
    throw new ValidationError("Fee plan not found.");
  }

  const service = required(body?.service || feePlan?.service || feePlan?.name, "Service is required.");
  const quantity = parseMoney(body?.quantity ?? feePlan?.defaultQuantity ?? 1, "Quantity is required.");
  const rate = parseMoney(body?.rate ?? feePlan?.defaultRate ?? 0, "Rate is required.");
  const discountAmount = parseOptionalMoney(body?.discountAmount ?? feePlan?.discountAmount, 0);
  const taxAmount = parseOptionalMoney(body?.taxAmount, 0);
  const subtotal = round2(quantity * rate);
  const totalAmount = Math.max(0, round2(subtotal + taxAmount - discountAmount));
  const status = parseOption(body?.status || "DRAFT", ["DRAFT", "SENT"], "Invoices can be created as draft or sent.");
  const now = new Date();

  return cleanData({
    invoiceNumber,
    parentId,
    studentId,
    feePlanId: optional(body?.feePlanId),
    status,
    service,
    billingPeriodStart: requiredDate(body?.billingPeriodStart, "Billing period start is required."),
    billingPeriodEnd: requiredDate(body?.billingPeriodEnd, "Billing period end is required."),
    quantity,
    rate,
    discountAmount,
    currency: parseCurrency(body?.currency || feePlan?.currency || "GBP"),
    subtotal,
    taxAmount,
    totalAmount,
    balanceDue: totalAmount,
    dueDate: requiredDate(body?.dueDate, "Due date is required."),
    issuedAt: status === "SENT" ? now : null,
    sentAt: status === "SENT" ? now : null,
    notes: optional(body?.notes),
    createdById,
  });
}

function parseFeePlanInput(body, createdById) {
  const planType = parseOption(body?.planType, planTypes, "Select a valid fee plan type.");
  return cleanData({
    name: required(body?.name, "Fee plan name is required."),
    planType,
    service: required(body?.service, "Service is required."),
    description: optional(body?.description),
    subjectId: optional(body?.subjectId),
    examPathway: optional(body?.examPathway),
    billingFrequency: parseOption(body?.billingFrequency || "Monthly", billingFrequencies, "Select a valid billing frequency."),
    defaultQuantity: parseMoney(body?.defaultQuantity ?? 1, "Default quantity is required."),
    defaultRate: parseMoney(body?.defaultRate ?? 0, "Default rate is required."),
    currency: parseCurrency(body?.currency || "GBP"),
    discountType: optional(body?.discountType),
    discountAmount: parseOptionalMoney(body?.discountAmount, 0),
    scholarshipOrConcession: parseBoolean(body?.scholarshipOrConcession),
    status: parseOption(body?.status || "ACTIVE", ["ACTIVE", "INACTIVE"], "Select a valid fee plan status."),
    notes: optional(body?.notes),
    createdById,
  });
}

async function recordPayment({ prisma, request, invoice }) {
  const kind = parseOption(request.body?.kind || "PAYMENT", paymentKinds, "Select a valid payment type.");
  if (kind !== "PAYMENT") {
    throw new ValidationError("Use the refund or correction actions for non-payment entries.");
  }
  const amount = parseMoney(request.body?.amount, "Payment amount is required.");
  if (amount <= 0) {
    throw new ValidationError("Payment amount must be greater than zero.");
  }
  if (amount > decimalNumber(invoice.balanceDue) && normaliseInvoiceStatus(invoice.status) !== "PAID") {
    throw new ValidationError("Payment amount cannot exceed the outstanding balance.");
  }
  const status = parseOption(request.body?.status || "COMPLETED", ["PENDING", "COMPLETED", "FAILED", "CANCELLED"], "Select a valid payment status.");
  const paymentMethod = parseOption(request.body?.paymentMethod || "Manual payment entry", paymentMethods, "Select a valid payment method.");
  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      kind,
      amount,
      currency: invoice.currency,
      status,
      paymentMethod,
      provider: optional(request.body?.provider),
      providerPaymentId: optional(request.body?.providerPaymentId),
      reference: optional(request.body?.reference),
      transactionReference: status === "COMPLETED" ? required(request.body?.transactionReference, "Transaction reference is required for confirmed payments.") : optional(request.body?.transactionReference),
      receivedById: status === "COMPLETED" ? request.portalUser.id : null,
      paidAt: status === "COMPLETED" ? requiredDate(request.body?.paidAt || dateInput(new Date()), "Payment date is required.") : null,
      notes: optional(request.body?.notes),
    },
    include: { invoice: { include: invoiceInclude }, receipt: true },
  });
  if (payment.status === "COMPLETED") {
    await ensureReceiptForPayment(prisma, payment, request.portalUser.id);
  }
  return payment;
}

async function ensureReceiptForPayment(prisma, payment, authorisedById) {
  if (payment.receipt || payment.status !== "COMPLETED" || payment.kind !== "PAYMENT" || decimalNumber(payment.amount) <= 0) {
    return payment.receipt ?? null;
  }
  const invoice = payment.invoice ?? (await prisma.invoice.findUnique({ where: { id: payment.invoiceId }, include: invoiceInclude }));
  if (!invoice?.parentId) {
    throw new ValidationError("A receipt cannot be generated without a linked parent.");
  }
  const receiptNumber = await nextNumber(prisma.receipt, "receiptNumber", "THH-RCP");
  return prisma.receipt.create({
    data: {
      receiptNumber,
      invoiceId: invoice.id,
      paymentId: payment.id,
      parentId: invoice.parentId,
      studentId: invoice.studentId,
      amount: payment.amount,
      amountInWords: amountInWords(payment.amount, payment.currency),
      currency: payment.currency,
      paymentMethod: payment.paymentMethod || "Manual payment entry",
      transactionReference: payment.transactionReference || payment.reference,
      dateReceived: payment.paidAt || new Date(),
      service: invoice.service,
      periodCovered: periodText(invoice),
      authorisedConfirmation: true,
      authorisedById,
    },
  });
}

async function refreshInvoiceFinancials(prisma, invoiceId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: invoiceInclude,
  });
  if (!invoice) {
    throw new NotFoundError("Invoice not found.");
  }
  const paidTotal = round2((invoice.payments ?? []).reduce((total, payment) => total + signedCompletedAmount(payment), 0));
  const amountPaid = Math.max(0, paidTotal);
  const balanceDue = Math.max(0, round2(decimalNumber(invoice.totalAmount) - paidTotal));
  const nextStatus = nextInvoiceStatus(invoice, amountPaid, balanceDue);

  return prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid,
      balanceDue,
      status: nextStatus,
      paidAt: balanceDue <= 0 && decimalNumber(invoice.totalAmount) > 0 ? invoice.paidAt ?? new Date() : null,
    },
    include: invoiceInclude,
  });
}

function signedCompletedAmount(payment) {
  if (payment.status !== "COMPLETED") {
    return 0;
  }
  const amount = Math.abs(decimalNumber(payment.amount));
  if (payment.kind === "REFUND") {
    return -amount;
  }
  if (payment.kind === "CORRECTION") {
    return decimalNumber(payment.amount);
  }
  return amount;
}

function nextInvoiceStatus(invoice, amountPaid, balanceDue) {
  const current = normaliseInvoiceStatus(invoice.status);
  if (current === "CANCELLED") {
    return "CANCELLED";
  }
  if (balanceDue <= 0 && decimalNumber(invoice.totalAmount) > 0) {
    return "PAID";
  }
  if (amountPaid > 0) {
    return "PARTIALLY_PAID";
  }
  if (current !== "DRAFT" && invoice.dueDate && startOfDay(invoice.dueDate) < startOfDay(new Date())) {
    return "OVERDUE";
  }
  return current === "DRAFT" ? "DRAFT" : "SENT";
}

async function findInvoiceForRequest(prisma, request, id, manageOnly = false) {
  const scope = manageOnly ? {} : await invoiceScopeWhere(prisma, request);
  if (manageOnly && !canManageFinance(request.portalUser)) {
    throw new ForbiddenError("Access denied.");
  }
  const invoice = await prisma.invoice.findFirst({ where: { AND: [{ id }, scope] }, include: invoiceInclude });
  if (!invoice) {
    throw new NotFoundError("Invoice not found.");
  }
  return invoice;
}

async function findReceiptForRequest(prisma, request, id) {
  const scope = await receiptScopeWhere(prisma, request);
  const receipt = await prisma.receipt.findFirst({ where: { AND: [{ id }, scope] }, include: receiptInclude() });
  if (!receipt) {
    throw new NotFoundError("Receipt not found.");
  }
  return receipt;
}

async function invoiceScopeWhere(prisma, request) {
  if (canManageFinance(request.portalUser)) {
    return {};
  }
  if (hasPermission(request.portalUser, "family:finance")) {
    const parent = await requireParentProfile(prisma, request);
    return { parentId: parent.id };
  }
  return { id: "__no_invoice_scope__" };
}

async function receiptScopeWhere(prisma, request) {
  if (canManageFinance(request.portalUser)) {
    return {};
  }
  if (hasPermission(request.portalUser, "family:finance")) {
    const parent = await requireParentProfile(prisma, request);
    return { parentId: parent.id };
  }
  return { id: "__no_receipt_scope__" };
}

async function requireParentProfile(prisma, request) {
  const parent = await prisma.parent.findUnique({
    where: { userId: request.portalUser.id },
    select: { id: true, fullName: true, email: true, phone: true, country: true, status: true },
  });
  if (!parent || parent.status !== "ACTIVE") {
    throw new ForbiddenError("No active parent profile is linked to this portal account.");
  }
  return parent;
}

async function assertStudentBelongsToParent(prisma, studentId, parentId) {
  const student = await prisma.student.findFirst({ where: { id: studentId, parentId }, select: { id: true } });
  if (!student) {
    throw new ValidationError("Selected student must be linked to the selected parent.");
  }
}

function buildFinanceDashboard(invoices, payments) {
  const totalInvoiced = sumMoney(invoices.map((invoice) => invoice.totalAmount));
  const totalReceived = sumMoney(payments.map((payment) => signedCompletedAmount(payment)));
  const outstandingBalance = sumMoney(invoices.map((invoice) => invoice.balanceDue));
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const positivePayments = payments.filter((payment) => payment.kind !== "REFUND" && signedCompletedAmount(payment) > 0);
  const refunds = payments.filter((payment) => payment.kind === "REFUND");

  return {
    totalInvoiced,
    totalReceived,
    outstandingBalance,
    overdueInvoices: invoices.filter((invoice) => normaliseInvoiceStatus(invoice.status) === "OVERDUE" || (invoice.dueDate && decimalNumber(invoice.balanceDue) > 0 && startOfDay(invoice.dueDate) < startOfDay(now))).map(safeInvoice),
    paymentsThisMonth: positivePayments.filter((payment) => {
      const date = new Date(payment.paidAt || payment.createdAt);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    }).length,
    refunds: sumMoney(refunds.map((payment) => payment.amount)),
    revenueByService: groupPayments(payments, (payment) => payment.invoice?.service || "Unspecified service"),
    revenueByStudent: groupPayments(payments, (payment) => payment.invoice?.student?.fullName || "No student recorded"),
    revenueByPeriod: groupPayments(payments, (payment) => {
      const date = new Date(payment.paidAt || payment.createdAt);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }),
  };
}

function parentFinanceTotals(invoices) {
  return {
    totalInvoiced: sumMoney(invoices.filter((invoice) => !["CANCELLED", "VOID"].includes(normaliseInvoiceStatus(invoice.status))).map((invoice) => invoice.totalAmount)),
    amountPaid: sumMoney(invoices.map((invoice) => invoice.amountPaid)),
    outstandingBalance: sumMoney(invoices.map((invoice) => invoice.balanceDue)),
    overdueCount: invoices.filter((invoice) => normaliseInvoiceStatus(invoice.status) === "OVERDUE").length,
  };
}

function groupPayments(payments, keyFn) {
  const groups = new Map();
  for (const payment of payments) {
    const signed = signedCompletedAmount(payment);
    if (signed <= 0) continue;
    const key = keyFn(payment);
    const existing = groups.get(key) ?? { label: key, amount: 0, count: 0 };
    existing.amount = round2(existing.amount + signed);
    existing.count += 1;
    groups.set(key, existing);
  }
  return Array.from(groups.values()).sort((a, b) => b.amount - a.amount).slice(0, 12);
}

function paymentsFromInvoices(invoices) {
  return invoices
    .flatMap((invoice) => (invoice.payments ?? []).map((payment) => safePayment({ ...payment, invoice })))
    .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime());
}

function receiptsFromInvoices(invoices) {
  return invoices
    .flatMap((invoice) => (invoice.receipts ?? []).map((receipt) => safeReceipt({ ...receipt, invoice, parent: invoice.parent, student: invoice.student })))
    .sort((a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime());
}

function safeInvoice(invoice) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: effectiveInvoiceStatus(invoice),
    parent: invoice.parent,
    student: invoice.student,
    feePlan: invoice.feePlan,
    service: invoice.service,
    billingPeriodStart: invoice.billingPeriodStart,
    billingPeriodEnd: invoice.billingPeriodEnd,
    periodCovered: periodText(invoice),
    quantity: invoice.quantity,
    rate: invoice.rate,
    discountAmount: invoice.discountAmount,
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
    amountPaid: invoice.amountPaid,
    balanceDue: invoice.balanceDue,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    issuedAt: invoice.issuedAt,
    sentAt: invoice.sentAt,
    paidAt: invoice.paidAt,
    cancelledAt: invoice.cancelledAt,
    notes: invoice.notes,
    payments: invoice.payments?.map(safePayment) ?? [],
    receipts: invoice.receipts?.map((receipt) => safeReceipt({ ...receipt, invoice, parent: invoice.parent, student: invoice.student })) ?? [],
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

function safeFeePlan(plan) {
  return {
    id: plan.id,
    name: plan.name,
    planType: plan.planType,
    service: plan.service,
    description: plan.description,
    subject: plan.subject,
    examPathway: plan.examPathway,
    billingFrequency: plan.billingFrequency,
    defaultQuantity: plan.defaultQuantity,
    defaultRate: plan.defaultRate,
    currency: plan.currency,
    discountType: plan.discountType,
    discountAmount: plan.discountAmount,
    scholarshipOrConcession: plan.scholarshipOrConcession,
    status: plan.status,
    notes: plan.notes,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

function safePayment(payment) {
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    invoiceNumber: payment.invoice?.invoiceNumber,
    parent: payment.invoice?.parent,
    student: payment.invoice?.student,
    service: payment.invoice?.service,
    kind: payment.kind,
    amount: payment.amount,
    signedAmount: signedCompletedAmount(payment),
    currency: payment.currency,
    status: payment.status,
    paymentMethod: payment.paymentMethod,
    provider: payment.provider,
    reference: payment.reference,
    transactionReference: payment.transactionReference,
    paidAt: payment.paidAt,
    notes: payment.notes,
    receipt: payment.receipt ? safeReceipt(payment.receipt) : null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

function safeReceipt(receipt) {
  return {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    invoiceId: receipt.invoiceId,
    invoiceNumber: receipt.invoice?.invoiceNumber,
    parent: receipt.parent,
    student: receipt.student,
    amount: receipt.amount,
    amountInWords: receipt.amountInWords,
    currency: receipt.currency,
    paymentMethod: receipt.paymentMethod,
    transactionReference: receipt.transactionReference,
    dateReceived: receipt.dateReceived,
    service: receipt.service,
    periodCovered: receipt.periodCovered,
    authorisedConfirmation: receipt.authorisedConfirmation,
    authorisedBy: receipt.authorisedBy,
    createdAt: receipt.createdAt,
  };
}

function receiptInclude() {
  return {
    invoice: { select: { id: true, invoiceNumber: true, service: true, totalAmount: true, currency: true } },
    parent: { select: { id: true, fullName: true, email: true, phone: true } },
    student: { select: { id: true, fullName: true, yearGroup: true } },
    authorisedBy: { select: { id: true, name: true, email: true } },
    payment: true,
  };
}

function buildInvoiceWhere(query) {
  return cleanData({
    status: query.status ? parseOption(query.status, [...invoiceStatuses, ...legacyInvoiceStatuses], "Select a valid invoice status.") : undefined,
    parentId: optional(query.parentId),
    studentId: optional(query.studentId),
    service: query.service ? { contains: String(query.service), mode: "insensitive" } : undefined,
  });
}

function buildFeePlanWhere(query) {
  return cleanData({
    status: optional(query.status),
    planType: optional(query.planType),
    subjectId: optional(query.subjectId),
  });
}

async function nextNumber(modelDelegate, fieldName, prefix) {
  const year = new Date().getFullYear();
  const numberPrefix = `${prefix}-${year}-`;
  const latest = await modelDelegate.findFirst({
    where: { [fieldName]: { startsWith: numberPrefix } },
    orderBy: { [fieldName]: "desc" },
    select: { [fieldName]: true },
  });
  const current = latest?.[fieldName] ? Number(String(latest[fieldName]).slice(-4)) : 0;
  return `${numberPrefix}${String(current + 1).padStart(4, "0")}`;
}

function paymentProviderSummary() {
  return {
    provider: process.env.PAYMENT_PROVIDER || "Manual or bank transfer",
    publicName: process.env.PAYMENT_PUBLIC_NAME || process.env.PAYMENT_PROVIDER || "TutorHiveHub payments",
    onlineConfigured: Boolean(process.env.PAYMENT_CHECKOUT_URL),
    bankTransferDetails: process.env.BANK_TRANSFER_DETAILS || "TutorHiveHub bank transfer details will be provided by administration.",
  };
}

function checkoutUrlForInvoice(config, invoice, amount, paymentId) {
  if (!process.env.PAYMENT_CHECKOUT_URL) {
    return null;
  }
  const url = new URL(process.env.PAYMENT_CHECKOUT_URL);
  url.searchParams.set("invoice", invoice.invoiceNumber);
  url.searchParams.set("amount", String(amount));
  url.searchParams.set("currency", invoice.currency);
  url.searchParams.set("paymentId", paymentId);
  return url.toString();
}

function sendPrintableHtml(response, filename, html) {
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.send(html);
}

function invoiceDocumentHtml(invoice) {
  const rows = [
    ["Invoice number", invoice.invoiceNumber],
    ["Parent", invoice.parent?.fullName],
    ["Student", invoice.student?.fullName],
    ["Service", invoice.service],
    ["Period", periodText(invoice)],
    ["Quantity", moneyText(invoice.quantity)],
    ["Rate", money(invoice.rate, invoice.currency)],
    ["Discount", money(invoice.discountAmount, invoice.currency)],
    ["Subtotal", money(invoice.subtotal, invoice.currency)],
    ["Total", money(invoice.totalAmount, invoice.currency)],
    ["Paid", money(invoice.amountPaid, invoice.currency)],
    ["Balance due", money(invoice.balanceDue, invoice.currency)],
    ["Due date", dateText(invoice.dueDate)],
    ["Status", normaliseInvoiceStatus(invoice.status)],
    ["Notes", invoice.notes],
  ];
  return documentHtml("TutorHiveHub Invoice", rows, `
    <h2>${escapeHtml(invoice.invoiceNumber)}</h2>
    <p>Please use the invoice number as the payment reference.</p>
  `);
}

function receiptDocumentHtml(receipt) {
  const rows = [
    ["Receipt number", receipt.receiptNumber],
    ["Invoice number", receipt.invoice?.invoiceNumber],
    ["Parent", receipt.parent?.fullName],
    ["Student", receipt.student?.fullName],
    ["Service", receipt.service],
    ["Period", receipt.periodCovered],
    ["Amount", money(receipt.amount, receipt.currency)],
    ["Amount in words", receipt.amountInWords],
    ["Payment method", receipt.paymentMethod],
    ["Transaction reference", receipt.transactionReference],
    ["Date received", dateText(receipt.dateReceived)],
    ["Authorised confirmation", receipt.authorisedConfirmation ? "Confirmed" : "Not confirmed"],
    ["Authorised by", receipt.authorisedBy?.name],
  ];
  return documentHtml("TutorHiveHub Receipt", rows, `
    <h2>${escapeHtml(receipt.receiptNumber)}</h2>
    <p>This receipt confirms payment received by TutorHiveHub.</p>
  `);
}

function documentHtml(title, rows, intro) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, sans-serif; color: #061c3d; margin: 0; background: #f8fafc; }
    .page { min-height: calc(297mm - 36mm); background: #fff; padding: 28px; border-top: 8px solid #f2a900; }
    header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid #dbe4ef; padding-bottom: 18px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 30px; }
    h2 { margin: 0 0 8px; font-size: 20px; }
    p { line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #dbe4ef; padding: 12px; text-align: left; vertical-align: top; }
    th { width: 220px; background: #f8fafc; }
    footer { margin-top: 32px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p>TutorHiveHub - Your Hub for Academic Success</p>
      </div>
      <div>${intro}</div>
    </header>
    <table>
      <tbody>
        ${rows
          .map(
            ([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || "-")}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>
    <footer>Generated by the TutorHiveHub secure portal.</footer>
  </main>
</body>
</html>`;
}

function amountInWords(value, currency) {
  const amount = Math.abs(decimalNumber(value));
  const whole = Math.floor(amount);
  const fraction = Math.round((amount - whole) * 100);
  const labels = currencyLabels(currency);
  const wholeWords = numberToWords(whole);
  const fractionWords = fraction > 0 ? ` and ${numberToWords(fraction)} ${labels.fraction}` : "";
  return `${wholeWords} ${labels.major}${fractionWords} only`;
}

function numberToWords(number) {
  const small = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  if (number < 20) return small[number];
  if (number < 100) return `${tens[Math.floor(number / 10)]}${number % 10 ? ` ${small[number % 10]}` : ""}`;
  if (number < 1000) return `${small[Math.floor(number / 100)]} hundred${number % 100 ? ` ${numberToWords(number % 100)}` : ""}`;
  if (number < 1000000) return `${numberToWords(Math.floor(number / 1000))} thousand${number % 1000 ? ` ${numberToWords(number % 1000)}` : ""}`;
  return String(number);
}

function currencyLabels(currency) {
  if (currency === "NGN") return { major: "naira", fraction: "kobo" };
  if (currency === "USD") return { major: "dollars", fraction: "cents" };
  if (currency === "EUR") return { major: "euros", fraction: "cents" };
  return { major: "pounds", fraction: "pence" };
}

function periodText(invoice) {
  const start = dateText(invoice.billingPeriodStart);
  const end = dateText(invoice.billingPeriodEnd);
  if (start === "-" && end === "-") return "-";
  if (start === end || end === "-") return start;
  if (start === "-") return end;
  return `${start} to ${end}`;
}

function normaliseInvoiceStatus(status) {
  if (status === "PART_PAID") return "PARTIALLY_PAID";
  if (status === "VOID") return "CANCELLED";
  return status;
}

function effectiveInvoiceStatus(invoice) {
  const status = normaliseInvoiceStatus(invoice.status);
  if (!["DRAFT", "PAID", "CANCELLED"].includes(status) && decimalNumber(invoice.balanceDue) > 0 && invoice.dueDate && startOfDay(invoice.dueDate) < startOfDay(new Date())) {
    return "OVERDUE";
  }
  return status;
}

function canManageFinance(user) {
  return hasPermission(user, "finance:manage");
}

function parseMoney(value, message) {
  const cleaned = required(value, message);
  const number = Number(cleaned);
  if (!Number.isFinite(number) || number < 0) {
    throw new ValidationError(message);
  }
  return round2(number);
}

function parseSignedMoney(value, message) {
  const cleaned = required(value, message);
  const number = Number(cleaned);
  if (!Number.isFinite(number)) {
    throw new ValidationError(message);
  }
  return round2(number);
}

function parseOptionalMoney(value, fallback) {
  const cleaned = optional(value);
  if (!cleaned) {
    return round2(fallback);
  }
  return parseMoney(cleaned, "Please enter a valid amount.");
}

function parseCurrency(value) {
  const cleaned = required(value, "Currency is required.").toUpperCase();
  if (!/^[A-Z]{3}$/.test(cleaned)) {
    throw new ValidationError("Currency must use a three-letter code such as GBP.");
  }
  return cleaned;
}

function parseOption(value, options, message) {
  const cleaned = required(value, message);
  if (!options.includes(cleaned)) {
    throw new ValidationError(message);
  }
  return cleaned;
}

function required(value, message) {
  const cleaned = optional(value);
  if (!cleaned) {
    throw new ValidationError(message);
  }
  return cleaned;
}

function requiredDate(value, message) {
  const parsed = optionalDate(value);
  if (!parsed) {
    throw new ValidationError(message);
  }
  return parsed;
}

function optional(value) {
  const cleaned = String(value ?? "").trim();
  return cleaned || null;
}

function optionalDate(value) {
  const cleaned = optional(value);
  if (!cleaned) {
    return null;
  }
  const date = new Date(`${cleaned}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Please enter a valid date.");
  }
  return date;
}

function parseBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "Yes";
}

function sumMoney(values) {
  return round2(values.reduce((total, value) => total + decimalNumber(value), 0));
}

function decimalNumber(value) {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function money(value, currency = "GBP") {
  return `${currency} ${moneyText(value)}`;
}

function moneyText(value) {
  const number = decimalNumber(value);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

function dateText(value) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value)) : "-";
}

function dateInput(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function cleanData(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function notifyParentFinanceEvent({ prisma, request, invoice, sendPortalEmail, category, title, message }) {
  const parentUser = invoice.parent?.user;
  if (parentUser?.id) {
    await prisma.notification.create({
      data: {
        recipientId: parentUser.id,
        createdById: request.portalUser.id,
        title,
        message,
        category,
        entityType: "Invoice",
        entityId: invoice.id,
      },
    });
  }

  const email = invoice.parent?.email || parentUser?.email;
  if (!email || !sendPortalEmail) {
    return;
  }

  try {
    await sendPortalEmail({ to: email, subject: title, text: message, html: `<p>${escapeHtml(message)}</p>` });
  } catch (error) {
    await auditLog({ request, actorId: request.portalUser.id, action: "finance_notification_email_failed", entityType: "Invoice", entityId: invoice.id, metadata: { email, category, error: error instanceof Error ? error.message : String(error) } });
  }
}

function handleFinanceError(error, response, next) {
  if (error instanceof ValidationError) {
    response.status(422).json({ ok: false, message: error.message });
    return;
  }
  if (error instanceof ForbiddenError) {
    response.status(403).json({ ok: false, message: error.message });
    return;
  }
  if (error instanceof NotFoundError) {
    response.status(404).json({ ok: false, message: error.message });
    return;
  }
  next(error);
}

class ValidationError extends Error {}
class ForbiddenError extends Error {}
class NotFoundError extends Error {}
