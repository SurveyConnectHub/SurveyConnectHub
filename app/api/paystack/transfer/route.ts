import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";
import { NextRequest, NextResponse } from "next/server";
import { sendNotificationEmail } from "@/lib/email/notify";

export async function POST(request: NextRequest) {
	try {
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

		const allowed = await checkRateLimit(`transfer:${user.id}`, 3, 60);
		if (!allowed) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}

		const { contractId } = await request.json();

		// Get contract details
		const { data: contract, error: contractError } = await supabase
			.from("contracts")
			.select(
				`
        *,
				jobs(title),
        profiles!contracts_professional_id_fkey(
          full_name,
					email,
          bank_account_number,
          bank_name,
          bank_account_name,
          paystack_recipient_code
        )
      `,
			)
			.eq("id", contractId)
			.eq("client_id", user.id)
			.eq("status", "completed")
			.is("payment_released_at", null)
			.single();

		if (contractError || !contract) {
			return NextResponse.json(
				{ error: "Contract not found or already paid" },
				{ status: 404 },
			);
		}

		const professional = contract.profiles;

		// Check if professional has bank details
		if (!professional?.bank_account_number || !professional?.bank_name) {
			return NextResponse.json(
				{
					error:
						"Professional has not added their bank details yet. Ask them to add their bank account in their profile settings.",
				},
				{ status: 400 },
			);
		}

		if (!contract.exchange_rate_used) {
			return NextResponse.json(
				{ error: "Contract exchange rate not initialized" },
				{ status: 400 },
			);
		}

		if (!contract.agreed_budget) {
			return NextResponse.json(
				{ error: "Contract agreed budget not available" },
				{ status: 400 },
			);
		}

		// Professional receives 95% of agreed budget, converted using stored exchange rate.
		const exchangeRate = Number(contract.exchange_rate_used);
		const agreedBudget = Number(contract.agreed_budget);
		const professionalAmountNgn = Math.round(
			agreedBudget * exchangeRate * 0.95,
		);
		const professionalAmountKobo = professionalAmountNgn * 100;
		const professionalReceivesUsd = Number((agreedBudget * 0.95).toFixed(2));
		const platformFeeUsd = Number((agreedBudget * 0.1).toFixed(2));

		const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
		if (!paystackSecretKey) {
			return NextResponse.json(
				{ error: "Payment service not configured" },
				{ status: 500 },
			);
		}

		let recipientCode = professional.paystack_recipient_code;

		// Create transfer recipient if not exists
		if (!recipientCode) {
			const recipientResponse = await fetch(
				"https://api.paystack.co/transferrecipient",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${paystackSecretKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						type: "nuban",
						name: professional.bank_account_name || professional.full_name,
						account_number: professional.bank_account_number,
						bank_code: professional.bank_name,
						currency: "NGN",
					}),
				},
			);

			if (!recipientResponse.ok) {
				return NextResponse.json(
					{ error: "Failed to create transfer recipient" },
					{ status: 502 },
				);
			}

			const recipientData = await recipientResponse.json();

			if (!recipientData.status) {
				return NextResponse.json(
					{ error: "Failed to create transfer recipient" },
					{ status: 500 },
				);
			}

			recipientCode = recipientData.data.recipient_code;

			await supabase
				.from("profiles")
				.update({ paystack_recipient_code: recipientCode })
				.eq("id", contract.professional_id);
		}

		// Initiate transfer with a unique reference for idempotency
		const transferReference = `SC-REL-${contractId}-${Date.now()}`;
		const transferResponse = await fetch("https://api.paystack.co/transfer", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${paystackSecretKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				source: "balance",
				amount: professionalAmountKobo,
				recipient: recipientCode,
				reference: transferReference,
				reason: `Payment for ${contract.jobs?.title ?? contract.job_id} on SurveyConnectHub`,
			}),
		});

		if (!transferResponse.ok) {
			return NextResponse.json(
				{ error: "Transfer failed" },
				{ status: 502 },
			);
		}

		const transferData = await transferResponse.json();

		if (!transferData.status) {
			return NextResponse.json({ error: "Transfer failed" }, { status: 500 });
		}

		// Only mark as released after Paystack confirms the transfer
		const releaseTimestamp = new Date().toISOString();
		const { data: releasedRows, error: releaseError } = await supabase
			.from("contracts")
			.update({
				payment_released_at: releaseTimestamp,
				professional_receives: professionalReceivesUsd,
				platform_fee: platformFeeUsd,
			})
			.eq("id", contractId)
			.is("payment_released_at", null)
			.select("id");

		if (releaseError) {
			// Payment was sent but we failed to record it — admin must reconcile
			return NextResponse.json(
				{ error: "Payment sent but could not be recorded" },
				{ status: 500 },
			);
		}

		if (!releasedRows || releasedRows.length === 0) {
			// Race condition: another request already completed this
			return NextResponse.json(
				{ error: "Payment already released" },
				{ status: 409 },
			);
		}

		// Notifications — best effort, non-critical
		if (professional?.email && professional?.full_name) {
			sendNotificationEmail({
				supabase,
				userId: user.id,
				payload: {
					event: "payment_released",
					recipientEmail: professional.email,
					recipientName: professional.full_name,
					details: {
						amount: professionalReceivesUsd.toFixed(2),
						jobTitle: contract.jobs?.title ?? "your job",
						contractId,
					},
				},
			}).catch(() => {});
		}

		try {
			const serviceClient = createServiceClient();
			await serviceClient
				.from("notifications")
				.insert({
					user_id: contract.professional_id,
					title: "Payment released",
					message: `$${professionalReceivesUsd.toFixed(2)} released for "${
						contract.jobs?.title ?? "your job"
					}"`,
					type: "payment",
					link: "/dashboard/professional/contracts",
					is_read: false,
				});
		} catch {
			// Non-critical
		}

		return NextResponse.json({
			success: true,
			message: "Payment released successfully",
			amount: professionalAmountNgn,
		});
	} catch (error) {
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
