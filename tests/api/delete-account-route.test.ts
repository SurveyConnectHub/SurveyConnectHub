import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const checkRateLimit = vi.fn();
const validateOrigin = vi.fn();
const createServiceClient = vi.fn();
const signInWithPassword = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({ auth: { getUser } })),
	createServiceClient,
}));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit }));
vi.mock("@/lib/csrf", () => ({ validateOrigin }));
vi.mock("@supabase/supabase-js", () => ({
	createClient: vi.fn(() => ({ auth: { signInWithPassword } })),
}));

type Call = {
	table: string;
	op: "select" | "update" | "delete";
	payload?: Record<string, unknown>;
	filters: unknown[][];
};

type FakeOptions = {
	profile?: { id: string; role: string; is_admin: boolean } | null;
	hasBlockingContract?: boolean;
	failTable?: string;
	authError?: { message: string } | null;
};

// Minimal stand-in for the Supabase service client that records every call.
function makeService(options: FakeOptions = {}) {
	const calls: Call[] = [];
	const updateUserById = vi.fn(async () => ({
		error: options.authError ?? null,
	}));

	const client = {
		auth: { admin: { updateUserById } },
		from(table: string) {
			const state: Call = { table, op: "select", filters: [] };
			const builder: any = {
				select: () => builder,
				update: (payload: Record<string, unknown>) => {
					state.op = "update";
					state.payload = payload;
					return builder;
				},
				delete: () => {
					state.op = "delete";
					return builder;
				},
				eq: (...args: unknown[]) => {
					state.filters.push(["eq", ...args]);
					return builder;
				},
				or: (...args: unknown[]) => {
					state.filters.push(["or", ...args]);
					return builder;
				},
				in: (...args: unknown[]) => {
					state.filters.push(["in", ...args]);
					return builder;
				},
				limit: () => builder,
				maybeSingle: () => {
					calls.push(state);
					return Promise.resolve({
						data:
							options.profile === undefined
								? { id: "user-1", role: "client", is_admin: false }
								: options.profile,
						error: null,
					});
				},
				then: (resolve: (value: unknown) => unknown, reject: (e: unknown) => unknown) => {
					calls.push(state);
					let result: unknown;
					if (table === "contracts") {
						result = {
							data: options.hasBlockingContract ? [{ id: "contract-1" }] : [],
							error: null,
						};
					} else if (options.failTable === table) {
						result = { error: { message: "boom: internal detail" } };
					} else {
						result = { error: null };
					}
					return Promise.resolve(result).then(resolve, reject);
				},
			};
			return builder;
		},
	};

	const writes = () => calls.filter((call) => call.op !== "select");
	return { client, calls, writes, updateUserById };
}

function deleteRequest(body: unknown) {
	return new Request("http://localhost/api/account/delete", {
		method: "POST",
		body: typeof body === "string" ? body : JSON.stringify(body),
	}) as never;
}

const validBody = { password: "correct-horse", confirm: "DELETE" };

async function callRoute(body: unknown) {
	const { POST } = await import("@/app/api/account/delete/route");
	return POST(deleteRequest(body));
}

