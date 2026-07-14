"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { userLocale } from "@/lib/datetime";
import { getProfessionLabel } from "@/lib/constants";
import {
	MapPin,
	Calendar,
	DollarSign,
	User,
	Search,
	SlidersHorizontal,
} from "lucide-react";
import BookmarkButton from "@/components/BookmarkButton";
import { CardSkeleton } from "@/components/ui/Skeleton";
import type { Job, Profile } from "@/types/database";

const PAGE_SIZE = 10;

function JobsPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const supabase = useMemo(() => createClient(), []);

	const [jobs, setJobs] = useState<
		(Job & { profiles: Pick<Profile, "full_name" | "country"> | null })[]
	>([]);
	const [loading, setLoading] = useState(true);
	const [user, setUser] = useState<any>(null);
	const [profile, setProfile] = useState<any>(null);
	const [search, setSearch] = useState("");
	const [filterProfession, setFilterProfession] = useState("");
	const [filterBudget, setFilterBudget] = useState("");
	const [filterRemote, setFilterRemote] = useState(false);
	const [totalCount, setTotalCount] = useState(0);

	const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10);
	const currentPage =
		Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
	const pageIndex = currentPage - 1;

	const fetchJobs = useCallback(async () => {
		let query = supabase
			.from("jobs")
			.select(`*, profiles(full_name, country)`, { count: "exact" })
			.eq("status", "open");

		if (search.trim()) {
			const term = search.trim();
			query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
		}

		if (filterProfession) {
			query = query.eq("profession_type", filterProfession);
		}

		if (filterBudget === "under500") {
			query = query.lt("budget", 500);
		} else if (filterBudget === "500to2000") {
			query = query.gte("budget", 500).lte("budget", 2000);
		} else if (filterBudget === "above2000") {
			query = query.gt("budget", 2000);
		}

		if (filterRemote) {
			query = query.eq("job_type", "remote");
		}

		const { data, count, error } = await query
			.order("created_at", { ascending: false })
			.range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);

		if (error) {
			console.error("Failed to fetch jobs:", error);
			setJobs([]);
			setTotalCount(0);
			return;
		}

		setJobs(data || []);
		setTotalCount(count || 0);
	}, [
		filterBudget,
		filterProfession,
		filterRemote,
		pageIndex,
		search,
		supabase,
	]);

	useEffect(() => {
		const getData = async () => {
			setLoading(true);
			try {
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (!user) {
					router.push("/login");
					return;
				}

				const { data: profile } = await supabase
					.from("profiles")
					.select("role, full_name")
					.eq("id", user.id)
					.single();

				setUser(user);
				setProfile(profile);
			} catch {
				router.push("/login");
				return;
			}
			await fetchJobs();
			setLoading(false);
		};

		getData().catch(() => setLoading(false));
	}, [fetchJobs, router, supabase]);

	// Reset to page 1 when filters change (intentionally omits currentPage to avoid loops)
	const filterKey = `${search}:${filterProfession}:${filterBudget}:${filterRemote}`;
	const prevFilterKey = useRef(filterKey);
	useEffect(() => {
		if (prevFilterKey.current !== filterKey) {
			prevFilterKey.current = filterKey;
			if (currentPage !== 1) {
				const params = new URLSearchParams(searchParams.toString());
				params.delete("page");
				const nextQuery = params.toString();
				router.push(nextQuery ? `/jobs?${nextQuery}` : "/jobs");
			}
		}
	}, [filterKey, currentPage, searchParams, router]);

	const formatBudget = (budget: number, type: string) =>
		type === "hourly" ? `$${budget}/hr` : `$${budget}`;

	const formatDate = (date: string) =>
		new Date(date).toLocaleDateString(userLocale(), {
			day: "numeric",
			month: "short",
			year: "numeric",
		});

	const getJobTypeLabel = (type?: string | null) => {
		switch (type) {
			case "remote":
				return "Remote";
			case "on_site":
				return "On-site";
			case "hybrid":
				return "Hybrid";
			default:
				return type || "";
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
				<div className="max-w-6xl mx-auto px-6 py-8 space-y-4">
					{Array.from({ length: PAGE_SIZE }).map((_, index) => (
						<CardSkeleton key={`jobs-skeleton-${index}`} />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
			<nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
				<h1 className="text-xl font-bold text-gray-900 dark:text-white">
					Survey<span className="text-green-600">ConnectHub</span>
				</h1>
				<div className="flex items-center gap-4">
					<Link
						href={
							profile?.role === "client"
								? "/dashboard/client"
								: "/dashboard/professional"
						}
						className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
					>
						Dashboard
					</Link>
					<span className="text-gray-600 dark:text-gray-300 text-sm">
						{profile?.full_name}
					</span>
				</div>
			</nav>

			<div className="max-w-6xl mx-auto px-6 py-8">
				<div className="mb-8">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
						Browse Jobs
					</h2>
					<p className="text-gray-500 dark:text-gray-400 mt-1">
						{totalCount} open job{totalCount !== 1 ? "s" : ""} available
					</p>
				</div>

				{/* Filters */}
				<div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						<div className="md:col-span-2 relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
							<input
								type="text"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Search jobs..."
								className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 dark:placeholder-gray-400"
							/>
						</div>
						<select
							value={filterProfession}
							onChange={(e) => setFilterProfession(e.target.value)}
							aria-label="Filter by profession"
							className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 dark:placeholder-gray-400"
						>
							<option value="">All Professions</option>
							<option value="land_surveyor">Land Surveyor</option>
							<option value="gis_analyst">GIS Analyst</option>
							<option value="drone_pilot">Drone/UAV Pilot</option>
							<option value="cartographer">Cartographer</option>
							<option value="photogrammetrist">Photogrammetrist</option>
							<option value="lidar_specialist">LiDAR Specialist</option>
							<option value="remote_sensing_analyst">
								Remote Sensing Analyst
							</option>
							<option value="urban_planner">Urban Planner</option>
							<option value="spatial_data_scientist">
								Spatial Data Scientist
							</option>
							<option value="hydrographic_surveyor">
								Hydrographic Surveyor
							</option>
							<option value="mining_surveyor">Mining Surveyor</option>
							<option value="construction_surveyor">
								Construction Surveyor
							</option>
							<option value="environmental_analyst">
								Environmental Analyst
							</option>
							<option value="bim_specialist">BIM Specialist</option>
						</select>
						<select
							value={filterBudget}
							onChange={(e) => setFilterBudget(e.target.value)}
							aria-label="Filter by budget"
							className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 dark:placeholder-gray-400"
						>
							<option value="">Any Budget</option>
							<option value="under500">Under $500</option>
							<option value="500to2000">$500 - $2,000</option>
							<option value="above2000">Above $2,000</option>
						</select>
					</div>
					<div className="mt-4">
						<label className="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={filterRemote}
								onChange={(e) => setFilterRemote(e.target.checked)}
								className="w-4 h-4 text-green-600 rounded dark:text-white dark:placeholder-gray-400"
							/>
							<span className="text-sm text-gray-700 dark:text-gray-300">
								Remote jobs only
							</span>
						</label>
					</div>
				</div>

				{/* Jobs List */}
				{jobs.length === 0 ? (
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-800">
						<div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
							<SlidersHorizontal className="w-7 h-7 text-gray-400" />
						</div>
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
							No jobs found
						</h3>
						<p className="text-gray-500 dark:text-gray-400">
							Try adjusting your search or filters
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{jobs.map((job) => (
							<div
								key={job.id}
								className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 hover:border-green-300 dark:hover:border-green-700 hover:shadow-md transition-all"
							>
								<div className="flex items-start justify-between gap-4">
									<div className="flex-1">
										<div className="flex items-center gap-2 flex-wrap mb-2">
											<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
												{job.title}
											</h3>
											{job.job_type && (
												<span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium px-2 py-1 rounded-full">
													{getJobTypeLabel(job.job_type)}
												</span>
											)}
											{job.required_verification && (
												<span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium px-2 py-1 rounded-full">
													Verified only
												</span>
											)}
										</div>

										<p className="text-green-600 dark:text-green-400 text-sm font-medium mb-2">
											{getProfessionLabel(job.profession_type)}
										</p>

										<p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
											{job.description}
										</p>

										<div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
											<span className="flex items-center gap-1">
												<MapPin className="w-3 h-3" />
												{job.location || "Remote"}
											</span>
											<span className="flex items-center gap-1">
												<Calendar className="w-3 h-3" />
												Posted {formatDate(job.created_at)}
											</span>
											<span className="flex items-center gap-1">
												<User className="w-3 h-3" />
												{job.profiles?.full_name}
											</span>
										</div>
									</div>

									<div className="text-right shrink-0 flex flex-col items-end gap-2">
										<BookmarkButton jobId={job.id} />
										<p className="text-2xl font-bold text-gray-900 dark:text-white">
											{formatBudget(job.budget, job.budget_type)}
										</p>
										<p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
											{job.budget_type === "hourly"
												? "per hour"
												: "fixed price"}
										</p>
										{profile?.role === "professional" && (
											<Link
												href={`/jobs/${job.id}/apply`}
												className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
											>
												Apply Now
											</Link>
										)}
										{profile?.role === "client" && (
											<span className="text-xs text-gray-400 dark:text-gray-500">
												{job.applications_count || 0} applicant(s)
											</span>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				)}

				<div className="flex items-center justify-between mt-8">
					{(() => {
						const start = totalCount === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
						const end = Math.min((pageIndex + 1) * PAGE_SIZE, totalCount);
						return (
							<>
								{pageIndex > 0 ? (
									<button
										onClick={() => {
											const params = new URLSearchParams(
												searchParams.toString(),
											);
											const nextPage = pageIndex;
											if (nextPage <= 1) {
												params.delete("page");
											} else {
												params.set("page", String(nextPage));
											}
											router.push(`/jobs?${params.toString()}`);
										}}
										className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
									>
										← Previous
									</button>
								) : (
									<span />
								)}
								<span className="text-sm text-gray-500">
									Showing {start}–{end} of {totalCount}
								</span>
								{(pageIndex + 1) * PAGE_SIZE < totalCount ? (
									<button
										onClick={() => {
											const params = new URLSearchParams(
												searchParams.toString(),
											);
											const nextPage = pageIndex + 2;
											params.set("page", String(nextPage));
											router.push(`/jobs?${params.toString()}`);
										}}
										className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
									>
										Next →
									</button>
								) : (
									<span />
								)}
							</>
						);
					})()}
				</div>
			</div>
		</div>
	);
}

export default function JobsPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
					<div className="max-w-6xl mx-auto px-6 py-8 space-y-4">
						{Array.from({ length: PAGE_SIZE }).map((_, index) => (
							<CardSkeleton key={`jobs-suspense-${index}`} />
						))}
					</div>
				</div>
			}
		>
			<JobsPageContent />
		</Suspense>
	);
}
