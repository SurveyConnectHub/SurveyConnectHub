"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CardSkeleton } from "@/components/ui/Skeleton";
import Image from "next/image";
import ActionModal from "@/components/ui/ActionModal";
import {
	PROFESSION_OPTIONS as professionOptions,
	SOFTWARE_TOOL_OPTIONS as softwareToolOptions,
	PORTFOLIO_IMAGE_TYPES,
	MAX_PORTFOLIO_IMAGE_SIZE,
} from "@/lib/constants";

export default function ProfessionalOnboardingPage() {
	const router = useRouter();
	const supabase = useMemo(() => createClient(), []);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [step, setStep] = useState(1);
	const [userId, setUserId] = useState("");
	const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
	const [portfolioLoading, setPortfolioLoading] = useState(true);
	const [portfolioError, setPortfolioError] = useState("");
	const [portfolioSaving, setPortfolioSaving] = useState(false);
	const [previewImageFile, setPreviewImageFile] = useState<File | null>(null);
	const [previewImageError, setPreviewImageError] = useState("");
	const [portfolioPreviewUrls, setPortfolioPreviewUrls] = useState<
		Record<string, string>
	>({});
	const [portfolioDeleteCandidate, setPortfolioDeleteCandidate] = useState<
		any | null
	>(null);

	const [formData, setFormData] = useState({
		full_name: "",
		phone: "",
		country: "",
		city: "",
		bio: "",
		software_tools: [] as string[],
		profession_type: "",
		custom_profession: "",
		years_experience: "",
		license_number: "",
	});

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
	});

	const buildSignedUrl = useCallback(
		async (path: string) => {
			if (!path) return "";
			if (path.startsWith("http")) return path;
			const { data } = await supabase.storage
				.from("portfolio-images")
				.createSignedUrl(path, 60 * 60);
			return data?.signedUrl || "";
		},
		[supabase],
	);

	const loadPortfolioItems = useCallback(
		async (ownerId: string) => {
			setPortfolioLoading(true);
			setPortfolioError("");
			try {
				const { data, error: portfolioLoadError } = await supabase
					.from("portfolio_items")
					.select("*")
					.eq("professional_id", ownerId)
					.order("created_at", { ascending: false });

				if (portfolioLoadError) {
					throw portfolioLoadError;
				}

				setPortfolioItems(data || []);
				const previews: Record<string, string> = {};
				await Promise.all(
					(data || []).map(async (item: any) => {
						const url = await buildSignedUrl(item.preview_image_url);
						if (url) previews[item.id] = url;
					}),
				);
				setPortfolioPreviewUrls(previews);
				return data || [];
			} catch (err: any) {
				console.error("Failed to load portfolio items", err);
				setPortfolioError("Failed to load portfolio items.");
				return [];
			} finally {
				setPortfolioLoading(false);
			}
		},
		[buildSignedUrl, supabase],
	);

	const confirmPortfolioDelete = useCallback(async () => {
		if (!portfolioDeleteCandidate) return;
		const item = portfolioDeleteCandidate;
		setPortfolioDeleteCandidate(null);
		const response = await fetch(`/api/portfolio/${item.id}`, {
			method: "DELETE",
		});
		if (response.ok) {
			setPortfolioItems((prev) => prev.filter((entry) => entry.id !== item.id));
			setPortfolioPreviewUrls((prev) => {
				const next = { ...prev };
				delete next[item.id];
				return next;
			});
		}
	}, [portfolioDeleteCandidate]);

	useEffect(() => {
		const init = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) {
				router.push("/login");
				return;
			}

			setUserId(user.id);

			const { data: profile } = await supabase
				.from("profiles")
				.select("role, full_name, phone, country, city, bio")
				.eq("id", user.id)
				.single();

			if (!profile || profile.role !== "professional") {
				router.push("/dashboard/client");
				return;
			}

			const { data: professional } = await supabase
				.from("professional_profiles")
				.select(
					"onboarding_completed, onboarding_step, profession_type, years_experience, license_number, software_tools",
				)
				.eq("id", user.id)
				.maybeSingle();

			if (professional?.onboarding_completed) {
				router.push("/dashboard/professional");
				return;
			}

			const stepMap: Record<string, number> = {
				profile: 1,
				professional: 2,
				portfolio: 3,
				complete: 4,
			};

			setStep(stepMap[professional?.onboarding_step || "profile"] || 1);

			const storedProfessionType = professional?.profession_type || "";
			const isPlaceholderProfessional =
				storedProfessionType === "other" &&
				!professional?.license_number &&
				!professional?.onboarding_completed &&
				(professional?.years_experience ?? 0) === 0;
			const isCustomProfession =
				!!storedProfessionType &&
				!professionOptions.includes(storedProfessionType);

			const initialProfessionType = isPlaceholderProfessional
				? ""
				: isCustomProfession
					? "other"
					: storedProfessionType;
			const initialCustomProfession = isCustomProfession
				? storedProfessionType
				: "";

			setFormData({
				full_name: profile.full_name || "",
				phone: profile.phone || "",
				country: profile.country || "",
				city: profile.city || "",
				bio: profile.bio || "",
				software_tools: professional?.software_tools || [],
				profession_type: initialProfessionType,
				custom_profession: initialCustomProfession,
				years_experience: professional?.years_experience
					? String(professional.years_experience)
					: "",
				license_number: professional?.license_number || "",
			});

			await loadPortfolioItems(user.id);
			setLoading(false);
		};

		init();
	}, [loadPortfolioItems, router, supabase]);

	const saveStep = async (
		nextStep: "profile" | "professional" | "portfolio" | "complete",
	) => {
		setSaving(true);
		setError("");

		if (!formData.full_name.trim()) {
			setSaving(false);
			setError("Full name is required");
			return false;
		}

		const shouldValidateProfessionalFields =
			nextStep === "portfolio" || nextStep === "complete";
		const resolvedProfessionType =
			formData.profession_type === "other"
				? formData.custom_profession.trim()
				: formData.profession_type;

		if (shouldValidateProfessionalFields && !resolvedProfessionType) {
			setSaving(false);
			setError(
				formData.profession_type === "other"
					? "Please enter your profession"
					: "Profession is required",
			);
			return false;
		}

		const years = Number(formData.years_experience || 0);
		if (
			shouldValidateProfessionalFields &&
			(!Number.isFinite(years) || years < 0 || years > 70)
		) {
			setSaving(false);
			setError("Years of experience must be between 0 and 70");
			return false;
		}

		const { error: profileError } = await supabase
			.from("profiles")
			.update({
				full_name: formData.full_name.trim(),
				phone: formData.phone.trim(),
				country: formData.country.trim(),
				city: formData.city.trim(),
				bio: formData.bio.trim(),
			})
			.eq("id", userId);

		if (profileError) {
			setSaving(false);
			setError("Could not save profile details");
			return false;
		}

		const professionalError =
			nextStep === "professional"
				? (
						await supabase
							.from("professional_profiles")
							.update({ onboarding_step: nextStep })
							.eq("id", userId)
					).error
				: (
						await supabase.from("professional_profiles").upsert(
							{
								id: userId,
								onboarding_step: nextStep,
								profession_type: resolvedProfessionType,
								years_experience: years,
								license_number: formData.license_number.trim() || null,
								software_tools: formData.software_tools,
							},
							{ onConflict: "id" },
						)
					).error;

		if (professionalError) {
			console.error("Failed to save professional details", professionalError);
			setSaving(false);
			setError("Could not save professional details");
			return false;
		}

		setSaving(false);
		return true;
	};

	const handleContinue = async () => {
		const next =
			step === 1 ? "professional" : step === 2 ? "portfolio" : "complete";
		if (next === "complete") {
			const items = await loadPortfolioItems(userId);
			if (items.length === 0) {
				setError("Add at least one portfolio item to continue.");
				return;
			}
		}
		const ok = await saveStep(next);
		if (!ok) return;
		setStep((prev) => Math.min(4, prev + 1));
	};

	const handleFinish = async () => {
		setSaving(true);
		setError("");

		const items = await loadPortfolioItems(userId);
		if (items.length === 0) {
			setSaving(false);
			setError("Add at least one portfolio item to finish onboarding.");
			return;
		}

		const { error: completionError } = await supabase
			.from("professional_profiles")
			.update({
				onboarding_completed: true,
				onboarding_completed_at: new Date().toISOString(),
				onboarding_step: "complete",
			})
			.eq("id", userId);

		if (completionError) {
			setSaving(false);
			setError("Failed to complete onboarding");
			return;
		}

		await supabase.from("notifications").insert({
			user_id: userId,
			title: "Onboarding complete",
			message: "Your onboarding is complete. Welcome to your dashboard.",
			type: "onboarding",
			link: "/dashboard/professional",
			is_read: false,
		});

		router.push("/dashboard/professional");
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-6">
				<div className="w-full max-w-md space-y-4">
					<CardSkeleton />
					<CardSkeleton />
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
				<button
					type="button"
					onClick={async () => {
						try {
							await supabase
								.from("professional_profiles")
								.update({ onboarding_step: step === 1 ? "profile" : "professional" })
								.eq("id", userId);
						} catch {
							// Non-critical
						}
						router.push("/dashboard/professional");
					}}
					className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
				>
					Skip for now
				</button>
			</nav>

			<div className="max-w-3xl mx-auto px-6 py-8">
				<div className="mb-8">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
						Professional Onboarding
					</h2>
					<p className="text-gray-500 dark:text-gray-400 mt-1">
						Step {step} of 4
					</p>
				</div>

				{error && (
					<div className="mb-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
						{error}
					</div>
				)}

				<div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-6">
					{step === 1 && (
						<>
							<div>
								<label
									htmlFor="onboarding-full-name"
									className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
								>
									Full Name <span className="text-red-500">*</span>
								</label>
								<input
									id="onboarding-full-name"
									type="text"
									value={formData.full_name}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											full_name: e.target.value,
										}))
									}
									placeholder="Enter your full name"
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
								/>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label
										htmlFor="onboarding-phone"
										className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
									>
										Phone
									</label>
									<input
										id="onboarding-phone"
										type="text"
										placeholder="Phone"
										value={formData.phone}
										onChange={(e) =>
											setFormData((prev) => ({
												...prev,
												phone: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
									/>
								</div>
								<div>
									<label
										htmlFor="onboarding-country"
										className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
									>
										Country
									</label>
									<input
										id="onboarding-country"
										type="text"
										placeholder="Country"
										value={formData.country}
										onChange={(e) =>
											setFormData((prev) => ({
												...prev,
												country: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
									/>
								</div>
							</div>
							<div>
								<label
									htmlFor="onboarding-city"
									className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
								>
									City
								</label>
								<input
									id="onboarding-city"
									type="text"
									placeholder="City"
									value={formData.city}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, city: e.target.value }))
									}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
								/>
							</div>
							<div>
								<label
									htmlFor="onboarding-bio"
									className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
								>
									Short Bio
								</label>
								<textarea
									id="onboarding-bio"
									rows={4}
									placeholder="Short bio"
									value={formData.bio}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, bio: e.target.value }))
									}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 resize-none dark:text-white dark:placeholder-gray-400"
								/>
							</div>
						</>
					)}

					{step === 2 && (
						<>
							<div>
								<p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									GIS Software &amp; Tools
								</p>
								<p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
									Select the GIS stack you use in the field and lab.
								</p>
								<div className="flex flex-wrap gap-2">
									{softwareToolOptions.map((tool) => {
										const isSelected = formData.software_tools.includes(tool);
										return (
											<button
												key={tool}
												type="button"
												onClick={() =>
													setFormData((prev) => ({
														...prev,
														software_tools: isSelected
															? prev.software_tools.filter(
																	(item) => item !== tool,
																)
															: [...prev.software_tools, tool],
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
								<label
									htmlFor="onboarding-profession-type"
									className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
								>
									Profession Type <span className="text-red-500">*</span>
								</label>
								<select
									id="onboarding-profession-type"
									value={formData.profession_type}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											profession_type: e.target.value,
										}))
									}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
								>
									<option value="">Select profession</option>
									{professionOptions.map((option) => (
										<option
											key={option}
											value={option}
										>
											{option}
										</option>
									))}
								</select>
							</div>
							{formData.profession_type === "other" && (
								<div>
									<label
										htmlFor="onboarding-custom-profession"
										className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
									>
										Custom Profession <span className="text-red-500">*</span>
									</label>
									<input
										id="onboarding-custom-profession"
										type="text"
										value={formData.custom_profession}
										onChange={(e) =>
											setFormData((prev) => ({
												...prev,
												custom_profession: e.target.value,
											}))
										}
										placeholder="Enter your profession"
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
									/>
								</div>
							)}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label
										htmlFor="onboarding-years"
										className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
									>
										Years Experience
									</label>
									<input
										id="onboarding-years"
										type="number"
										min="0"
										max="70"
										placeholder="Years experience"
										value={formData.years_experience}
										onChange={(e) =>
											setFormData((prev) => ({
												...prev,
												years_experience: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
									/>
								</div>
								<div>
									<label
										htmlFor="onboarding-license"
										className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
									>
										License Number
									</label>
									<input
										id="onboarding-license"
										type="text"
										placeholder="License number"
										value={formData.license_number}
										onChange={(e) =>
											setFormData((prev) => ({
												...prev,
												license_number: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
									/>
								</div>
							</div>
						</>
					)}

					{step === 3 && (
						<div className="space-y-6">
							<div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
								<p className="font-semibold text-green-700 dark:text-green-400">
									Add your portfolio
								</p>
								<p className="text-sm text-green-700 dark:text-green-400 mt-1">
									Add at least one project with a preview image so clients can
									understand your geospatial work.
								</p>
							</div>

							{portfolioError && (
								<div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
									{portfolioError}
								</div>
							)}

							<div className="space-y-4">
								<div>
									<label
										htmlFor="portfolio-title"
										className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
									>
										Project Title <span className="text-red-500">*</span>
									</label>
									<input
										id="portfolio-title"
										type="text"
										value={portfolioForm.title}
										onChange={(e) =>
											setPortfolioForm((prev) => ({
												...prev,
												title: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
										placeholder="Land survey for residential layout"
									/>
								</div>

								<div>
									<label
										htmlFor="portfolio-description"
										className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
									>
										Description
									</label>
									<textarea
										id="portfolio-description"
										rows={3}
										value={portfolioForm.description}
										onChange={(e) =>
											setPortfolioForm((prev) => ({
												...prev,
												description: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 resize-none dark:text-white dark:placeholder-gray-400"
										placeholder="Summarize the scope, outputs, and outcome."
									/>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label
											htmlFor="portfolio-project-type"
											className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
										>
											Project Type
										</label>
										<input
											id="portfolio-project-type"
											type="text"
											value={portfolioForm.project_type}
											onChange={(e) =>
												setPortfolioForm((prev) => ({
													...prev,
													project_type: e.target.value,
												}))
											}
											className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
											placeholder="Topographic survey"
										/>
									</div>
									<div>
										<label
											htmlFor="portfolio-data-sources"
											className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
										>
											Data Sources
										</label>
										<input
											id="portfolio-data-sources"
											type="text"
											value={portfolioForm.data_sources}
											onChange={(e) =>
												setPortfolioForm((prev) => ({
													...prev,
													data_sources: e.target.value,
												}))
											}
											className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
											placeholder="GNSS, UAV, satellite imagery"
										/>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label
											htmlFor="portfolio-crs"
											className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
										>
											Coordinate System (CRS)
										</label>
										<input
											id="portfolio-crs"
											type="text"
											value={portfolioForm.crs}
											onChange={(e) =>
												setPortfolioForm((prev) => ({
													...prev,
													crs: e.target.value,
												}))
											}
											className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
											placeholder="EPSG:4326"
										/>
									</div>
									<div>
										<label
											htmlFor="portfolio-scale"
											className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
										>
											Scale / Resolution
										</label>
										<input
											id="portfolio-scale"
											type="text"
											value={portfolioForm.scale_resolution}
											onChange={(e) =>
												setPortfolioForm((prev) => ({
													...prev,
													scale_resolution: e.target.value,
												}))
											}
											className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
											placeholder="1:500, 10cm GSD"
										/>
									</div>
								</div>

								<div>
									<p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
										Software Used
									</p>
									<div className="flex flex-wrap gap-2">
										{softwareToolOptions.map((tool) => {
											const isSelected =
												portfolioForm.software_used.includes(tool);
											return (
												<button
													key={tool}
													type="button"
													onClick={() =>
														setPortfolioForm((prev) => ({
															...prev,
															software_used: isSelected
																? prev.software_used.filter(
																		(item) => item !== tool,
																	)
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
									<label
										htmlFor="portfolio-file-url"
										className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
									>
										Supporting Link (optional)
									</label>
									<input
										id="portfolio-file-url"
										type="url"
										value={portfolioForm.file_url}
										onChange={(e) =>
											setPortfolioForm((prev) => ({
												...prev,
												file_url: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
										placeholder="https://example.com/report.pdf"
									/>
								</div>

								<div>
									<label
										htmlFor="portfolio-map-embed"
										className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
									>
										Map Embed (iframe HTML)
									</label>
									<textarea
										id="portfolio-map-embed"
										rows={3}
										value={portfolioForm.map_embed_html}
										onChange={(e) =>
											setPortfolioForm((prev) => ({
												...prev,
												map_embed_html: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 resize-none dark:text-white dark:placeholder-gray-400"
										placeholder="<iframe src=...></iframe>"
									/>
									<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
										Supported providers: ArcGIS, Mapbox, Google Maps, OSM,
										CARTO.
									</p>
								</div>

								<div>
									<label
										htmlFor="portfolio-preview-image"
										className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
									>
										Preview Image <span className="text-red-500">*</span>
									</label>
									<input
										id="portfolio-preview-image"
										type="file"
										accept="image/png,image/jpeg,image/webp"
										onChange={(e) => {
											setPreviewImageError("");
											const file = e.target.files?.[0] || null;
											if (!file) {
												setPreviewImageFile(null);
												return;
											}
											if (!PORTFOLIO_IMAGE_TYPES.includes(file.type)) {
												setPreviewImageError(
													"Only JPG, PNG, or WebP images are allowed.",
												);
												setPreviewImageFile(null);
												return;
											}
											if (file.size > MAX_PORTFOLIO_IMAGE_SIZE) {
												const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
												setPreviewImageError(
													`Image is ${sizeMB}MB — max size is 5MB.`,
												);
												setPreviewImageFile(null);
												return;
											}
											setPreviewImageFile(file);
										}}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"
									/>
									{previewImageError && (
										<p className="text-xs text-red-500 mt-1">
											{previewImageError}
										</p>
									)}
								</div>

								<button
									type="button"
									disabled={portfolioSaving}
									onClick={async () => {
										setPortfolioSaving(true);
										setPortfolioError("");
										if (!portfolioForm.title.trim()) {
											setPortfolioError("Project title is required.");
											setPortfolioSaving(false);
											return;
										}
										if (!previewImageFile) {
											setPortfolioError("Preview image is required.");
											setPortfolioSaving(false);
											return;
										}

										try {
											const cleanName = previewImageFile.name.replace(
												/[^a-zA-Z0-9._-]/g,
												"-",
											);
											const uploadPath = `${userId}/portfolio-preview-${Date.now()}-${cleanName}`;

											const { error: uploadError } = await supabase.storage
												.from("portfolio-images")
												.upload(uploadPath, previewImageFile, {
													contentType: previewImageFile.type,
													upsert: false,
												});

											if (uploadError) {
												throw uploadError;
											}

											const response = await fetch("/api/portfolio", {
												method: "POST",
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
													preview_image_url: uploadPath,
													map_embed_html: portfolioForm.map_embed_html,
												}),
											});

											const result = await response.json().catch(() => ({}));
											if (!response.ok) {
												throw new Error(
													result?.error || "Failed to save portfolio item",
												);
											}

											const newItem = result.item;
											const signedUrl = await buildSignedUrl(uploadPath);
											setPortfolioItems((prev) => [newItem, ...prev]);
											setPortfolioPreviewUrls((prev) => ({
												...prev,
												[newItem.id]: signedUrl,
											}));

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
											});
											setPreviewImageFile(null);
										} catch (err: any) {
											console.error("Portfolio save failed", err);
											setPortfolioError(
												err?.message || "Failed to save portfolio item.",
											);
										} finally {
											setPortfolioSaving(false);
										}
									}}
									className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
								>
									{portfolioSaving ? "Saving..." : "Add Portfolio Item"}
								</button>
							</div>

							<div>
								<h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
									Your Portfolio
								</h4>
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
												className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900"
											>
												{portfolioPreviewUrls[item.id] && (
													<div className="relative w-full h-36">
														<Image
															src={portfolioPreviewUrls[item.id]}
															alt={item.title || "Portfolio preview"}
															fill
															sizes="(max-width: 768px) 100vw, 50vw"
															className="object-cover"
														/>
													</div>
												)}
												<div className="p-4 space-y-2">
													<p className="font-semibold text-gray-900 dark:text-white text-sm">
														{item.title || "Untitled project"}
													</p>
													<p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
														{item.description || "No description provided."}
													</p>
													<button
														type="button"
														className="text-xs text-red-600 hover:text-red-700"
														onClick={() => setPortfolioDeleteCandidate(item)}
													>
														Delete
													</button>
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						</div>
					)}

					{step === 4 && (
						<div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
							<p className="font-semibold text-green-700 dark:text-green-400">
								Ready to finish
							</p>
							<p className="text-sm text-green-700 dark:text-green-400 mt-1">
								Complete onboarding now to continue to your dashboard and unlock
								all professional actions.
							</p>
						</div>
					)}

					<div
						className={`flex items-center ${step > 1 ? "justify-between" : "justify-end"}`}
					>
						{step > 1 && (
							<button
								type="button"
								onClick={async () => {
									const currentStep = step;
									const nextStep = currentStep === 2 ? "profile" : currentStep === 3 ? "professional" : "portfolio";
									await saveStep(nextStep as any).catch(() => {});
									setStep((prev) => Math.max(1, prev - 1));
								}}
								disabled={saving}
								className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 disabled:opacity-50"
							>
								Back
							</button>
						)}
						{step < 4 ? (
							<button
								type="button"
								onClick={handleContinue}
								disabled={saving}
								className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
							>
								{saving ? "Saving..." : "Continue"}
							</button>
						) : (
							<button
								type="button"
								onClick={handleFinish}
								disabled={saving}
								className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
							>
								{saving ? "Finishing..." : "Complete Onboarding"}
							</button>
						)}
					</div>
				</div>

				<ActionModal
					open={Boolean(portfolioDeleteCandidate)}
					onClose={() => setPortfolioDeleteCandidate(null)}
					onConfirm={confirmPortfolioDelete}
					variant="danger"
					title="Delete this portfolio item?"
					description={
						portfolioDeleteCandidate?.title
							? `"${portfolioDeleteCandidate.title}" will be removed from your portfolio.`
							: "This item will be removed from your portfolio."
					}
					confirmLabel="Delete item"
					cancelLabel="Keep item"
				/>
			</div>
		</div>
	);
}
