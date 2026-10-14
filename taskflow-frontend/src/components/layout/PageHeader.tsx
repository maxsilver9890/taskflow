"use client";

import type { ReactNode } from "react";

import { useScrollReveal } from "@/hooks/use-scroll-reveal";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();

  return (
    <div className="tf-page-header flex flex-wrap items-start justify-between gap-3 border-b border-line bg-surface px-4 py-4 md:px-6 md:py-5">
      <div ref={ref} data-visible={visible} className="tf-scroll-reveal min-w-0 flex-1">
        <h1 className="tf-glossy flex min-w-0 flex-wrap items-center gap-2 break-words font-display text-[19px] font-bold md:text-[22px]">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
