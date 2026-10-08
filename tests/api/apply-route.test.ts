import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const from = vi.fn();
const checkRateLimit = vi.fn();
const verifyTurnstileToken = vi.fn();
const validateOrigin = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({ auth: { getUser }, from })),
	createServiceClient: vi.fn(),
}));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstileToken }));
vi.mock("@/lib/csrf", () => ({ validateOrigin }));
vi.mock("@/lib/email/notify", () => ({ sendNotificationEmail: vi.fn() }));

describe("job application API", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		validateOrigin.mockReturnValue(true);
		checkRateLimit.mockResolvedValue(true);
		verifyTurnstileToken.mockResolvedValue(true);
	});

	it("rejects a cross-origin request before authentication", async () => {
		validateOrigin.mockReturnValue(false);
		const { POST } = await import("@/app/api/apply/route");

		const response = await POST(
			new Request("http://localhost/api/apply", {
				method: "POST",
				headers: { origin: "https://attacker.example" },
			}) as never,
		);

		expect(response.status).toBe(403);
		expect(getUser).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated applicants", async () => {
		getUser.mockResolvedValue({ data: { user: null } });
		const { POST } = await import("@/app/api/apply/route");

		const response = await POST(
			new Request("http://localhost/api/apply", {
				method: "POST",
				headers: { origin: "http://localhost:3000" },
				body: "{}",
			}) as never,
		);

		expect(response.status).toBe(401);
	});

	it("rejects requests when rate limiting denies the caller", async () => {
		getUser.mockResolvedValue({ data: { user: { id: "professional-1" } } });
		checkRateLimit.mockResolvedValue(false);
		const profileQuery = {
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			single: vi.fn().mockResolvedValue({
				data: { role: "professional", full_name: "Test", email: "test@example.com" },
			}),
		};
		from.mockReturnValue(profileQuery);
		const { POST } = await import("@/app/api/apply/route");

		const response = await POST(
			new Request("http://localhost/api/apply", {
				method: "POST",
				body: JSON.stringify({}),
			}) as never,
		);

		expect(response.status).toBe(429);
		expect(verifyTurnstileToken).not.toHaveBeenCalled();
	});

	it("rejects invalid bot verification before accepting application data", async () => {
		getUser.mockResolvedValue({ data: { user: { id: "professional-1" } } });
		const profileQuery = {
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			single: vi.fn().mockResolvedValue({
				data: { role: "professional", full_name: "Test", email: "test@example.com" },
			}),
		};
		from.mockReturnValue(profileQuery);
		verifyTurnstileToken.mockResolvedValue(false);
		const { POST } = await import("@/app/api/apply/route");

		const response = await POST(
			new Request("http://localhost/api/apply", {
				method: "POST",
				body: JSON.stringify({ turnstileToken: "invalid-token" }),
			}) as never,
		);

		expect(response.status).toBe(403);
		expect(verifyTurnstileToken).toHaveBeenCalledWith("invalid-token", undefined);
	});
});
