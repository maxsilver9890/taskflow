import { AlertTriangle, Inbox, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { errorMessage } from "@/lib/api/errors";
import { Button } from "./Button";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="tf-fade-in flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-3">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div>
        <p className="text-[15px] font-medium text-ink">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-3">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const isNetwork = errorMessage(error).includes("reach the TaskFlow API");
  return (
    <div className="tf-fade-in flex flex-col items-center justify-center gap-3 rounded-xl border border-line bg-danger-soft/40 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        {isNetwork ? <WifiOff className="size-5" /> : <AlertTriangle className="size-5" />}
      </div>
      <div>
        <p className="text-[15px] font-medium text-ink">Something went wrong</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-3">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function InlineSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-ink-3">
      <span className="size-4 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label}
    </div>
  );
}
