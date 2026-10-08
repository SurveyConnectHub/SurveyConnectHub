import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("resend", () => ({
	Resend: class {
		emails = { send };
	},
}));

describe("admin alert API", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubEnv("ADMIN_ALERT_SECRET", "alert-secret");
		vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
		vi.stubEnv("RESEND_API_KEY", "resend-test-key");
		send.mockResolvedValue({ data: { id: "email-1" }, error: null });
	});

	it("rejects missing or invalid alert secrets", async () => {
		const { POST } = await import("@/app/api/admin/alerts/route");
		const missing = await POST(
			new Request("http://localhost/api/admin/alerts", { method: "POST" }) as never,
		);
		const invalid = await POST(
			new Request("http://localhost/api/admin/alerts", {
				method: "POST",
				headers: { "x-admin-alert-secret": "wrong" },
			}) as never,
		);
		expect(missing.status).toBe(403);
		expect(invalid.status).toBe(403);
	});

	it("escapes alert content before sending email", async () => {
		const { POST } = await import("@/app/api/admin/alerts/route");
		const response = await POST(
			new Request("http://localhost/api/admin/alerts", {
				method: "POST",
				headers: {
					"x-admin-alert-secret": "alert-secret",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					type: "<script>alert(1)</script>",
					message: "<img src=x onerror=alert(1)>",
				}),
			}) as never,
		);
		expect(response.status).toBe(200);
		const email = send.mock.calls[0][0];
		expect(email.html).not.toContain("<script>");
		expect(email.html).toContain("&lt;script&gt;");
	});
});
