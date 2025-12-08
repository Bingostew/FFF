import { describe, it, expect } from "vitest";

describe("Initial endpoint", () => {
  it("should return 200 on initial request", async () => {
    const res = await fetch("http://localhost:5173/");

    expect(res.status).toBe(200);
  })
});
