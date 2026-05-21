import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

type NotifyEvent =
	| "contract_activated"
	| "job_completed"
	| "payment_released"
	| "application_received"
	| "verification_approved";

const requiredDetails: Record<NotifyEvent, string[]> = {
	contract_activated: ["jobTitle", "otherParty", "role", "contractId"],
	job_completed: ["jobTitle", "contractId"],
	payment_released: ["amount", "jobTitle", "contractId"],
	application_received: ["jobTitle", "applicantName", "jobId"],
	verification_approved: ["professionalName", "professionType"],
};

const isValidEmail = (value: string) =>
	/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const escapeHtml = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let payload: {
		event: NotifyEvent;
		recipientEmail: string;
		recipientName: string;
		details: Record<string, string>;
	} | null = null;

	try {
		payload = (await request.json()) as {
			event: NotifyEvent;
			recipientEmail: string;
			recipientName: string;
			details: Record<string, string>;
		};
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const { event, recipientEmail, recipientName, details } = payload ?? {};

	if (!event || !recipientEmail || !recipientName || !details) {
		return NextResponse.json({ error: "Missing fields" }, { status: 400 });
	}

	if (!isValidEmail(recipientEmail)) {
		return NextResponse.json({ error: "Invalid email" }, { status: 400 });
	}

	if (recipientName.trim().length < 2) {
		return NextResponse.json(
			{ error: "Invalid recipient name" },
			{ status: 400 },
		);
	}

	const subjects: Record<NotifyEvent, string> = {
		contract_activated: "Your contract is now active — SurveyConnectHub",
		job_completed: "Job marked complete — review and release payment",
		payment_released: "Payment has been released to your account",
		application_received: "New application received for your job",
		verification_approved: "Your account is verified — SurveyConnectHub",
	};

	if (!subjects[event]) {
		return NextResponse.json({ error: "Invalid event" }, { status: 400 });
	}

	const missingDetails = requiredDetails[event].filter(
		(key) => !String(details[key] ?? "").trim(),
	);
	if (missingDetails.length > 0) {
		return NextResponse.json(
			{ error: "Missing details", fields: missingDetails },
			{ status: 400 },
		);
	}

	if (event === "verification_approved") {
		// No contract or job ownership check required for verification emails.
	} else if (event === "application_received") {
		const jobId = details.jobId;
		const { data: job, error: jobError } = await supabase
			.from("jobs")
			.select("id, client_id, profiles!jobs_client_id_fkey(email)")
			.eq("id", jobId)
			.single();

		if (jobError || !job) {
			return NextResponse.json({ error: "Job not found" }, { status: 404 });
		}

		const jobClientEmail = job.profiles?.[0]?.email;
		if (jobClientEmail !== recipientEmail) {
			return NextResponse.json(
				{ error: "Recipient mismatch" },
				{ status: 403 },
			);
		}

		const { data: application } = await supabase
			.from("job_applications")
			.select("id")
			.eq("job_id", jobId)
			.eq("professional_id", user.id)
			.maybeSingle();

		if (!application) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
	} else {
		const contractId = details.contractId;
		const { data: contract, error: contractError } = await supabase
			.from("contracts")
			.select(
				`
        id,
        client_id,
        professional_id,
        client:profiles!contracts_client_id_fkey(email),
        professional:profiles!contracts_professional_id_fkey(email)
      `,
			)
			.eq("id", contractId)
			.single();

		if (contractError || !contract) {
			return NextResponse.json(
				{ error: "Contract not found" },
				{ status: 404 },
			);
		}

		if (
			contract.client_id !== user.id &&
			contract.professional_id !== user.id
		) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const allowedEmails = [
			contract.client?.[0]?.email,
			contract.professional?.[0]?.email,
		].filter(Boolean);

		if (!allowedEmails.includes(recipientEmail)) {
			return NextResponse.json(
				{ error: "Recipient mismatch" },
				{ status: 403 },
			);
		}
	}

	const safeRecipientName = escapeHtml(recipientName);
	const safeDetails = Object.fromEntries(
		Object.entries(details).map(([key, value]) => [
			key,
			escapeHtml(String(value ?? "")),
		]),
	);

	const bodies: Record<NotifyEvent, string> = {
		contract_activated: `Hi ${safeRecipientName},<br><br>Your contract for <strong>${safeDetails.jobTitle}</strong> is now active. You can communicate with your ${safeDetails.otherParty} via the platform chat.<br><br><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${safeDetails.role}/contracts">View Contract</a>`,
		job_completed: `Hi ${safeRecipientName},<br><br>The professional has marked <strong>${safeDetails.jobTitle}</strong> as complete. Please review the work and release payment if satisfied.<br><br><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/client/contracts">Review & Release Payment</a>`,
		payment_released: `Hi ${safeRecipientName},<br><br>Payment of <strong>$${safeDetails.amount}</strong> has been released for <strong>${safeDetails.jobTitle}</strong>. It will be transferred to your bank account.<br><br><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/professional/contracts">View Contracts</a>`,
		application_received: `Hi ${safeRecipientName},<br><br>You have a new application for <strong>${safeDetails.jobTitle}</strong> from ${safeDetails.applicantName}.<br><br><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/client/jobs/${safeDetails.jobId}/applications">Review Application</a>`,
		verification_approved: `Hi ${safeRecipientName}, congratulations! Your ${safeDetails.professionType} credentials have been verified. You can now apply to jobs on SurveyConnectHub. <a href="${process.env.NEXT_PUBLIC_APP_URL}/jobs">Browse Jobs</a>`,
	};

	try {
		await resend.emails.send({
			from: "SurveyConnectHub <notifications@resend.dev>",
			to: recipientEmail,
			subject: subjects[event],
			html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        ${bodies[event]}
        <hr style="margin: 24px 0; border-color: #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">SurveyConnectHub — Marketplace for Geospatial Professionals</p>
      </div>`,
		});

		return NextResponse.json({ success: true });
	} catch (error: any) {
		console.error("Failed to send notification email:", error);
		return NextResponse.json({ success: true });
	}
}
