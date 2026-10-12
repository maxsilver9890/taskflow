import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_DATABASE = "taskflow";
const EXPECTED_FIREBASE_PROJECT = "testing-ca96d";
const TEST_EMAIL = "maxsilver9890@gmail.com";
const TEST_NAME = "Local Firebase Link Test User";
const TEST_ORGANIZATION = "Local Firebase Link Test Workspace";
const REQUIRED_FLAG = "--confirm-local-test-only";

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!process.argv.includes(REQUIRED_FLAG)) {
  refuse(`Refusing to run without explicit opt-in. Re-run with ${REQUIRED_FLAG}.`);
}

dotenv.config({ path: resolve(process.cwd(), ".env"), override: false });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) refuse("Refusing to run: DATABASE_URL is missing.");

let databaseTarget: URL;
try {
  databaseTarget = new URL(databaseUrl);
} catch {
  refuse("Refusing to run: DATABASE_URL cannot be verified.");
}

const databaseName = decodeURIComponent(databaseTarget.pathname.replace(/^\//, ""));
const connectionOverrideParameters = new Set([
  "host",
  "hostaddr",
  "port",
  "database",
  "dbname",
  "socket",
  "options",
  "service",
  "servicefile",
]);
const hasConnectionOverrides = [...databaseTarget.searchParams.keys()].some(
  (parameter) => connectionOverrideParameters.has(parameter.toLowerCase()),
);
if (
  !["postgres:", "postgresql:"].includes(databaseTarget.protocol) ||
  databaseTarget.hostname.toLowerCase() !== "localhost" ||
  databaseTarget.port !== "5433" ||
  databaseName !== EXPECTED_DATABASE ||
  hasConnectionOverrides
) {
  refuse("Refusing to run: database target must be localhost:5433/taskflow.");
}

const frontendEnvPath = resolve(process.cwd(), "../taskflow-frontend/.env.local");
let frontendEnv: Record<string, string>;
try {
  frontendEnv = dotenv.parse(readFileSync(frontendEnvPath));
} catch {
  refuse("Refusing to run: frontend .env.local is missing or unreadable.");
}

if (
  frontendEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== EXPECTED_FIREBASE_PROJECT ||
  process.env.FIREBASE_PROJECT_ID !== EXPECTED_FIREBASE_PROJECT
) {
  refuse("Refusing to run: frontend and Firebase Admin must both use the approved development Firebase project.");
}

const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
if (
  !firebaseClientEmail ||
  !firebaseClientEmail.endsWith(`@${EXPECTED_FIREBASE_PROJECT}.iam.gserviceaccount.com`) ||
  !process.env.FIREBASE_PRIVATE_KEY
) {
  refuse("Refusing to run: Firebase Admin development service-account credentials are not configured.");
}

function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    return Promise.reject(new Error("A TTY is required to enter the temporary password securely."));
  }

  return new Promise((resolveInput, rejectInput) => {
    let value = "";
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };

    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 3) {
          cleanup();
          rejectInput(new Error("Password entry cancelled."));
          return;
        }
        if (byte === 10 || byte === 13) {
          cleanup();
          resolveInput(value);
          return;
        }
        if (byte === 8 || byte === 127) {
          value = value.slice(0, -1);
        } else if (byte >= 32 && byte <= 126) {
          value += String.fromCharCode(byte);
        }
      }
    };

    process.stdin.on("data", onData);
  });
}

async function main(): Promise<void> {
  let password: string;
  let confirmation: string;
  try {
    password = await readHidden("Temporary TaskFlow test password (12+ characters; input hidden): ");
    confirmation = await readHidden("Confirm temporary password (input hidden): ");
  } catch {
    refuse("Password entry failed or was cancelled; no database changes were made.");
  }

  if (password.length < 12 || password !== confirmation) {
    refuse("Passwords must match and be at least 12 characters; no database changes were made.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email: TEST_EMAIL },
        select: { id: true },
      });
      if (existing) {
        throw new Error("TEST_EMAIL_ALREADY_EXISTS");
      }

      const organization = await tx.organization.create({
        data: { name: TEST_ORGANIZATION },
        select: { id: true },
      });
      const user = await tx.user.create({
        data: {
          email: TEST_EMAIL,
          name: TEST_NAME,
          passwordHash,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          firebaseUid: null,
        },
        select: { id: true },
      });
      await tx.orgMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: "ORG_ADMIN",
        },
      });
    });

    console.log("Local Firebase account-link test user created successfully.");
  } catch (error) {
    if (error instanceof Error && error.message === "TEST_EMAIL_ALREADY_EXISTS") {
      console.error("Refusing to run: the test email already exists; no records were created.");
    } else {
      console.error("Local test-user setup failed; the transaction was rolled back.");
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
