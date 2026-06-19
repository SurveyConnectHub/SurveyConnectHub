import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ jobId: string }> },
) {
	try {
		const { jobId } = await params;
		if (!jobId) {
			return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
		}

		const supabase = await createClient();
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!(await checkRateLimit(`saved-jobs:check:${user.id}`, 30, 60))) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}

		const { data, error } = await supabase
			.from("saved_jobs")
			.select("id")
			.eq("user_id", user.id)
			.eq("job_id", jobId)
			.maybeSingle();

		if (error) {
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({ isSaved: !!data, savedJobId: data?.id ?? null });
	} catch (error) {
		console.error("saved-jobs check GET error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ jobId: string }> },
) {
	try {
		if (!validateOrigin(_request)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { jobId } = await params;
		if (!jobId) {
			return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
		}

		const supabase = await createClient();
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!(await checkRateLimit(`saved-jobs:delete:${user.id}`, 20, 60))) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}

		const { error } = await supabase
			.from("saved_jobs")
			.delete()
			.eq("user_id", user.id)
			.eq("job_id", jobId);

		if (error) {
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("saved-jobs DELETE error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
