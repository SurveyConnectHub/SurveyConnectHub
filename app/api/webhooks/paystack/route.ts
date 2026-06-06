import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-paystack-signature");
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      console.error("PAYSTACK_SECRET_KEY is not configured");
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 },
      );
    }

    if (!signature) {
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    // Verify webhook signature — this is what makes it secure
    const hash = crypto.createHmac("sha512", secret).update(body).digest("hex");

    const hashBuffer = Buffer.from(hash, "hex");
    const signatureBuffer = Buffer.from(signature, "hex");
    const signaturesMatch =
      hashBuffer.length === signatureBuffer.length &&
      crypto.timingSafeEqual(hashBuffer, signatureBuffer);

    if (!signaturesMatch) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);

    // Handle successful payment
    if (event.event === "charge.success") {
      const { reference, metadata, status } = event.data;

      if (status !== "success") {
        return NextResponse.json({ received: true });
      }

      const contractId = metadata?.contractId;

      if (!contractId) {
        return NextResponse.json({ received: true });
      }

      const supabase = await createClient();

      // Double confirm contract is active (verify route may have already done this)
      const { data: contract } = await supabase
        .from("contracts")
        .select("status, ngn_amount_paid")
        .eq("id", contractId)
        .single();

      const expectedAmountKobo = Number(contract?.ngn_amount_paid || 0) * 100;
      const paidAmountKobo = Number(event.data.amount || 0);

      if (
        expectedAmountKobo <= 0 ||
        paidAmountKobo !== expectedAmountKobo ||
        event.data.currency !== "NGN"
      ) {
        console.error("Payment amount mismatch on webhook:", {
          contractId,
          expectedAmountKobo,
          paidAmountKobo,
          currency: event.data.currency,
        });
        return NextResponse.json({ received: true });
      }

      if (contract && contract.status === "pending") {
        // Only update if still pending (avoid duplicate updates)
        const { data: updatedRows, error: updateError } = await supabase
          .from("contracts")
          .update({
            status: "active",
            start_date: new Date().toISOString(),
            payment_reference: reference,
          })
          .eq("id", contractId)
          .eq("status", "pending")
          .is("payment_reference", null)
          .select("id");

        if (updateError || !updatedRows || updatedRows.length === 0) {
          console.error("Webhook contract update failed:", {
            contractId,
            reference,
            error: updateError,
          });
        } else {
          console.log(`Contract ${contractId} activated via webhook`);
        }
      }
    }

    if (event.event === "transfer.success") {
      const { reference, amount, recipient } = event.data || {};
      // Payment was successfully transferred — status is final
      return NextResponse.json({ received: true });
    }

    if (
      event.event === "transfer.failed" ||
      event.event === "transfer.reversed"
    ) {
      const { reference } = event.data || {};
      const supabase = await createClient();

      // Try to find the contract by reference prefix (SC-REL-{contractId}-{timestamp})
      if (reference && reference.startsWith("SC-REL-")) {
        const contractId = reference.split("-").slice(2, -1).join("-");
        if (contractId) {
          await supabase
            .from("contracts")
            .update({ payment_released_at: null })
            .eq("id", contractId)
            .not("payment_released_at", "is", null);
        }
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
      if (appUrl) {
        try {
          const alertHeaders: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (process.env.ADMIN_ALERT_SECRET) {
            alertHeaders["x-admin-alert-secret"] =
              process.env.ADMIN_ALERT_SECRET;
          }

          await fetch(`${appUrl}/api/admin/alerts`, {
            method: "POST",
            headers: alertHeaders,
            body: JSON.stringify({
              type: "transfer_failed",
              reference,
              message: "Paystack transfer failed or was reversed.",
            }),
          }).catch(() => {});
        } catch {
          // Non-critical
        }
      }
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
