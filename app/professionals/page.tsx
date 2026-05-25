"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Hourglass, Users } from "lucide-react";
import { CardSkeleton } from "@/components/ui/Skeleton";
import type { Profile, ProfessionalProfile } from "@/types/database";

const PAGE_SIZE = 12;

const softwareToolOptions = [
	"ArcGIS Pro",
	"QGIS",
	"ArcGIS Online",
	"Google Earth Engine",
	"GRASS GIS",
	"ENVI",
	"Global Mapper",
	"AutoCAD Civil 3D",
	"Pix4D",
	"Agisoft Metashape",
	"GDAL/OGR",
	"PostGIS",
	"FME",
	"Blender GIS",
	"Other",
];

type ProfessionalRow = Pick<
	ProfessionalProfile,
	| "id"
	| "profession_type"
	| "secondary_profession"
	| "license_number"
	| "years_experience"
	| "verification_status"
	| "software_tools"
	| "created_at"
> & {
	profiles:
		| Pick<Profile, "full_name" | "country" | "email">
		| Pick<Profile, "full_name" | "country" | "email">[]
		| null;
};

function ProfessionalsPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const supabase = useMemo(() => createClient(), []);

	const [professionals, setProfessionals] = useState<ProfessionalRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [profile, setProfile] = useState<any>(null);
	const [search, setSearch] = useState("");
	const [filterProfession, setFilterProfession] = useState("");
	const [filterSoftware, setFilterSoftware] = useState("");
	const [totalCount, setTotalCount] = useState(0);

	const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10);
	const currentPage =
		Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
	const pageIndex = currentPage - 1;

	useEffect(() => {
		const getData = async () => {
			setLoading(true);
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				router.push("/login");
				return;
			}

			const { data: profileData } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", user.id)
				.single();

			setProfile(profileData);

			// Removed .eq('verification_status', 'verified') — show all professionals
			let query = supabase.from("professional_profiles").select(
				`
					id,
					profession_type,
					secondary_profession,
					license_number,
					years_experience,
					verification_status,
					software_tools,
					created_at,
					profiles (
						full_name,
						country,
						email
					)
				`,
				{ count: "exact" },
			);

			if (search.trim()) {
				const term = search.trim();
				query = query.or(
					`profiles.full_name.ilike.%${term}%,profession_type.ilike.%${term}%`,
				);
			}

			if (filterProfession) {
				query = query.eq("profession_type", filterProfession);
			}

			if (filterSoftware) {
				query = query.contains("software_tools", [filterSoftware]);
			}

			const { data, count, error } = await query
				.order("created_at", { ascending: false })
				.range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);

			if (error) {
				console.error("Failed to fetch professionals:", error);
				setProfessionals([]);
				setTotalCount(0);
				setLoading(false);
				return;
			}

			setProfessionals(data || []);
			setTotalCount(count || 0);
			setLoading(false);
		};
		getData();
	}, [
		currentPage,
		pageIndex,
		router,
		supabase,
		search,
		filterProfession,
		filterSoftware,
	]);

	useEffect(() => {
		if (currentPage === 1) return;
		const params = new URLSearchParams(searchParams.toString());
		params.delete("page");
		const nextQuery = params.toString();
		router.push(nextQuery ? `/professionals?${nextQuery}` : "/professionals");
	}, [
		currentPage,
		filterProfession,
		filterSoftware,
		router,
		search,
		searchParams,
	]);

	const getProfessionLabel = (type: string) => {
		const labels: Record<string, string> = {
			land_surveyor: "Land Surveyor",
			gis_analyst: "GIS Analyst",
			drone_pilot: "Drone/UAV Pilot",
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
			other: "Other",
		};
		return labels[type] || type;
	};

	const getInitials = (name: string) => {
		if (!name) return "??";
		const parts = name.trim().split(" ");
		if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
				<div className="max-w-6xl mx-auto px-6 py-8">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{Array.from({ length: PAGE_SIZE }).map((_, index) => (
							<CardSkeleton key={`professionals-skeleton-${index}`} />
						))}
					</div>
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
				<Link
					href={
						profile?.role === "client"
							? "/dashboard/client"
							: "/dashboard/professional"
					}
					className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
				>
					← Dashboard
				</Link>
			</nav>

			<div className="max-w-6xl mx-auto px-6 py-8">
				<div className="mb-8">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
						Browse Professionals
					</h2>
					<p className="text-gray-500 dark:text-gray-400 mt-1">
						{totalCount} professional{totalCount !== 1 ? "s" : ""} available
					</p>
				</div>

				<div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search by name or profession..."
							className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 dark:placeholder-gray-400"
						/>
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
							value={filterSoftware}
							onChange={(e) => setFilterSoftware(e.target.value)}
							aria-label="Filter by GIS software"
							className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 dark:placeholder-gray-400"
						>
							<option value="">All Software</option>
							{softwareToolOptions.map((tool) => (
								<option
									key={tool}
									value={tool}
								>
									{tool}
								</option>
							))}
						</select>
					</div>
				</div>

				{professionals.length === 0 ? (
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center border border-gray-100 dark:border-gray-800">
						<div className="flex justify-center mb-4">
							<Users className="w-10 h-10 text-gray-400" />
						</div>
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
							No professionals found
						</h3>
						<p className="text-gray-500 dark:text-gray-400">
							Try adjusting your search or filters
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{professionals.map((prof) => {
							const profileInfo = Array.isArray(prof.profiles)
								? prof.profiles[0]
								: prof.profiles;
							return (
								<div
									key={prof.id}
									className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 hover:border-green-300 dark:hover:border-green-700 hover:shadow-md transition-all"
								>
									<div className="flex items-center gap-3 mb-4">
										<div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
											<span className="text-green-700 dark:text-green-300 font-bold">
												{getInitials(profileInfo?.full_name || "")}
											</span>
										</div>
										<div>
											<p className="font-semibold text-gray-900 dark:text-white">
												{profileInfo?.full_name}
											</p>
											<p className="text-xs text-gray-500 dark:text-gray-400">
												{profileInfo?.country}
											</p>
										</div>
										{prof.verification_status === "verified" ? (
											<span className="ml-auto bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium px-2 py-1 rounded-full">
												<span className="inline-flex items-center gap-1">
													<CheckCircle2 className="w-3.5 h-3.5" />
													Verified
												</span>
											</span>
										) : (
											<span className="ml-auto bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium px-2 py-1 rounded-full">
												<span className="inline-flex items-center gap-1">
													<Hourglass className="w-3.5 h-3.5" />
													Unverified
												</span>
											</span>
										)}
									</div>

									<p className="text-green-600 dark:text-green-400 text-sm font-medium mb-2">
										{getProfessionLabel(prof.profession_type)}
									</p>

									{prof.years_experience > 0 && (
										<p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
											{prof.years_experience} year
											{prof.years_experience !== 1 ? "s" : ""} experience
										</p>
									)}

									{Array.isArray(prof.software_tools) &&
										prof.software_tools.length > 0 && (
											<div className="flex flex-wrap gap-2 mb-3">
												{prof.software_tools.slice(0, 4).map((tool) => (
													<span
														key={tool}
														className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs px-2 py-0.5 rounded-full"
													>
														{tool}
													</span>
												))}
												{prof.software_tools.length > 4 && (
													<span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs px-2 py-0.5 rounded-full">
														+{prof.software_tools.length - 4} more
													</span>
												)}
											</div>
										)}

									{prof.license_number && (
										<p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
											License: {prof.license_number}
										</p>
									)}

									<Link
										href={`/professionals/${prof.id}`}
										className="block w-full text-center bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
									>
										View Profile
									</Link>
								</div>
							);
						})}
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
											router.push(`/professionals?${params.toString()}`);
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
											router.push(`/professionals?${params.toString()}`);
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

export default function ProfessionalsPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
					<div className="max-w-6xl mx-auto px-6 py-8">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{Array.from({ length: PAGE_SIZE }).map((_, index) => (
								<CardSkeleton key={`professionals-suspense-${index}`} />
							))}
						</div>
					</div>
				</div>
			}
		>
			<ProfessionalsPageContent />
		</Suspense>
	);
}
