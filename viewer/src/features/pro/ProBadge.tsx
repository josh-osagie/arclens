import { cn } from "@/lib/utils";

type Tier = "free" | "pro";

type Props = {
  tier?: Tier;
  className?: string;
};

export function ProBadge({ tier = "free", className }: Props) {
  const isPro = tier === "pro";
  const label = isPro ? "Pro" : "Free";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        isPro
          ? "bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-violet-300 border border-violet-500/30"
          : "bg-muted text-muted-foreground border border-border",
        className
      )}
    >
      {label}
    </span>
  );
}
