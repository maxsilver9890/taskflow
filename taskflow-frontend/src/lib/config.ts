/**
 * Runtime configuration. All values come from NEXT_PUBLIC_* env vars so they
 * are inlined at build time and safe to read from client components.
 */
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export const config = {
  /** Base URL of the TaskFlow API without a trailing slash. */
  apiUrl: rawApiUrl.replace(/\/+$/, ""),
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
  demoPassword: process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "",
  workerDeployed: process.env.NEXT_PUBLIC_WORKER_DEPLOYED === "true",
} as const;

/** Seeded accounts from the backend's prisma/seed.ts (demo sign-in shortcuts). */
export const DEMO_ACCOUNTS = [
  { email: "ava.shah@northstar.example", name: "Ava Shah", org: "Northstar Labs", role: "Org admin" },
  { email: "liam.chen@northstar.example", name: "Liam Chen", org: "Northstar Labs", role: "Member" },
  { email: "noah.kim@blueorbit.example", name: "Noah Kim", org: "Blue Orbit Studio", role: "Org admin" },
] as const;
