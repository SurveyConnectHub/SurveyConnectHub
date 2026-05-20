"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PartyPopper } from "lucide-react";
import BackButton from "@/components/ui/BackButton";

type Job = {
	id: string;
	title: string;
	description: string;
	budget: number;
	budget_model?: string | null;
	budget_type: string;
	job_type: string;
	location: string | null;
	status: string;
	client_id: string;
	screening_questions?: string[] | null;
	experience_level?: string | null;
};

export default function ApplyPage() {
	const { id } = useParams();
	const router = useRouter();
	const supabase = useMemo(() => createClient(), []);

	const [job, setJob] = useState<Job | null>(null);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);
	const [alreadyApplied, setAlreadyApplied] = useState(false);

	const [coverLetter, setCoverLetter] = useState("");
	const [proposedRate, setProposedRate] = useState("");
	const [estimatedDelivery, setEstimatedDelivery] = useState("");
	const [relevantExperience, setRelevantExperience] = useState("");
	const [questionsForClient, setQuestionsForClient] = useState("");
	const [screeningAnswers, setScreeningAnswers] = useState<string[]>([]);
	const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
	const [portfolioMode, setPortfolioMode] = useState<"existing" | "upload">(
		"existing",
	);
	const [selectedPortfolioItemId, setSelectedPortfolioItemId] = useState("");
	const [portfolioFile, setPortfolioFile] = useState<File | null>(null);
	const [uploadProgress, setUploadProgress] = useState<
		"idle" | "uploading" | "done" | "error"
	>("idle");

	useEffect(() => {
		const init = async () => {
			const jobId =
				typeof id === "string" ? id : Array.isArray(id) ? id[0] : undefined;
			if (!jobId) {
				setError("Job not found.");
				setLoading(false);
				return;
			}

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

			if (profile?.role !== "professional") {
				router.push("/dashboard/client");
				return;
			}

			const { data: portfolioData, error: portfolioError } = await supabase
				.from("portfolio_items")
				.select("id, title, file_url")
				.eq("professional_id", user.id)
				.order("created_at", { ascending: false });

			if (portfolioData && portfolioData.length > 0) {
				setPortfolioItems(portfolioData);
				setSelectedPortfolioItemId(portfolioData[0].id);
			} else {
				setPortfolioMode("upload");
			}

			const { data: jobData, error: jobError } = await supabase
				.from("jobs")
				.select("*")
				.eq("id", jobId)
				.single();

			if (jobError || !jobData) {
				setError("Job not found.");
				setLoading(false);
				return;
			}

			setJob(jobData);

			if (jobData.budget_model === "fixed") {
				setProposedRate(String(jobData.budget));
			}

			// Initialize screening answers if there are screening questions
			if (
				jobData.screening_questions &&
				jobData.screening_questions.length > 0
			) {
				setScreeningAnswers(
					new Array(jobData.screening_questions.length).fill(""),
				);
			}

			const { data: existing } = await supabase
				.from("job_applications")
				.select("id")
				.eq("job_id", jobId)
				.eq("professional_id", user.id)
				.single();

			if (existing) setAlreadyApplied(true);

			setLoading(false);
		};

		init();
	}, [id, router, supabase]);

	const handleSubmit = async () => {
		if (
			!coverLetter.trim() ||
			!proposedRate ||
			!estimatedDelivery ||
			!relevantExperience.trim()
		) {
			setError("Please fill in all fields.");
			return;
		}

		// Validate screening answers if present
		if (job?.screening_questions && job.screening_questions.length > 0) {
			if (screeningAnswers.some((answer) => !answer.trim())) {
				setError("Please answer all screening questions.");
				return;
			}
		}

		if (parseFloat(proposedRate) <= 0) {
			setError("Please enter a valid rate.");
			return;
		}

		setSubmitting(true);
		setError("");

		const jobId =
			typeof id === "string" ? id : Array.isArray(id) ? id[0] : undefined;
		if (!jobId) {
			setError("Job not found.");
			setSubmitting(false);
			return;
		}

		try {
			let portfolioAttachmentUrl: string | null = null;
			if (portfolioMode === "upload" && portfolioFile) {
				const allowed = [
					"application/pdf",
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				];
				const ext = portfolioFile.name.split(".").pop()?.toLowerCase();
				if (
					!allowed.includes(portfolioFile.type) ||
					!["pdf", "docx"].includes(ext || "")
				) {
					setError("Only PDF and DOCX files are allowed.");
					setSubmitting(false);
					return;
				}

				setUploadProgress("uploading");
				const {
					data: { user: uploadUser },
				} = await supabase.auth.getUser();
				const cleanName = portfolioFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
				const uploadPath = `${uploadUser!.id}/portfolio-${Date.now()}-${cleanName}`;

				const { error: uploadError } = await supabase.storage
					.from("portfolio-attachments")
					.upload(uploadPath, portfolioFile, {
						contentType: portfolioFile.type,
						upsert: false,
					});

				if (uploadError) {
					setUploadProgress("error");
					setError(`File upload failed: ${uploadError.message}`);
					setSubmitting(false);
					return;
				}

				setUploadProgress("done");
				portfolioAttachmentUrl = uploadPath;
			}

			const response = await fetch("/api/apply", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					jobId,
					coverLetter,
					proposedRate,
					estimatedDelivery,
					relevantExperience,
					questionsForClient,
					screeningAnswers:
						screeningAnswers.length > 0 ? screeningAnswers : null,
					portfolioItemId:
						portfolioMode === "existing" ? selectedPortfolioItemId : null,
					portfolioAttachmentUrl,
				}),
			});

			const result = await response.json().catch(() => ({}));
			if (!response.ok) {
				setError(result?.error || "Failed to submit application.");
				if (response.status === 409) {
					setAlreadyApplied(true);
				}
				return;
			}

			setSuccess(true);
			setUploadProgress("idle");
			setTimeout(() => router.push("/jobs"), 2000);
		} catch (error) {
			console.error("Application submit failed:", error);
			setError("Network error. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	const professionalReceives = proposedRate
		? (parseFloat(proposedRate) * 0.95).toLocaleString(undefined, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			})
		: "0.00";

	const jobTypeLabel = (type: string) => {
		switch (type) {
			case "remote":
				return "Remote";
			case "on_site":
				return "On-site";
			case "hybrid":
				return "Hybrid";
			default:
				return type;
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center transition-colors duration-300">
				<div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
			</div>
		);
	}

	if (error && !job) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center text-red-500 dark:text-red-400 transition-colors duration-300">
				{error}
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-300">
			{/* Header */}
			<div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center gap-4">
				<BackButton label="Back to Job" />
				<span className="text-gray-300 dark:text-gray-600">|</span>
				<span className="text-gray-500 dark:text-gray-400 text-sm">
					Apply for Job
				</span>
			</div>

			<div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
				{/* Job Summary */}
				{job && (
					<div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-3">
						<div className="flex items-start justify-between gap-4">
							<div>
								<h1 className="text-xl font-semibold text-gray-900 dark:text-white">
									{job.title}
								</h1>
								<p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
									{jobTypeLabel(job.job_type)}
									{job.location ? ` · ${job.location}` : ""}
								</p>
							</div>
							<span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium px-3 py-1 rounded-full border border-emerald-500/20 whitespace-nowrap">
								${job.budget.toLocaleString()} {job.budget_type}
							</span>
						</div>
						<p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed line-clamp-3">
							{job.description}
						</p>
					</div>
				)}

				{/* Already Applied */}
				{alreadyApplied ? (
					<div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6 text-center space-y-2">
						<p className="text-yellow-600 dark:text-yellow-400 font-medium">
							You&apos;ve already applied to this job.
						</p>
						<p className="text-gray-500 dark:text-gray-400 text-sm">
							Check your dashboard for application status.
						</p>
						<button
							onClick={() => router.push("/dashboard/professional")}
							className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
						>
							Go to Dashboard →
						</button>
					</div>
				) : success ? (
					<div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-2">
						<p className="text-emerald-600 dark:text-emerald-400 font-semibold text-lg inline-flex items-center gap-2">
							<PartyPopper className="w-5 h-5" />
							Application Submitted!
						</p>
						<p className="text-gray-500 dark:text-gray-400 text-sm">
							Redirecting you back to jobs...
						</p>
					</div>
				) : (
					<div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-6">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
							Your Proposal
						</h2>

						{/* Cover Letter */}
						<div className="space-y-2">
							<label className="text-sm text-gray-700 dark:text-gray-300 font-medium">
								Cover Letter <span className="text-red-400">*</span>
							</label>
							<textarea
								rows={6}
								placeholder="Introduce yourself. Why are you the best fit for this job? What's your relevant experience?"
								value={coverLetter}
								onChange={(e) => setCoverLetter(e.target.value)}
								maxLength={1000}
								className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors resize-none"
							/>
							<p className="text-xs text-gray-400 dark:text-gray-500">
								{coverLetter.length} / 1000 characters
							</p>
						</div>

						{/* Proposed Rate */}
						{(!job?.budget_model || job?.budget_model === "negotiable") && (
							<div className="space-y-2">
								<label className="text-sm text-gray-700 dark:text-gray-300 font-medium">
									What are you expecting to be paid? ($){" "}
									<span className="text-red-400">*</span>
								</label>
								{job?.budget_model === "negotiable" && (
									<div className="rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300">
										Client budget: ${job?.budget.toLocaleString()}{" "}
										{job?.budget_type}
									</div>
								)}
								<div className="relative">
									<span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
										$
									</span>
									<input
										type="number"
										placeholder="0.00"
										value={proposedRate}
										min="1"
										onChange={(e) => setProposedRate(e.target.value)}
										onKeyDown={(e) => {
											if (["e", "E", "+", "-"].includes(e.key)) {
												e.preventDefault();
											}
										}}
										className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl pl-8 pr-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
									/>
								</div>
								<p className="text-xs text-gray-400 dark:text-gray-500">
									SurveyConnectHub takes 5% commission. You&apos;ll receive{" "}
									<span className="text-emerald-600 dark:text-emerald-400 font-medium">
										${professionalReceives}
									</span>
								</p>
							</div>
						)}
						{job?.budget_model === "fixed" && (
							<div className="rounded-xl border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 px-4 py-3">
								<p className="text-sm text-green-700 dark:text-green-400 font-medium">
									Fixed Price Job — Rate: ${job.budget.toLocaleString()}{" "}
									{job.budget_type}
								</p>
								<p className="text-xs text-green-600 dark:text-green-500 mt-1">
									You receive ${(job.budget * 0.95).toFixed(2)} after 5%
									platform fee
								</p>
							</div>
						)}

						{/* Estimated Delivery */}
						<div className="space-y-2">
							<label
								htmlFor="estimated-delivery"
								className="text-sm text-gray-700 dark:text-gray-300 font-medium"
							>
								Estimated Delivery <span className="text-red-400">*</span>
							</label>
							<select
								id="estimated-delivery"
								value={estimatedDelivery}
								onChange={(e) => setEstimatedDelivery(e.target.value)}
								className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white dark:placeholder-gray-400 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
							>
								<option value="">Select delivery timeframe</option>
								<option value="1_day">1 Day</option>
								<option value="3_days">3 Days</option>
								<option value="1_week">1 Week</option>
								<option value="2_weeks">2 Weeks</option>
								<option value="1_month">1 Month</option>
								<option value="3_months">3 Months</option>
							</select>
						</div>

						<div className="space-y-2">
							<label className="text-sm text-gray-700 dark:text-gray-300 font-medium">
								Relevant Experience <span className="text-red-400">*</span>
							</label>
							<textarea
								rows={4}
								placeholder="Describe your relevant experience for this specific job."
								value={relevantExperience}
								onChange={(e) => setRelevantExperience(e.target.value)}
								className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors resize-none"
							/>
						</div>

						<div className="space-y-2">
							<label className="text-sm text-gray-700 dark:text-gray-300 font-medium">
								Questions for Client
							</label>
							<textarea
								rows={3}
								placeholder="List any questions you need answered before starting."
								value={questionsForClient}
								onChange={(e) => setQuestionsForClient(e.target.value)}
								className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors resize-none"
							/>
						</div>

						<div className="space-y-3">
							<label className="text-sm text-gray-700 dark:text-gray-300 font-medium">
								Portfolio Attachment
							</label>
							<div className="flex flex-wrap gap-3 text-sm">
								{portfolioItems.length > 0 && (
									<label className="flex items-center gap-2">
										<input
											type="radio"
											checked={portfolioMode === "existing"}
											onChange={() => setPortfolioMode("existing")}
											className="text-emerald-600 dark:text-white"
										/>
										Use existing
									</label>
								)}
								<label className="flex items-center gap-2">
									<input
										type="radio"
										checked={portfolioMode === "upload"}
										onChange={() => setPortfolioMode("upload")}
										className="text-emerald-600 dark:text-white"
									/>
									Upload new
								</label>
							</div>

							{portfolioMode === "existing" && portfolioItems.length > 0 && (
								<select
									value={selectedPortfolioItemId}
									onChange={(e) => setSelectedPortfolioItemId(e.target.value)}
									aria-label="Select portfolio item"
									className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white dark:placeholder-gray-400 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
								>
									{portfolioItems.map((item) => (
										<option
											key={item.id}
											value={item.id}
										>
											{item.title || item.file_url}
										</option>
									))}
								</select>
							)}

							{portfolioMode === "upload" && (
								<div className="space-y-2">
									<input
										type="file"
										accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
										onChange={(e) => {
											const file = e.target.files?.[0] || null;
											if (file) {
												const allowed = [
													"application/pdf",
													"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
												];
												const ext = file.name.split(".").pop()?.toLowerCase();
												if (
													!allowed.includes(file.type) ||
													!["pdf", "docx"].includes(ext || "")
												) {
													setError("Only PDF and DOCX files are allowed.");
													e.target.value = "";
													setPortfolioFile(null);
													return;
												}
												if (file.size > 5 * 1024 * 1024) {
													setError("File must be under 5MB.");
													e.target.value = "";
													setPortfolioFile(null);
													return;
												}
												setError("");
												setUploadProgress("idle");
												setPortfolioFile(file);
											}
										}}
										aria-label="Upload portfolio file"
										className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
									/>
									{portfolioFile && uploadProgress === "idle" && (
										<p className="text-xs text-emerald-600 dark:text-emerald-400">
											✓ {portfolioFile.name} (
											{(portfolioFile.size / 1024).toFixed(0)}KB) ready to
											upload
										</p>
									)}
									{uploadProgress === "uploading" && (
										<div className="space-y-1">
											<p className="text-xs text-gray-500 dark:text-gray-400">
												Uploading file...
											</p>
											<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
												<div className="bg-emerald-500 h-1.5 rounded-full animate-pulse w-3/4" />
											</div>
										</div>
									)}
									{uploadProgress === "done" && (
										<p className="text-xs text-emerald-600 dark:text-emerald-400">
											✓ File uploaded successfully
										</p>
									)}
									{uploadProgress === "error" && (
										<p className="text-xs text-red-500">
											✗ Upload failed. Please try again.
										</p>
									)}
								</div>
							)}
						</div>

						{/* Screening Questions */}
						{job?.screening_questions && job.screening_questions.length > 0 && (
							<div className="border-t border-gray-200 dark:border-gray-700 pt-6">
								<h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
									Screening Questions
								</h3>
								<div className="space-y-4">
									{job.screening_questions.map((question, index) => (
										<div
											key={index}
											className="space-y-2"
										>
											<label className="text-sm text-gray-700 dark:text-gray-300 font-medium">
												{index + 1}. {question}
												<span className="text-red-400"> *</span>
											</label>
											<textarea
												rows={3}
												placeholder="Your answer..."
												value={screeningAnswers[index] || ""}
												onChange={(e) => {
													const newAnswers = [...screeningAnswers];
													newAnswers[index] = e.target.value;
													setScreeningAnswers(newAnswers);
												}}
												className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors resize-none"
											/>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Error */}
						{error && (
							<div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-500 dark:text-red-400 text-sm">
								{error}
							</div>
						)}

						{/* Submit */}
						<button
							onClick={handleSubmit}
							disabled={submitting}
							className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
						>
							{submitting ? (
								<>
									<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
									Submitting...
								</>
							) : (
								"Submit Application"
							)}
						</button>

						<p className="text-xs text-gray-400 dark:text-gray-500 text-center">
							By applying, you agree to SurveyConnectHub&apos;s terms. The
							client will review your proposal and may reach out via the
							platform.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
