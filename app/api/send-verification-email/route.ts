import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";

const resend = new Resend(process.env.RESEND_API_KEY);

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

		if (!(await checkRateLimit(`send-verification-email:${user.id}`, 3, 60))) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}

		// Derive data server-side from the authenticated user's profile
		const { data: professionalProfile, error: profileError } = await supabase
			.from("professional_profiles")
			.select("profession_type, verification_status")
			.eq("id", user.id)
			.single();

		if (profileError || !professionalProfile) {
			return NextResponse.json({ error: "Professional profile not found" }, { status: 404 });
		}

		if (professionalProfile.verification_status !== "pending") {
			return NextResponse.json({ error: "No pending verification request" }, { status: 400 });
		}

		const { data: profile } = await supabase
			.from("profiles")
			.select("full_name")
			.eq("id", user.id)
			.single();

		const professionalName = profile?.full_name ?? "Unknown";
		const professionType = professionalProfile.profession_type;

		const adminEmail = process.env.ADMIN_EMAIL;
		if (!adminEmail) {
			return NextResponse.json({ error: "Admin email not configured" }, { status: 500 });
		}

		await resend.emails.send({
			from: `SurveyConnectHub <${process.env.RESEND_SENDER_EMAIL || "admin@surveyconnecthub.com"}>`,
			to: adminEmail,
			subject: "New Verification Request — SurveyConnectHub",
			html: `
				<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
					<h2 style="color: #16a34a;">New Verification Request</h2>
					<p>A professional has submitted their verification documents and is awaiting approval.</p>
					<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
						<tr>
							<td style="padding: 8px; font-weight: bold; color: #6b7280;">Name</td>
							<td style="padding: 8px;">${professionalName}</td>
						</tr>
						<tr style="background: #f9fafb;">
							<td style="padding: 8px; font-weight: bold; color: #6b7280;">Profession</td>
							<td style="padding: 8px;">${professionType}</td>
						</tr>
						<tr>
							<td style="padding: 8px; font-weight: bold; color: #6b7280;">User ID</td>
							<td style="padding: 8px; font-size: 12px; color: #6b7280;">${user.id}</td>
						</tr>
					</table>
					<a href="https://surveyconnect.vercel.app/admin" 
					   style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
						Review in Admin Dashboard
					</a>
					<p style="margin-top: 20px; color: #6b7280; font-size: 12px;">
						SurveyConnectHub — Marketplace for Geospatial Professionals
					</p>
				</div>
			`,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Email error:", error);
		return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
	}
}
