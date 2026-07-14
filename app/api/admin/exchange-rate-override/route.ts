import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateOrigin } from "@/lib/csrf";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null);
  const rate = body?.rate;

  if (
    typeof rate !== "number" ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    return NextResponse.json(
      { error: "Invalid rate (must be a finite number greater than 0)" },
      { status: 400 },
    );
  }

  // Insert via the user's own session client — RLS INSERT policy (admin-only)
  // from the exchange_rate_overrides migration permits this.
  const { data: inserted, error: insertError } = await supabase
    .from("exchange_rate_overrides")
    .insert({ rate, set_by: user.id })
    .select("id, rate, set_by, created_at")
    .single();

  if (insertError || !inserted) {
    console.error("Failed to insert exchange rate override:", insertError);
    return NextResponse.json(
      { error: "Could not save override" },
      { status: 500 },
    );
  }

  return NextResponse.json({ override: inserted });
}

export async function GET(request: NextRequest) {
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

  // Stage 1: try Supabase JS joined select (single round-trip).
  const { data: joined, error: joinError } = await supabase
    .from("exchange_rate_overrides")
    .select(
      "id, rate, created_at, set_by, profiles!exchange_rate_overrides_set_by_fkey(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(5);

  if (!joinError && joined) {
    const overrides = joined.map((row: any) => ({
      id: row.id,
      rate: Number(row.rate),
      created_at: row.created_at,
      set_by: row.set_by,
      full_name: row.profiles?.full_name ?? "Unknown admin",
    }));
    return NextResponse.json({ overrides });
  }

  // Stage 2: fallback to two explicit queries if the FK-join relation
  // name didn't resolve (e.g. older Supabase client builds).
  console.warn(
    "Joined override query failed; falling back to explicit two-query approach:",
    joinError,
  );

  const { data: overrides, error: overridesError } = await supabase
    .from("exchange_rate_overrides")
    .select("id, rate, created_at, set_by")
    .order("created_at", { ascending: false })
    .limit(5);

  if (overridesError || !overrides) {
    console.error("Failed to fetch override history:", overridesError);
    return NextResponse.json(
      { error: "Could not fetch override history" },
      { status: 500 },
    );
  }

  const setByIds = Array.from(
    new Set(overrides.map((row: any) => row.set_by).filter(Boolean)),
  );

  let nameById: Record<string, string> = {};
  if (setByIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", setByIds);

    if (profilesError) {
      console.warn(
        "profiles lookup for override history failed:",
        profilesError,
      );
    } else if (profiles) {
      nameById = Object.fromEntries(
        profiles.map((p: any) => [p.id, p.full_name ?? "Unknown admin"]),
      );
    }
  }

  const result = overrides.map((row: any) => ({
    id: row.id,
    rate: Number(row.rate),
    created_at: row.created_at,
    set_by: row.set_by,
    full_name: nameById[row.set_by] ?? "Unknown admin",
  }));

  return NextResponse.json({ overrides: result });
}
