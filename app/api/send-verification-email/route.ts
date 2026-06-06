import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
	try {
		const { professionalName, professionType, userId } = await request.json();

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
							<td style="padding: 8px; font-size: 12px; color: #6b7280;">${userId}</td>
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