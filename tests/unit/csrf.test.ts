import { describe, expect, it, vi } from "vitest";
import { validateOrigin } from "@/lib/csrf";

describe("CSRF origin validation", () => {
	it("accepts configured and local origins", () => {
		vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example");
		vi.stubEnv("NEXT_PUBLIC_APP_URLS", "https://preview.example");
		expect(
			validateOrigin(
				new Request("https://app.example/api", {
					headers: { origin: "https://app.example" },
				}),
			),
		).toBe(true);
		expect(
			validateOrigin(
				new Request("http://localhost:3000/api", {
					headers: { origin: "http://localhost:3000" },
				}),
			),
		).toBe(true);
	});

	it("rejects untrusted origins", () => {
		vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example");
		expect(
			validateOrigin(
				new Request("https://app.example/api", {
					headers: { origin: "https://attacker.example" },
				}),
			),
		).toBe(false);
	});
});
