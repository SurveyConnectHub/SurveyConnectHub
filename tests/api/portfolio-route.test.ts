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

describe("portfolio API input handling", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		getUser.mockResolvedValue({ data: { user: { id: "professional-1" } } });
		checkRateLimit.mockResolvedValue(true);
		validateOrigin.mockReturnValue(true);
	});

	it("rejects unsafe map embeds instead of storing arbitrary HTML", async () => {
		const { POST } = await import("@/app/api/portfolio/route");
		const response = await POST(
			new Request("http://localhost/api/portfolio", {
				method: "POST",
				body: JSON.stringify({
					title: "Map",
					preview_image_url: "https://cdn.example/image.png",
					map_embed_html: '<script>alert("xss")</script>',
				}),
			}) as never,
		);
		expect(response.status).toBe(400);
		expect(from).not.toHaveBeenCalled();
	});

	it("rejects non-HTTPS and unapproved map hosts", async () => {
		const { POST } = await import("@/app/api/portfolio/route");
		const response = await POST(
			new Request("http://localhost/api/portfolio", {
				method: "POST",
				body: JSON.stringify({
					title: "Map",
					preview_image_url: "https://cdn.example/image.png",
					map_embed_html: '<iframe src="https://evil.example/map"></iframe>',
				}),
			}) as never,
		);
		expect(response.status).toBe(400);
	});

	it("requires a title and preview image", async () => {
		const { POST } = await import("@/app/api/portfolio/route");
		const response = await POST(
			new Request("http://localhost/api/portfolio", {
				method: "POST",
				body: JSON.stringify({}),
			}) as never,
		);
		expect(response.status).toBe(400);
	});
});
