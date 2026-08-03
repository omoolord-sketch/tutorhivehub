type BrandLogoProps = {
  compact?: boolean;
  light?: boolean;
};

export function BrandLogo({ compact = false, light = false }: BrandLogoProps) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/tutorhivehub-logo.png"
        alt=""
        className={`${compact ? "h-11 w-11" : "h-14 w-14"} shrink-0 rounded-lg bg-white object-contain shadow-sm`}
      />
      {!compact && (
        <div className="leading-none">
          <p className={light ? "text-2xl font-black text-white" : "text-2xl font-black text-navy"}>
            Tutor<span className="text-gold">Hive</span>Hub
          </p>
          <p className={light ? "mt-1 text-sm font-semibold text-white/75" : "mt-1 text-sm font-semibold text-slate-600"}>
            Your Hub for Academic Success
          </p>
        </div>
      )}
    </div>
  );
}
