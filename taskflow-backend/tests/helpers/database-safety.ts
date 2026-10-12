const REQUIRED_HOST = "localhost";
const REQUIRED_PORT = "5433";
const REQUIRED_DATABASE = "taskflow_test";

export type TestDatabaseEnvironment = Partial<Pick<NodeJS.ProcessEnv, "NODE_ENV" | "DATABASE_URL">>;

/** Validate the effective Prisma URL before any integration test can mutate data. */
export function assertSafeTestDatabase(
  environment: TestDatabaseEnvironment = process.env
): void {
  if (environment.NODE_ENV !== "test") {
    throw new Error("Refusing database mutation: NODE_ENV must be test.");
  }

  const connectionString = environment.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Refusing database mutation: DATABASE_URL is not set.");
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(connectionString);
  } catch {
    throw new Error("Refusing database mutation: DATABASE_URL is not a valid PostgreSQL URL.");
  }

  const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  const connectionOverrideParameters = new Set([
    "host", "hostaddr", "port", "database", "dbname", "socket", "options"
  ]);
  const hasConnectionOverrides = [...databaseUrl.searchParams.keys()]
    .some((parameter) => connectionOverrideParameters.has(parameter.toLowerCase()));

  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.hostname.toLowerCase() !== REQUIRED_HOST ||
    databaseUrl.port !== REQUIRED_PORT ||
    databaseName !== REQUIRED_DATABASE ||
    hasConnectionOverrides
  ) {
    throw new Error(
      "Refusing database mutation: DATABASE_URL must target localhost:5433/taskflow_test."
    );
  }
}
