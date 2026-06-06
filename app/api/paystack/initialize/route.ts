import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createClient } from "@/lib/supabase/server";
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

async function getExchangeRate(): Promise<number | null> {
  const redis = getRedis();

  if (redis) {
    try {
      const cached = await redis.get<number>("exchange_rate_usd_ngn");
      if (cached !== null && typeof cached === "number") {
        return cached;
      }
    } catch {
      // Redis unavailable, proceed to API fetch
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch("https://cdn.moneyconvert.net/api/latest.json", {
      signal: controller.signal,
    });
    const data = await res.json();
    const rate = data?.rates?.NGN;
    if (!rate || typeof rate !== "number") return null;

    if (redis) {
      try {
        await redis.set("exchange_rate_usd_ngn", rate, {
          ex: CACHE_TTL_SECONDS,
        });
      } catch {
        // Non-critical
      }
    }

    return rate;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
