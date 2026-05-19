"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/ui/BackButton";
import {
	ChevronRight,
	ChevronLeft,
	Plus,
	Trash2,
	AlertCircle,
} from "lucide-react";

export default function MultiStepJobForm() {
	const router = useRouter();
	const supabase = useMemo(() => createClient(), []);
	const [currentStep, setCurrentStep] = useState(1);
	const [loading, setLoading] = useState(false);
	const [pageLoading, setPageLoading] = useState(true);
	const [error, setError] = useState("");
	const [user, setUser] = useState<any>(null);
	const [briefFile, setBriefFile] = useState<File | null>(null);
	const [skillInput, setSkillInput] = useState("");
	const [screeningQuestions, setScreeningQuestions] = useState<string[]>([]);
	const [newQuestion, setNewQuestion] = useState("");

	const [formData, setFormData] = useState({
		// Step 1: Basics
		title: "",
		profession_type: "",
		// Step 2: Details
		description: "",
		// Step 3: Requirements
		required_skills: [] as string[],
		experience_level: "",
		job_type: "",
		location: "",
		// Step 4: Budget
		budget_model: "fixed" as "fixed" | "negotiable",
		budget_fixed: "",
		budget_min: "",
		budget_max: "",
		estimated_duration: "",
		// Step 5: Screening
		screening_questions: [] as string[],
		// Other
		required_verification: true,
	});

	// Validation functions for each step
	const validateStep = (step: number): boolean => {
		setError("");
		switch (step) {
			case 1:
				if (!formData.title.trim()) {
					setError("Job title is required");
					return false;
				}
				if (!formData.profession_type) {
					setError("Please select a profession type");
					return false;
				}
				return true;
			case 2:
				if (!formData.description.trim()) {
					setError("Job description is required");
					return false;
				}
				return true;
			case 3:
				if (!formData.job_type) {
					setError("Please select a job type");
					return false;
				}
				if (formData.job_type === "on_site" && !formData.location.trim()) {
					setError("Location is required for on-site roles");
					return false;
				}
				if (!formData.experience_level) {
					setError("Please select an experience level");
					return false;
				}
				return true;
			case 4:
				if (formData.budget_model === "fixed") {
					if (!formData.budget_fixed) {
						setError("Budget amount is required");
						return false;
					}
					const fixedBudget = parseFloat(formData.budget_fixed);
					if (fixedBudget < 1) {
						setError("Budget must be greater than 0");
						return false;
					}
					if (fixedBudget > 30000) {
						setError(
							"Budget cannot exceed $30,000. For larger contracts, contact support@SurveyConnectHub.com",
						);
						return false;
					}
				} else {
					if (formData.budget_min && formData.budget_max) {
						const minBudget = parseFloat(formData.budget_min);
						const maxBudget = parseFloat(formData.budget_max);
						if (minBudget >= maxBudget) {
							setError("Maximum budget must be greater than minimum");
							return false;
						}
					}
				}
				if (!formData.estimated_duration) {
					setError("Please select an estimated duration");
					return false;
				}
				return true;
			case 5:
				// Step 5 is optional
				return true;
			case 6:
				// Review step - no validation needed here
				return true;
			default:
				return true;
		}
	};

	useEffect(() => {
		const checkUser = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				router.push("/login");
				return;
			}

			const { data: profile } = await supabase
				.from("profiles")
				.select("role")
				.eq("id", user.id)
				.single();

			if (profile?.role !== "client") {
				router.push("/dashboard/professional");
				return;
			}

			setUser(user);
			setPageLoading(false);
		};

		checkUser();
	}, [router, supabase]);

	const handleChange = (
		e: React.ChangeEvent<
			HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
		>,
	) => {
		const { name, value } = e.target;
		const checked = (e.target as HTMLInputElement).checked;
		const type = (e.target as HTMLInputElement).type;
		setFormData((prev) => ({
			...prev,
			[name]: type === "checkbox" ? checked : value,
		}));
	};

	const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key !== "Enter") return;
		e.preventDefault();
		const value = skillInput.trim();
		if (!value) return;
		if (formData.required_skills.includes(value)) {
			setSkillInput("");
			return;
		}
		setFormData((prev) => ({
			...prev,
			required_skills: [...prev.required_skills, value],
		}));
		setSkillInput("");
	};

	const removeSkill = (skill: string) => {
		setFormData((prev) => ({
			...prev,
			required_skills: prev.required_skills.filter((item) => item !== skill),
		}));
	};

	const handleAddScreeningQuestion = () => {
		if (!newQuestion.trim()) return;
		if (formData.screening_questions.length >= 3) {
			setError("Maximum 3 screening questions allowed");
			return;
		}
		setFormData((prev) => ({
			...prev,
			screening_questions: [...prev.screening_questions, newQuestion.trim()],
		}));
		setNewQuestion("");
		setError("");
	};

	const removeScreeningQuestion = (index: number) => {
		setFormData((prev) => ({
			...prev,
			screening_questions: prev.screening_questions.filter(
				(_, i) => i !== index,
			),
		}));
	};

	const handleBriefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const allowedTypes = [
			"application/pdf",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		];
		const ext = file.name.split(".").pop()?.toLowerCase();

		if (
			!allowedTypes.includes(file.type) ||
			!["pdf", "docx"].includes(ext || "")
		) {
			setError("Only PDF and DOCX files are allowed");
			return;
		}

		setBriefFile(file);
		setError("");
	};

	const handleNext = () => {
		if (validateStep(currentStep)) {
			setCurrentStep(currentStep + 1);
			setError("");
			window.scrollTo(0, 0);
		}
	};

	const handlePrev = () => {
		setCurrentStep(currentStep - 1);
		setError("");
		window.scrollTo(0, 0);
	};

	const handleSubmit = async () => {
		if (!validateStep(6)) return;

		setError("");
		setLoading(true);

		try {
			let briefAttachmentUrl: string | null = null;
			if (briefFile) {
				const cleanName = briefFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
				const briefPath = `${user.id}/job-brief-${Date.now()}-${cleanName}`;
				const { error: uploadError } = await supabase.storage
					.from("job-briefs")
					.upload(briefPath, briefFile);

				if (uploadError) {
					throw uploadError;
				}
				briefAttachmentUrl = briefPath;
			}

			const budgetAmount =
				formData.budget_model === "fixed"
					? parseFloat(formData.budget_fixed)
					: parseFloat(formData.budget_max || formData.budget_min || "0");

			const { error: jobError } = await supabase.from("jobs").insert({
				client_id: user.id,
				title: formData.title,
				description: formData.description,
				profession_type: formData.profession_type,
				job_type: formData.job_type,
				location: formData.job_type === "on_site" ? formData.location : null,
				required_skills: formData.required_skills,
				estimated_duration: formData.estimated_duration || null,
				brief_attachment_url: briefAttachmentUrl,
				budget: budgetAmount,
				budget_min:
					formData.budget_model === "negotiable"
						? formData.budget_min
							? parseFloat(formData.budget_min)
							: null
						: null,
				budget_max:
					formData.budget_model === "negotiable"
						? formData.budget_max
							? parseFloat(formData.budget_max)
							: null
						: null,
				budget_model: formData.budget_model,
				budget_type: "fixed",
				experience_level: formData.experience_level,
				screening_questions:
					formData.screening_questions.length > 0
						? formData.screening_questions
						: null,
				required_verification: formData.required_verification,
				status: "open",
			});

			if (jobError) throw jobError;

			router.push("/dashboard/client/jobs");
		} catch (err: any) {
			setError(err.message || "Failed to post job. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	if (pageLoading) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
				<div className="text-gray-500 dark:text-gray-400">Loading...</div>
			</div>
		);
	}

	const steps = [
		"Basics",
		"Details",
		"Requirements",
		"Budget",
		"Screening",
		"Review",
	];

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4 transition-colors duration-300">
			<div className="max-w-2xl mx-auto">
				<div className="text-center mb-8">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">
						Survey<span className="text-green-600">ConnectHub</span>
					</h1>
					<p className="text-gray-500 dark:text-gray-400 mt-2">
						Post a New Job
					</p>
				</div>

				<div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 border border-transparent dark:border-gray-800">
					{/* Progress Indicator */}
					<div className="mb-8">
						<div className="flex items-center justify-between mb-2">
							{steps.map((step, index) => (
								<div
									key={index}
									className="flex-1"
								>
									<div
										className={`h-2 rounded-full transition-colors ${
											index + 1 <= currentStep
												? "bg-green-600"
												: "bg-gray-300 dark:bg-gray-700"
										}`}
									/>
									{index < steps.length - 1 && (
										<div
											className={`h-2 -mt-2 rounded-full transition-colors ${
												index + 1 < currentStep
													? "bg-green-600"
													: "bg-gray-300 dark:bg-gray-700"
											}`}
										/>
									)}
								</div>
							))}
						</div>
						<div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
							<span>
								Step {currentStep} of {steps.length}
							</span>
							<span className="font-medium text-gray-900 dark:text-white">
								{steps[currentStep - 1]}
							</span>
						</div>
					</div>

					{/* Error Message */}
					{error && (
						<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6 text-sm flex gap-2">
							<AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
							<span>{error}</span>
						</div>
					)}

					{/* Step 1: Basics */}
					{currentStep === 1 && (
						<form className="space-y-6">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Job Title <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									name="title"
									value={formData.title}
									onChange={handleChange}
									placeholder="e.g. Land Survey for 50 Hectare Farm in Ogun State"
									className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Profession Needed <span className="text-red-500">*</span>
								</label>
								<select
									name="profession_type"
									value={formData.profession_type}
									onChange={handleChange}
									aria-label="Select profession type"
									className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
								>
									<option value="">Select profession type</option>
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
									<option value="other">Other</option>
								</select>
							</div>
						</form>
					)}

					{/* Step 2: Details */}
					{currentStep === 2 && (
						<form className="space-y-6">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Job Description <span className="text-red-500">*</span>
								</label>
								<textarea
									name="description"
									value={formData.description}
									onChange={handleChange}
									rows={8}
									placeholder="Describe the project in detail. Include scope, deliverables, timeline expectations, and any special requirements..."
									className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Job Brief Attachment
								</label>
								<label className="block w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-center cursor-pointer hover:border-green-500 transition-colors">
									<input
										type="file"
										accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
										onChange={handleBriefFileChange}
										className="hidden"
									/>
									<div className="text-gray-600 dark:text-gray-400 text-sm">
										{briefFile ? (
											<span className="text-green-600 dark:text-green-400">
												✓ {briefFile.name}
											</span>
										) : (
											<>
												<span className="text-green-600 dark:text-green-400">
													Click to upload
												</span>
												<span className="text-gray-500 dark:text-gray-500">
													{" "}
													or drag and drop
												</span>
												<p className="text-xs text-gray-400 mt-1">
													PDF or DOCX only
												</p>
											</>
										)}
									</div>
								</label>
							</div>
						</form>
					)}

					{/* Step 3: Requirements */}
					{currentStep === 3 && (
						<form className="space-y-6">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Job Type <span className="text-red-500">*</span>
								</label>
								<select
									name="job_type"
									value={formData.job_type}
									onChange={handleChange}
									aria-label="Select job type"
									className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
								>
									<option value="">Select job type</option>
									<option value="remote">Remote</option>
									<option value="on_site">On-site</option>
									<option value="hybrid">Hybrid</option>
								</select>
							</div>

							{formData.job_type === "on_site" && (
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										Location <span className="text-red-500">*</span>
									</label>
									<input
										type="text"
										name="location"
										value={formData.location}
										onChange={handleChange}
										placeholder="Enter job location"
										className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500"
									/>
								</div>
							)}

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Experience Level <span className="text-red-500">*</span>
								</label>
								<select
									name="experience_level"
									value={formData.experience_level}
									onChange={handleChange}
									aria-label="Select experience level"
									className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
								>
									<option value="">Select experience level</option>
									<option value="entry_level">Entry Level</option>
									<option value="intermediate">Intermediate</option>
									<option value="expert">Expert</option>
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Required Skills
								</label>
								<div className="flex flex-wrap gap-2 mb-2">
									{formData.required_skills.map((skill) => (
										<span
											key={skill}
											className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 py-1 text-sm"
										>
											{skill}
											<button
												type="button"
												onClick={() => removeSkill(skill)}
												className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
												aria-label={`Remove skill ${skill}`}
											>
												×
											</button>
										</span>
									))}
								</div>
								<input
									type="text"
									value={skillInput}
									onChange={(e) => setSkillInput(e.target.value)}
									onKeyDown={handleSkillKeyDown}
									placeholder="Type a skill and press Enter"
									className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500"
								/>
							</div>
						</form>
					)}

					{/* Step 4: Budget */}
					{currentStep === 4 && (
						<form className="space-y-6">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Budget Type <span className="text-red-500">*</span>
								</label>
								<div className="grid grid-cols-2 gap-3">
									<button
										type="button"
										onClick={() =>
											setFormData((prev) => ({
												...prev,
												budget_model: "fixed",
											}))
										}
										className={`p-4 rounded-xl border-2 text-left transition-all ${
											formData.budget_model === "fixed"
												? "border-green-600 bg-green-50 dark:bg-green-900/20"
												: "border-gray-200 dark:border-gray-700 hover:border-gray-300"
										}`}
									>
										<p className="font-semibold text-gray-900 dark:text-white text-sm">
											Fixed Price
										</p>
										<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
											You set the exact price.
										</p>
									</button>
									<button
										type="button"
										onClick={() =>
											setFormData((prev) => ({
												...prev,
												budget_model: "negotiable",
											}))
										}
										className={`p-4 rounded-xl border-2 text-left transition-all ${
											formData.budget_model === "negotiable"
												? "border-green-600 bg-green-50 dark:bg-green-900/20"
												: "border-gray-200 dark:border-gray-700 hover:border-gray-300"
										}`}
									>
										<p className="font-semibold text-gray-900 dark:text-white text-sm">
											Negotiable
										</p>
										<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
											Set a budget range.
										</p>
									</button>
								</div>
							</div>

							{formData.budget_model === "fixed" && (
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										Fixed Amount (USD) <span className="text-red-500">*</span>
									</label>
									<div className="relative">
										<span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">
											$
										</span>
										<input
											type="number"
											name="budget_fixed"
											value={formData.budget_fixed}
											onChange={handleChange}
											placeholder="e.g. 500"
											min="1"
											max="30000"
											className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400"
										/>
									</div>
									<p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
										Maximum $30,000.
									</p>
								</div>
							)}

							{formData.budget_model === "negotiable" && (
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
											Minimum Budget (USD)
										</label>
										<div className="relative">
											<span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
												$
											</span>
											<input
												type="number"
												name="budget_min"
												value={formData.budget_min}
												onChange={handleChange}
												placeholder="e.g. 300"
												min="1"
												className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400"
											/>
										</div>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
											Maximum Budget (USD)
										</label>
										<div className="relative">
											<span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
												$
											</span>
											<input
												type="number"
												name="budget_max"
												value={formData.budget_max}
												onChange={handleChange}
												placeholder="e.g. 600"
												min="1"
												className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400"
											/>
										</div>
									</div>
								</div>
							)}

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Estimated Duration <span className="text-red-500">*</span>
								</label>
								<select
									name="estimated_duration"
									value={formData.estimated_duration}
									onChange={handleChange}
									aria-label="Select estimated duration"
									className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
								>
									<option value="">Select duration</option>
									<option value="1_day">1 Day</option>
									<option value="3_days">3 Days</option>
									<option value="1_week">1 Week</option>
									<option value="2_weeks">2 Weeks</option>
									<option value="1_month">1 Month</option>
									<option value="3_months">3 Months</option>
									<option value="6_months">6 Months</option>
								</select>
							</div>
						</form>
					)}

					{/* Step 5: Screening Questions */}
					{currentStep === 5 && (
						<form className="space-y-6">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Screening Questions (Optional)
								</label>
								<p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
									Add up to 3 questions that professionals must answer when
									applying.
								</p>

								<div className="space-y-4 mb-4">
									{formData.screening_questions.map((question, index) => (
										<div
											key={index}
											className="flex gap-3 items-start bg-gray-50 dark:bg-gray-800 p-4 rounded-xl"
										>
											<span className="text-gray-500 dark:text-gray-400 font-medium text-sm">
												{index + 1}.
											</span>
											<span className="flex-1 text-gray-700 dark:text-gray-300 text-sm pt-0.5">
												{question}
											</span>
											<button
												type="button"
												onClick={() => removeScreeningQuestion(index)}
												className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex-shrink-0"
												aria-label={`Remove screening question ${index + 1}`}
											>
												<Trash2 className="w-4 h-4" />
											</button>
										</div>
									))}
								</div>

								{formData.screening_questions.length < 3 && (
									<div className="flex gap-2">
										<input
											type="text"
											value={newQuestion}
											onChange={(e) => setNewQuestion(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													handleAddScreeningQuestion();
												}
											}}
											placeholder="Enter a screening question"
											className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
										/>
										<button
											type="button"
											onClick={handleAddScreeningQuestion}
											className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
											aria-label="Add screening question"
										>
											<Plus className="w-4 h-4" />
										</button>
									</div>
								)}
							</div>
						</form>
					)}

					{/* Step 6: Review */}
					{currentStep === 6 && (
						<div className="space-y-6">
							<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 space-y-4">
								<h3 className="font-semibold text-gray-900 dark:text-white">
									Job Basics
								</h3>
								<div className="space-y-2 text-sm">
									<div className="flex justify-between">
										<span className="text-gray-600 dark:text-gray-400">
											Title:
										</span>
										<span className="text-gray-900 dark:text-white font-medium">
											{formData.title}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-600 dark:text-gray-400">
											Profession:
										</span>
										<span className="text-gray-900 dark:text-white font-medium">
											{formData.profession_type}
										</span>
									</div>
								</div>
							</div>

							<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 space-y-4">
								<h3 className="font-semibold text-gray-900 dark:text-white">
									Job Details
								</h3>
								<div className="text-sm text-gray-700 dark:text-gray-300">
									<p className="line-clamp-3">{formData.description}</p>
								</div>
								{briefFile && (
									<div className="text-sm">
										<span className="text-gray-600 dark:text-gray-400">
											Brief:
										</span>
										<span className="text-green-600 dark:text-green-400 ml-2">
											✓ {briefFile.name}
										</span>
									</div>
								)}
							</div>

							<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 space-y-4">
								<h3 className="font-semibold text-gray-900 dark:text-white">
									Requirements
								</h3>
								<div className="space-y-2 text-sm">
									<div className="flex justify-between">
										<span className="text-gray-600 dark:text-gray-400">
											Job Type:
										</span>
										<span className="text-gray-900 dark:text-white font-medium">
											{formData.job_type}
										</span>
									</div>
									{formData.location && (
										<div className="flex justify-between">
											<span className="text-gray-600 dark:text-gray-400">
												Location:
											</span>
											<span className="text-gray-900 dark:text-white font-medium">
												{formData.location}
											</span>
										</div>
									)}
									<div className="flex justify-between">
										<span className="text-gray-600 dark:text-gray-400">
											Experience:
										</span>
										<span className="text-gray-900 dark:text-white font-medium">
											{formData.experience_level}
										</span>
									</div>
								</div>
								{formData.required_skills.length > 0 && (
									<div>
										<p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
											Skills:
										</p>
										<div className="flex flex-wrap gap-2">
											{formData.required_skills.map((skill) => (
												<span
													key={skill}
													className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs px-2 py-1 rounded"
												>
													{skill}
												</span>
											))}
										</div>
									</div>
								)}
							</div>

							<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 space-y-4">
								<h3 className="font-semibold text-gray-900 dark:text-white">
									Budget & Timeline
								</h3>
								<div className="space-y-2 text-sm">
									<div className="flex justify-between">
										<span className="text-gray-600 dark:text-gray-400">
											Budget Type:
										</span>
										<span className="text-gray-900 dark:text-white font-medium">
											{formData.budget_model === "fixed"
												? `Fixed: $${formData.budget_fixed}`
												: `Negotiable: $${formData.budget_min} - $${formData.budget_max}`}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-600 dark:text-gray-400">
											Duration:
										</span>
										<span className="text-gray-900 dark:text-white font-medium">
											{formData.estimated_duration}
										</span>
									</div>
								</div>
							</div>

							{formData.screening_questions.length > 0 && (
								<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 space-y-4">
									<h3 className="font-semibold text-gray-900 dark:text-white">
										Screening Questions
									</h3>
									<div className="space-y-2 text-sm">
										{formData.screening_questions.map((question, index) => (
											<div
												key={index}
												className="text-gray-700 dark:text-gray-300"
											>
												<span className="text-gray-600 dark:text-gray-400">
													{index + 1}.
												</span>
												<span className="ml-2">{question}</span>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					)}

					{/* Navigation Buttons */}
					<div className="flex gap-4 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
						{currentStep > 1 && (
							<button
								onClick={handlePrev}
								className="flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
							>
								<ChevronLeft className="w-4 h-4" />
								Back
							</button>
						)}

						{currentStep < 6 ? (
							<button
								onClick={handleNext}
								className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
							>
								Next
								<ChevronRight className="w-4 h-4" />
							</button>
						) : (
							<button
								onClick={handleSubmit}
								disabled={loading}
								className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-xl font-medium transition-colors disabled:cursor-not-allowed"
							>
								{loading ? "Posting..." : "Post Job"}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
