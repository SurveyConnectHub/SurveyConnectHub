"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { ProfileSkeleton, CardSkeleton } from "@/components/ui/Skeleton";
import BackButton from "@/components/ui/BackButton";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { PortfolioItem } from "@/types/database";

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

const PORTFOLIO_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PORTFOLIO_IMAGE_SIZE = 5 * 1024 * 1024;

export default function ProfessionalProfilePage() {
	const router = useRouter();
	const { id: rawId } = useParams();
	const id = rawId as string;
	const supabase = useMemo(() => createClient(), []);

	const [prof, setProf] = useState<any>(null);
	const [profile, setProfile] = useState<any>(null);
	const [viewerRole, setViewerRole] = useState<string>("");
	const [viewerId, setViewerId] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);
	const [reviews, setReviews] = useState<any[]>([]);
	const [eligibleContracts, setEligibleContracts] = useState<any[]>([]);
	const [selectedContract, setSelectedContract] = useState<string>("");
	const [rating, setRating] = useState(0);
	const [comment, setComment] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [reviewSuccess, setReviewSuccess] = useState(false);
	const [reviewError, setReviewError] = useState<string | null>(null);
	const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
	const [portfolioLoading, setPortfolioLoading] = useState(true);
	const [portfolioError, setPortfolioError] = useState("");
	const [portfolioPreviewUrls, setPortfolioPreviewUrls] = useState<
		Record<string, string>
	>({});
	const [editorOpen, setEditorOpen] = useState(false);
	const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
	const [portfolioSaving, setPortfolioSaving] = useState(false);
	const [previewImageFile, setPreviewImageFile] = useState<File | null>(null);
	const [previewImageError, setPreviewImageError] = useState("");
	const [portfolioForm, setPortfolioForm] = useState({
		title: "",
		description: "",
		project_type: "",
		data_sources: "",
		crs: "",
		scale_resolution: "",
		software_used: [] as string[],
		file_url: "",
		map_embed_html: "",
		preview_image_url: "",
	});

	const getProfessionLabel = (type: string) => {
		const labels: any = {
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

	const avgRating = reviews.length
		? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(
				1,
			)
		: null;
	const isOwner = viewerId === id;

	const buildSignedUrl = useCallback(async (path: string) => {
		if (!path) return "";
		if (path.startsWith("http")) return path;
		const { data } = await supabase.storage
			.from("portfolio-images")
			.createSignedUrl(path, 60 * 60);
		return data?.signedUrl || "";
	}, [supabase]);

	const loadPortfolioItems = useCallback(async (ownerId: string) => {
		setPortfolioLoading(true);
		setPortfolioError("");
		try {
			const { data, error: loadError } = await supabase
				.from("portfolio_items")
				.select("*")
				.eq("professional_id", ownerId)
				.order("created_at", { ascending: false });

			if (loadError) throw loadError;
			setPortfolioItems(data || []);

			const previews: Record<string, string> = {};
			await Promise.all(
				(data || []).map(async (item) => {
					const url = await buildSignedUrl(item.preview_image_url);
					if (url) previews[item.id] = url;
				}),
			);
			setPortfolioPreviewUrls(previews);
		} catch (err: any) {
			console.error("Failed to load portfolio", err);
			setPortfolioError("Failed to load portfolio items.");
		} finally {
			setPortfolioLoading(false);
		}
	}, [buildSignedUrl, supabase]);

	const openEditor = (item?: PortfolioItem) => {
		if (item) {
			setEditingItem(item);
			setPortfolioForm({
				title: item.title || "",
				description: item.description || "",
				project_type: item.project_type || "",
				data_sources: item.data_sources || "",
				crs: item.crs || "",
				scale_resolution: item.scale_resolution || "",
				software_used: item.software_used || [],
				file_url: item.file_url || "",
				map_embed_html: item.map_embed_html || "",
				preview_image_url: item.preview_image_url || "",
			});
		} else {
			setEditingItem(null);
			setPortfolioForm({
				title: "",
				description: "",
				project_type: "",
				data_sources: "",
				crs: "",
				scale_resolution: "",
				software_used: [],
				file_url: "",
				map_embed_html: "",
				preview_image_url: "",
			});
		}
		setPreviewImageFile(null);
		setPreviewImageError("");
		setEditorOpen(true);
	};

	const resetEditor = () => {
		setEditorOpen(false);
		setEditingItem(null);
		setPreviewImageFile(null);
		setPreviewImageError("");
	};

	const handleImageChange = (file: File | null) => {
		setPreviewImageError("");
		if (!file) {
			setPreviewImageFile(null);
			return;
		}

		if (!PORTFOLIO_IMAGE_TYPES.includes(file.type)) {
			setPreviewImageError("Only JPG, PNG, or WebP images are allowed.");
			setPreviewImageFile(null);
			return;
		}

		if (file.size > MAX_PORTFOLIO_IMAGE_SIZE) {
			const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
			setPreviewImageError(`Image is ${sizeMB}MB — max size is 5MB.`);
			setPreviewImageFile(null);
			return;
		}

		setPreviewImageFile(file);
	};

	useEffect(() => {
		if (!id || typeof id !== "string") {
			setNotFound(true);
			setLoading(false);
			return;
		}

		const getData = async () => {
			try {
				const {
					data: { user },
					error: authError,
				} = await supabase.auth.getUser();
				if (authError || !user) {
					router.push("/login");
					return;
				}

				setViewerId(user.id);

				const { data: viewerProfile, error: viewerProfileError } =
					await supabase
						.from("profiles")
						.select("role")
						.eq("id", user.id)
						.single();

				if (viewerProfileError) {
					console.error("Failed to load viewer profile", viewerProfileError);
				}

				setViewerRole(viewerProfile?.role || "");

				const [professionalResult, profileResult] = await Promise.all([
					supabase
						.from("professional_profiles")
						.select("*")
						.eq("id", id)
						.maybeSingle(),
					supabase
						.from("profiles")
						.select("full_name, country, bio")
						.eq("id", id)
						.maybeSingle(),
				]);

				if (profileResult.error) {
					console.error("Failed to load public profile", profileResult.error);
					setNotFound(true);
					return;
				}

				if (!profileResult.data) {
					setNotFound(true);
					return;
				}

				if (professionalResult.error) {
					console.error(
						"Failed to load professional details",
						professionalResult.error,
					);
				}

				setProf(professionalResult.data);
				setProfile(profileResult.data);

				await loadPortfolioItems(id);

				const { data: reviewsData, error: reviewsError } = await supabase
					.from("reviews")
					.select("*, profiles!reviews_reviewer_id_fkey(full_name)")
					.eq("reviewee_id", id)
					.order("created_at", { ascending: false });

				if (reviewsError) {
					console.error("Failed to load reviews", reviewsError);
				}

				setReviews(reviewsData || []);

				if (viewerProfile?.role === "client") {
					const { data: contractsData, error: contractsError } = await supabase
						.from("contracts")
						.select("id, jobs(title)")
						.eq("client_id", user.id)
						.eq("professional_id", id)
						.not("payment_released_at", "is", null);

					if (contractsError) {
						console.error("Failed to load eligible contracts", contractsError);
					}

					const { data: existingReviews, error: existingReviewsError } =
						await supabase
							.from("reviews")
							.select("contract_id")
							.eq("reviewer_id", user.id)
							.eq("reviewee_id", id);

					if (existingReviewsError) {
						console.error(
							"Failed to load existing reviews",
							existingReviewsError,
						);
					}

					const reviewedContractIds = (existingReviews || []).map(
						(r: any) => r.contract_id,
					);
					const eligible = (contractsData || []).filter(
						(c: any) => !reviewedContractIds.includes(c.id),
					);

					setEligibleContracts(eligible);
					if (eligible.length > 0) setSelectedContract(eligible[0].id);
				}
			} catch (err) {
				console.error("Unexpected error loading professional profile", err);
				setNotFound(true);
			} finally {
				setLoading(false);
			}
		};

		getData();
	}, [id, loadPortfolioItems, router, supabase]);

	const handleSubmitReview = async () => {
		if (!rating || !selectedContract) return;
		setSubmitting(true);
		setReviewError(null);

		const { error } = await supabase.from("reviews").insert({
			contract_id: selectedContract,
			reviewer_id: viewerId,
			reviewee_id: id,
			rating,
			comment: comment.trim() || null,
		});

		if (error) {
			setReviewError(error.message || "Failed to submit review");
			setTimeout(() => setReviewError(null), 3000);
			setSubmitting(false);
			return;
		}

		const { data: reviewsData } = await supabase
			.from("reviews")
			.select("*, profiles!reviews_reviewer_id_fkey(full_name)")
			.eq("reviewee_id", id)
			.order("created_at", { ascending: false });

		setReviews(reviewsData || []);
		setEligibleContracts((prev) =>
			prev.filter((c) => c.id !== selectedContract),
		);
		setRating(0);
		setComment("");
		setReviewSuccess(true);
		setTimeout(() => setReviewSuccess(false), 3000);
		setSubmitting(false);
	};

	const handlePortfolioSave = async () => {
		setPortfolioSaving(true);
		setPortfolioError("");

		if (!portfolioForm.title.trim()) {
			setPortfolioError("Project title is required.");
			setPortfolioSaving(false);
			return;
		}

		if (!editingItem && !previewImageFile) {
			setPortfolioError("Preview image is required.");
			setPortfolioSaving(false);
			return;
		}

		try {
			let previewPath = portfolioForm.preview_image_url;
			if (previewImageFile) {
				const cleanName = previewImageFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
				previewPath = `${viewerId}/portfolio-preview-${Date.now()}-${cleanName}`;
				const { error: uploadError } = await supabase.storage
					.from("portfolio-images")
					.upload(previewPath, previewImageFile, {
						contentType: previewImageFile.type,
						upsert: false,
					});

				if (uploadError) throw uploadError;
			}

			const endpoint = editingItem
				? `/api/portfolio/${editingItem.id}`
				: "/api/portfolio";
			const method = editingItem ? "PATCH" : "POST";
			const response = await fetch(endpoint, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: portfolioForm.title,
					description: portfolioForm.description,
					project_type: portfolioForm.project_type,
					data_sources: portfolioForm.data_sources,
					crs: portfolioForm.crs,
					scale_resolution: portfolioForm.scale_resolution,
					software_used: portfolioForm.software_used,
					file_url: portfolioForm.file_url,
					preview_image_url: previewPath,
					map_embed_html: portfolioForm.map_embed_html,
				}),
			});

			const result = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(result?.error || "Failed to save portfolio item");
			}

			const savedItem = result.item as PortfolioItem;
			setPortfolioItems((prev) =>
				editingItem
					? prev.map((item) => (item.id === savedItem.id ? savedItem : item))
					: [savedItem, ...prev],
			);

			if (previewPath) {
				const signedUrl = await buildSignedUrl(previewPath);
				setPortfolioPreviewUrls((prev) => ({
					...prev,
					[savedItem.id]: signedUrl,
				}));
			}

			resetEditor();
		} catch (err: any) {
			console.error("Portfolio save failed", err);
			setPortfolioError(err?.message || "Failed to save portfolio item.");
		} finally {
			setPortfolioSaving(false);
		}
	};

	const handlePortfolioDelete = async (item: PortfolioItem) => {
		if (!confirm("Delete this portfolio item?")) return;
		setPortfolioSaving(true);
		setPortfolioError("");
		try {
			const response = await fetch(`/api/portfolio/${item.id}`, {
				method: "DELETE",
			});
			if (!response.ok) {
				const result = await response.json().catch(() => ({}));
				throw new Error(result?.error || "Failed to delete portfolio item");
			}
			setPortfolioItems((prev) => prev.filter((entry) => entry.id !== item.id));
			setPortfolioPreviewUrls((prev) => {
				const next = { ...prev };
				delete next[item.id];
				return next;
			});
		} catch (err: any) {
			console.error("Portfolio delete failed", err);
			setPortfolioError(err?.message || "Failed to delete portfolio item.");
		} finally {
			setPortfolioSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
				<div className="max-w-3xl mx-auto px-6 py-10">
					<ProfileSkeleton />
				</div>
			</div>
		);
	}

	if (notFound) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
				<div className="text-center">
					<p className="text-gray-500 dark:text-gray-400 mb-4">
						Professional not found
					</p>
					<Link
						href="/professionals"
						className="text-green-600 hover:underline"
					>
						Back to Professionals
					</Link>
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
				<BackButton
					href="/professionals"
					label="Browse Professionals"
				/>
			</nav>

			<div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
				{/* Profile Header */}
				<div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-100 dark:border-gray-800">
					<div className="flex items-start gap-6">
						<div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
							<span className="text-green-700 dark:text-green-300 text-2xl font-bold">
								{getInitials(profile?.full_name || "")}
							</span>
						</div>
						<div className="flex-1">
							<div className="flex items-center gap-3 flex-wrap mb-1">
								<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
									{profile?.full_name}
								</h2>
								{prof?.verification_status === "verified" ? (
									<span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium px-3 py-1 rounded-full">
										Verified
									</span>
								) : (
									<span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium px-3 py-1 rounded-full">
										Unverified
									</span>
								)}
							</div>
							{prof?.profession_type && (
								<p className="text-green-600 dark:text-green-400 font-medium mb-1">
									{getProfessionLabel(prof?.profession_type)}
								</p>
							)}
							<p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
								{profile?.country || "Location not specified"}
							</p>
							{avgRating && (
								<div className="flex items-center gap-2">
									<div className="flex">
										{[1, 2, 3, 4, 5].map((star) => (
											<span
												key={star}
												className={`text-lg ${Number(avgRating) >= star ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"}`}
											>
												&#9733;
											</span>
										))}
									</div>
									<span className="text-sm font-semibold text-gray-900 dark:text-white">
										{avgRating}
									</span>
									<span className="text-xs text-gray-500 dark:text-gray-400">
										({reviews.length} review{reviews.length !== 1 ? "s" : ""})
									</span>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Portfolio Overview */}
				{prof && (
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 space-y-4">
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
							Portfolio Overview
						</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{prof?.years_experience > 0 && (
								<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
									<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
										Experience
									</p>
									<p className="font-semibold text-gray-900 dark:text-white">
										{prof.years_experience} year
										{prof.years_experience !== 1 ? "s" : ""}
									</p>
								</div>
							)}
							{prof?.license_number && (
								<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
									<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
										License Number
									</p>
									<p className="font-semibold text-gray-900 dark:text-white">
										{prof.license_number}
									</p>
								</div>
							)}
							{prof?.profession_type && (
								<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
									<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
										Profession
									</p>
									<p className="font-semibold text-gray-900 dark:text-white">
										{getProfessionLabel(prof.profession_type)}
									</p>
								</div>
							)}
							{prof?.software_tools?.length > 0 && (
								<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
									<p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
										Software &amp; Tools
									</p>
									<div className="flex flex-wrap gap-2">
										{prof.software_tools.map((tool: string) => (
											<span
												key={tool}
												className="px-2 py-1 rounded-full bg-green-600 text-white text-xs font-medium"
											>
												{tool}
											</span>
										))}
									</div>
								</div>
							)}
							{prof?.secondary_profession && (
								<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
									<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
										Secondary Profession
									</p>
									<p className="font-semibold text-gray-900 dark:text-white">
										{getProfessionLabel(prof.secondary_profession)}
									</p>
								</div>
							)}
						</div>

						{profile?.bio && (
							<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
								<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
									About
								</p>
								<p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
									{profile.bio}
								</p>
							</div>
						)}
					</div>
				)}

						{prof && (
							<div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 space-y-4">
								<div className="flex items-center justify-between gap-4 flex-wrap">
									<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
										Portfolio Projects
									</h3>
									{isOwner && (
										<button
											type="button"
											onClick={() => openEditor()}
											className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
										>
											<Plus className="w-4 h-4" />
											Add Portfolio Item
										</button>
									)}
								</div>

								{portfolioError && (
									<div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
										{portfolioError}
									</div>
								)}

								{portfolioLoading ? (
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<CardSkeleton />
										<CardSkeleton />
									</div>
								) : portfolioItems.length === 0 ? (
									<p className="text-sm text-gray-500 dark:text-gray-400">
										No portfolio items yet.
									</p>
								) : (
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										{portfolioItems.map((item) => (
											<div
												key={item.id}
												className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-gray-900"
											>
												{portfolioPreviewUrls[item.id] && (
													<div className="relative w-full h-44">
														<Image
															src={portfolioPreviewUrls[item.id]}
															alt={item.title || "Portfolio preview"}
															fill
															sizes="(max-width: 768px) 100vw, 50vw"
															className="object-cover"
														/>
													</div>
												)}
												<div className="p-4 space-y-3">
													<div>
														<p className="text-sm font-semibold text-gray-900 dark:text-white">
															{item.title || "Untitled project"}
														</p>
														{item.description && (
															<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
																{item.description}
															</p>
														)}
													</div>

													<div className="flex flex-wrap gap-2">
														{item.project_type && (
															<span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
																{item.project_type}
															</span>
														)}
														{item.crs && (
															<span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
																{item.crs}
															</span>
														)}
														{item.scale_resolution && (
															<span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
																{item.scale_resolution}
															</span>
														)}
													</div>

													{Array.isArray(item.software_used) && item.software_used.length > 0 && (
														<div className="flex flex-wrap gap-2">
															{item.software_used.map((tool) => (
																<span
																	key={tool}
																	className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full"
																>
																	{tool}
																</span>
															))}
														</div>
													)}

													{item.map_embed_html && (
														<div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
															<div
																className="w-full h-56"
																dangerouslySetInnerHTML={{ __html: item.map_embed_html }}
															/>
														</div>
													)}

													{isOwner && (
														<div className="flex items-center gap-3 text-sm pt-1">
															<button
																type="button"
																onClick={() => openEditor(item)}
																className="inline-flex items-center gap-1 text-green-600 hover:text-green-700"
															>
																<Pencil className="w-4 h-4" />
																Edit
															</button>
															<button
																type="button"
																onClick={() => handlePortfolioDelete(item)}
																className="inline-flex items-center gap-1 text-red-500 hover:text-red-600"
															>
																<Trash2 className="w-4 h-4" />
																Delete
															</button>
														</div>
													)}
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						)}

				{!prof && (
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
						<p className="text-gray-500 dark:text-gray-400 text-sm">
							This professional has not completed their profile yet.
						</p>
					</div>
				)}

				{/* Leave a Review */}
				{viewerRole === "client" && eligibleContracts.length > 0 && (
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
							Leave a Review
						</h3>

						{eligibleContracts.length > 1 && (
							<div className="mb-4">
								<label
									htmlFor="review-contract-select"
									className="text-sm text-gray-600 dark:text-gray-400 mb-1 block"
								>
									Select Contract
								</label>
								<select
									id="review-contract-select"
									value={selectedContract}
									onChange={(e) => setSelectedContract(e.target.value)}
									className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 dark:placeholder-gray-400"
								>
									{eligibleContracts.map((c: any) => (
										<option
											key={c.id}
											value={c.id}
										>
											{c.jobs?.title}
										</option>
									))}
								</select>
							</div>
						)}

						<div className="mb-4">
							<label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
								Rating
							</label>
							<div className="flex gap-1">
								{[1, 2, 3, 4, 5].map((star) => (
									<button
										key={star}
										onClick={() => setRating(star)}
										className={`text-3xl transition-colors ${rating >= star ? "text-yellow-400" : "text-gray-300 dark:text-gray-600 hover:text-yellow-300"}`}
									>
										&#9733;
									</button>
								))}
							</div>
						</div>

						<div className="mb-4">
							<label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
								Review (optional)
							</label>
							<textarea
								value={comment}
								onChange={(e) => setComment(e.target.value)}
								placeholder="Share your experience working with this professional..."
								rows={3}
								className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none text-sm"
							/>
						</div>

						{reviewSuccess && (
							<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 mb-4">
								<p className="text-green-700 dark:text-green-400 text-sm font-medium">
									Review submitted successfully!
								</p>
							</div>
						)}

						{reviewError && (
							<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4">
								<p className="text-red-700 dark:text-red-400 text-sm font-medium">
									{reviewError}
								</p>
							</div>
						)}

						<button
							onClick={handleSubmitReview}
							disabled={!rating || submitting}
							className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
						>
							{submitting ? "Submitting..." : "Submit Review"}
						</button>
					</div>
				)}

				{/* Reviews Section */}
				<div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
						Reviews {reviews.length > 0 && `(${reviews.length})`}
					</h3>
					{reviews.length === 0 ? (
						<p className="text-gray-500 dark:text-gray-400 text-sm">
							No reviews yet.
						</p>
					) : (
						<div className="space-y-4">
							{reviews.map((review) => (
								<div
									key={review.id}
									className="border-b border-gray-100 dark:border-gray-800 last:border-0 pb-4 last:pb-0"
								>
									<div className="flex items-center justify-between mb-2">
										<p className="font-medium text-gray-900 dark:text-white text-sm">
											{review.profiles?.full_name || "Anonymous"}
										</p>
										<div className="flex">
											{[1, 2, 3, 4, 5].map((star) => (
												<span
													key={star}
													className={`text-sm ${review.rating >= star ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"}`}
												>
													&#9733;
												</span>
											))}
										</div>
									</div>
									{review.comment && (
										<p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
											{review.comment}
										</p>
									)}
									<p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
										{new Date(review.created_at).toLocaleDateString("en-GB", {
											day: "numeric",
											month: "short",
											year: "numeric",
										})}
									</p>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Hire Section */}
				{viewerRole === "client" && (
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
							Hire this Professional
						</h3>
						<p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
							Post a job and this professional can apply, or browse your
							existing jobs to invite them.
						</p>
						<Link
							href="/jobs/post"
							className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
						>
							Post a Job
						</Link>
					</div>
				)}
			</div>

			{editorOpen && isOwner && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center px-4 z-50">
					<div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 border border-gray-100 dark:border-gray-800">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
								{editingItem ? "Edit Portfolio Item" : "Add Portfolio Item"}
							</h3>
							<button
								type="button"
								onClick={resetEditor}
								className="text-sm text-gray-500 hover:text-gray-700"
							>
								Close
							</button>
						</div>

						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Project Title <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									value={portfolioForm.title}
									onChange={(e) =>
										setPortfolioForm((prev) => ({
											...prev,
											title: e.target.value,
										}))
									}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Description
								</label>
								<textarea
									rows={3}
									value={portfolioForm.description}
									onChange={(e) =>
										setPortfolioForm((prev) => ({
											...prev,
											description: e.target.value,
										}))
									}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white resize-none"
								/>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										Project Type
									</label>
									<input
										type="text"
										value={portfolioForm.project_type}
										onChange={(e) =>
											setPortfolioForm((prev) => ({
												...prev,
												project_type: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										Data Sources
									</label>
									<input
										type="text"
										value={portfolioForm.data_sources}
										onChange={(e) =>
											setPortfolioForm((prev) => ({
												...prev,
												data_sources: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										CRS
									</label>
									<input
										type="text"
										value={portfolioForm.crs}
										onChange={(e) =>
											setPortfolioForm((prev) => ({
												...prev,
												crs: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										Scale / Resolution
									</label>
									<input
										type="text"
										value={portfolioForm.scale_resolution}
										onChange={(e) =>
											setPortfolioForm((prev) => ({
												...prev,
												scale_resolution: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"
									/>
								</div>
							</div>

							<div>
								<p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Software Used
								</p>
								<div className="flex flex-wrap gap-2">
									{softwareToolOptions.map((tool) => {
										const isSelected = portfolioForm.software_used.includes(tool);
										return (
											<button
												key={tool}
												type="button"
												onClick={() =>
													setPortfolioForm((prev) => ({
														...prev,
														software_used: isSelected
															? prev.software_used.filter((item) => item !== tool)
															: [...prev.software_used, tool],
													}))
												}
												className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
													isSelected
														? "bg-green-600 text-white"
														: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
												}`}
											>
												{tool}
											</button>
										);
									})}
								</div>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Supporting Link (optional)
								</label>
								<input
									type="url"
									value={portfolioForm.file_url}
									onChange={(e) =>
										setPortfolioForm((prev) => ({
											...prev,
											file_url: e.target.value,
										}))
									}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"
									placeholder="https://example.com/report.pdf"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Map Embed (iframe HTML)
								</label>
								<textarea
									rows={3}
									value={portfolioForm.map_embed_html}
									onChange={(e) =>
										setPortfolioForm((prev) => ({
											...prev,
											map_embed_html: e.target.value,
										}))
									}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white resize-none"
									placeholder="<iframe src=...></iframe>"
								/>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
									Supported providers: ArcGIS, Mapbox, Google Maps, OSM, CARTO.
								</p>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Preview Image {editingItem ? "(optional)" : "*"}
								</label>
								<input
									type="file"
									accept="image/png,image/jpeg,image/webp"
									onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"
								/>
								{previewImageError && (
									<p className="text-xs text-red-500 mt-1">{previewImageError}</p>
								)}
							</div>
						</div>

						<div className="mt-6 flex items-center justify-between">
							<button
								type="button"
								onClick={resetEditor}
								className="text-sm text-gray-500 hover:text-gray-700"
							>
								Cancel
							</button>
							<button
								type="button"
								disabled={portfolioSaving}
								onClick={handlePortfolioSave}
								className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors disabled:opacity-50"
							>
								{portfolioSaving ? "Saving..." : "Save Portfolio Item"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
