/**
 * Parse a comma-separated list of browser origins. An origin is a scheme,
 * hostname, and optional port only; paths, credentials, wildcards, and opaque
 * origins are rejected so the allowlist cannot silently broaden.
 */
export function parseCorsOrigins(value: string | undefined, fallback: string): string[] {
  const origins = (value?.trim() ? value.split(",") : [fallback])
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      let parsed: URL;
      try {
        parsed = new URL(item);
      } catch {
        throw new Error(`Invalid CORS origin: ${item}`);
      }

      if (
        (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
        parsed.hostname.includes("*") ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash
      ) {
        throw new Error(`Invalid CORS origin: ${item}`);
      }

      return parsed.origin;
    });

  if (origins.length === 0) {
    throw new Error("At least one CORS origin must be configured.");
  }

  return [...new Set(origins)];
}
