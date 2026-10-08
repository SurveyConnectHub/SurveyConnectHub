import { createServiceClient } from "@/lib/supabase/server";
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

    let event: any;
    try {
      event = JSON.parse(body);
    } catch {
      console.error("Invalid webhook body JSON");
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventReference =
      event.data?.reference ??
      crypto.createHash("sha256").update(body).digest("hex");
    const eventKey = `${event.event}:${eventReference}`;
    const supabase = createServiceClient();
    const { error: eventInsertError } = await supabase
      .from("paystack_webhook_events")
      .insert({
        event_key: eventKey,
        event_name: String(event.event ?? "unknown"),
        reference: event.data?.reference ?? null,
      });
    if (eventInsertError?.code === "23505") {
      const { data: existingEvent, error: existingEventError } = await supabase
        .from("paystack_webhook_events")
        .select("processed_at")
        .eq("event_key", eventKey)
        .maybeSingle();
      if (existingEventError) {
        console.error("Failed to inspect Paystack webhook event:", existingEventError);
        return NextResponse.json({ error: "Webhook unavailable" }, { status: 503 });
      }
      if (existingEvent?.processed_at) {
        return NextResponse.json({ received: true, duplicate: true });
      }
    }
    if (eventInsertError && eventInsertError.code !== "23505") {
      console.error("Failed to record Paystack webhook event:", eventInsertError);
      return NextResponse.json({ error: "Webhook unavailable" }, { status: 503 });
    }

    // Handle successful payment
    if (event.event === "charge.success") {
      const { reference, metadata, status } = event.data;

      if (status !== "success") {
        await supabase.from("paystack_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_key", eventKey);
        return NextResponse.json({ received: true });
      }

      const contractId = metadata?.contractId;
      const milestoneId = metadata?.milestoneId;

      if (!contractId) {
        await supabase.from("paystack_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_key", eventKey);
        return NextResponse.json({ received: true });
      }

      // Milestone funding path — flip milestone to "funded" if still pending
      // (verify route may have already done this).
      if (milestoneId) {
        const { data: milestone } = await supabase
          .from("milestones")
          .select("id, amount, status")
          .eq("id", milestoneId)
          .eq("contract_id", contractId)
          .single();

        if (milestone && milestone.status === "pending") {
          const expectedMilestoneAmountKobo =
            Math.round(Number(milestone.amount) * 1.05 * Number(metadata?.exchangeRate || 0)) * 100;
          if (
            expectedMilestoneAmountKobo > 0 &&
            Number(event.data.amount || 0) === expectedMilestoneAmountKobo &&
            event.data.currency === "NGN"
          ) {
            const { error: milestoneUpdateError } = await supabase
              .from("milestones")
              .update({
                status: "funded",
                funded_at: new Date().toISOString(),
                paystack_payment_reference: reference,
              })
              .eq("id", milestoneId)
              .eq("status", "pending");

            if (milestoneUpdateError) {
              console.error("Webhook milestone fund failed:", milestoneUpdateError);
            } else {
              try {
                await supabase.from("transactions").insert({
                  contract_id: contractId,
                  milestone_id: milestoneId,
                  type: "escrow_deposit",
                  amount: Number(milestone.amount),
                  platform_fee: Number(milestone.amount) * 0.05,
                  status: "completed",
                  paystack_reference: reference,
                });
              } catch (err) {
                console.error("Failed to insert escrow_deposit transaction:", err);
              }
            }
          }
        }
        await supabase.from("paystack_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_key", eventKey);
        return NextResponse.json({ received: true });
      }

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
        await supabase.from("paystack_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_key", eventKey);
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
      await supabase.from("paystack_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_key", eventKey);
      return NextResponse.json({ received: true });
    }

    if (
      event.event === "transfer.failed" ||
      event.event === "transfer.reversed"
    ) {
      const { reference, metadata } = event.data || {};
      const supabase = createServiceClient();

      // Prefer contract_id from metadata (set when initiating transfer),
      // fall back to positional parsing of the reference string.
      let contractId: string | undefined = metadata?.contract_id;

      // Parse contractId from reference: SC-REL-{contractId}-{timestamp}
      // Use regex to extract the contract ID portion between SC-REL- and the last segment
      if (!contractId && reference && typeof reference === "string") {
        const match = reference.match(/^SC-REL-(.+)-(\d+)$/);
        if (match) {
          contractId = match[1];
        }
      }
      if (contractId) {
        await supabase
          .from("contracts")
          .update({ payment_released_at: null })
          .eq("id", contractId)
          .not("payment_released_at", "is", null);
      }

      // Milestone transfer rollback: if metadata carries a milestone_id,
      // revert the milestone back to "approved" so the client can retry.
      const milestoneId = metadata?.milestone_id;
      if (milestoneId) {
        await supabase
          .from("milestones")
          .update({
            status: "approved",
            released_at: null,
            paystack_transfer_reference: null,
          })
          .eq("id", milestoneId)
          .is("released_at", null);
        // also fall back to parsing the reference: SC-MREL-{milestoneId}-{ts}
        if (!milestoneId && reference && typeof reference === "string") {
          const match = reference.match(/^SC-MREL-(.+)-(\d+)$/);
          if (match) {
            await supabase
              .from("milestones")
              .update({
                status: "approved",
                released_at: null,
                paystack_transfer_reference: null,
              })
              .eq("id", match[1])
              .is("released_at", null);
          }
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
      await supabase.from("paystack_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_key", eventKey);
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
