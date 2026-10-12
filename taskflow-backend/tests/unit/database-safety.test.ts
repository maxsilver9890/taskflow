import { describe, expect, it } from "vitest";
import { assertSafeTestDatabase } from "../helpers/database-safety.js";

const safeEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://test_user:test_password@localhost:5433/taskflow_test?schema=public"
};

describe("integration test database safety guard", () => {
  it("allows only the explicitly approved local test database", () => {
    expect(() => assertSafeTestDatabase(safeEnvironment)).not.toThrow();
  });

  it.each([
    ["development database", "postgresql://user:password@localhost:5433/taskflow"],
    ["production Supabase URL", "postgresql://user:password@db.example.supabase.co:5432/postgres"],
    ["unexpected host", "postgresql://user:password@127.0.0.1:5433/taskflow_test"],
    ["unexpected port", "postgresql://user:password@localhost:5432/taskflow_test"],
    ["unexpected database name", "postgresql://user:password@localhost:5433/taskflow_other"],
    ["alternate host override", "postgresql://user:password@localhost:5433/taskflow_test?host=db.example.com"],
    ["case-varied host override", "postgresql://user:password@localhost:5433/taskflow_test?HOST=db.example.com"],
    ["invalid URL", "not-a-database-url"]
  ])("rejects %s", (_description, DATABASE_URL) => {
    expect(() => assertSafeTestDatabase({ NODE_ENV: "test", DATABASE_URL })).toThrow();
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => assertSafeTestDatabase({ NODE_ENV: "test" })).toThrow(/DATABASE_URL/);
  });

  it.each([undefined, "development", "production"])(
    "rejects NODE_ENV=%s",
    (NODE_ENV) => {
      expect(() => assertSafeTestDatabase({ ...safeEnvironment, NODE_ENV })).toThrow(/NODE_ENV/);
    }
  );
});
