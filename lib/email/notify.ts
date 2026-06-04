import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";

export type NotifyEvent =
	| "contract_activated"
	| "job_completed"
	| "payment_released"
	| "application_received"
	| "verification_approved";

export type NotifyPayload = {
	event: NotifyEvent;
	recipientEmail: string;
	recipientName: string;
	details: Record<string, string>;
};

type NotifyError = Error & { status?: number; fields?: string[] };

const resend = new Resend(process.env.RESEND_API_KEY);

const requiredDetails: Record<NotifyEvent, string[]> = {
	contract_activated: ["jobTitle", "otherParty", "role", "contractId"],
	job_completed: ["jobTitle", "contractId"],
	payment_released: ["amount", "jobTitle", "contractId"],
	application_received: ["jobTitle", "applicantName", "jobId"],
	verification_approved: ["professionalName", "professionType"],
};

const subjects: Record<NotifyEvent, string> = {
	contract_activated: "Your contract is now active — SurveyConnectHub",
	job_completed: "Job marked complete — review and release payment",
	payment_released: "Payment has been released to your account",
	application_received: "New application received for your job",
	verification_approved: "Your account is verified — SurveyConnectHub",
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

const throwError = (
	message: string,
	status: number,
	fields?: string[],
): never => {
	const error = new Error(message) as NotifyError;
	error.status = status;
	if (fields) error.fields = fields;
	throw error;
};

function assertPayload(
	payload: NotifyPayload | null,
): asserts payload is NotifyPayload {
	if (!payload) {
		throwError("Missing fields", 400);
	}
}

export async function sendNotificationEmail(options: {
	supabase: SupabaseClient;
	userId: string;
	payload: NotifyPayload | null;
}): Promise<void> {
	const { supabase, userId, payload } = options;
	const serviceClient = createServiceClient();

	assertPayload(payload);

	const { event, recipientEmail, recipientName, details } = payload;

	if (!event || !recipientEmail || !recipientName || !details) {
		throwError("Missing fields", 400);
	}

	if (!subjects[event]) {
		throwError("Invalid event", 400);
	}

	if (!isValidEmail(recipientEmail)) {
		throwError("Invalid email", 400);
	}

	if (recipientName.trim().length < 2) {
		throwError("Invalid recipient name", 400);
	}

	const missingDetails = requiredDetails[event].filter(
		(key) => !String(details[key] ?? "").trim(),
	);
	if (missingDetails.length > 0) {
		throwError("Missing details", 400, missingDetails);
	}

	if (event === "verification_approved") {
		// No contract or job ownership check required for verification emails.
	} else if (event === "application_received") {
		const jobId = details.jobId;
		const { data: job, error: jobError } = await serviceClient
			.from("jobs")
			.select("id, client_id, profiles!jobs_client_id_fkey(email)")
			.eq("id", jobId)
			.single();

		if (jobError || !job) {
			throwError("Job not found", 404);
		}
		const jobData = job as NonNullable<typeof job>;
		const jobClientEmail = jobData.profiles?.[0]?.email;
		if (jobClientEmail !== recipientEmail) {
			throwError("Recipient mismatch", 403);
		}

		const { data: application } = await serviceClient
			.from("job_applications")
			.select("id")
			.eq("job_id", jobId)
			.eq("professional_id", userId)
			.maybeSingle();

		if (!application) {
			throwError("Forbidden", 403);
		}
	} else {
		const contractId = details.contractId;
		const { data: contract, error: contractError } = await serviceClient
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
			throwError("Contract not found", 404);
		}
		const contractData = contract as NonNullable<typeof contract>;
		if (
			contractData.client_id !== userId &&
			contractData.professional_id !== userId
		) {
			throwError("Forbidden", 403);
		}

		const allowedEmails = [
			contractData.client?.[0]?.email,
			contractData.professional?.[0]?.email,
		].filter(Boolean);

		if (!allowedEmails.includes(recipientEmail)) {
			throwError("Recipient mismatch", 403);
		}
	}

	const safeRecipientName = escapeHtml(recipientName);
	const safeDetails = Object.fromEntries(
		Object.entries(details).map(([key, value]) => [
			key,
			escapeHtml(String(value ?? "")),
		]),
	);

	const appUrl = process.env.NEXT_PUBLIC_APP_URL;
	if (!appUrl) {
		throwError("NEXT_PUBLIC_APP_URL is not configured", 500);
	}

	const senderEmail =
		process.env.RESEND_SENDER_EMAIL || "admin@surveyconnecthub.com";

	const bodies: Record<NotifyEvent, string> = {
		contract_activated: `Hi ${safeRecipientName},<br><br>Your contract for <strong>${safeDetails.jobTitle}</strong> is now active. You can communicate with your ${safeDetails.otherParty} via the platform chat.<br><br><a href="${appUrl}/dashboard/${safeDetails.role}/contracts">View Contract</a>`,
		job_completed: `Hi ${safeRecipientName},<br><br>The professional has marked <strong>${safeDetails.jobTitle}</strong> as complete. Please review the work and release payment if satisfied.<br><br><a href="${appUrl}/dashboard/client/contracts">Review & Release Payment</a>`,
		payment_released: `Hi ${safeRecipientName},<br><br>Payment of <strong>$${safeDetails.amount}</strong> has been released for <strong>${safeDetails.jobTitle}</strong>. It will be transferred to your bank account.<br><br><a href="${appUrl}/dashboard/professional/contracts">View Contracts</a>`,
		application_received: `Hi ${safeRecipientName},<br><br>You have a new application for <strong>${safeDetails.jobTitle}</strong> from ${safeDetails.applicantName}.<br><br><a href="${appUrl}/dashboard/client/jobs/${safeDetails.jobId}/applications">Review Application</a>`,
		verification_approved: `Hi ${safeRecipientName}, congratulations! Your ${safeDetails.professionType} credentials have been verified. You can now apply to jobs on SurveyConnectHub. <a href="${appUrl}/jobs">Browse Jobs</a>`,
	};

	const unsubscribeUrl = `${appUrl}/settings/account`;

	try {
		await resend.emails.send({
			from: `SurveyConnectHub <${senderEmail}>`,
			to: recipientEmail,
			subject: subjects[event],
			html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        ${bodies[event]}
        <hr style="margin: 24px 0; border-color: #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">SurveyConnectHub — Marketplace for Geospatial Professionals</p>
        <p style="color: #9ca3af; font-size: 11px;"><a href="${unsubscribeUrl}" style="color: #6b7280;">Unsubscribe</a></p>
      </div>`,
		});
	} catch {
		throwError("Failed to send notification email", 502);
	}
}
