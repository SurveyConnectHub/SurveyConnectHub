import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const from = vi.fn();
const checkRateLimit = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit }));

const query = (result: unknown) => ({
	select: vi.fn().mockReturnThis(),
	eq: vi.fn().mockReturnThis(),
	order: vi.fn().mockReturnThis(),
	limit: vi.fn().mockReturnThis(),
	update: vi.fn().mockReturnThis(),
	then: (resolve: (value: unknown) => unknown) => resolve(result),
});

describe("notifications API", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
		checkRateLimit.mockResolvedValue(true);
	});

	it("returns only the authenticated user's notifications", async () => {
		const notificationQuery = query({ data: [{ id: "n1" }], error: null });
		from.mockReturnValue(notificationQuery);
		const { GET } = await import("@/app/api/notifications/route");

		const response = await GET(
			new Request("http://localhost/api/notifications?limit=999&filter=unread") as never,
		);

		expect(response.status).toBe(200);
		expect(notificationQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
		expect(notificationQuery.eq).toHaveBeenCalledWith("is_read", false);
		expect(notificationQuery.limit).toHaveBeenCalledWith(100);
	});

	it("rejects unauthenticated reads and rate-limited updates", async () => {
		getUser.mockResolvedValue({ data: { user: null } });
		const { GET, PATCH } = await import("@/app/api/notifications/route");
		const unauthenticated = await GET(
			new Request("http://localhost/api/notifications") as never,
		);
		expect(unauthenticated.status).toBe(401);

		getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
		checkRateLimit.mockResolvedValue(false);
		const limited = await PATCH(
			new Request("http://localhost/api/notifications", {
				method: "PATCH",
				body: JSON.stringify({ id: "n1" }),
			}) as never,
		);
		expect(limited.status).toBe(429);
	});

	it("requires an id when marking one notification as read", async () => {
		const { PATCH } = await import("@/app/api/notifications/route");
		const response = await PATCH(
			new Request("http://localhost/api/notifications", {
				method: "PATCH",
				body: JSON.stringify({}),
			}) as never,
		);
		expect(response.status).toBe(400);
	});
});
