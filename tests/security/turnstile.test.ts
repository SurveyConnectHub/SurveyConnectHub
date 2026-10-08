import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstileToken } from "@/lib/turnstile";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("Turnstile verification", () => {
	it("rejects missing tokens without contacting the provider", async () => {
		vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(verifyTurnstileToken("")).resolves.toBe(false);
		await expect(verifyTurnstileToken(null)).resolves.toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("fails closed when the server secret is missing", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(verifyTurnstileToken("token")).resolves.toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("accepts a successful response and forwards the client IP", async () => {
		vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ success: true }), { status: 200 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(verifyTurnstileToken("token", "203.0.113.10")).resolves.toBe(true);

		const request = fetchMock.mock.calls[0][1] as RequestInit;
		const body = String(request.body);
		expect(body).toContain("secret=test-secret");
		expect(body).toContain("response=token");
		expect(body).toContain("remoteip=203.0.113.10");
	});

	it("rejects provider errors, unsuccessful responses, malformed JSON, and network errors", async () => {
		vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.stubGlobal(
			"fetch",
			vi.fn()
				.mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
				.mockResolvedValueOnce(
					new Response(JSON.stringify({ success: false }), { status: 200 }),
				)
				.mockResolvedValueOnce(new Response("not-json", { status: 200 }))
				.mockRejectedValueOnce(new Error("network unavailable")),
		);

		await expect(verifyTurnstileToken("token")).resolves.toBe(false);
		await expect(verifyTurnstileToken("token")).resolves.toBe(false);
		await expect(verifyTurnstileToken("token")).resolves.toBe(false);
		await expect(verifyTurnstileToken("token")).resolves.toBe(false);
	});
});
