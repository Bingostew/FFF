// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};


import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:8000"; // change to your API host

describe("Initial endpoint", () => {
  it("should return 400 on initial request", async () => {
    const res = await fetch(`${BASE_URL}/`, {
      method: "GET",
    });

    expect(res.status).toBe(400);
  });
});
