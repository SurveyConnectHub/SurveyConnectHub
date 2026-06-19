"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/ui/BackButton";
import { CardSkeleton } from "@/components/ui/Skeleton";
import BookmarkButton from "@/components/BookmarkButton";
import {
	MapPin,
	Calendar,
	DollarSign,
	User,
	Bookmark,
} from "lucide-react";
import type { Job, Profile } from "@/types/database";

type SavedJobWithJob = {
	id: string;
	user_id: string;
	job_id: string;
	created_at: string;
	jobs: Job & { profiles: Pick<Profile, "full_name" | "country"> | null };
};

const formatDate = (date: string) =>
	new Date(date).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});

const getProfessionLabel = (profession: string) => {
	const labels: Record<string, string> = {
		land_surveyor: "Land Surveyor",
		gis_analyst: "GIS Analyst",
		drone_pilot: "Drone Pilot",
		cartographer: "Cartographer",
		photogrammetrist: "Photogrammetrist",
		lidar_specialist: "LiDAR Specialist",
		remote_sensing_analyst: "Remote Sensing Analyst",
		urban_planner: "Urban Planner",
		spatial_data_scientist: "Spatial Data Scientist",
		hydrographic_surveyor: "Hydrographic Surveyor",
		mining_surveyor: "Mining Surveyor",
		construction_surveyor: "Construction Surveyor",
		environmental_analyst: "Environmental Analyst",
		bim_specialist: "BIM Specialist",
	};
	return labels[profession] || profession;
};

const formatBudget = (budget: number, type: string) => {
	if (type === "hourly") return `$${budget}/hr`;
	return `$${budget.toLocaleString()}`;
};

export default function ProfessionalSavedJobsPage() {
	const router = useRouter();
	const supabase = useMemo(() => createClient(), []);
	const [savedJobs, setSavedJobs] = useState<SavedJobWithJob[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const getData = async () => {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) {
				router.push("/login");
				return;
			}

			const { data } = await supabase
				.from("saved_jobs")
				.select(`*, jobs(*)`)
				.eq("user_id", user.id)
				.order("created_at", { ascending: false });

			setSavedJobs(data || []);
			setLoading(false);
		};
		getData();
	}, [router, supabase]);

	if (loading) {
		return (
			<div className="max-w-6xl mx-auto px-6 py-8">
				<BackButton href="/dashboard/professional" />
				<div className="flex items-center gap-3 mb-8 mt-4">
					<Bookmark className="w-6 h-6 text-green-600" />
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white">Saved Jobs</h1>
				</div>
				<div className="space-y-4">
					<CardSkeleton />
					<CardSkeleton />
					<CardSkeleton />
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-6xl mx-auto px-6 py-8">
			<BackButton href="/dashboard/professional" />
			<div className="flex items-center gap-3 mb-8 mt-4">
				<Bookmark className="w-6 h-6 text-green-600" />
				<h1 className="text-2xl font-bold text-gray-900 dark:text-white">Saved Jobs</h1>
				<span className="text-sm text-gray-500 dark:text-gray-400">
					({savedJobs.length} saved)
				</span>
			</div>

			{savedJobs.length === 0 ? (
				<div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-800">
					<div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
						<Bookmark className="w-7 h-7 text-gray-400" />
					</div>
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
						No saved jobs yet
					</h3>
					<p className="text-gray-500 dark:text-gray-400 mb-6">
						Browse jobs and bookmark the ones you are interested in
					</p>
					<Link
						href="/jobs"
						className="inline-block bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
					>
						Browse Jobs
					</Link>
				</div>
			) : (
				<div className="space-y-4">
					{savedJobs.map((saved) => {
						const job = saved.jobs;
						return (
							<div
								key={saved.id}
								className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 hover:border-green-300 dark:hover:border-green-700 hover:shadow-md transition-all"
							>
								<div className="flex items-start justify-between gap-4">
									<div className="flex-1">
										<div className="flex items-center gap-2 flex-wrap mb-2">
											<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
												{job.title}
											</h3>
											<span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium px-2 py-1 rounded-full">
												{job.job_type}
											</span>
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
										<Link
											href={`/jobs/${job.id}/apply`}
											className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
										>
											Apply Now
										</Link>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
