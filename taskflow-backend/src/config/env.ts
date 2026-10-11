import dotenv from "dotenv";

dotenv.config();

type AppEnv = "development" | "test" | "production";

const allowedNodeEnvs = ["development", "test", "production"] as const;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getPort(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return parsed;
}

function getRedisPort(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid REDIS_PORT value: ${value}`);
  }

  return parsed;
}

function getPositiveInt(name: string, defaultValue: number): number {
  const raw = process.env[name]?.trim();
  const parsed = Number.parseInt(raw ?? String(defaultValue), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid ${name} value: "${raw}". Must be a positive integer.`
    );
  }

  return parsed;
}

function getBcryptRounds(): number {
  const raw = process.env["BCRYPT_ROUNDS"]?.trim();
  const parsed = Number.parseInt(raw ?? "12", 10);

  if (!Number.isInteger(parsed) || parsed < 12) {
    throw new Error(
      `Invalid BCRYPT_ROUNDS value: "${raw}". Must be an integer >= 12.`
    );
  }

  return parsed;
}

function getNodeEnv(value: string | undefined): AppEnv {
  const normalized = value?.trim() || "development";

  if (!allowedNodeEnvs.includes(normalized as AppEnv)) {
    throw new Error(
      `Invalid NODE_ENV value: ${normalized}. Allowed values: ${allowedNodeEnvs.join(", ")}`
    );
  }

  return normalized as AppEnv;
}

export const env = {
  nodeEnv: getNodeEnv(process.env.NODE_ENV),
  port: getPort(process.env.PORT?.trim() || "3000"),
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  postgresDb: getRequiredEnv("POSTGRES_DB"),
  postgresUser: getRequiredEnv("POSTGRES_USER"),
  postgresPassword: getRequiredEnv("POSTGRES_PASSWORD"),
  redisHost: getRequiredEnv("REDIS_HOST"),
  redisPort: getRedisPort(getRequiredEnv("REDIS_PORT")),
  jwtSecret: getRequiredEnv("JWT_SECRET"),
  jwtRefreshSecret: getRequiredEnv("JWT_REFRESH_SECRET"),
  /** Access token TTL in seconds (default 15 min). */
  jwtAccessTtlSeconds: getPositiveInt("JWT_ACCESS_TTL_SECONDS", 900),
  /** Refresh token TTL in seconds (default 7 days). */
  jwtRefreshTtlSeconds: getPositiveInt("JWT_REFRESH_TTL_SECONDS", 604800),
  /** bcrypt cost factor — must be >= 12 per spec. */
  bcryptRounds: getBcryptRounds(),
  /** Email provider driver. Supported: "console" (default), "resend". */
  emailProvider: process.env.EMAIL_PROVIDER?.trim() || "console",
  /**
   * Resend API key — required when EMAIL_PROVIDER=resend.
   * Obtain from https://resend.com/api-keys.
   */
  resendApiKey: process.env.RESEND_API_KEY?.trim() || "",
  /**
   * Sender address used for all outgoing email — required when EMAIL_PROVIDER=resend.
   * Must be a verified domain/address in your Resend account.
   * Example: "TaskFlow <noreply@yourdomain.com>"
   */
  resendFromAddress: process.env.RESEND_FROM_ADDRESS?.trim() || "",
  /** Base URL of the frontend app, used to build links embedded in emails (e.g. password reset). */
  frontendUrl: process.env.FRONTEND_URL?.trim() || "http://localhost:3000"
} as const;
