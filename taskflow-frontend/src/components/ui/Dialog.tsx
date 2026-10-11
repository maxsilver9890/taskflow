"use client";

import * as RDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const width = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl" }[size];
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[1px] data-[state=open]:animate-[tf-fade-in_0.15s_ease-out]" />
        <RDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 tf-pop-in",
            "max-h-[85vh] overflow-y-auto rounded-2xl border border-line bg-surface shadow-pop focus:outline-none",
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line p-5">
            <div>
              <RDialog.Title className="text-[16px] font-semibold text-ink">{title}</RDialog.Title>
              {description && <RDialog.Description className="mt-1 text-[13px] text-ink-3">{description}</RDialog.Description>}
            </div>
            <RDialog.Close asChild>
              <button
                aria-label="Close"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </RDialog.Close>
          </div>
          <div className="p-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line p-4">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
