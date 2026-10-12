import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const checkRateLimit = vi.fn();
const validateOrigin = vi.fn();
const createServiceClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({ auth: { getUser } })),
	createServiceClient,
}));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit }));
vi.mock("@/lib/csrf", () => ({ validateOrigin }));

type DbError = { code?: string; message: string } | null;

type FakeOptions = {
	existingProfile?: { id: string; role: string } | null;
	profileInsertError?: DbError;
	roleInsertError?: DbError;
};

// Minimal stand-in for the Supabase service client that records every write.
function makeServiceClient(options: FakeOptions = {}) {
	const inserts: { table: string; row: Record<string, unknown> }[] = [];
	const deletes: { table: string; id: unknown }[] = [];

	const client = {
		from(table: string) {
			return {
				select: () => ({
					eq: () => ({
						maybeSingle: async () => ({
							data: options.existingProfile ?? null,
							error: null,
						}),
					}),
				}),
				insert: async (row: Record<string, unknown>) => {
					inserts.push({ table, row });
					const error =
						table === "profiles"
							? (options.profileInsertError ?? null)
							: (options.roleInsertError ?? null);
					return { error };
				},
				delete: () => ({
					eq: async (_column: string, id: unknown) => {
						deletes.push({ table, id });
						return { error: null };
					},
				}),
			};
		},
	};

	return { client, inserts, deletes };
}

function signupRequest(body: unknown) {
	return new Request("http://localhost/api/auth/complete-signup", {
		method: "POST",
		body: typeof body === "string" ? body : JSON.stringify(body),
	}) as never;
}

const clientBody = {
	role: "client",
	fullName: "Ada Client",
	username: "ada_client",
	phone: "+2348000000000",
	country: "Nigeria",
	primaryDisciplines: [],
};

const professionalBody = {
	role: "professional",
	fullName: "Pat Professional",
	username: "ignored_for_professionals",
	phone: "+255700000000",
	country: "Tanzania",
	primaryDisciplines: ["Topographic Survey", "  GIS Mapping  ", 42, ""],
};

async function callRoute(body: unknown) {
	const { POST } = await import("@/app/api/auth/complete-signup/route");
	return POST(signupRequest(body));
}

