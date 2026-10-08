import { describe, expect, it, vi } from "vitest";

describe("rate limiting", () => {
	it("fails closed when Redis is not configured", async () => {
		vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
		vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
		vi.resetModules();

		const { checkRateLimit } = await import("@/lib/rateLimit");
		await expect(checkRateLimit("test-key", 5, 60)).resolves.toBe(false);

		vi.unstubAllEnvs();
	});
});
