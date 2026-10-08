"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Profile, ProfessionalProfile } from "@/types/database";
import { getProfessionLabel } from "@/lib/constants";
import {
	AlertTriangle,
	Briefcase,
	CheckCircle2,
	DollarSign,
	FileCheck,
	FileText,
	History,
	IdCard,
	Info,
	Users,
} from "lucide-react";
import { LoadingButton } from "@/components/ui/LoadingButton";
import BackButton from "@/components/ui/BackButton";
import ActionModal from "@/components/ui/ActionModal";

export type AdminStats = {
	totalUsers: number;
	totalClients: number;
	totalProfessionals: number;
	totalJobs: number;
	totalContracts: number;
	platformRevenue: number;
	pendingVerifications: number;
};

type PendingProfileInfo = Pick<Profile, "full_name" | "email" | "country">;

export type PendingProfessional = Pick<
	ProfessionalProfile,
	| "id"
	| "profession_type"
	| "license_number"
	| "years_experience"
	| "id_document_url"
	| "license_url"
	| "verification_status"
	| "created_at"
> & {
	profiles: PendingProfileInfo | null;
};

type AdminContentProps = {
	initialStats: AdminStats;
	initialPendingProfessionals: PendingProfessional[];
};

type ForceContract = {
	id: string;
	status: string;
	agreedBudget: number;
	professionalReceives: number;
	isMilestoneBased: boolean;
	paymentReleasedAt: string | null;
	jobTitle: string | null;
	professionalName: string | null;
	professionalEmail: string | null;
	clientName: string | null;
	clientEmail: string | null;
	hasBankDetails: boolean;
	hasOpenReport?: boolean;
	openReport?: {
		id: string;
		reason: string;
		details: string | null;
		created_at: string;
	} | null;
};

type AdminActionLog = {
	id: string;
	action: string;
	contractId: string | null;
	details: Record<string, unknown> | null;
	createdAt: string;
	adminName: string;
};

