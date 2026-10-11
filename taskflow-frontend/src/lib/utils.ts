import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const dateShortFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Due dates are calendar days: format them in UTC so the day never shifts by timezone. */
export function formatDueDate(iso: string, short = false): string {
  return (short ? dateShortFmt : dateFmt).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function formatRelative(iso: string, now = Date.now()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  return formatDateTime(iso);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** yyyy-mm-dd of the UTC calendar day of an ISO timestamp (for <input type="date">). */
export function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** yyyy-mm-dd → ISO timestamp pinned to noon UTC so the calendar day is stable everywhere. */
export function dateInputToIso(value: string): string {
  return `${value}T12:00:00.000Z`;
}

/** The viewer's local calendar day as yyyy-mm-dd. */
export function localTodayKey(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isOverdue(dueDate: string | null, done: boolean, now = new Date()): boolean {
  if (!dueDate || done) return false;
  return isoToDateInput(dueDate) < localTodayKey(now);
}

/** ISO bounds for "start of local today" and "end of local day N days ahead". */
export function startOfTodayIso(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
export function endOfDayPlusIso(days: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
