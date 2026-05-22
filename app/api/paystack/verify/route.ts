import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendNotificationEmail } from "@/lib/email/notify";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const reference = searchParams.get("reference");

		if (!reference) {
			return NextResponse.redirect(
				new URL("/dashboard/client?payment=failed", request.url),
			);
		}

		const controller = new AbortController();
		const timeoutMs = Number(process.env.PAYSTACK_TIMEOUT_MS ?? "8000");
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		let paystackResponse: Response;
		try {
			paystackResponse = await fetch(
				`https://api.paystack.co/transaction/verify/${reference}`,
				{
					headers: {
						Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
					},
					signal: controller.signal,
				},
			);
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return NextResponse.redirect(
					new URL("/dashboard/client?payment=failed", request.url),
				);
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}

		if (!paystackResponse.ok) {
			return NextResponse.redirect(
				new URL("/dashboard/client?payment=failed", request.url),
			);
		}

		const paystackData = await paystackResponse.json();

		if (!paystackData.status || paystackData.data.status !== "success") {
			return NextResponse.redirect(
				new URL("/dashboard/client?payment=failed", request.url),
			);
		}

		const contractId = paystackData.data.metadata?.contractId;

		if (!contractId) {
			return NextResponse.redirect(
				new URL("/dashboard/client?payment=failed", request.url),
			);
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.redirect(
				new URL("/dashboard/client?payment=failed", request.url),
			);
		}

		const { data: ownerCheck } = await supabase
			.from("contracts")
			.select("client_id")
			.eq("id", contractId)
			.single();

		if (!ownerCheck || ownerCheck.client_id !== user.id) {
			return NextResponse.redirect(
				new URL("/dashboard/client?payment=failed", request.url),
			);
		}

		const { data: contract } = await supabase
			.from("contracts")
			.select(
				"job_id, application_id, status, ngn_amount_paid, client_id, professional_id",
			)
			.eq("id", contractId)
			.single();

		if (!contract) {
			return NextResponse.redirect(
				new URL("/dashboard/client?payment=failed", request.url),
			);
		}

		const expectedAmountKobo = Number(contract.ngn_amount_paid || 0) * 100;
		const paidAmountKobo = Number(paystackData.data.amount || 0);

		if (
			expectedAmountKobo <= 0 ||
			paidAmountKobo !== expectedAmountKobo ||
			paystackData.data.currency !== "NGN"
		) {
			console.error("Payment amount mismatch on verify:", {
				contractId,
				expectedAmountKobo,
				paidAmountKobo,
				currency: paystackData.data.currency,
			});
			return NextResponse.redirect(
				new URL("/dashboard/client?payment=failed", request.url),
			);
		}

		if (contract.status === "pending") {
			// 1. Activate contract only once when still pending and without a payment reference.
			const { data: activatedRows } = await supabase
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

			if (activatedRows && activatedRows.length > 0) {
				// 2. Mark application as accepted
				await supabase
					.from("job_applications")
					.update({ status: "accepted" })
					.eq("id", contract.application_id);

				// 3. Reject all other applications
				await supabase
					.from("job_applications")
					.update({ status: "rejected" })
					.eq("job_id", contract.job_id)
					.neq("id", contract.application_id);

				// 4. Update job to in_progress
				await supabase
					.from("jobs")
					.update({ status: "in_progress" })
					.eq("id", contract.job_id);

				const { data: jobRecord } = await supabase
					.from("jobs")
					.select("title")
					.eq("id", contract.job_id)
					.single();
				const jobTitle = jobRecord?.title ?? "your job";
				const { data: clientProfile } = await supabase
					.from("profiles")
					.select("full_name, email")
					.eq("id", contract.client_id)
					.single();
				const { data: professionalProfile } = await supabase
					.from("profiles")
					.select("full_name, email")
					.eq("id", contract.professional_id)
					.single();

				if (clientProfile?.email && clientProfile?.full_name) {
					await sendNotificationEmail({
						supabase,
						userId: user.id,
						payload: {
							event: "contract_activated",
							recipientEmail: clientProfile.email,
							recipientName: clientProfile.full_name,
							details: {
								jobTitle,
								otherParty: professionalProfile?.full_name ?? "professional",
								role: "client",
								contractId,
							},
						},
					}).catch((error) => {
						console.error(
							"Failed to send contract activation email (client):",
							error,
						);
					});
				}

				if (professionalProfile?.email && professionalProfile?.full_name) {
					await sendNotificationEmail({
						supabase,
						userId: user.id,
						payload: {
							event: "contract_activated",
							recipientEmail: professionalProfile.email,
							recipientName: professionalProfile.full_name,
							details: {
								jobTitle,
								otherParty: clientProfile?.full_name ?? "client",
								role: "professional",
								contractId,
							},
						},
					}).catch((error) => {
						console.error(
							"Failed to send contract activation email (professional):",
							error,
						);
					});
				}

				try {
					const serviceClient = createServiceClient();
					const { error: notificationError } = await serviceClient
						.from("notifications")
						.insert([
							{
								user_id: contract.client_id,
								title: "Contract activated",
								message: `Your contract for "${jobTitle}" with ${
									professionalProfile?.full_name ?? "the professional"
								} is now active.`,
								type: "contract",
								link: "/dashboard/client/contracts",
								is_read: false,
							},
							{
								user_id: contract.professional_id,
								title: "Contract activated",
								message: `Your contract for "${jobTitle}" with ${
									clientProfile?.full_name ?? "the client"
								} is now active.`,
								type: "contract",
								link: "/dashboard/professional/contracts",
								is_read: false,
							},
						]);

					if (notificationError) {
						console.error(
							"Failed to insert contract activation notifications:",
							notificationError,
						);
					}
				} catch (error) {
					console.error("Failed to create notification client:", error);
				}
			}
		}

		return NextResponse.redirect(
			new URL("/dashboard/client/contracts?payment=success", request.url),
		);
	} catch (error) {
		console.error("Payment verification error:", error);
		return NextResponse.redirect(
			new URL("/dashboard/client?payment=failed", request.url),
		);
	}
}
