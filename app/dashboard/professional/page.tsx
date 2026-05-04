"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/ThemeProvider";
import AppBrand from "@/components/dashboard/AppBrand";
import DashboardHeaderActions from "@/components/dashboard/DashboardHeaderActions";
import StatCard from "@/components/dashboard/StatCard";
import QuickActionGrid from "@/components/dashboard/QuickActionGrid";
import {
	Search,
	ClipboardList,
	FileText,
	User,
	CheckCircle2,
	AlertTriangle,
	Star,
	DollarSign,
	Briefcase,
} from "lucide-react";

export default function ProfessionalDashboard() {
	const router = useRouter();
	const [profile, setProfile] = useState<any>(null);
	const [profProfile, setProfProfile] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [unreadCount, setUnreadCount] = useState(0);
	const [unreadNotifications, setUnreadNotifications] = useState(0);
	const [stats, setStats] = useState({
		jobsCompleted: 0,
		totalEarned: 0,
		avgRating: null as number | null,
	});
	const { theme, toggleTheme } = useTheme();
	const supabase = useMemo(() => createClient(), []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			const raw = sessionStorage.getItem("sch_notifications");
			if (!raw) return;
			const parsed = JSON.parse(raw) as {
				unreadCount?: number;
				notifications?: { is_read: boolean }[];
			};
			if (typeof parsed.unreadCount === "number") {
				setUnreadNotifications(parsed.unreadCount);
				return;
			}
			if (Array.isArray(parsed.notifications)) {
				const count = parsed.notifications.filter(
					(item) => !item.is_read,
				).length;
				setUnreadNotifications(count);
			}
		} catch {
			// Ignore cache errors.
		}
	}, []);

	const getCurrentUser = useCallback<
		() => Promise<any>
	>(async (): Promise<any> => {
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (session?.user) {
			return session.user;
		}

		const {
			data: { user },
			error,
		} = await supabase.auth.getUser();

		if (error) {
			throw error;
		}

		return user;
	}, [supabase]);

	useEffect(() => {
		const getProfile = async () => {
			try {
				const user = await getCurrentUser();
				if (!user) {
					router.push("/login");
					return;
				}

				const { data } = await supabase
					.from("profiles")
					.select("*")
					.eq("id", user.id)
					.single();

				const { data: prof } = await supabase
					.from("professional_profiles")
					.select("verification_status")
					.eq("id", user.id)
					.single();

				setProfile(data);
				setProfProfile(prof);

				const { data: contracts } = await supabase
					.from("contracts")
					.select("id, professional_receives, payment_released_at")
					.eq("professional_id", user.id);

				const { data: reviews } = await supabase
					.from("reviews")
					.select("rating")
					.eq("reviewee_id", user.id);

				if (contracts) {
					const completed = contracts.filter(
						(c) => c.payment_released_at !== null,
					).length;
					const earned = contracts
						.filter((c) => c.payment_released_at !== null)
						.reduce((sum, c) => sum + Number(c.professional_receives || 0), 0);

					const avg =
						reviews && reviews.length > 0
							? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
							: null;

					setStats({
						jobsCompleted: completed,
						totalEarned: earned,
						avgRating: avg,
					});
				}

				setLoading(false);

				const fetchUnread = async () => {
					const { data: activeContracts } = await supabase
						.from("contracts")
						.select("id")
						.eq("professional_id", user.id)
						.in("status", ["active", "completed"]);

					if (!activeContracts || activeContracts.length === 0) return;

					const contractIds = activeContracts.map((c) => c.id);
					const { count } = await supabase
						.from("messages")
						.select("id", { count: "exact", head: true })
						.in("contract_id", contractIds)
						.neq("sender_id", user.id)
						.eq("is_read", false);

					setUnreadCount(count || 0);
				};

				fetchUnread();

				const { data: activeContracts } = await supabase
					.from("contracts")
					.select("id")
					.eq("professional_id", user.id)
					.in("status", ["active", "completed"]);

				if (activeContracts && activeContracts.length > 0) {
					const channel = supabase
						.channel("professional-unread-messages")
						.on(
							"postgres_changes",
							{ event: "INSERT", schema: "public", table: "messages" },
							(payload) => {
								const msg = payload.new as any;
								const isMyContract = activeContracts.some(
									(c) => c.id === msg.contract_id,
								);
								if (isMyContract && msg.sender_id !== user.id) {
									setUnreadCount((prev) => prev + 1);
								}
							},
						)
						.subscribe();

					return () => {
						supabase.removeChannel(channel);
					};
				}
			} catch (error) {
				console.error("Failed to load professional dashboard", error);
				router.push("/login");
			} finally {
				setLoading(false);
			}
		};

		getProfile();
	}, [getCurrentUser, router, supabase]);

	const handleLogout = async () => {
		await supabase.auth.signOut();
		router.push("/login");
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
				<div className="text-gray-500 dark:text-gray-400">Loading...</div>
			</div>
		);
	}

	const quickActions = [
		{
			href: "/jobs",
			icon: <Search className="w-5 h-5 text-green-700 dark:text-green-300" />,
			iconBg: "bg-green-100 dark:bg-green-900/40",
			label: "Browse Jobs",
			desc: "Find geospatial projects matching your skills",
		},
		{
			href: "/dashboard/professional/applications",
			icon: (
				<ClipboardList className="w-5 h-5 text-blue-700 dark:text-blue-300" />
			),
			iconBg: "bg-blue-100 dark:bg-blue-900/40",
			label: "My Applications",
			desc: "Track jobs you have applied to",
		},
		{
			href: "/dashboard/professional/contracts",
			icon: (
				<FileText className="w-5 h-5 text-purple-700 dark:text-purple-300" />
			),
			iconBg: "bg-purple-100 dark:bg-purple-900/40",
			label: "My Contracts",
			desc: "View active contracts and mark jobs complete",
			badge: unreadCount,
		},
		{
			href: profile?.id ? `/professionals/${profile.id}` : "/professionals",
			icon: <User className="w-5 h-5 text-orange-700 dark:text-orange-300" />,
			iconBg: "bg-orange-100 dark:bg-orange-900/40",
			label: "Portfolio Preview",
			desc: "See how clients view your public profile",
		},
	];

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
			<nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
				<AppBrand />
				<DashboardHeaderActions
					theme={theme}
					toggleTheme={toggleTheme}
					fullName={profile?.full_name || ""}
					unreadNotifications={unreadNotifications}
					onUnreadNotificationsChange={setUnreadNotifications}
					onLogout={handleLogout}
				/>
			</nav>

			<div className="max-w-6xl mx-auto px-6 py-8">
				<div className="mb-8">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
						Welcome back, {profile?.full_name?.split(" ")[0]}!
					</h2>
					<p className="text-gray-500 dark:text-gray-400 mt-1">
						Find jobs and grow your geospatial career
					</p>
				</div>

				{/* Verification banners */}
				{profProfile?.verification_status !== "verified" && (
					<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-2xl p-4 mb-8 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
							<div>
								<p className="font-semibold text-yellow-800 dark:text-yellow-300">
									Get verified to land more jobs
								</p>
								<p className="text-sm text-yellow-700 dark:text-yellow-400">
									Complete verification to increase trust and unlock more
									opportunities
								</p>
							</div>
						</div>
						<Link
							href="/verification"
							className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shrink-0"
						>
							Get Verified
						</Link>
					</div>
				)}

				{profProfile?.verification_status === "verified" && (
					<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-2xl p-4 mb-8 flex items-center gap-3">
						<CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
						<p className="font-semibold text-green-800 dark:text-green-300">
							Your account is verified — you can apply to jobs
						</p>
					</div>
				)}

				{/* Stats */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
					<StatCard
						title="Jobs Completed"
						value={stats.jobsCompleted}
						icon={<Briefcase className="w-4 h-4" />}
						iconBgClass="bg-blue-100 dark:bg-blue-900/40"
						iconColorClass="text-blue-600 dark:text-blue-400"
					/>
					<StatCard
						title="Total Earned"
						value={`$${stats.totalEarned.toLocaleString()}`}
						icon={<DollarSign className="w-4 h-4" />}
						iconBgClass="bg-green-100 dark:bg-green-900/40"
						iconColorClass="text-green-600 dark:text-green-400"
					/>
					<StatCard
						title="Average Rating"
						value={
							stats.avgRating !== null ? (
								<span className="flex items-center gap-1">
									{stats.avgRating.toFixed(1)}
									<Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
								</span>
							) : (
								"—"
							)
						}
						icon={<Star className="w-4 h-4" />}
						iconBgClass="bg-yellow-100 dark:bg-yellow-900/40"
						iconColorClass="text-yellow-600 dark:text-yellow-400"
					/>
				</div>

				<QuickActionGrid actions={quickActions} />
			</div>
		</div>
	);
}
