import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const from = vi.fn();
const checkRateLimit = vi.fn();
const validateOrigin = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit }));
vi.mock("@/lib/csrf", () => ({ validateOrigin }));

describe("saved jobs API", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
		checkRateLimit.mockResolvedValue(true);
		validateOrigin.mockReturnValue(true);
	});

	it("rejects cross-origin saves", async () => {
		validateOrigin.mockReturnValue(false);
		const { POST } = await import("@/app/api/saved-jobs/route");
		const response = await POST(
			new Request("http://localhost/api/saved-jobs", {
				method: "POST",
				body: JSON.stringify({ jobId: "job-1" }),
			}) as never,
		);
		expect(response.status).toBe(403);
	});

	it("requires authentication and a job id", async () => {
		getUser.mockResolvedValue({ data: { user: null } });
		const { POST } = await import("@/app/api/saved-jobs/route");
		const unauthorized = await POST(
			new Request("http://localhost/api/saved-jobs", { method: "POST" }) as never,
		);
		expect(unauthorized.status).toBe(401);

		getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
		const missing = await POST(
			new Request("http://localhost/api/saved-jobs", {
				method: "POST",
				body: JSON.stringify({}),
			}) as never,
		);
		expect(missing.status).toBe(400);
	});

	it("maps duplicate saves to a conflict", async () => {
		const saveQuery = {
			insert: vi.fn().mockReturnThis(),
			select: vi.fn().mockReturnThis(),
			single: vi.fn().mockResolvedValue({ error: { code: "23505" } }),
		};
		from.mockReturnValue(saveQuery);
		const { POST } = await import("@/app/api/saved-jobs/route");
		const response = await POST(
			new Request("http://localhost/api/saved-jobs", {
				method: "POST",
				body: JSON.stringify({ jobId: "job-1" }),
			}) as never,
		);
		expect(response.status).toBe(409);
	});
});
