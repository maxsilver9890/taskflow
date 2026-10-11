import { describe, expect, it } from "vitest";

import { formatDueDate, isOverdue, isoToDateInput, dateInputToIso, pluralize } from "@/lib/utils";

describe("dateInputToIso / isoToDateInput", () => {
  it("round-trips a calendar day regardless of local timezone", () => {
    const iso = dateInputToIso("2026-03-15");
    expect(isoToDateInput(iso)).toBe("2026-03-15");
  });
});

describe("formatDueDate", () => {
  it("formats an ISO date in UTC", () => {
    expect(formatDueDate("2026-03-15T12:00:00.000Z")).toBe("Mar 15, 2026");
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("is false when there is no due date", () => {
    expect(isOverdue(null, false, now)).toBe(false);
  });

  it("is false once the task is done, even if the due date has passed", () => {
    expect(isOverdue("2026-01-01T12:00:00.000Z", true, now)).toBe(false);
  });

  it("is true for a past due date on an unfinished task", () => {
    expect(isOverdue("2026-01-01T12:00:00.000Z", false, now)).toBe(true);
  });

  it("is false for a future due date", () => {
    expect(isOverdue("2026-12-01T12:00:00.000Z", false, now)).toBe(false);
  });
});

describe("pluralize", () => {
  it("uses the singular for 1", () => {
    expect(pluralize(1, "task")).toBe("1 task");
  });
  it("uses the plural otherwise", () => {
    expect(pluralize(0, "task")).toBe("0 tasks");
    expect(pluralize(3, "task")).toBe("3 tasks");
  });
});
