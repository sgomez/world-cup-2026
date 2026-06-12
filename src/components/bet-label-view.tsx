import type { SerializedBetLabel } from "@/modules/bet/domain/bet-label";

interface BetLabelViewProps {
  label: SerializedBetLabel | string;
  className?: string;
}

export function BetLabelView({ label, className }: BetLabelViewProps) {
  if (typeof label === "string") {
    return <span className={className}>{label}</span>;
  }

  if (!label.obfuscated) {
    return <span className={className}>{label.value}</span>;
  }

  return (
    <span className={`inline-flex items-center min-w-0 ${className ?? ""}`}>
      {label.num && <span className="shrink-0">{label.num}&nbsp;|&nbsp;</span>}
      {label.head && <span className="shrink-0">{label.head}</span>}
      <span
        role="img"
        className="inline-block h-[0.9em] self-center rounded-[2px] bg-muted-foreground/40 dark:bg-muted-foreground/40 blur-[2px] shrink-0"
        style={{
          width: `${Math.max(1.5, Math.min(10, label.middleLen * 0.55))}em`,
        }}
        aria-label="obfuscated name"
      />
      {label.tail && <span className="shrink-0">{label.tail}</span>}
    </span>
  );
}
