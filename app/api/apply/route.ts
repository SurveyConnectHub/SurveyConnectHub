import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";

export async function POST(request: NextRequest) {
	if (!validateOrigin(request)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("role, full_name, email")
		.eq("id", user.id)
		.single();

	if (profile?.role !== "professional") {
		return NextResponse.json(
			{ error: "Only professionals can apply" },
			{ status: 403 },
		);
	}

	if (!(await checkRateLimit(`apply:${user.id}`, 10, 60))) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const body = await request.json().catch(() => ({}));
	const {
		jobId,
		coverLetter,
		proposedRate,
		estimatedDelivery,
		relevantExperience,
		questionsForClient,
		portfolioItemId,
		portfolioAttachmentUrl,
	} = body;

	if (
		!jobId ||
		!coverLetter?.trim() ||
		!proposedRate ||
		!estimatedDelivery ||
		!relevantExperience?.trim()
	) {
		return NextResponse.json(
			{ error: "Missing required fields" },
			{ status: 400 },
		);
	}

	const parsedRate = Number.parseFloat(proposedRate);
	if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
		return NextResponse.json({ error: "Invalid rate" }, { status: 400 });
	}

	const { data: job } = await supabase
		.from("jobs")
		.select("id, status, client_id, title")
		.eq("id", jobId)
		.eq("status", "open")
		.single();

	if (!job) {
		return NextResponse.json(
			{ error: "Job not found or closed" },
			{ status: 404 },
		);
	}

	const { data: existing } = await supabase
		.from("job_applications")
		.select("id")
		.eq("job_id", jobId)
		.eq("professional_id", user.id)
		.single();

	if (existing) {
		return NextResponse.json({ error: "Already applied" }, { status: 409 });
	}

	const { error } = await supabase.from("job_applications").insert({
		job_id: jobId,
		professional_id: user.id,
		cover_letter: coverLetter.trim(),
		proposed_rate: parsedRate,
		estimated_delivery: estimatedDelivery,
		relevant_experience: relevantExperience.trim(),
		questions_for_client: questionsForClient?.trim() || null,
		portfolio_item_id: portfolioItemId || null,
		portfolio_attachment_url: portfolioAttachmentUrl || null,
		status: "pending",
	});

	if (error) {
		if (error.code === "23505") {
			return NextResponse.json({ error: "Already applied" }, { status: 409 });
		}

		console.error("Job application insert failed:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}

	const { data: clientProfile } = await supabase
		.from("profiles")
		.select("email, full_name")
		.eq("id", job.client_id)
		.single();

	if (clientProfile?.email && clientProfile?.full_name) {
		const notifyUrl = new URL("/api/notify", request.url);
		await fetch(notifyUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				event: "application_received",
				recipientEmail: clientProfile.email,
				recipientName: clientProfile.full_name,
				details: {
					jobTitle: job.title ?? "your job",
					applicantName: profile?.full_name ?? "a professional",
					jobId: job.id,
				},
			}),
		}).catch(() => {});
	}

	try {
		const serviceClient = createServiceClient();
		const { error: notificationError } = await serviceClient
			.from("notifications")
			.insert({
				user_id: job.client_id,
				title: "New application received",
				message: `${profile?.full_name ?? "A professional"} applied to "${job.title ?? "your job"}"`,
				type: "application",
				link: `/dashboard/client/jobs/${job.id}/applications`,
				is_read: false,
			});

		if (notificationError) {
			console.error(
				"Failed to insert application notification:",
				notificationError,
			);
		}
	} catch (error) {
		console.error("Failed to create notification client:", error);
	}

	return NextResponse.json({ success: true });
}
