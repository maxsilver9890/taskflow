import type { Express } from "express";
import type { Queue } from "bullmq";
import request from "supertest";
import type { EmailJobPayload } from "../../src/jobs/queue.js";
import { setAuthEmailQueue } from "../../src/auth/auth.controller.js";
import { setOrganizationEmailQueue } from "../../src/organizations/organization.controller.js";

type CapturedJob = { type?: string; data?: Record<string, unknown> };

/** Replaces delivery with an in-memory queue so integration tests can use real OTP endpoints. */
export function createTestEmailCapture() {
  const jobs: CapturedJob[] = [];
  const tokens = new Map<string, string>();
  const queue = {
    add: async (_name: string, job: CapturedJob) => {
      jobs.push(job);
      return { id: `test-email-${jobs.length}` };
    },
  } as unknown as Queue<EmailJobPayload>;
  setAuthEmailQueue(queue);
  setOrganizationEmailQueue(queue);

  async function registerAndVerify(
    app: Express,
    input: { email: string; name: string; password: string; organizationName: string },
  ) {
    const email = input.email.toLowerCase();
    const registration = await request(app).post("/auth/register").send(input);
    if (registration.status !== 201) {
      throw new Error(`Expected pending registration 201, got ${registration.status}: ${JSON.stringify(registration.body)}`);
    }

    const sent = [...jobs].reverse().find((job) => job.type === "email_verification" && job.data?.email === email);
    const otp = sent?.data?.otp;
    if (typeof otp !== "string") throw new Error(`No verification OTP was captured for ${email}`);

    const verification = await request(app).post("/auth/verify-registration").send({ email, otp });
    if (verification.status !== 200) {
      throw new Error(`Expected OTP verification 200, got ${verification.status}: ${JSON.stringify(verification.body)}`);
    }
    tokens.set(email, verification.body.accessToken as string);
    return { status: registration.status, body: verification.body };
  }

  function accessToken(email: string): string {
    const token = tokens.get(email.toLowerCase());
    if (!token) throw new Error(`No verified access token was captured for ${email}`);
    return token;
  }

  return { queue, registerAndVerify, accessToken };
}
