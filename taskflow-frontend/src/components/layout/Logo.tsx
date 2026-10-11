import Link from "next/link";

export function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 font-display text-[16px] font-bold">
      <span className="flex size-6 items-center justify-center rounded-md bg-brand text-[13px] text-brand-ink">T</span>
      <span className="tf-glossy">TaskFlow</span>
    </Link>
  );
}
