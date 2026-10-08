import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const updateUser = vi.fn();
const verifyTurnstileToken = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({ auth: { getUser, updateUser } })),
}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstileToken }));

describe("reset-password bot verification route", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		updateUser.mockResolvedValue({ error: null });
	});

	it("rejects unauthenticated callers before token verification", async () => {
		getUser.mockResolvedValue({ data: { user: null } });
		const { POST } = await import("@/app/api/auth/verify-turnstile/route");

		const response = await POST(
			new Request("http://localhost/api/auth/verify-turnstile", {
				method: "POST",
				body: JSON.stringify({ token: "token" }),
			}) as never,
		);

		expect(response.status).toBe(401);
		expect(verifyTurnstileToken).not.toHaveBeenCalled();
	});

	it("rejects malformed payloads and invalid tokens", async () => {
		getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
		verifyTurnstileToken.mockResolvedValue(false);
		const { POST } = await import("@/app/api/auth/verify-turnstile/route");

		const response = await POST(
			new Request("http://localhost/api/auth/verify-turnstile", {
				method: "POST",
				headers: { "x-forwarded-for": "203.0.113.8" },
				body: "{invalid",
			}) as never,
		);

		expect(response.status).toBe(400);
		expect(verifyTurnstileToken).not.toHaveBeenCalled();

		const invalidTokenResponse = await POST(
			new Request("http://localhost/api/auth/verify-turnstile", {
				method: "POST",
				headers: { "x-forwarded-for": "203.0.113.8" },
				body: JSON.stringify({
					token: "invalid-token",
					password: "new-password",
				}),
			}) as never,
		);

		expect(invalidTokenResponse.status).toBe(403);
		expect(verifyTurnstileToken).toHaveBeenCalledWith(
			"invalid-token",
			"203.0.113.8",
		);
	});

	it("accepts an authenticated request with a valid token", async () => {
		getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
		verifyTurnstileToken.mockResolvedValue(true);
		const { POST } = await import("@/app/api/auth/verify-turnstile/route");

		const response = await POST(
			new Request("http://localhost/api/auth/verify-turnstile", {
				method: "POST",
				body: JSON.stringify({ token: "valid-token", password: "new-password" }),
			}) as never,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		expect(updateUser).toHaveBeenCalledWith({ password: "new-password" });
	});
});
