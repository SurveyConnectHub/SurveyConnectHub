import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({ auth: { getUser }, from })),
	createServiceClient: vi.fn(),
}));

describe("signed storage URL API", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
	});

	it("rejects unauthenticated requests", async () => {
		getUser.mockResolvedValue({ data: { user: null } });
		const { POST } = await import("@/app/api/storage/signed-url/route");

		const response = await POST(
			new Request("http://localhost/api/storage/signed-url", {
				method: "POST",
				body: JSON.stringify({ bucket: "job-briefs", path: "job/file.pdf" }),
			}) as never,
		);

		expect(response.status).toBe(401);
	});

	it("rejects unsupported buckets and traversal paths", async () => {
		const { POST } = await import("@/app/api/storage/signed-url/route");
		const invalidBucket = await POST(
			new Request("http://localhost/api/storage/signed-url", {
				method: "POST",
				body: JSON.stringify({ bucket: "profiles", path: "user/file.pdf" }),
			}) as never,
		);
		const traversal = await POST(
			new Request("http://localhost/api/storage/signed-url", {
				method: "POST",
				body: JSON.stringify({ bucket: "job-briefs", path: "../secret.pdf" }),
			}) as never,
		);

		expect(invalidBucket.status).toBe(400);
		expect(traversal.status).toBe(400);
		expect(from).not.toHaveBeenCalled();
	});

	it("denies a job brief when the caller is neither owner nor applicant", async () => {
		const jobQuery = {
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			maybeSingle: vi.fn().mockResolvedValue({
				data: { id: "job-1", client_id: "client-1" },
				error: null,
			}),
		};
		const applicationQuery = {
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			maybeSingle: vi.fn().mockResolvedValue({ data: null }),
		};
		from.mockReturnValueOnce(jobQuery).mockReturnValueOnce(applicationQuery);
		const { POST } = await import("@/app/api/storage/signed-url/route");

		const response = await POST(
			new Request("http://localhost/api/storage/signed-url", {
				method: "POST",
				body: JSON.stringify({ bucket: "job-briefs", path: "job-1/file.pdf" }),
			}) as never,
		);

		expect(response.status).toBe(403);
	});
});
