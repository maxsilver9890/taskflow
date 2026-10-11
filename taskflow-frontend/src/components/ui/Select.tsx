import { ChevronDown } from "lucide-react";
import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, Props>(
  ({ className, wrapperClassName, children, ...props }, ref) => (
    <div className={cn("relative", wrapperClassName)}>
      <select
        ref={ref}
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-line bg-surface pl-3 pr-8 text-sm text-ink",
          "outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
    </div>
  ),
);
Select.displayName = "Select";
