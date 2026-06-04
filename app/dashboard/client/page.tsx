"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/ThemeProvider";
import AppBrand from "@/components/dashboard/AppBrand";
import DashboardHeaderActions from "@/components/dashboard/DashboardHeaderActions";
import StatCard from "@/components/dashboard/StatCard";
import QuickActionGrid from "@/components/dashboard/QuickActionGrid";
import ChecklistPanel from "@/components/onboarding/ChecklistPanel";
import {
	Briefcase,
	FolderOpen,
	FileText,
	Search,
	TrendingUp,
	DollarSign,
	CheckCircle,
} from "lucide-react";

export default function ClientDashboard() {
	const router = useRouter();
	const [profile, setProfile] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [unreadCount, setUnreadCount] = useState(0);
	const [unreadNotifications, setUnreadNotifications] = useState(0);
	const [userId, setUserId] = useState<string | null>(null);
	const [showChecklist, setShowChecklist] = useState(false);
	const [dismissingChecklist, setDismissingChecklist] = useState(false);
	const [isChecklistExpanded, setIsChecklistExpanded] = useState(true);
	const [stats, setStats] = useState({
		activeProjects: 0,
		totalSpent: 0,
		completedProjects: 0,
	});
	const { theme, toggleTheme } = useTheme();
	const supabase = useMemo(() => createClient(), []);

	const getCurrentUser = useCallback(async (): Promise<any> => {
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

				setUserId(user.id);

				const { data } = await supabase
					.from("profiles")
					.select("*")
					.eq("id", user.id)
					.single();

				setProfile(data);

				const { data: contracts } = await supabase
					.from("contracts")
					.select("id, status, escrow_amount, payment_released_at")
					.eq("client_id", user.id);

				const { count: jobsCount } = await supabase
					.from("jobs")
					.select("id", { count: "exact", head: true })
					.eq("client_id", user.id);

				const { data: clientProfile } = await supabase
					.from("client_profiles")
					.select("onboarding_dismissed_at")
					.eq("id", user.id)
					.maybeSingle();

				if (contracts) {
					const active = contracts.filter((c) => c.status === "active").length;
					const completed = contracts.filter(
						(c) => c.payment_released_at !== null,
					).length;
					const spent = contracts
						.filter((c) => c.payment_released_at !== null)
						.reduce((sum, c) => sum + Number(c.escrow_amount || 0), 0);

					setStats({
						activeProjects: active,
						totalSpent: spent,
						completedProjects: completed,
					});

					const hasPostedJob = Number(jobsCount || 0) > 0;
					const hasAnyContract = contracts.length > 0;
					const isDismissed = Boolean(clientProfile?.onboarding_dismissed_at);
					if (!isDismissed && !(hasPostedJob && hasAnyContract)) {
						setShowChecklist(true);
					}
				}

				setLoading(false);

				const fetchUnread = async () => {
					const { data: activeContracts } = await supabase
						.from("contracts")
						.select("id")
						.eq("client_id", user.id)
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
					.eq("client_id", user.id)
					.in("status", ["active", "completed"]);

				let channel: ReturnType<typeof supabase.channel> | null = null;

				if (activeContracts && activeContracts.length > 0) {
					channel = supabase
						.channel("client-unread-messages")
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
				}

				return () => {
					if (channel) supabase.removeChannel(channel);
				};
			} catch (error) {
				console.error("Failed to load client dashboard", error);
				router.push("/login");
			} finally {
				setLoading(false);
			}
		};

		getProfile();
	}, [getCurrentUser, router, supabase]);

	const dismissChecklist = async () => {
		setDismissingChecklist(true);
		setShowChecklist(false);

		let user = null;
		try {
			user = await getCurrentUser();
		} catch (error) {
			console.error("Failed to resolve user for checklist dismiss", error);
		}

		if (user) {
			await supabase
				.from("client_profiles")
				.update({ onboarding_dismissed_at: new Date().toISOString() })
				.eq("id", user.id);
		}

		setDismissingChecklist(false);
	};

	const toggleChecklistExpanded = () => {
		setIsChecklistExpanded((prev) => !prev);
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
			href: "/jobs/post",
			icon: (
				<Briefcase className="w-5 h-5 text-green-700 dark:text-green-300" />
			),
			iconBg: "bg-green-100 dark:bg-green-900/40",
			label: "Post a Job",
			desc: "Find the right professional for your project",
		},
		{
			href: "/dashboard/client/jobs",
			icon: <FolderOpen className="w-5 h-5 text-blue-700 dark:text-blue-300" />,
			iconBg: "bg-blue-100 dark:bg-blue-900/40",
			label: "My Jobs",
			desc: "View applications for your posted jobs",
		},
		{
			href: "/dashboard/client/contracts",
			icon: (
				<FileText className="w-5 h-5 text-purple-700 dark:text-purple-300" />
			),
			iconBg: "bg-purple-100 dark:bg-purple-900/40",
			label: "My Contracts",
			desc: "Review completed work and release payments",
			badge: unreadCount,
		},
		{
			href: "/professionals",
			icon: <Search className="w-5 h-5 text-orange-700 dark:text-orange-300" />,
			iconBg: "bg-orange-100 dark:bg-orange-900/40",
			label: "Browse Professionals",
			desc: "Search verified geospatial experts",
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
					userId={userId}
					unreadNotifications={unreadNotifications}
					onUnreadNotificationsChange={setUnreadNotifications}
				/>
			</nav>

			<div className="max-w-6xl mx-auto px-6 py-8">
				<div className="mb-8">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
						Welcome back, {profile?.full_name?.split(" ")[0]}!
					</h2>
					<p className="text-gray-500 dark:text-gray-400 mt-1">
						Find and hire the best geospatial professionals
					</p>
				</div>

				{showChecklist && (
					<ChecklistPanel
						title="Welcome Checklist"
						subtitle="Set up your account and start hiring faster"
						items={[
							{
								id: "profile",
								label: "Complete your basic profile",
								href: "/profile",
								completed: Boolean(profile?.full_name && profile?.country),
							},
							{
								id: "job",
								label: "Post your first job",
								href: "/jobs/post",
								completed:
									stats.activeProjects > 0 || stats.completedProjects > 0,
							},
							{
								id: "contract",
								label: "Start your first contract",
								href: "/dashboard/client/contracts",
								completed: stats.completedProjects > 0,
							},
						]}
						onDismiss={dismissChecklist}
						dismissing={dismissingChecklist}
						isExpanded={isChecklistExpanded}
						onToggleExpand={toggleChecklistExpanded}
					/>
				)}

				{/* Stats */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
					<StatCard
						title="Active Projects"
						value={stats.activeProjects}
						icon={<TrendingUp className="w-4 h-4" />}
						iconBgClass="bg-blue-100 dark:bg-blue-900/40"
						iconColorClass="text-blue-600 dark:text-blue-400"
					/>
					<StatCard
						title="Total Spent"
						value={`$${stats.totalSpent.toLocaleString()}`}
						icon={<DollarSign className="w-4 h-4" />}
						iconBgClass="bg-green-100 dark:bg-green-900/40"
						iconColorClass="text-green-600 dark:text-green-400"
					/>
					<StatCard
						title="Completed Projects"
						value={stats.completedProjects}
						icon={<CheckCircle className="w-4 h-4" />}
						iconBgClass="bg-purple-100 dark:bg-purple-900/40"
						iconColorClass="text-purple-600 dark:text-purple-400"
					/>
				</div>

				<QuickActionGrid actions={quickActions} />
			</div>
		</div>
	);
}
