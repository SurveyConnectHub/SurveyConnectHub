"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const professionOptions = [
	"land_surveyor",
	"gis_analyst",
	"drone_pilot",
	"cartographer",
	"photogrammetrist",
	"lidar_specialist",
	"remote_sensing_analyst",
	"urban_planner",
	"spatial_data_scientist",
	"hydrographic_surveyor",
	"mining_surveyor",
	"construction_surveyor",
	"environmental_analyst",
	"bim_specialist",
	"other",
];

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

export default function ProfessionalOnboardingPage() {
	const router = useRouter();
	const supabase = useMemo(() => createClient(), []);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [step, setStep] = useState(1);
	const [userId, setUserId] = useState("");

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
				complete: 3,
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

			setLoading(false);
		};

		init();
	}, [router, supabase]);

	const saveStep = async (
		nextStep: "profile" | "professional" | "complete",
	) => {
		setSaving(true);
		setError("");

		if (!formData.full_name.trim()) {
			setSaving(false);
			setError("Full name is required");
			return false;
		}

		const shouldValidateProfessionalFields = nextStep !== "professional";
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
		const next = step === 1 ? "professional" : "complete";
		const ok = await saveStep(next);
		if (!ok) return;
		setStep((prev) => Math.min(3, prev + 1));
	};

	const handleFinish = async () => {
		setSaving(true);
		setError("");

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
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
				<div className="text-gray-500 dark:text-gray-400">
					Preparing onboarding...
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
					href="/dashboard/professional"
					className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
				>
					Skip for now
				</Link>
			</nav>

			<div className="max-w-3xl mx-auto px-6 py-8">
				<div className="mb-8">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
						Professional Onboarding
					</h2>
					<p className="text-gray-500 dark:text-gray-400 mt-1">
						Step {step} of 3
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
								onClick={() => setStep((prev) => Math.max(1, prev - 1))}
								disabled={saving}
								className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 disabled:opacity-50"
							>
								Back
							</button>
						)}
						{step < 3 ? (
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
			</div>
		</div>
	);
}
