import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendNotificationEmail, type NotifyPayload } from "@/lib/email/notify";

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let payload: NotifyPayload | null = null;

	try {
		payload = (await request.json()) as NotifyPayload;
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	// Ownership validation: ensure the caller owns the contract or job
	if (payload?.event !== "verification_approved") {
		const contractId = payload?.details?.contractId;
		const jobId = payload?.details?.jobId;

		if (contractId) {
			const { data: contract } = await supabase
				.from("contracts")
				.select("client_id, professional_id")
				.eq("id", contractId)
				.single();

			if (
				!contract ||
				(contract.client_id !== user.id && contract.professional_id !== user.id)
			) {
				return NextResponse.json({ error: "Forbidden" }, { status: 403 });
			}
		} else if (jobId) {
			const { data: job } = await supabase
				.from("jobs")
				.select("client_id")
				.eq("id", jobId)
				.single();

			if (!job || job.client_id !== user.id) {
				return NextResponse.json({ error: "Forbidden" }, { status: 403 });
			}
		} else {
			return NextResponse.json({ error: "Bad request" }, { status: 400 });
		}
	}

	try {
		await sendNotificationEmail({
			supabase,
			userId: user.id,
			payload,
		});
		return NextResponse.json({ success: true });
	} catch (error: any) {
		return NextResponse.json(
			{ error: error?.message || "Failed to send email" },
			{ status: error?.status || 500 },
		);
	}
}
