import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function Upsell({ className }: Props) {
  return (
    <a
      href="/#pricing"
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors",
        className
      )}
    >
      Arclens Pro — upgrade →
    </a>
  );
}