function ContractStatusBadge({ status }: { status: string }) {
	const styles: Record<string, string> = {
		pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
		active: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
		completed: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
		disputed: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
		cancelled: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
	};
	return (
		<span
			className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
				styles[status] || styles.cancelled
			}`}
		>
			{status}
		</span>
	);
}

export default function AdminContent({
	initialStats,
	initialPendingProfessionals,
}: AdminContentProps) {
	const supabase = createClient();
	const [stats, setStats] = useState<AdminStats>(initialStats);
	const [pendingProfessionals, setPendingProfessionals] = useState<
		PendingProfessional[]
	>(initialPendingProfessionals);
	const [actionLoading, setActionLoading] = useState<{
		id: string;
		type: "verified" | "rejected";
	} | null>(null);
	const [message, setMessage] = useState("");
	const [noticeModal, setNoticeModal] = useState<{
		title: string;
		message: string;
	} | null>(null);
	const [forceInput, setForceInput] = useState("");
	const [forceLookupLoading, setForceLookupLoading] = useState(false);
	const [forceLookupError, setForceLookupError] = useState("");
	const [forceContract, setForceContract] = useState<ForceContract | null>(null);
	const [forceModalOpen, setForceModalOpen] = useState(false);
	const [forceSubmitting, setForceSubmitting] = useState(false);
	const [forceMessage, setForceMessage] = useState("");
	const [pendingContracts, setPendingContracts] = useState<ForceContract[]>([]);
	const [adminActions, setAdminActions] = useState<AdminActionLog[]>([]);

	const refreshForcePanel = useCallback(async () => {
		try {
			const response = await fetch("/api/admin/force-release");
			if (!response.ok) return;
			const data = await response.json();
			setPendingContracts(data.pendingContracts || []);
			setAdminActions(data.actions || []);
		} catch {
			// Non-critical
		}
	}, []);

	useEffect(() => {
		refreshForcePanel();
	}, [refreshForcePanel]);

	const lookupContract = async (id: string) => {
		const trimmed = id.trim();
		if (!trimmed) {
			setForceLookupError("Enter a contract ID");
			return;
		}
		setForceLookupLoading(true);
		setForceLookupError("");
		try {
			const response = await fetch(
				`/api/admin/force-release?contractId=${encodeURIComponent(trimmed)}`,
			);
			const data = await response.json();
			if (!response.ok) {
				setForceContract(null);
				setForceLookupError(data.error || "Contract not found");
				return;
			}
			setForceContract(data.contract);
		} catch {
			setForceContract(null);
			setForceLookupError("Something went wrong. Please try again.");
		} finally {
			setForceLookupLoading(false);
		}
	};

	const handleForceRelease = async () => {
		if (!forceContract) return;
		setForceSubmitting(true);
		try {
			const response = await fetch("/api/admin/force-release", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ contractId: forceContract.id }),
			});
			const data = await response.json();
			if (!response.ok) {
				setForceModalOpen(false);
				setForceLookupError(data.error || "Force release failed");
				setForceSubmitting(false);
				return;
			}
			setForceModalOpen(false);
			setForceMessage(
				`Payment force-released — $${forceContract.professionalReceives.toFixed(2)} sent to ${
					forceContract.professionalName || "the professional"
				}.`,
			);
			setForceContract(null);
			setForceInput("");
			refreshForcePanel();
			setTimeout(() => setForceMessage(""), 6000);
		} catch {
			setForceLookupError("Something went wrong. Please try again.");
		} finally {
			setForceSubmitting(false);
		}
	};

	const handleViewDocument = async (pathOrUrl: string) => {
		try {
			const response = await fetch("/api/admin/signed-url", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: pathOrUrl }),
			});

			if (!response.ok) {
				throw new Error(`Signed URL request failed: ${response.status}`);
			}

			const data = await response.json();
			if (data.signedUrl) {
				window.open(data.signedUrl, "_blank");
				return;
			}

			throw new Error("Signed URL missing");
		} catch (error) {
			console.error("Failed to load document:", error);
			setNoticeModal({
				title: "Could not load document",
				message: "Please try again or refresh the page.",
			});
		}
	};

	const handleVerify = async (
		professionalId: string,
		action: "verified" | "rejected",
		prof: PendingProfessional,
	) => {
		setActionLoading({ id: professionalId, type: action });
		setMessage("");

		try {
			const { error } = await supabase
				.from("professional_profiles")
				.update({ verification_status: action })
				.eq("id", professionalId);

			if (error) {
				setMessage("Something went wrong.");
				return;
			}

			if (action === "verified" && prof.license_url) {
				let licensePath = prof.license_url;
				if (prof.license_url.includes("/storage/v1/object/")) {
					const parts = prof.license_url.split("/verification-documents/");
					licensePath = parts[1] || prof.license_url;
				}
				await supabase.storage
					.from("verification-documents")
					.remove([licensePath]);
			}

			if (action === "verified") {
				try {
					const { data: profile, error: profileError } = await supabase
						.from("profiles")
						.select("email, full_name")
						.eq("id", professionalId)
						.single();

					if (profileError || !profile?.email) {
						throw profileError || new Error("Missing profile email");
					}

					const recipientName = profile.full_name || prof.profiles?.full_name;
					const professionalName = recipientName || "Professional";
					const professionType = getProfessionLabel(prof.profession_type);

					const notifyResponse = await fetch("/api/notify", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							event: "verification_approved",
							recipientEmail: profile.email,
							recipientName: recipientName || "Professional",
							details: {
								professionalName,
								professionType,
								professionalId,
							},
						}),
					});

					if (!notifyResponse.ok) {
						console.error(
							"Failed to send verification approval email:",
							await notifyResponse.text(),
						);
					}
				} catch (error) {
					console.error("Failed to send verification approval email:", error);
				}
			}

			setPendingProfessionals((prev) =>
				prev.filter((p) => p.id !== professionalId),
			);
			setStats((prev) => ({
				...prev,
				pendingVerifications: Math.max(prev.pendingVerifications - 1, 0),
			}));
			setMessage(
				action === "verified"
					? "Professional verified! License certificate deleted from storage."
					: "Professional rejected.",
			);
			setTimeout(() => setMessage(""), 4000);
		} finally {
			setActionLoading(null);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
			<nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Image
						src="/logo.png"
						alt="SurveyConnectHub"
						width={40}
						height={40}
						className="h-10 w-auto"
						onError={(e) => (e.currentTarget.style.display = "none")}
					/>
					<h1 className="text-xl font-bold text-gray-900 dark:text-white">
						Survey<span className="text-green-600">ConnectHub</span>
					</h1>
					<span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold px-2 py-1 rounded-full">
						ADMIN
					</span>
				</div>
				<BackButton
					href="/dashboard/client"
					label="Dashboard"
				/>
			</nav>

			<div className="max-w-6xl mx-auto px-6 py-8">
				<div className="mb-8">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
						Admin Dashboard
					</h2>
					<p className="text-gray-500 dark:text-gray-400 mt-1">
						Platform overview and verification management
					</p>
				</div>

				{message && (
					<div
						className={`rounded-xl p-4 mb-6 text-sm font-medium ${
							message.includes("verified") || message.includes("deleted")
								? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
								: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
						}`}
					>
						{message}
					</div>
				)}

				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
						<div className="flex items-center gap-2 mb-2">
							<Users className="w-4 h-4 text-blue-500" />
							<p className="text-gray-500 dark:text-gray-400 text-xs">
								Total Users
							</p>
						</div>
						<p className="text-2xl font-bold text-gray-900 dark:text-white">
							{stats.totalUsers}
						</p>
						<p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
							{stats.totalClients} clients · {stats.totalProfessionals}{" "}
							professionals
						</p>
					</div>
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
						<div className="flex items-center gap-2 mb-2">
							<Briefcase className="w-4 h-4 text-green-500" />
							<p className="text-gray-500 dark:text-gray-400 text-xs">
								Total Jobs
							</p>
						</div>
						<p className="text-2xl font-bold text-gray-900 dark:text-white">
							{stats.totalJobs}
						</p>
					</div>
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
						<div className="flex items-center gap-2 mb-2">
							<FileCheck className="w-4 h-4 text-purple-500" />
							<p className="text-gray-500 dark:text-gray-400 text-xs">
								Total Contracts
							</p>
						</div>
						<p className="text-2xl font-bold text-gray-900 dark:text-white">
							{stats.totalContracts}
						</p>
					</div>
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
						<div className="flex items-center gap-2 mb-2">
							<DollarSign className="w-4 h-4 text-green-500" />
							<p className="text-gray-500 dark:text-gray-400 text-xs">
								Platform Revenue
							</p>
						</div>
						<p className="text-2xl font-bold text-green-600 dark:text-green-400">
							${stats.platformRevenue.toLocaleString()}
						</p>
					</div>
				</div>

				<div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
					<div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
						<div>
							<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
								Pending Verifications
							</h3>
							<p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
								{stats.pendingVerifications} professional
								{stats.pendingVerifications !== 1 ? "s" : ""} awaiting review
							</p>
						</div>
						{stats.pendingVerifications > 0 && (
							<span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-sm font-bold px-3 py-1 rounded-full">
								{stats.pendingVerifications} pending
							</span>
						)}
					</div>

					{pendingProfessionals.length === 0 ? (
						<div className="p-12 text-center">
							<div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
								<CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
							</div>
							<p className="text-gray-500 dark:text-gray-400">
								No pending verifications
							</p>
						</div>
					) : (
						<div className="divide-y divide-gray-100 dark:divide-gray-800">
							{pendingProfessionals.map((prof) => (
								<div
									key={prof.id}
									className="p-6"
								>
									<div className="flex items-start justify-between gap-4 flex-wrap">
										<div className="flex-1">
											<div className="flex items-center gap-3 mb-3">
												<div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
													<span className="text-green-700 dark:text-green-300 text-sm font-bold">
														{prof.profiles?.full_name
															?.split(" ")
															.map((n: string) => n[0])
															.slice(0, 2)
															.join("") || "??"}
													</span>
												</div>
												<div>
													<p className="font-semibold text-gray-900 dark:text-white">
														{prof.profiles?.full_name}
													</p>
													<p className="text-xs text-gray-500 dark:text-gray-400">
														{prof.profiles?.email} · {prof.profiles?.country}
													</p>
												</div>
											</div>

											<div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
												<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
													<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
														Profession
													</p>
													<p className="text-sm font-medium text-gray-900 dark:text-white">
														{getProfessionLabel(prof.profession_type)}
													</p>
												</div>
												<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
													<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
														License Number
													</p>
													<p className="text-sm font-medium text-gray-900 dark:text-white">
														{prof.license_number || (
															<span className="text-gray-400 italic">
																Not provided
															</span>
														)}
													</p>
												</div>
												{prof.years_experience != null && prof.years_experience > 0 && (
													<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
														<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
															Experience
														</p>
														<p className="text-sm font-medium text-gray-900 dark:text-white">
															{prof.years_experience} year
															{prof.years_experience !== 1 ? "s" : ""}
														</p>
													</div>
												)}
											</div>

											<div className="flex gap-3 flex-wrap">
												{prof.id_document_url ? (
													<button
														onClick={() =>
															handleViewDocument(prof.id_document_url || "")
														}
														className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-sm font-medium px-4 py-2 rounded-xl transition-colors border border-blue-200 dark:border-blue-800"
													>
														<IdCard className="w-4 h-4" />
														View ID Document
													</button>
												) : (
													<span className="text-xs text-gray-400 dark:text-gray-600 italic">
														No ID document uploaded
													</span>
												)}
												{prof.license_url ? (
													<button
														onClick={() =>
															handleViewDocument(prof.license_url || "")
														}
														className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-400 text-sm font-medium px-4 py-2 rounded-xl transition-colors border border-purple-200 dark:border-purple-800"
													>
														<FileText className="w-4 h-4" />
														View License
													</button>
												) : (
													<span className="text-xs text-gray-400 dark:text-gray-600 italic">
														No license uploaded
													</span>
												)}
											</div>

											<div className="flex items-start gap-2 mt-3">
												<Info className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
												<p className="text-xs text-gray-400 dark:text-gray-600">
													Approving will delete the license certificate from
													storage (license number is saved in DB)
												</p>
											</div>
										</div>

										<div className="flex flex-col gap-2 shrink-0">
											<LoadingButton
												onClick={() => handleVerify(prof.id, "verified", prof)}
												isLoading={
													actionLoading?.id === prof.id &&
													actionLoading?.type === "verified"
												}
												loadingText="Updating..."
												className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm font-semibold px-6 py-2 rounded-xl transition-colors"
											>
												Approve
											</LoadingButton>
											<LoadingButton
												onClick={() => handleVerify(prof.id, "rejected", prof)}
												isLoading={
													actionLoading?.id === prof.id &&
													actionLoading?.type === "rejected"
												}
												loadingText="Updating..."
												className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 text-sm font-semibold px-6 py-2 rounded-xl transition-colors"
											>
												Reject
											</LoadingButton>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 mt-8">
					<div className="p-6 border-b border-gray-100 dark:border-gray-800">
						<div className="flex items-center gap-2">
							<AlertTriangle className="w-4 h-4 text-red-500" />
							<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
								Force Payment Release
							</h3>
						</div>
						<p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
							Release escrow for a flat-rate contract outside the normal
							client flow (e.g. when the client has gone silent). This
							moves real money — every release is recorded in the admin
							action log below.
						</p>
					</div>

					<div className="p-6">
						{forceMessage && (
							<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg mb-6 text-sm font-medium">
								{forceMessage}
							</div>
						)}

						<div className="flex gap-3 mb-3">
							<input
								value={forceInput}
								onChange={(e) => setForceInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") lookupContract(forceInput);
								}}
								placeholder="Contract ID"
								className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
							/>
							<button
								onClick={() => lookupContract(forceInput)}
								disabled={forceLookupLoading}
								className="bg-gray-900 dark:bg-white hover:opacity-80 disabled:opacity-50 text-white dark:text-gray-900 text-sm font-semibold px-5 py-2.5 rounded-xl transition-opacity"
							>
								{forceLookupLoading ? "Looking up..." : "Look up contract"}
							</button>
						</div>

						{forceLookupError && (
							<p className="text-sm text-red-500 mb-4" role="alert">
								{forceLookupError}
							</p>
						)}

						{forceContract && (
							<div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
								<div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
									<div>
										<p className="font-semibold text-gray-900 dark:text-white">
											{forceContract.jobTitle || "Untitled job"}
										</p>
										<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
											{forceContract.professionalName || "Unknown professional"}
											{" · "}
											{forceContract.id}
										</p>
									</div>
									<ContractStatusBadge status={forceContract.status} />
								</div>
								<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
									<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
										<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
											Agreed Budget
										</p>
										<p className="text-sm font-medium text-gray-900 dark:text-white">
											${forceContract.agreedBudget.toLocaleString()}
										</p>
									</div>
									<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
										<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
											Professional Receives (95%)
										</p>
										<p className="text-sm font-medium text-gray-900 dark:text-white">
											${forceContract.professionalReceives.toFixed(2)}
										</p>
									</div>
									<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
										<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
											Bank Details
										</p>
										<p className="text-sm font-medium text-gray-900 dark:text-white">
											{forceContract.hasBankDetails ? "On file" : "Missing"}
										</p>
									</div>
									<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
										<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
											Type
										</p>
										<p className="text-sm font-medium text-gray-900 dark:text-white">
											{forceContract.isMilestoneBased
												? "Milestone-based"
												: "Flat-rate"}
										</p>
									</div>
								</div>

								<div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
									<p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
										Contact the parties
									</p>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
										<div>
											<p className="text-sm font-medium text-gray-900 dark:text-white">
												Client: {forceContract.clientName || "Unknown"}
											</p>
											<a
												href={
													forceContract.clientEmail
														? `mailto:${forceContract.clientEmail}`
														: undefined
												}
												className={`text-sm ${
													forceContract.clientEmail
														? "text-green-600 hover:underline"
														: "text-gray-400"
												}`}
											>
												{forceContract.clientEmail || "No email on file"}
											</a>
										</div>
										<div>
											<p className="text-sm font-medium text-gray-900 dark:text-white">
												Professional:{" "}
												{forceContract.professionalName || "Unknown"}
											</p>
											<a
												href={
													forceContract.professionalEmail
														? `mailto:${forceContract.professionalEmail}`
														: undefined
												}
												className={`text-sm ${
													forceContract.professionalEmail
														? "text-green-600 hover:underline"
														: "text-gray-400"
												}`}
											>
												{forceContract.professionalEmail ||
													"No email on file"}
											</a>
										</div>
									</div>
								</div>

								{forceContract.openReport && (
									<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
										<p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">
											Open report on this contract
										</p>
										<p className="text-sm font-medium text-gray-900 dark:text-white">
											{forceContract.openReport.reason}
										</p>
										{forceContract.openReport.details && (
											<p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
												{forceContract.openReport.details}
											</p>
										)}
										<p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
											Reported on{" "}
											{new Date(
												forceContract.openReport.created_at,
											).toLocaleString()}
										</p>
									</div>
								)}

								<button
									onClick={() => setForceModalOpen(true)}
									disabled={
										!forceContract.hasBankDetails ||
										Boolean(forceContract.paymentReleasedAt) ||
										forceContract.isMilestoneBased
									}
									className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
								>
									Force Release Payment
								</button>
								{!forceContract.hasBankDetails && (
									<p className="text-xs text-red-500 mt-2">
										Blocked: the professional has not added bank details.
									</p>
								)}
								{forceContract.isMilestoneBased && (
									<p className="text-xs text-red-500 mt-2">
										Blocked: milestone-based contracts use the per-milestone
										release flow.
									</p>
								)}
								{forceContract.paymentReleasedAt && (
									<p className="text-xs text-green-600 mt-2">
										Payment already released on{" "}
										{new Date(
											forceContract.paymentReleasedAt,
										).toLocaleString()}
										.
									</p>
								)}
							</div>
						)}

						<div className="flex items-center gap-2 mb-3">
							<Info className="w-3.5 h-3.5 text-gray-400" />
							<p className="text-sm font-medium text-gray-600 dark:text-gray-300">
								Unreleased contracts (20 most recent)
							</p>
						</div>
						{pendingContracts.length === 0 ? (
							<p className="text-sm text-gray-400 dark:text-gray-600 italic">
								No unreleased contracts right now.
							</p>
						) : (
							<ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-100 dark:border-gray-800">
								{pendingContracts.map((contract) => (
									<li
										key={contract.id}
										className="p-4 flex items-center justify-between gap-4"
									>
										<div className="min-w-0">
											<p className="font-medium text-gray-900 dark:text-white truncate">
												{contract.jobTitle || "Untitled job"}
											</p>
											<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
												{contract.professionalName || "Unknown professional"}
												{" · "}
												{contract.id.slice(0, 8)}… {" · $"}
												{contract.agreedBudget.toLocaleString()}
											</p>
										</div>
										<div className="flex items-center gap-3 shrink-0">
											<ContractStatusBadge status={contract.status} />
											{contract.hasOpenReport && (
												<span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium px-2.5 py-0.5 rounded-full">
													Disputed
												</span>
											)}
											<button
												onClick={() => lookupContract(contract.id)}
												className="text-sm font-medium text-green-600 hover:underline"
											>
												Select
											</button>
										</div>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>

				<div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 mt-8">
					<div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
						<History className="w-4 h-4 text-gray-400" />
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
							Admin action log
						</h3>
					</div>
					{adminActions.length === 0 ? (
						<div className="p-12 text-center text-sm text-gray-400 dark:text-gray-600">
							No admin actions recorded yet.
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
										<th className="px-6 py-3 font-medium">Admin</th>
										<th className="px-6 py-3 font-medium">Action</th>
										<th className="px-6 py-3 font-medium">Contract</th>
										<th className="px-6 py-3 font-medium">Amount</th>
										<th className="px-6 py-3 font-medium">When</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100 dark:divide-gray-800">
									{adminActions.map((action) => (
										<tr key={action.id}>
											<td className="px-6 py-3 text-gray-900 dark:text-white">
												{action.adminName}
											</td>
											<td className="px-6 py-3">
												<span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium px-2.5 py-0.5 rounded-full">
													{action.action.replace(/_/g, " ")}
												</span>
											</td>
											<td className="px-6 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
												{action.contractId?.slice(0, 12) || "—"}…
											</td>
											<td className="px-6 py-3 text-gray-900 dark:text-white">
												{action.details?.professional_receives_usd != null
													? `$${Number(action.details.professional_receives_usd).toFixed(2)}`
													: "—"}
											</td>
											<td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">
												{new Date(action.createdAt).toLocaleString()}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>

			<ActionModal
				open={Boolean(noticeModal)}
				onClose={() => setNoticeModal(null)}
				variant="info"
				title={noticeModal?.title ?? "Notice"}
				description={noticeModal?.message}
				confirmLabel="Got it"
				showCancel={false}
			/>

			<ActionModal
				open={forceModalOpen}
				onClose={() => setForceModalOpen(false)}
				variant="danger"
				title="Force release payment?"
				description={
					forceContract
						? `This will send $${forceContract.professionalReceives.toFixed(2)} to ${
								forceContract.professionalName || "the professional"
						  } via Paystack outside the normal client approval flow. The contract does not need to be marked completed. This cannot be undone.`
						: undefined
				}
				confirmLabel="Release payment"
				onConfirm={handleForceRelease}
				isProcessing={forceSubmitting}
			/>
		</div>
	);
}
