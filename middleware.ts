import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getEnvOrThrow(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required env var: ${key}`);
	}
	return value;
}

export async function middleware(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	const supabaseUrl = getEnvOrThrow("NEXT_PUBLIC_SUPABASE_URL");
	const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? getEnvOrThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");

	const supabase = createServerClient(supabaseUrl, supabaseKey, {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value }) =>
					request.cookies.set(name, value),
				);
				supabaseResponse = NextResponse.next({
					request,
				});
				cookiesToSet.forEach(({ name, value, options }) =>
					supabaseResponse.cookies.set(name, value, options),
				);
			},
		},
	});

	let user = null;
	try {
		const {
			data: { user: authUser },
		} = await supabase.auth.getUser();
		user = authUser;
	} catch {
		// Supabase is down or unreachable — treat as unauthenticated
	}

	let profile: { role?: string | null; is_admin?: boolean | null } | null =
		null;
	let professionalProfile: { onboarding_completed?: boolean | null } | null =
		null;
	if (user) {
		const { data } = await supabase
			.from("profiles")
			.select("role, is_admin")
			.eq("id", user.id)
			.maybeSingle();

		profile = data ?? null;

		if (data?.role === "professional") {
			const { data: professionalData } = await supabase
				.from("professional_profiles")
				.select("onboarding_completed")
				.eq("id", user.id)
				.maybeSingle();

			professionalProfile = professionalData;
		}
	}

	if (
		!user &&
		!request.nextUrl.pathname.startsWith("/login") &&
		!request.nextUrl.pathname.startsWith("/signup") &&
		!request.nextUrl.pathname.startsWith("/api/paystack") &&
		request.nextUrl.pathname !== "/"
	) {
		const url = request.nextUrl.clone();
		url.pathname = "/login";
		return NextResponse.redirect(url);
	}

	if (
		user &&
		(request.nextUrl.pathname.startsWith("/login") ||
			request.nextUrl.pathname.startsWith("/signup"))
	) {
		if (profile?.role === "client") {
			const url = request.nextUrl.clone();
			url.pathname = "/dashboard/client";
			return NextResponse.redirect(url);
		}

		if (profile?.role === "professional") {
			const url = request.nextUrl.clone();
			url.pathname = "/dashboard/professional";
			return NextResponse.redirect(url);
		}
	}

	if (request.nextUrl.pathname.startsWith("/dashboard/client")) {
		if (profile?.role !== "client") {
			if (profile?.role === "professional") {
				const url = request.nextUrl.clone();
				url.pathname = "/dashboard/professional";
				return NextResponse.redirect(url);
			}
			const url = request.nextUrl.clone();
			url.pathname = "/login";
			return NextResponse.redirect(url);
		}
	}

	if (request.nextUrl.pathname.startsWith("/dashboard/professional")) {
		if (profile?.role !== "professional") {
			if (profile?.role === "client") {
				const url = request.nextUrl.clone();
				url.pathname = "/dashboard/client";
				return NextResponse.redirect(url);
			}
			const url = request.nextUrl.clone();
			url.pathname = "/login";
			return NextResponse.redirect(url);
		}
	}

	if (request.nextUrl.pathname.startsWith("/payments/")) {
		if (profile?.role !== "client") {
			const url = request.nextUrl.clone();
			url.pathname = "/dashboard/professional";
			return NextResponse.redirect(url);
		}
	}

	if (request.nextUrl.pathname.startsWith("/verification")) {
		if (profile?.role !== "professional") {
			const url = request.nextUrl.clone();
			url.pathname = "/dashboard/client";
			return NextResponse.redirect(url);
		}
	}

	if (request.nextUrl.pathname.startsWith("/onboarding/professional")) {
		if (profile?.role !== "professional") {
			const url = request.nextUrl.clone();
			url.pathname = "/dashboard/client";
			return NextResponse.redirect(url);
		}

		if (professionalProfile?.onboarding_completed) {
			const url = request.nextUrl.clone();
			url.pathname = "/dashboard/professional";
			return NextResponse.redirect(url);
		}
	}

	if (
		profile?.role === "professional" &&
		!professionalProfile?.onboarding_completed
	) {
		const path = request.nextUrl.pathname;
		const isAllowedBeforeOnboarding =
			path.startsWith("/onboarding/professional") ||
			path.startsWith("/dashboard/professional") ||
			path.startsWith("/api") ||
			path === "/" ||
			path.startsWith("/login") ||
			path.startsWith("/signup");

		if (!isAllowedBeforeOnboarding) {
			const url = request.nextUrl.clone();
			url.pathname = "/onboarding/professional";
			return NextResponse.redirect(url);
		}
	}

	if (request.nextUrl.pathname.startsWith("/admin")) {
		if (!profile?.is_admin) {
			const url = request.nextUrl.clone();
			url.pathname = "/dashboard/client";
			return NextResponse.redirect(url);
		}
	}

	return supabaseResponse;
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|woff2?)$).*)",
	],
};
