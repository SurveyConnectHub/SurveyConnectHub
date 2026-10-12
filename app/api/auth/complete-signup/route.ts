import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";

export const dynamic = "force-dynamic";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const MAX_DISCIPLINES = 30;
const GENERIC_ERROR = "Could not create your profile. Please try again.";

function cleanString(value: unknown, maxLength: number): string {
	return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function fail(message: string, status: number) {
	return NextResponse.json({ error: message }, { status });
}

// Creates the profile rows (profiles + client_profiles / professional_profiles)
// for the account that is currently signed in.
//
// This must run on the server: it needs SUPABASE_SERVICE_ROLE_KEY, which must
// never reach the browser. The user id and email always come from the verified
// session, never from the request body. Safe to call more than once: a retry
// for an account that already has its profile succeeds without creating
// duplicates, and a half-created account (profile row but no role row) is
// completed.
export async function POST(request: NextRequest) {
	if (!validateOrigin(request)) {
		return fail("Forbidden", 403);
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user || !user.email) {
		return fail("Unauthorized", 401);
	}

	const allowed = await checkRateLimit(`complete-signup:${user.id}`, 5, 60);
	if (!allowed) {
		return fail("Too many requests", 429);
	}

	const body = await request.json().catch(() => null);

	const role = body?.role;
	if (role !== "client" && role !== "professional") {
		return fail("Invalid role", 400);
	}

	const fullName = cleanString(body?.fullName, 200);
	if (!fullName) {
		return fail("Full name is required", 400);
	}

	const username =
		typeof body?.username === "string" ? body.username.trim() : "";
	if (role === "client" && !USERNAME_PATTERN.test(username)) {
		return fail(
			"Username must be 3-20 characters using only letters, numbers, and underscores",
			400,
		);
	}

	const phone = cleanString(body?.phone, 30);
	const country = cleanString(body?.country, 100);
	const primaryDisciplines: string[] = Array.isArray(body?.primaryDisciplines)
		? body.primaryDisciplines
				.filter((item: unknown): item is string => typeof item === "string")
				.map((item: string) => item.trim().slice(0, 100))
				.filter(Boolean)
				.slice(0, MAX_DISCIPLINES)
		: [];

	let serviceClient: ReturnType<typeof createServiceClient>;
	try {
		serviceClient = createServiceClient();
	} catch (error) {
		// Server misconfiguration (e.g. missing service-role key): log the
		// detail, show the user nothing internal.
		console.error("complete-signup: service client unavailable:", error);
		return fail(GENERIC_ERROR, 500);
	}

	const { data: existingProfile, error: existingError } = await serviceClient
		.from("profiles")
		.select("id, role")
		.eq("id", user.id)
		.maybeSingle();

	if (existingError) {
		console.error("complete-signup: profile lookup failed:", existingError);
		return fail(GENERIC_ERROR, 500);
	}

	// The role is fixed once it is set; never let this route change it.
	if (existingProfile && existingProfile.role !== role) {
		return fail("This account already has a different role", 409);
	}

	const createdProfile = !existingProfile;

	if (createdProfile) {
		const { error: profileError } = await serviceClient.from("profiles").insert({
			id: user.id,
			role,
			full_name: fullName,
			username: role === "client" ? username : null,
			email: user.email,
			phone,
			country,
		});

		if (profileError) {
			if (profileError.code === "23505" && role === "client") {
				return fail(
					"That username is already taken. Please choose another one.",
					409,
				);
			}
			// A duplicate on the id for a professional means a concurrent request
			// already created the row; carry on and finish the role row below.
			if (profileError.code !== "23505") {
				console.error("complete-signup: profile insert failed:", profileError);
				return fail(GENERIC_ERROR, 500);
			}
		}
	}

	const roleInsert =
		role === "client"
			? await serviceClient.from("client_profiles").insert({ id: user.id })
			: await serviceClient.from("professional_profiles").insert({
					id: user.id,
					profession_type: "other",
					years_experience: 0,
					license_number: null,
					verification_status: "unverified",
					primary_disciplines: primaryDisciplines,
				});

	// 23505 = the role row already exists (a retry): that is success.
	if (roleInsert.error && roleInsert.error.code !== "23505") {
		console.error(
			"complete-signup: role profile insert failed:",
			roleInsert.error,
		);
		if (createdProfile) {
			// Roll back the profile row created by this request so the account
			// is not left half-created and the user can retry.
			const { error: rollbackError } = await serviceClient
				.from("profiles")
				.delete()
				.eq("id", user.id);
			if (rollbackError) {
				console.error("complete-signup: rollback failed:", rollbackError);
			}
		}
		return fail(GENERIC_ERROR, 500);
	}

	return NextResponse.json({ success: true, role });
}
