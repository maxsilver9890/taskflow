"use client";

import * as RDropdown from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const DropdownMenu = RDropdown.Root;
export const DropdownMenuTrigger = RDropdown.Trigger;

export function DropdownMenuContent({ children, align = "end" }: { children: ReactNode; align?: "start" | "end" | "center" }) {
  return (
    <RDropdown.Portal>
      <RDropdown.Content
        align={align}
        sideOffset={6}
        className="tf-pop-in z-50 min-w-[180px] overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-pop"
      >
        {children}
      </RDropdown.Content>
    </RDropdown.Portal>
  );
}

export function DropdownMenuItem({
  children,
  onSelect,
  destructive,
  disabled,
}: {
  children: ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <RDropdown.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] outline-none transition-colors",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        destructive ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-surface-2",
      )}
    >
      {children}
    </RDropdown.Item>
  );
}
