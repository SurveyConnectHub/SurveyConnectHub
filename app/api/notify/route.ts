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

	try {
		await sendNotificationEmail({
			supabase,
			userId: user.id,
			payload,
		});
		return NextResponse.json({ success: true });
	} catch (error: any) {
		console.error("Failed to send notification email:", error);
		return NextResponse.json(
			{ error: error?.message || "Failed to send email" },
			{ status: error?.status || 500 },
		);
	}
}
