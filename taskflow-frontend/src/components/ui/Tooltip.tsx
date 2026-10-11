import { cn } from "@/lib/utils";

export function TooltipText({ children, className }: { children: string; className?: string }) {
  return (
    <span title={children} className={cn(className)}>
      {children}
    </span>
  );
}
