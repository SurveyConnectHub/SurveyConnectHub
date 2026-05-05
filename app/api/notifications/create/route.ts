import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";

type CreateNotificationPayload = {
	event: "job_completed";
	contractId: string;
};

export async function POST(request: NextRequest) {
	try {
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

		if (!(await checkRateLimit(`notifications:create:${user.id}`, 10, 60))) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}

		const body = (await request
			.json()
			.catch(() => null)) as CreateNotificationPayload | null;

		if (
			!body ||
			typeof body.contractId !== "string" ||
			!body.contractId.trim()
		) {
			return NextResponse.json(
				{ error: "Missing contract id" },
				{ status: 400 },
			);
		}

		if (body.event !== "job_completed") {
			return NextResponse.json({ error: "Invalid event" }, { status: 400 });
		}

		const { data: contract } = await supabase
			.from("contracts")
			.select("id, client_id, professional_id, jobs(title)")
			.eq("id", body.contractId)
			.single();

		if (!contract) {
			return NextResponse.json(
				{ error: "Contract not found" },
				{ status: 404 },
			);
		}

		if (contract.professional_id !== user.id) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { data: professionalProfile } = await supabase
			.from("profiles")
			.select("full_name")
			.eq("id", contract.professional_id)
			.single();

		const serviceClient = createServiceClient();
		const { error: notificationError } = await serviceClient
			.from("notifications")
			.insert({
				user_id: contract.client_id,
				title: "Job marked complete",
				message: `${
					professionalProfile?.full_name ?? "The professional"
				} marked "${contract.jobs?.[0]?.title ?? "your job"}" complete.`,
				type: "contract",
				link: "/dashboard/client/contracts",
				is_read: false,
			});

		if (notificationError) {
			console.error(
				"Failed to insert completion notification:",
				notificationError,
			);
			return NextResponse.json(
				{ error: "Failed to create notification" },
				{ status: 500 },
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Notifications create error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