describe("complete-signup route", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.spyOn(console, "error").mockImplementation(() => {});
		validateOrigin.mockReturnValue(true);
		checkRateLimit.mockResolvedValue(true);
		getUser.mockResolvedValue({
			data: { user: { id: "user-1", email: "session@example.com" } },
		});
	});

	it("rejects requests from an untrusted origin", async () => {
		validateOrigin.mockReturnValue(false);

		const response = await callRoute(clientBody);

		expect(response.status).toBe(403);
		expect(createServiceClient).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated profile creation", async () => {
		getUser.mockResolvedValue({ data: { user: null } });

		const response = await callRoute(clientBody);

		expect(response.status).toBe(401);
		expect(createServiceClient).not.toHaveBeenCalled();
	});

	it("rate limits repeated calls per user", async () => {
		checkRateLimit.mockResolvedValue(false);

		const response = await callRoute(clientBody);

		expect(response.status).toBe(429);
		expect(checkRateLimit).toHaveBeenCalledWith("complete-signup:user-1", 5, 60);
		expect(createServiceClient).not.toHaveBeenCalled();
	});

	it("rejects malformed and invalid payloads", async () => {
		expect((await callRoute("{invalid")).status).toBe(400);
		expect((await callRoute({ ...clientBody, role: "admin" })).status).toBe(400);
		expect((await callRoute({ ...clientBody, fullName: "   " })).status).toBe(
			400,
		);
		expect((await callRoute({ ...clientBody, username: "no spaces!" })).status).toBe(
			400,
		);
		expect((await callRoute({ ...clientBody, username: "ab" })).status).toBe(400);
		expect(createServiceClient).not.toHaveBeenCalled();
	});

	it("creates a client profile using the session identity, not the body", async () => {
		const { client, inserts } = makeServiceClient();
		createServiceClient.mockReturnValue(client);

		const response = await callRoute({
			...clientBody,
			id: "attacker-id",
			email: "attacker@example.com",
			is_admin: true,
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true, role: "client" });
		expect(inserts).toEqual([
			{
				table: "profiles",
				row: {
					id: "user-1",
					role: "client",
					full_name: "Ada Client",
					username: "ada_client",
					email: "session@example.com",
					phone: "+2348000000000",
					country: "Nigeria",
				},
			},
			{ table: "client_profiles", row: { id: "user-1" } },
		]);
	});

	it("creates a professional profile with cleaned disciplines and no username", async () => {
		const { client, inserts } = makeServiceClient();
		createServiceClient.mockReturnValue(client);

		const response = await callRoute(professionalBody);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			role: "professional",
		});
		expect(inserts[0]).toMatchObject({
			table: "profiles",
			row: { id: "user-1", role: "professional", username: null },
		});
		expect(inserts[1]).toEqual({
			table: "professional_profiles",
			row: {
				id: "user-1",
				profession_type: "other",
				years_experience: 0,
				license_number: null,
				verification_status: "unverified",
				primary_disciplines: ["Topographic Survey", "GIS Mapping"],
			},
		});
	});

	it("returns a clear error for a duplicate username and writes nothing else", async () => {
		const { client, inserts } = makeServiceClient({
			profileInsertError: { code: "23505", message: "duplicate key" },
		});
		createServiceClient.mockReturnValue(client);

		const response = await callRoute(clientBody);

		expect(response.status).toBe(409);
		expect((await response.json()).error).toMatch(/username is already taken/i);
		expect(inserts.map((entry) => entry.table)).toEqual(["profiles"]);
	});

	it("is idempotent when the profile already exists with the same role", async () => {
		const { client, inserts } = makeServiceClient({
			existingProfile: { id: "user-1", role: "client" },
			roleInsertError: { code: "23505", message: "duplicate key" },
		});
		createServiceClient.mockReturnValue(client);

		const first = await callRoute(clientBody);
		const second = await callRoute(clientBody);

		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		// No new profiles row is ever written on a retry.
		expect(inserts.filter((entry) => entry.table === "profiles")).toHaveLength(0);
	});

	it("completes a half-created account that has a profile but no role row", async () => {
		const { client, inserts, deletes } = makeServiceClient({
			existingProfile: { id: "user-1", role: "professional" },
		});
		createServiceClient.mockReturnValue(client);

		const response = await callRoute(professionalBody);

		expect(response.status).toBe(200);
		expect(inserts.map((entry) => entry.table)).toEqual([
			"professional_profiles",
		]);
		expect(deletes).toHaveLength(0);
	});

	it("never changes the role of an existing profile", async () => {
		const { client, inserts } = makeServiceClient({
			existingProfile: { id: "user-1", role: "client" },
		});
		createServiceClient.mockReturnValue(client);

		const response = await callRoute(professionalBody);

		expect(response.status).toBe(409);
		expect(inserts).toHaveLength(0);
	});

	it("rolls back the new profile row if the role row cannot be created", async () => {
		const { client, deletes } = makeServiceClient({
			roleInsertError: { code: "XX000", message: "boom: internal detail" },
		});
		createServiceClient.mockReturnValue(client);

		const response = await callRoute(clientBody);
		const payload = await response.json();

		expect(response.status).toBe(500);
		expect(JSON.stringify(payload)).not.toContain("boom");
		expect(deletes).toEqual([{ table: "profiles", id: "user-1" }]);
	});

	it("fails with a generic error when the service-role key is not configured", async () => {
		createServiceClient.mockImplementation(() => {
			throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
		});

		const response = await callRoute(clientBody);
		const payload = await response.json();

		expect(response.status).toBe(500);
		expect(JSON.stringify(payload)).not.toContain("SERVICE_ROLE");
	});
});
