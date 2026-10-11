import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
      <p className="font-display text-[40px] font-bold text-ink">404</p>
      <p className="text-[14px] text-ink-3">This page doesn&apos;t exist.</p>
      <Link href="/dashboard" className="mt-2 text-[13px] font-medium text-brand hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
