import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstileToken } from "@/lib/turnstile";

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	if (typeof body?.password !== "string" || body.password.length < 8) {
		return NextResponse.json({ error: "Invalid password" }, { status: 400 });
	}
	const valid = await verifyTurnstileToken(
		body?.token,
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
	);
	if (!valid) {
		return NextResponse.json({ error: "Bot verification failed" }, { status: 403 });
	}

	const { error } = await supabase.auth.updateUser({
		password: body.password,
	});
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 });
	}

	return NextResponse.json({ success: true });
}
