import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";

type BankOption = {
  code: string;
  name: string;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await checkRateLimit(`banks:get:${user.id}`, 15, 60))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        { error: "Payment service not configured" },
        { status: 500 },
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let response: Response;
    try {
      response = await fetch(
        "https://api.paystack.co/bank?country=nigeria&currency=NGN",
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
          cache: "no-store",
          signal: controller.signal,
        },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return NextResponse.json({ error: "Request timed out" }, { status: 504 });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await response.json();

    if (!response.ok || !data?.status || !Array.isArray(data?.data)) {
      return NextResponse.json({ banks: [] });
    }

    const banks: BankOption[] = data.data
      .filter((bank: any) => bank?.code && bank?.name)
      .map((bank: any) => ({
        code: String(bank.code),
        name: String(bank.name),
      }));

    const uniqueBanks = Array.from(
      new Map(
        banks.map((bank: BankOption) => [
          `${bank.code.toLowerCase()}::${bank.name.toLowerCase()}`,
          bank,
        ]),
      ).values(),
    );

    return NextResponse.json({ banks: uniqueBanks });
  } catch (error) {
    console.error("Banks fetch failed:", error);
    return NextResponse.json({ banks: [] });
  }
}
