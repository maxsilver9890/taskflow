import Link from "next/link";
import { Layers } from "lucide-react";

export function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 font-display text-[16px] font-bold uppercase tracking-[-.05em]">
      <span className="flex size-8 items-center justify-center border-2 border-line bg-brand text-ink shadow-[2px_2px_0_#09090B]"><Layers className="size-4" aria-hidden="true" /></span>
      <span className="tf-glossy">TASKFLOW</span>
    </Link>
  );
}
