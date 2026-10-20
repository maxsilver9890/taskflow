import { describe, expect, it } from "vitest";
import { parseCorsOrigins } from "../../src/config/cors.js";

describe("parseCorsOrigins", () => {
  it("parses and deduplicates configured origins", () => {
    expect(parseCorsOrigins(
      " https://app.example,https://preview.example,https://app.example ",
      "http://localhost:3001"
    )).toEqual(["https://app.example", "https://preview.example"]);
  });

  it("uses the frontend URL when no separate allowlist is set", () => {
    expect(parseCorsOrigins(undefined, "https://app.example")).toEqual([
      "https://app.example"
    ]);
  });

  it.each([
    "*",
    "https://*",
    "https://app.example/path",
    "ftp://app.example",
    "https://user:password@app.example"
  ])("rejects invalid or broad origin %s", (value) => {
    expect(() => parseCorsOrigins(value, "https://app.example")).toThrow(
      "Invalid CORS origin"
    );
  });
});
