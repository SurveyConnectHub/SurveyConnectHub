import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const from = vi.fn();
const checkRateLimit = vi.fn();
const validateOrigin = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({ auth: { getUser }, from })),
	createServiceClient: vi.fn(),
}));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit }));
vi.mock("@/lib/csrf", () => ({ validateOrigin }));
vi.mock("@/lib/email/notify", () => ({ sendNotificationEmail: vi.fn() }));

describe("payment API boundaries", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubEnv("PAYSTACK_SECRET_KEY", "paystack-secret");
		validateOrigin.mockReturnValue(true);
		getUser.mockResolvedValue({ data: { user: { id: "client-1" } }, error: null });
		checkRateLimit.mockResolvedValue(true);
	});

	it("rejects cross-origin and unauthenticated payment initialization", async () => {
		validateOrigin.mockReturnValue(false);
		const { POST } = await import("@/app/api/paystack/initialize/route");
		const crossOrigin = await POST(
			new Request("http://localhost/api/paystack/initialize", {
				method: "POST",
				body: JSON.stringify({ contractId: "contract-1" }),
			}) as never,
		);
		expect(crossOrigin.status).toBe(403);

		validateOrigin.mockReturnValue(true);
		getUser.mockResolvedValue({ data: { user: null }, error: null });
		const unauthenticated = await POST(
			new Request("http://localhost/api/paystack/initialize", {
				method: "POST",
				body: JSON.stringify({ contractId: "contract-1" }),
			}) as never,
		);
		expect(unauthenticated.status).toBe(401);
	});

	it("fails closed when initialization is rate limited or missing a contract", async () => {
		const { POST } = await import("@/app/api/paystack/initialize/route");
		checkRateLimit.mockResolvedValue(false);
		const limited = await POST(
			new Request("http://localhost/api/paystack/initialize", {
				method: "POST",
				body: JSON.stringify({ contractId: "contract-1" }),
			}) as never,
		);
		expect(limited.status).toBe(429);

		checkRateLimit.mockResolvedValue(true);
		const missing = await POST(
			new Request("http://localhost/api/paystack/initialize", {
				method: "POST",
				body: JSON.stringify({}),
			}) as never,
		);
		expect(missing.status).toBe(400);
	});

	it("redirects verification without a payment reference to failure", async () => {
		const { GET } = await import("@/app/api/paystack/verify/route");
		const response = await GET(
			new Request("http://localhost/api/paystack/verify") as never,
		);
		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toContain("payment=failed");
	});
});
