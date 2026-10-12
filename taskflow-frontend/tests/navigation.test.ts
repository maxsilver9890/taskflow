import { describe, expect, it } from "vitest";
import { safeNextPath } from "../src/lib/navigation";

describe("safeNextPath", () => {
  it("preserves internal invitation paths and query strings", () => {
    expect(safeNextPath("/invitations/abc123?from=email")).toBe("/invitations/abc123?from=email");
  });

  it("rejects absolute, protocol-relative, and backslash paths", () => {
    expect(safeNextPath("https://attacker.example/")).toBeNull();
    expect(safeNextPath("//attacker.example/")).toBeNull();
    expect(safeNextPath("/\\attacker.example/")).toBeNull();
  });
});
