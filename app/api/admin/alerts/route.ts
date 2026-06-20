import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export async function POST(request: NextRequest) {
  const secret = process.env.ADMIN_ALERT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Alerts not configured" },
      { status: 500 },
    );
  }
  if (request.headers.get("x-admin-alert-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return NextResponse.json(
      { error: "ADMIN_EMAIL is not configured" },
      { status: 500 },
    );
  }

  let payload: { type: string; reference?: string; message?: string } | null =
    null;

  try {
    payload = (await request.json()) as {
      type: string;
      reference?: string;
      message?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, reference, message } = payload ?? {};
  if (!type || typeof type !== "string") {
    return NextResponse.json({ error: "Missing type" }, { status: 400 });
  }

  const safeType = escapeHtml(type);
  const safeReference = escapeHtml(reference ?? "n/a");
  const safeMessage = escapeHtml(message ?? "No message provided.");

  try {
    await resend.emails.send({
      from: "SurveyConnectHub <notifications@resend.dev>",
      to: adminEmail,
      subject: `Admin alert: ${safeType}`,
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <p><strong>Type:</strong> ${safeType}</p>
        <p><strong>Reference:</strong> ${safeReference}</p>
        <p><strong>Message:</strong> ${safeMessage}</p>
      </div>`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to send admin alert:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Alert send failed" },
      { status: 502 },
    );
  }
}
