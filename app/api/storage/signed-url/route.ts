import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { path: pathValue, bucket } = body || {};

  if (!pathValue || typeof pathValue !== "string") {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  if (bucket !== "job-briefs" && bucket !== "portfolio-attachments") {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }

  const { posix } = await import("node:path");
  const normalizedPath = posix.normalize(pathValue).replace(/\\/g, "/");

  if (
    normalizedPath.startsWith("..") ||
    normalizedPath.includes("/../") ||
    normalizedPath.startsWith("/") ||
    normalizedPath === ".." ||
    normalizedPath === "."
  ) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (bucket === "job-briefs") {
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, client_id")
      .eq("brief_attachment_url", normalizedPath)
      .maybeSingle();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Brief not found or access denied" },
        { status: 404 },
      );
    }

    const { data: application } = await supabase
      .from("job_applications")
      .select("id")
      .eq("job_id", job.id)
      .eq("professional_id", user.id)
      .maybeSingle();

    if (job.client_id !== user.id && !application) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  if (bucket === "portfolio-attachments") {
    const folder = normalizedPath.split("/")[0];
    if (!folder) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const { data: app, error: appError } = await supabase
      .from("job_applications")
      .select("id, job_id")
      .eq("portfolio_attachment_url", normalizedPath)
      .maybeSingle();

    if (appError || !app) {
      return NextResponse.json(
        { error: "Attachment not found or access denied" },
        { status: 404 },
      );
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("client_id")
      .eq("id", app.job_id)
      .single();

    if (jobError || !job || job.client_id !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 },
      );
    }
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient.storage
    .from(bucket)
    .createSignedUrl(normalizedPath, 3600);

  if (error || !data?.signedUrl) {
    console.error("Signed URL generation failed:", error);
    return NextResponse.json(
      { error: "Could not generate URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}