import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";

const CACHE_TTL_SECONDS = 300;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

function isValidRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Primary provider: Frankfurter
async function fetchFrankfurterRate(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      "https://api.frankfurter.dev/v2/rate/USD/NGN",
      8000,
    );
    const data = await res.json();
    const rate = data?.rate;
    return isValidRate(rate) ? rate : null;
  } catch {
    return null;
  }
}

// Secondary provider: ExchangeRate-API
async function fetchExchangeRateApi(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      "https://open.er-api.com/v6/latest/USD",
      8000,
    );
    const data = await res.json();
    if (data?.result !== "success") return null;
    const rate = data?.rates?.NGN;
    return isValidRate(rate) ? rate : null;
  } catch {
    return null;
  }
}

// Tertiary provider: MoneyConvert (original provider, now last-resort live source)
async function fetchMoneyConvertRate(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      "https://cdn.moneyconvert.net/api/latest.json",
      8000,
    );
    const data = await res.json();
    const rate = data?.rates?.NGN;
    return isValidRate(rate) ? rate : null;
  } catch {
    return null;
  }
}

// Last-resort: admin-set DB override (NOT cached in Redis)
async function getAdminOverrideRate(): Promise<number | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("exchange_rate_overrides")
      .select("rate")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const rate = Number(data.rate);
    if (!isValidRate(rate)) return null;
    console.warn(`Using admin-set exchange rate override: ${rate}`);
    return rate;
  } catch (error) {
    console.error("Failed to fetch admin exchange rate override:", error);
    return null;
  }
}

// Final fallback: alert admin that all sources failed
async function notifyAdminAllSourcesFailed(): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    const secret = process.env.ADMIN_ALERT_SECRET;
    if (!baseUrl || !secret) {
      console.error(
        "Cannot send admin alert: NEXT_PUBLIC_APP_URL or ADMIN_ALERT_SECRET not configured",
      );
      return;
    }

    await fetch(`${baseUrl}/api/admin/alerts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-alert-secret": secret,
      },
      body: JSON.stringify({
        type: "exchange_rate_all_sources_failed",
        message:
          "All exchange rate sources failed (Frankfurter, ExchangeRate-API, MoneyConvert) and no admin override is set. Payments are currently blocked until an admin sets a manual rate at /admin/exchange-rate.",
      }),
    });
  } catch (error) {
    console.error("Failed to send admin alert for exchange rate failure:", error);
  }
}

async function getExchangeRate(): Promise<number | null> {
  const redis = getRedis();

  // Stage 1: Redis cache (sits in front of the whole live-provider chain)
  if (redis) {
    try {
      const cached = await redis.get<number>("exchange_rate_usd_ngn");
      if (cached !== null && typeof cached === "number") {
        return cached;
      }
    } catch {
      // Redis unavailable, proceed to live providers
    }
  }

  // Stages 2-4: live provider fallback chain
  let liveRate: number | null = null;

  if (liveRate === null) liveRate = await fetchFrankfurterRate();
  if (liveRate === null) liveRate = await fetchExchangeRateApi();
  if (liveRate === null) liveRate = await fetchMoneyConvertRate();

  if (liveRate !== null) {
    // Cache successful live-provider rates only (never admin overrides)
    if (redis) {
      try {
        await redis.set("exchange_rate_usd_ngn", liveRate, {
          ex: CACHE_TTL_SECONDS,
        });
      } catch {
        // Non-critical
      }
    }
    return liveRate;
  }

  // Stage 5: admin-set override (NOT cached — always re-check live first past TTL)
  const overrideRate = await getAdminOverrideRate();
  if (overrideRate !== null) {
    return overrideRate;
  }

  // Stage 6: all sources failed — alert admin and return null (caller surfaces 500)
  await notifyAdminAllSourcesFailed();
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await checkRateLimit(`initialize:${user.id}`, 3, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const { contractId } = body;

    if (!contractId) {
      return NextResponse.json(
        { error: "Missing contractId" },
        { status: 400 },
      );
    }

    // Look up contract server-side — never trust client-sent amounts
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("id, agreed_budget, status, client_id")
      .eq("id", contractId)
      .single();

    if (contractError || !contract) {
      console.error("Contract lookup failed:", contractError);
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    if (contract.status !== "pending") {
      return NextResponse.json(
        { error: "Contract is not in a payable state" },
        { status: 400 },
      );
    }

    if (contract.client_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Fetch exchange rate USD → NGN (cached in Redis for 5 min)
    const exchangeRate = await getExchangeRate();
    if (!exchangeRate) {
      return NextResponse.json(
        { error: "Could not fetch exchange rate" },
        { status: 500 },
      );
    }

    // 5% client fee on top of agreed budget
    const agreedBudget = Number(contract.agreed_budget);
    const clientTotal = agreedBudget * 1.05;
    const ngnAmount = Math.round(clientTotal * exchangeRate);

    // Paystack expects amount in kobo (NGN × 100)
    const amountInKobo = ngnAmount * 100;

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return NextResponse.json(
        { error: "Payment service not configured" },
        { status: 500 },
      );
    }

    // Get user email from their profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    const email = profile?.email || user.email;

    if (!email) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 },
      );
    }

    const reference = `SC-${contractId}-${Date.now()}`;

    const paystackPayload = {
      amount: amountInKobo,
      email,
      reference,
      metadata: {
        contractId,
        userId: user.id,
        agreedBudget,
        clientTotal,
        exchangeRate,
        ngnAmount,
      },
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/paystack/verify`,
    };

    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paystackPayload),
      },
    );

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      return NextResponse.json(
        {
          error: paystackData.message || "Failed to initialize payment",
        },
        { status: 500 },
      );
    }

    // Persist exchange data only after Paystack init succeeds
    const { error: amountPersistError } = await supabase
      .from("contracts")
      .update({ ngn_amount_paid: ngnAmount, exchange_rate_used: exchangeRate })
      .eq("id", contractId);

    if (amountPersistError) {
      // Rollback is not possible here since Paystack already initialized;
      // the user can retry and the payment will be linked via metadata
      return NextResponse.json(
        { error: "Could not prepare payment" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      authorizationUrl: paystackData.data.authorization_url,
      access_code: paystackData.data.access_code,
      reference: paystackData.data.reference,
      exchangeRate,
      ngnAmount,
    });
  } catch (error) {
    console.error("Unexpected error in payment initialization:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        debug: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
