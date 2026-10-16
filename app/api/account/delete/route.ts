import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";

export const dynamic = "force-dynamic";

const GENERIC_ERROR = "Could not delete your account. Please try again.";
// Contracts in any of these states still involve the other party or money.
const BLOCKING_CONTRACT_STATUSES = ["pending", "active", "disputed"];
const BAN_FOREVER = "876000h";

function fail(message: string, status: number) {
	return NextResponse.json({ error: message }, { status });
}

// Soft-deletes the signed-in user's account.
//
// Nothing that other people or the money trail depend on is removed: the
// profile row stays (contracts, messages and reviews reference it). Instead
// personal data is blanked, the row is flagged is_deleted, the sign-in email
// is replaced so it can be used to sign up again, and the auth user is banned.
// Safe to call again after a partial failure: every step is idempotent.
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

	const allowed = await checkRateLimit(`delete-account:${user.id}`, 3, 3600);
	if (!allowed) {
		return fail("Too many requests", 429);
	}

	const body = await request.json().catch(() => null);
	const password = typeof body?.password === "string" ? body.password : "";
	if (!password || body?.confirm !== "DELETE") {
		return fail("Enter your password and type DELETE to confirm", 400);
	}

	// Re-check the password on the server with a throwaway client, so a stolen
	// session alone cannot delete the account.
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const publicKey =
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !publicKey) {
		console.error("delete-account: Supabase public env vars missing");
		return fail(GENERIC_ERROR, 500);
	}
	const verifier = createSupabaseClient(url, publicKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
	const { error: passwordError } = await verifier.auth.signInWithPassword({
		email: user.email,
		password,
	});
	if (passwordError) {
		return fail("Your password is incorrect", 403);
	}

	let service: ReturnType<typeof createServiceClient>;
	try {
		service = createServiceClient();
	} catch (error) {
		console.error("delete-account: service client unavailable:", error);
		return fail(GENERIC_ERROR, 500);
	}

	const { data: profile, error: profileError } = await service
		.from("profiles")
		.select("id, role, is_admin")
		.eq("id", user.id)
		.maybeSingle();

	if (profileError) {
		console.error("delete-account: profile lookup failed:", profileError);
		return fail(GENERIC_ERROR, 500);
	}
	if (!profile) {
		return fail("Account not found", 404);
	}
	if (profile.is_admin) {
		return fail("Administrator accounts cannot be deleted here", 409);
	}

	const { data: blocking, error: blockingError } = await service
		.from("contracts")
		.select("id")
		.or(`client_id.eq.${user.id},professional_id.eq.${user.id}`)
		.in("status", BLOCKING_CONTRACT_STATUSES)
		.limit(1);

	if (blockingError) {
		console.error("delete-account: contract lookup failed:", blockingError);
		return fail(GENERIC_ERROR, 500);
	}
	if (blocking && blocking.length > 0) {
		return fail(
			"You still have a contract in progress. Finish or cancel it before deleting your account.",
			409,
		);
	}

	const steps: { label: string; run: () => PromiseLike<{ error: unknown }> }[] =
		[
			{
				label: "close open jobs",
				run: () =>
					service
						.from("jobs")
						.update({ status: "cancelled" })
						.eq("client_id", user.id)
						.eq("status", "open"),
			},
			{
				label: "withdraw pending applications",
				run: () =>
					service
						.from("job_applications")
						.update({ status: "withdrawn" })
						.eq("professional_id", user.id)
						.eq("status", "pending"),
			},
			{
				label: "delete notifications",
				run: () => service.from("notifications").delete().eq("user_id", user.id),
			},
			{
				label: "delete saved jobs",
				run: () => service.from("saved_jobs").delete().eq("user_id", user.id),
			},
			{
				label: "delete portfolio",
				run: () =>
					service.from("portfolio_items").delete().eq("professional_id", user.id),
			},
		];

	if (profile.role === "professional") {
		steps.push({
			label: "clear professional details",
			run: () =>
				service
					.from("professional_profiles")
					.update({
						license_number: null,
						license_url: null,
						id_document_url: null,
						verification_notes: null,
						portfolio_description: null,
					})
					.eq("id", user.id),
		});
	}

	for (const step of steps) {
		const { error } = await step.run();
		if (error) {
			console.error(`delete-account: failed to ${step.label}:`, error);
			return fail(GENERIC_ERROR, 500);
		}
	}

	const placeholderEmail = `deleted+${user.id}@deleted.invalid`;

	// The flag goes on last among the database steps, so a failure above leaves
	// the account usable and the user can simply try again.
	const { error: flagError } = await service
		.from("profiles")
		.update({
			full_name: "Deleted user",
			username: null,
			email: placeholderEmail,
			phone: null,
			country: null,
			city: null,
			bio: null,
			avatar_url: null,
			bank_name: null,
			bank_account_number: null,
			bank_account_name: null,
			paystack_recipient_code: null,
			notification_email: false,
			notification_messages: false,
			notification_marketing: false,
			is_active: false,
			is_deleted: true,
			deleted_at: new Date().toISOString(),
		})
		.eq("id", user.id);

	if (flagError) {
		console.error("delete-account: could not flag profile:", flagError);
		return fail(GENERIC_ERROR, 500);
	}

	// Free the original email for a future sign-up and lock sign-in. The auth
	// user is kept (not deleted) so the profile and its history stay valid.
	const { error: authError } = await service.auth.admin.updateUserById(user.id, {
		email: placeholderEmail,
		email_confirm: true,
		ban_duration: BAN_FOREVER,
		user_metadata: {},
	});
	if (authError) {
		// The profile is already flagged, and the middleware signs flagged
		// users out, so the account is unusable. Log it for manual cleanup.
		console.error("delete-account: auth user cleanup failed:", authError);
	}

	return NextResponse.json({ success: true });
}
