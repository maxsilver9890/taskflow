import { describe, expect, it } from "vitest";

function paginate(page: number, limit: number) {
  return {
    skip: (page - 1) * limit,
    take: limit
  };
}

describe("pagination", () => {
  it("calculates skip and take for the first page", () => {
    expect(paginate(1, 20)).toEqual({
      skip: 0,
      take: 20
    });
  });

  it("calculates skip correctly for later pages", () => {
    expect(paginate(3, 10)).toEqual({
      skip: 20,
      take: 10
    });
  });

  it("handles a single-item page size", () => {
    expect(paginate(5, 1)).toEqual({
      skip: 4,
      take: 1
    });
  });
});