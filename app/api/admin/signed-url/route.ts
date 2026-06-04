import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import path from "path";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Admin profile lookup failed:", profileError);
    return NextResponse.json(
      { error: "Failed to verify admin status" },
      { status: 500 },
    );
  }

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { path: pathValue } = await request.json().catch(() => ({}));
  if (!pathValue || typeof pathValue !== "string") {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  let storagePath = pathValue;
  const marker = "/verification-documents/";
  const markerIndex = pathValue.lastIndexOf(marker);
  if (markerIndex >= 0) {
    storagePath = pathValue.slice(markerIndex + marker.length);
  }

  const normalizedPath = path.posix.normalize(storagePath).replace(/\\/g, "/");

  if (
    normalizedPath.startsWith("..") ||
    normalizedPath.includes("/../") ||
    normalizedPath.startsWith("/") ||
    normalizedPath === ".." ||
    normalizedPath === "."
  ) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const { data, error } = await supabase.storage
    .from("verification-documents")
    .createSignedUrl(normalizedPath, 3600);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Could not generate URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
