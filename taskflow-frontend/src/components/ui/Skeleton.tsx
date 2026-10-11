import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("tf-skeleton rounded-md", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <Skeleton className="mb-3 h-4 w-2/3" />
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3">
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-6 w-6 rounded-full" />
    </div>
  );
}
