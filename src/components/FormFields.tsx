import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
};

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  id: string;
};

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  id: string;
  options: string[];
};

const fieldClass =
  "mt-2 w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/20";

export function Field({ label, id, className = "", ...props }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-bold text-navy">
        {label}
      </label>
      <input id={id} name={id} className={fieldClass} {...props} />
    </div>
  );
}

export function TextArea({ label, id, className = "", ...props }: TextAreaProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-bold text-navy">
        {label}
      </label>
      <textarea id={id} name={id} className={`${fieldClass} min-h-32 resize-y`} {...props} />
    </div>
  );
}

export function SelectField({ label, id, options, className = "", ...props }: SelectFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-bold text-navy">
        {label}
      </label>
      <select id={id} name={id} className={fieldClass} {...props}>
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
