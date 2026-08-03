import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";

const controlClass =
  "mt-2 w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/20 disabled:cursor-not-allowed disabled:bg-slate-100";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function PortalButton({ variant = "primary", className = "", ...props }: ButtonProps) {
  const variants = {
    primary: "bg-gold text-navy hover:bg-gold-100 focus:ring-gold/30",
    secondary: "bg-navy text-white hover:bg-navy-700 focus:ring-navy/25",
    ghost: "border border-slate-200 bg-white text-navy hover:border-gold hover:bg-gold-50 focus:ring-gold/20",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-200",
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-black shadow-sm transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function PortalInput({ label, id, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-bold text-navy">
        {label}
      </label>
      <input id={id} name={id} className={controlClass} {...props} />
    </div>
  );
}

export function PortalSelect({
  label,
  id,
  options,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string; options?: string[] }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-bold text-navy">
        {label}
      </label>
      <select id={id} name={id} className={controlClass} {...props}>
        {children ?? (
          <>
            <option value="">Select an option</option>
            {(options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}

export function PortalTextarea({ label, id, className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; id: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-bold text-navy">
        {label}
      </label>
      <textarea id={id} name={id} className={`${controlClass} min-h-32 resize-y`} {...props} />
    </div>
  );
}

export function PortalCard({ title, eyebrow, children, action, className = "" }: { title?: string; eyebrow?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || eyebrow || action) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {eyebrow && <p className="text-xs font-black uppercase tracking-wide text-gold">{eyebrow}</p>}
            {title && <h2 className="mt-1 text-xl font-black text-navy">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PortalBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "gold" }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
    gold: "bg-gold-50 text-navy",
  };

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${tones[tone]}`}>{children}</span>;
}

export function PortalAlert({ title, children, tone = "info" }: { title: string; children?: ReactNode; tone?: "info" | "success" | "warning" | "error" }) {
  const tones = {
    info: "border-navy/15 bg-navy-50 text-navy",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-red-200 bg-red-50 text-red-800",
  };
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`flex gap-3 rounded-lg border p-4 ${tones[tone]}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-black">{title}</p>
        {children && <div className="mt-1 text-sm leading-6 opacity-85">{children}</div>}
      </div>
    </div>
  );
}

export function PortalTable({ columns, rows }: { columns: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="align-top">
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-4 text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PortalModal({ title, children, open = false, onClose }: { title: string; children: ReactNode; open?: boolean; onClose?: () => void }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/70 p-4">
      <section className="w-full max-w-lg rounded-lg bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-black text-navy">{title}</h2>
          <button type="button" className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-navy" onClick={onClose} aria-label="Close modal">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </section>
    </div>
  );
}

export function PortalConfirmationDialog({
  title,
  message,
  open = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  open?: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
}) {
  return (
    <PortalModal title={title} open={open} onClose={onCancel}>
      <p className="leading-7 text-slate-650">{message}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <PortalButton type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </PortalButton>
        <PortalButton type="button" variant="danger" onClick={onConfirm}>
          Confirm
        </PortalButton>
      </div>
    </PortalModal>
  );
}

export function PortalPagination({ page = 1, totalPages = 1 }: { page?: number; totalPages?: number }) {
  return (
    <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <PortalButton type="button" variant="ghost" disabled={page <= 1}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Previous
      </PortalButton>
      <span className="font-bold text-slate-600">
        Page {page} of {totalPages}
      </span>
      <PortalButton type="button" variant="ghost" disabled={page >= totalPages}>
        Next
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </PortalButton>
    </nav>
  );
}

export function PortalLoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-md bg-slate-100" />
      ))}
    </div>
  );
}

export function PortalEmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <Search className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
      <h3 className="mt-4 text-lg font-black text-navy">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-650">{message}</p>
    </div>
  );
}

export function PortalLoadingButton({ children }: { children: ReactNode }) {
  return (
    <PortalButton type="button" disabled>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {children}
    </PortalButton>
  );
}
