"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MapPin, Calendar, DollarSign, Users } from "lucide-react";

export default function ClientJobsPage() {
	const router = useRouter();
	const supabase = useMemo(() => createClient(), []);
	const [jobs, setJobs] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

	useEffect(() => {
		const getData = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				router.push("/login");
				return;
			}

			const { data } = await supabase
				.from("jobs")
				.select("*")
				.eq("client_id", user.id)
				.order("created_at", { ascending: false });

			setJobs(data || []);
			setLoading(false);
		};
		getData();
	}, [router, supabase]);

	const formatDate = (date: string) =>
		new Date(date).toLocaleDateString("en-GB", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});

	const handleDelete = async (jobId: string) => {
		const confirmed = window.confirm("Delete this job? This cannot be undone.");
		if (!confirmed) return;

		setDeletingJobId(jobId);
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			router.push("/login");
			return;
		}

		const { error } = await supabase
			.from("jobs")
			.delete()
			.eq("id", jobId)
			.eq("client_id", user.id);

		if (error) {
			console.error("Failed to delete job", error);
			window.alert("Failed to delete job. Please try again.");
			setDeletingJobId(null);
			return;
		}

		setJobs((prev) => prev.filter((job) => job.id !== jobId));
		setDeletingJobId(null);
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
				<div className="text-gray-500 dark:text-gray-400">Loading...</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
			<nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
				<h1 className="text-xl font-bold text-gray-900 dark:text-white">
					Survey<span className="text-green-600">ConnectHub</span>
				</h1>
				<Link
					href="/dashboard/client"
					className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
				>
					← Back to Dashboard
				</Link>
			</nav>

			<div className="max-w-5xl mx-auto px-6 py-8">
				<div className="flex items-center justify-between mb-8">
					<div>
						<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
							My Posted Jobs
						</h2>
						<p className="text-gray-500 dark:text-gray-400 mt-1">
							{jobs.length} job{jobs.length !== 1 ? "s" : ""} posted
						</p>
					</div>
					<Link
						href="/jobs/post"
						className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
					>
						+ Post New Job
					</Link>
				</div>

				{jobs.length === 0 ? (
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center border border-gray-100 dark:border-gray-800">
						<div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
							<Users className="w-7 h-7 text-gray-400" />
						</div>
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
							No jobs posted yet
						</h3>
						<p className="text-gray-500 dark:text-gray-400 mb-6">
							Post your first job to start receiving applications
						</p>
						<Link
							href="/jobs/post"
							className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
						>
							Post a Job
						</Link>
					</div>
				) : (
					<div className="space-y-4">
						{jobs.map((job) => (
							<div
								key={job.id}
								className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 hover:border-green-300 dark:hover:border-green-700 transition-all"
							>
								<div className="flex items-start justify-between gap-4">
									<div className="flex-1">
										<div className="flex items-center gap-2 flex-wrap mb-2">
											<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
												{job.title}
											</h3>
											<span
												className={`text-xs font-medium px-2 py-1 rounded-full ${
													job.status === "open"
														? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
														: job.status === "in_progress"
															? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
															: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
												}`}
											>
												{job.status === "open"
													? "Open"
													: job.status === "in_progress"
														? "In Progress"
														: "Closed"}
											</span>
										</div>

										<p className="text-gray-500 dark:text-gray-400 text-sm mb-3 line-clamp-2">
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
												<DollarSign className="w-3 h-3" />${job.budget}{" "}
												{job.budget_type}
											</span>
										</div>
									</div>

									<div className="text-right shrink-0 space-y-2">
										<div className="bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-2 text-center">
											<p className="text-2xl font-bold text-green-600 dark:text-green-400">
												{job.applications_count || 0}
											</p>
											<p className="text-xs text-green-700 dark:text-green-500">
												applicant{job.applications_count !== 1 ? "s" : ""}
											</p>
										</div>
										<Link
											href={`/dashboard/client/jobs/${job.id}/applications`}
											className="block bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors text-center"
										>
											View Applications
										</Link>
										{job.status === "open" && (
											<button
												type="button"
												onClick={() => handleDelete(job.id)}
												disabled={deletingJobId === job.id}
												className="block w-full text-sm font-semibold px-4 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
											>
												{deletingJobId === job.id
													? "Deleting..."
													: "Delete Job"}
											</button>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
