import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createServiceClient: vi.fn(() => ({
		from: vi.fn(() => ({ insert })),
	})),
}));

describe("Paystack webhook security", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubEnv("PAYSTACK_SECRET_KEY", "paystack-test-secret");
	});

	it("rejects a webhook with no signature", async () => {
		const { POST } = await import("@/app/api/webhooks/paystack/route");
		const response = await POST(
			new Request("http://localhost/api/webhooks/paystack", {
				method: "POST",
				body: JSON.stringify({ event: "charge.success" }),
			}) as never,
		);

		expect(response.status).toBe(400);
		expect(insert).not.toHaveBeenCalled();
	});

	it("rejects a forged signature before recording an event", async () => {
		const { POST } = await import("@/app/api/webhooks/paystack/route");
		const response = await POST(
			new Request("http://localhost/api/webhooks/paystack", {
				method: "POST",
				headers: { "x-paystack-signature": "00".repeat(64) },
				body: JSON.stringify({ event: "charge.success" }),
			}) as never,
		);

		expect(response.status).toBe(400);
		expect(insert).not.toHaveBeenCalled();
	});

	it("does not process a duplicate event key", async () => {
		insert.mockResolvedValue({ error: { code: "23505" } });
		const body = JSON.stringify({
			event: "charge.success",
			data: { reference: "duplicate-reference" },
		});
		const signature = crypto
			.createHmac("sha512", "paystack-test-secret")
			.update(body)
			.digest("hex");
		const { POST } = await import("@/app/api/webhooks/paystack/route");

		const response = await POST(
			new Request("http://localhost/api/webhooks/paystack", {
				method: "POST",
				headers: { "x-paystack-signature": signature },
				body,
			}) as never,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ received: true, duplicate: true });
		expect(insert).toHaveBeenCalledWith({
			event_key: "charge.success:duplicate-reference",
			event_name: "charge.success",
			reference: "duplicate-reference",
		});
	});
});
