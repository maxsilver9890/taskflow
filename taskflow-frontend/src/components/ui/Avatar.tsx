import { cn, initials } from "@/lib/utils";

const PALETTE = [
  "bg-[#0d6b5e] text-white",
  "bg-[#2563eb] text-white",
  "bg-[#b7791f] text-white",
  "bg-[#7c3aed] text-white",
  "bg-[#be185d] text-white",
  "bg-[#0e7490] text-white",
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = { sm: "size-6 text-[10px]", md: "size-8 text-[12px]", lg: "size-11 text-[14px]" }[size];
  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", dims, colorFor(name), className)}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  if (names.length === 0) return null;
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((n, i) => (
        <Avatar key={n + i} name={n} size="sm" className="ring-2 ring-surface" />
      ))}
      {rest > 0 && (
        <span className="flex size-6 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-ink-2 ring-2 ring-surface">
          +{rest}
        </span>
      )}
    </div>
  );
}
