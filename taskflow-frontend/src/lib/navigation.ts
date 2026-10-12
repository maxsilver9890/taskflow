export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const parsed = new URL(value, "https://taskflow.invalid");
    if (parsed.origin !== "https://taskflow.invalid") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export const PENDING_AUTH_NEXT_KEY = "taskflow.pendingAuthNext";
