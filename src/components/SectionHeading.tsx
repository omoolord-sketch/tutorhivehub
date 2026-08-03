type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
};

export function SectionHeading({ eyebrow, title, description, align = "left", tone = "light" }: SectionHeadingProps) {
  const titleClass = tone === "dark" ? "text-white" : "text-navy";
  const descriptionClass = tone === "dark" ? "text-white/75" : "text-slate-650";

  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow && <p className="mb-3 text-sm font-black uppercase text-gold">{eyebrow}</p>}
      <h2 className={`text-2xl font-black leading-tight sm:text-4xl ${titleClass}`}>{title}</h2>
      {description && <p className={`mt-4 text-base leading-8 sm:text-lg ${descriptionClass}`}>{description}</p>}
    </div>
  );
}
