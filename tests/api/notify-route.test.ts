import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const from = vi.fn();
const checkRateLimit = vi.fn();
const sendNotificationEmail = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit }));
vi.mock("@/lib/email/notify", () => ({ sendNotificationEmail }));

describe("notification API", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
		checkRateLimit.mockResolvedValue(true);
	});

	it("rejects unauthenticated requests", async () => {
		getUser.mockResolvedValue({ data: { user: null } });
		const { POST } = await import("@/app/api/notify/route");

		const response = await POST(
			new Request("http://localhost/api/notify", { method: "POST" }) as never,
		);

		expect(response.status).toBe(401);
	});

	it("rejects requests when rate limiting denies the caller", async () => {
		checkRateLimit.mockResolvedValue(false);
		const { POST } = await import("@/app/api/notify/route");

		const response = await POST(
			new Request("http://localhost/api/notify", {
				method: "POST",
				body: JSON.stringify({ event: "application_received" }),
			}) as never,
		);

		expect(response.status).toBe(429);
		expect(sendNotificationEmail).not.toHaveBeenCalled();
	});

	it("rejects a notification for a job the caller does not own", async () => {
		const jobQuery = {
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			single: vi.fn().mockResolvedValue({ data: { client_id: "other-user" } }),
		};
		from.mockReturnValue(jobQuery);
		const { POST } = await import("@/app/api/notify/route");

		const response = await POST(
			new Request("http://localhost/api/notify", {
				method: "POST",
				body: JSON.stringify({
					event: "application_received",
					details: { jobId: "job-1" },
				}),
			}) as never,
		);

		expect(response.status).toBe(403);
		expect(sendNotificationEmail).not.toHaveBeenCalled();
	});

	it("sends an owned notification", async () => {
		const jobQuery = {
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			single: vi.fn().mockResolvedValue({ data: { client_id: "user-1" } }),
		};
		from.mockReturnValue(jobQuery);
		sendNotificationEmail.mockResolvedValue(undefined);
		const payload = {
			event: "application_received",
			details: { jobId: "job-1" },
		};
		const { POST } = await import("@/app/api/notify/route");

		const response = await POST(
			new Request("http://localhost/api/notify", {
				method: "POST",
				body: JSON.stringify(payload),
			}) as never,
		);

		expect(response.status).toBe(200);
		expect(sendNotificationEmail).toHaveBeenCalledWith({
			supabase: expect.anything(),
			userId: "user-1",
			payload,
		});
	});
});
