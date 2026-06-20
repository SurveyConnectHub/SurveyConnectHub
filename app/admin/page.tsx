import AdminContent, { AdminStats, PendingProfessional } from "./AdminContent";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { firstOf } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("is_admin")
		.eq("id", user.id)
		.single();

	if (!profile?.is_admin) {
		redirect("/dashboard/client");
	}

	const [
		{ count: totalUsers },
		{ count: totalClients },
		{ count: totalProfessionals },
		{ count: totalJobs },
		{ data: contracts },
		{ count: pendingCount },
	] = await Promise.all([
		supabase.from("profiles").select("id", { count: "exact", head: true }),
		supabase
			.from("profiles")
			.select("id", { count: "exact", head: true })
			.eq("role", "client"),
		supabase
			.from("profiles")
			.select("id", { count: "exact", head: true })
			.eq("role", "professional"),
		supabase.from("jobs").select("id", { count: "exact", head: true }),
		supabase.from("contracts").select("platform_fee, payment_released_at"),
		supabase
			.from("professional_profiles")
			.select("id", { count: "exact", head: true })
			.eq("verification_status", "pending"),
	]);

	const revenue = (contracts || [])
		.filter((c: any) => c.payment_released_at !== null)
		.reduce((sum: number, c: any) => sum + Number(c.platform_fee || 0), 0);

	const initialStats: AdminStats = {
		totalUsers: totalUsers || 0,
		totalClients: totalClients || 0,
		totalProfessionals: totalProfessionals || 0,
		totalJobs: totalJobs || 0,
		totalContracts: (contracts || []).length,
		platformRevenue: revenue,
		pendingVerifications: pendingCount || 0,
	};

	const { data: pending } = await supabase
		.from("professional_profiles")
		.select(
			"id, profession_type, license_number, years_experience, id_document_url, license_url, verification_status, created_at, profiles(full_name, email, country)",
		)
		.eq("verification_status", "pending")
		.order("created_at", { ascending: false });

	const normalizedPending = (pending || []).map((item: any) => ({
		...item,
		profiles: firstOf(item.profiles),
	}));

	return (
		<AdminContent
			initialStats={initialStats}
			initialPendingProfessionals={normalizedPending as PendingProfessional[]}
		/>
	);
}