describe("delete-account route", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.spyOn(console, "error").mockImplementation(() => {});
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
		validateOrigin.mockReturnValue(true);
		checkRateLimit.mockResolvedValue(true);
		signInWithPassword.mockResolvedValue({ error: null });
		getUser.mockResolvedValue({
			data: { user: { id: "user-1", email: "user@example.com" } },
		});
	});

	it("rejects requests from an untrusted origin", async () => {
		validateOrigin.mockReturnValue(false);

		const response = await callRoute(validBody);

		expect(response.status).toBe(403);
		expect(createServiceClient).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated requests", async () => {
		getUser.mockResolvedValue({ data: { user: null } });

		const response = await callRoute(validBody);

		expect(response.status).toBe(401);
		expect(createServiceClient).not.toHaveBeenCalled();
	});

	it("rate limits repeated attempts per user", async () => {
		checkRateLimit.mockResolvedValue(false);

		const response = await callRoute(validBody);

		expect(response.status).toBe(429);
		expect(checkRateLimit).toHaveBeenCalledWith("delete-account:user-1", 3, 3600);
		expect(createServiceClient).not.toHaveBeenCalled();
	});

	it("requires the password and the word DELETE", async () => {
		expect((await callRoute("{invalid")).status).toBe(400);
		expect((await callRoute({ password: "x" })).status).toBe(400);
		expect((await callRoute({ confirm: "DELETE" })).status).toBe(400);
		expect((await callRoute({ password: "x", confirm: "delete" })).status).toBe(
			400,
		);
		expect(signInWithPassword).not.toHaveBeenCalled();
		expect(createServiceClient).not.toHaveBeenCalled();
	});

	it("rejects a wrong password and changes nothing", async () => {
		signInWithPassword.mockResolvedValue({ error: { message: "Invalid login" } });

		const response = await callRoute(validBody);

		expect(response.status).toBe(403);
		expect(signInWithPassword).toHaveBeenCalledWith({
			email: "user@example.com",
			password: "correct-horse",
		});
		expect(createServiceClient).not.toHaveBeenCalled();
	});

	it("refuses to delete an administrator", async () => {
		const { client, writes, updateUserById } = makeService({
			profile: { id: "user-1", role: "client", is_admin: true },
		});
		createServiceClient.mockReturnValue(client);

		const response = await callRoute(validBody);

		expect(response.status).toBe(409);
		expect(writes()).toHaveLength(0);
		expect(updateUserById).not.toHaveBeenCalled();
	});

	it("blocks deletion while a contract is in progress", async () => {
		const { client, calls, writes, updateUserById } = makeService({
			hasBlockingContract: true,
		});
		createServiceClient.mockReturnValue(client);

		const response = await callRoute(validBody);

		expect(response.status).toBe(409);
		expect((await response.json()).error).toMatch(/contract in progress/i);
		expect(writes()).toHaveLength(0);
		expect(updateUserById).not.toHaveBeenCalled();

		const contractLookup = calls.find((call) => call.table === "contracts");
		expect(contractLookup?.filters).toContainEqual([
			"in",
			"status",
			["pending", "active", "disputed"],
		]);
	});

	it("anonymises a client, closes their jobs and frees the email", async () => {
		const { client, writes, updateUserById } = makeService();
		createServiceClient.mockReturnValue(client);

		const response = await callRoute(validBody);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });

		const jobs = writes().find((call) => call.table === "jobs");
		expect(jobs?.payload).toEqual({ status: "cancelled" });
		expect(jobs?.filters).toContainEqual(["eq", "client_id", "user-1"]);
		expect(jobs?.filters).toContainEqual(["eq", "status", "open"]);

		const profile = writes().find((call) => call.table === "profiles");
		expect(profile?.payload).toMatchObject({
			full_name: "Deleted user",
			username: null,
			email: "deleted+user-1@deleted.invalid",
			phone: null,
			bio: null,
			avatar_url: null,
			bank_name: null,
			bank_account_number: null,
			bank_account_name: null,
			paystack_recipient_code: null,
			is_active: false,
			is_deleted: true,
		});
		expect(typeof profile?.payload?.deleted_at).toBe("string");
		expect(profile?.filters).toContainEqual(["eq", "id", "user-1"]);

		// The profile row is never deleted: contracts and messages point at it.
		expect(
			writes().some((call) => call.table === "profiles" && call.op === "delete"),
		).toBe(false);
		expect(writes().some((call) => call.table === "professional_profiles")).toBe(
			false,
		);

		expect(updateUserById).toHaveBeenCalledWith("user-1", {
			email: "deleted+user-1@deleted.invalid",
			email_confirm: true,
			ban_duration: "876000h",
			user_metadata: {},
		});
	});

	it("also clears a professional's documents and portfolio", async () => {
		const { client, writes } = makeService({
			profile: { id: "user-1", role: "professional", is_admin: false },
		});
		createServiceClient.mockReturnValue(client);

		const response = await callRoute(validBody);

		expect(response.status).toBe(200);
		const details = writes().find((call) => call.table === "professional_profiles");
		expect(details?.payload).toEqual({
			license_number: null,
			license_url: null,
			id_document_url: null,
			verification_notes: null,
			portfolio_description: null,
		});
		expect(
			writes().some((call) => call.table === "portfolio_items" && call.op === "delete"),
		).toBe(true);
		const applications = writes().find((call) => call.table === "job_applications");
		expect(applications?.payload).toEqual({ status: "withdrawn" });
	});

	it("flags the profile last, after every cleanup step", async () => {
		const { client, writes } = makeService();
		createServiceClient.mockReturnValue(client);

		await callRoute(validBody);

		const tables = writes().map((call) => call.table);
		expect(tables[tables.length - 1]).toBe("profiles");
	});

	it("leaves the account usable when a cleanup step fails", async () => {
		const { client, writes, updateUserById } = makeService({
			failTable: "notifications",
		});
		createServiceClient.mockReturnValue(client);

		const response = await callRoute(validBody);
		const payload = await response.json();

		expect(response.status).toBe(500);
		expect(JSON.stringify(payload)).not.toContain("boom");
		expect(writes().some((call) => call.table === "profiles")).toBe(false);
		expect(updateUserById).not.toHaveBeenCalled();
	});

	it("still succeeds if only the auth cleanup fails, because the profile is flagged", async () => {
		const { client } = makeService({ authError: { message: "auth down" } });
		createServiceClient.mockReturnValue(client);

		const response = await callRoute(validBody);

		expect(response.status).toBe(200);
		expect(console.error).toHaveBeenCalled();
	});

	it("fails with a generic error when the service-role key is missing", async () => {
		createServiceClient.mockImplementation(() => {
			throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
		});

		const response = await callRoute(validBody);
		const payload = await response.json();

		expect(response.status).toBe(500);
		expect(JSON.stringify(payload)).not.toContain("SERVICE_ROLE");
	});
});
