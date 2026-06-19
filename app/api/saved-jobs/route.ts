import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";

export async function GET() {
	try {
		const supabase = await createClient();
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!(await checkRateLimit(`saved-jobs:list:${user.id}`, 30, 60))) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}

		const { data, error } = await supabase
			.from("saved_jobs")
			.select(`*, jobs(*)`)
			.eq("user_id", user.id)
			.order("created_at", { ascending: false });

		if (error) {
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({ savedJobs: data });
	} catch (error) {
		console.error("saved-jobs GET error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	try {
		if (!validateOrigin(request)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const supabase = await createClient();
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!(await checkRateLimit(`saved-jobs:post:${user.id}`, 20, 60))) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}

		const body = await request.json();
		const { jobId } = body;

		if (!jobId) {
			return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
		}

		const { data, error } = await supabase
			.from("saved_jobs")
			.insert({ user_id: user.id, job_id: jobId })
			.select()
			.single();

		if (error) {
			if (error.code === "23505") {
				return NextResponse.json({ error: "Job already saved" }, { status: 409 });
			}
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({ savedJob: data }, { status: 201 });
	} catch (error) {
		console.error("saved-jobs POST error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
