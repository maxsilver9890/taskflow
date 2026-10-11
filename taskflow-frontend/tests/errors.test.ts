import { describe, expect, it } from "vitest";

import { ApiError, errorMessage, parseErrorBody } from "@/lib/api/errors";

describe("parseErrorBody — OTP error codes", () => {
  it("extracts details.retryAfterSeconds from an OTP_RESEND_COOLDOWN envelope, for seeding the frontend's countdown", () => {
    const err = parseErrorBody(429, {
      error: "Please wait 42s before requesting another code.",
      code: "OTP_RESEND_COOLDOWN",
      details: { retryAfterSeconds: 42 },
    });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(429);
    expect(err.code).toBe("OTP_RESEND_COOLDOWN");
    expect(err.details.retryAfterSeconds).toBe(42);
  });

  it("parses OTP_INVALID as a 401 with no field errors", () => {
    const err = parseErrorBody(401, { error: "That verification code is incorrect.", code: "OTP_INVALID" });
    expect(err.status).toBe(401);
    expect(err.code).toBe("OTP_INVALID");
    expect(err.fieldErrors).toEqual({});
  });

  it("parses OTP_EXPIRED as a 401", () => {
    const err = parseErrorBody(401, { error: "That verification code has expired.", code: "OTP_EXPIRED" });
    expect(err.code).toBe("OTP_EXPIRED");
  });

  it("parses OTP_LOCKED as a 429", () => {
    const err = parseErrorBody(429, { error: "Too many incorrect attempts.", code: "OTP_LOCKED" });
    expect(err.status).toBe(429);
    expect(err.code).toBe("OTP_LOCKED");
  });

  it("parses EMAIL_ALREADY_VERIFIED as a 409", () => {
    const err = parseErrorBody(409, { error: "Already verified.", code: "EMAIL_ALREADY_VERIFIED" });
    expect(err.status).toBe(409);
    expect(err.code).toBe("EMAIL_ALREADY_VERIFIED");
  });

  it("parses EMAIL_NOT_VERIFIED as a 403", () => {
    const err = parseErrorBody(403, { error: "Please verify your email.", code: "EMAIL_NOT_VERIFIED" });
    expect(err.status).toBe(403);
    expect(err.code).toBe("EMAIL_NOT_VERIFIED");
  });
});

describe("errorMessage — friendly copy for OTP codes", () => {
  it("has distinct, human-readable copy for every OTP-related code", () => {
    const codes = [
      "EMAIL_NOT_VERIFIED",
      "EMAIL_ALREADY_VERIFIED",
      "OTP_INVALID",
      "OTP_EXPIRED",
      "OTP_LOCKED",
      "OTP_RESEND_COOLDOWN",
    ];
    const messages = codes.map((code) => errorMessage(new ApiError(400, code, "server fallback message")));

    for (const message of messages) {
      expect(message).not.toBe("server fallback message");
      expect(message.length).toBeGreaterThan(0);
    }
    // No two codes should accidentally collide on identical copy.
    expect(new Set(messages).size).toBe(messages.length);
  });

  it("falls back to the server's message for an unmapped code", () => {
    expect(errorMessage(new ApiError(400, "SOME_FUTURE_CODE", "a brand new server message"))).toBe(
      "a brand new server message",
    );
  });
});
