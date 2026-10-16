"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, X } from "lucide-react";
import { useLoadingState } from "@/hooks/useLoadingState";
import { LoadingButton } from "@/components/ui/LoadingButton";
import BackButton from "@/components/ui/BackButton";
import ActionModal from "@/components/ui/ActionModal";
import { SOFTWARE_TOOL_OPTIONS as softwareToolOptions } from "@/lib/constants";

type Bank = {
	code: string;
	name: string;
};

function SettingsModal({
	title,
	onClose,
	children,
}: {
	title: string;
	onClose: () => void;
	children: React.ReactNode;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center px-4">
			<div
				className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
				onClick={onClose}
			/>
			<div
				role="dialog"
				aria-modal="true"
				className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-emerald-200/70 dark:ring-emerald-900/50"
			>
				<div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-lime-400" />
				<div className="p-6">
					<div className="flex items-start justify-between gap-4">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
							{title}
						</h2>
						<button
							type="button"
							onClick={onClose}
							className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
							aria-label="Close"
						>
							<X className="w-4 h-4" />
						</button>
					</div>
					{children}
				</div>
			</div>
		</div>
	);
}

const maskAccountNumber = (acc: string) =>
	acc ? `••••••${acc.slice(-4)}` : "Not set";

export default function AccountSettingsPage() {
	const router = useRouter();
	const supabase = useMemo(() => createClient(), []);
	const [loading, setLoading] = useState(true);
	const [isSigningOut, setIsSigningOut] = useState(false);
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [deletePassword, setDeletePassword] = useState("");
	const [deleteConfirmText, setDeleteConfirmText] = useState("");
	const [deleteError, setDeleteError] = useState("");
	const [showDeletePassword, setShowDeletePassword] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [signOutModalOpen, setSignOutModalOpen] = useState(false);
	const { isLoading: isSavingProfile, withLoading: withProfileLoading } =
		useLoadingState();
	const {
		isLoading: isSavingPreferences,
		withLoading: withPreferencesLoading,
	} = useLoadingState();
	const { isLoading: isSavingPassword, withLoading: withPasswordLoading } =
		useLoadingState();
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [userEmail, setUserEmail] = useState("");
	const [isProfessional, setIsProfessional] = useState(false);
	const [banks, setBanks] = useState<Bank[]>([]);
	const [softwareTools, setSoftwareTools] = useState<string[]>([]);

	const [profile, setProfile] = useState({
		full_name: "",
		phone: "",
		country: "",
		city: "",
		bio: "",
		bank_name: "",
		bank_account_number: "",
		bank_account_name: "",
	});

	const [preferences, setPreferences] = useState({
		notification_email: true,
		notification_messages: true,
		notification_marketing: false,
	});

	const [passwordForm, setPasswordForm] = useState({
		currentPassword: "",
		newPassword: "",
		confirmPassword: "",
	});
	const [passwordModalOpen, setPasswordModalOpen] = useState(false);
	const [passwordModalError, setPasswordModalError] = useState("");
	const [showCurrentPassword, setShowCurrentPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const [payoutModalOpen, setPayoutModalOpen] = useState(false);
	const [payoutModalPassword, setPayoutModalPassword] = useState("");
	const [payoutModalError, setPayoutModalError] = useState("");
	const [showPayoutPassword, setShowPayoutPassword] = useState(false);
	const [payoutEditable, setPayoutEditable] = useState(false);
	const { isLoading: isPayoutAuthLoading, withLoading: withPayoutAuthLoading } =
		useLoadingState();
	const payoutSnapshot = useRef({
		bank_name: "",
		bank_account_number: "",
		bank_account_name: "",
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

			setUserEmail(user.email || "");

			const { data: profileData, error: profileError } = await supabase
				.from("profiles")
				.select(
					"role, full_name, phone, country, city, bio, bank_name, bank_account_number, bank_account_name, notification_email, notification_messages, notification_marketing",
				)
				.eq("id", user.id)
				.single();

			if (profileError || !profileData) {
				setError("Failed to load settings");
				setLoading(false);
				return;
			}

			setIsProfessional(profileData.role === "professional");
			setProfile({
				full_name: profileData.full_name || "",
				phone: profileData.phone || "",
				country: profileData.country || "",
				city: profileData.city || "",
				bio: profileData.bio || "",
				bank_name: profileData.bank_name || "",
				bank_account_number: profileData.bank_account_number || "",
				bank_account_name: profileData.bank_account_name || "",
			});

			payoutSnapshot.current = {
				bank_name: profileData.bank_name || "",
				bank_account_number: profileData.bank_account_number || "",
				bank_account_name: profileData.bank_account_name || "",
			};

			setPreferences({
				notification_email: profileData.notification_email ?? true,
				notification_messages: profileData.notification_messages ?? true,
				notification_marketing: profileData.notification_marketing ?? false,
			});

			if (profileData.role === "professional") {
				const { data: professionalData, error: professionalError } =
					await supabase
						.from("professional_profiles")
						.select("software_tools")
						.eq("id", user.id)
						.maybeSingle();

				if (professionalError) {
					setError("Failed to load professional profile");
					setLoading(false);
					return;
				}

				setSoftwareTools(professionalData?.software_tools || []);

				const bankResponse = await fetch("/api/banks", { cache: "no-store" });
				const bankData = await bankResponse.json().catch(() => ({}));
				if (Array.isArray(bankData?.banks)) {
					setBanks(bankData.banks);
				}
			}

			setLoading(false);
		};

		init();
	}, [router, supabase]);

	const saveProfile = () => {
		setError("");
		setMessage("");

		if (!profile.full_name.trim()) {
			setError("Full name is required");
			return;
		}

		if (
			isProfessional &&
			profile.bank_account_number &&
			!/^\d{10}$/.test(profile.bank_account_number)
		) {
			setError("Bank account number must be exactly 10 digits");
			return;
		}

		withProfileLoading(async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) {
				setError("Unauthorized");
				return;
			}

			const payload: any = {
				full_name: profile.full_name.trim(),
				phone: profile.phone.trim(),
				country: profile.country.trim(),
				city: profile.city.trim(),
				bio: profile.bio.trim(),
			};

			if (isProfessional) {
				payload.bank_name = profile.bank_name || null;
				payload.bank_account_number = profile.bank_account_number || null;
				payload.bank_account_name = profile.bank_account_name || null;

				// Only reset recipient code when bank details actually change
				const { data: currentProfile } = await supabase
					.from("profiles")
					.select("bank_name, bank_account_number, bank_account_name, paystack_recipient_code")
					.eq("id", user.id)
					.single();

				if (currentProfile?.paystack_recipient_code) {
					const bankChanged =
						payload.bank_name !== currentProfile.bank_name ||
						payload.bank_account_number !== currentProfile.bank_account_number ||
						payload.bank_account_name !== currentProfile.bank_account_name;
					if (bankChanged) {
						payload.paystack_recipient_code = null;
					}
				}
			}

			const { error: updateError } = await supabase
				.from("profiles")
				.update(payload)
				.eq("id", user.id);

			if (updateError) {
				setError("Failed to update profile settings");
				return;
			}

			if (isProfessional) {
				payoutSnapshot.current = {
					bank_name: profile.bank_name || "",
					bank_account_number: profile.bank_account_number || "",
					bank_account_name: profile.bank_account_name || "",
				};
			}

			if (isProfessional) {
				const { error: professionalError } = await supabase
					.from("professional_profiles")
					.update({ software_tools: softwareTools })
					.eq("id", user.id);

				if (professionalError) {
					setError("Failed to update professional settings");
					return;
				}
			}

			setMessage("Profile settings updated");
		});
	};

	const savePreferences = () => {
		setError("");
		setMessage("");

		withPreferencesLoading(async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) {
				setError("Unauthorized");
				return;
			}

			const { error: prefError } = await supabase
				.from("profiles")
				.update(preferences)
				.eq("id", user.id);

			if (prefError) {
				setError("Failed to save notification preferences");
			} else {
				setMessage("Notification preferences updated");
			}
		});
	};

	const openPasswordModal = () => {
		setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
		setPasswordModalError("");
		setPasswordModalOpen(true);
	};

	const saveNewPassword = () => {
		setPasswordModalError("");

		if (!passwordForm.currentPassword) {
			setPasswordModalError("Please enter your current password");
			return;
		}

		if (passwordForm.newPassword.length < 8) {
			setPasswordModalError("New password must be at least 8 characters");
			return;
		}

		if (passwordForm.newPassword !== passwordForm.confirmPassword) {
			setPasswordModalError("New passwords do not match");
			return;
		}

		withPasswordLoading(async () => {
			const { error: verifyError } = await supabase.auth.signInWithPassword({
				email: userEmail,
				password: passwordForm.currentPassword,
			});

			if (verifyError) {
				setPasswordModalError("Current password is incorrect");
				return;
			}

			const { error: passwordError } = await supabase.auth.updateUser({
				password: passwordForm.newPassword,
			});

			if (passwordError) {
				setPasswordModalError(passwordError.message || "Failed to update password");
				return;
			}

			setPasswordForm({
				currentPassword: "",
				newPassword: "",
				confirmPassword: "",
			});
			setPasswordModalOpen(false);
			setMessage("Password updated successfully");
		});
	};

	const openPayoutModal = () => {
		setPayoutModalPassword("");
		setPayoutModalError("");
		setPayoutModalOpen(true);
	};

	const confirmPayoutAuth = () => {
		setPayoutModalError("");

		if (!payoutModalPassword) {
			setPayoutModalError("Please enter your current password");
			return;
		}

		withPayoutAuthLoading(async () => {
			const { error: verifyError } = await supabase.auth.signInWithPassword({
				email: userEmail,
				password: payoutModalPassword,
			});

			if (verifyError) {
				setPayoutModalError("Current password is incorrect");
				return;
			}

			setPayoutModalPassword("");
			setPayoutModalOpen(false);
			setPayoutEditable(true);
		});
	};

	const cancelPayoutEdit = () => {
		setProfile((prev) => ({ ...prev, ...payoutSnapshot.current }));
		setPayoutEditable(false);
	};

	const handleSignOut = () => {
		setSignOutModalOpen(true);
	};

	const confirmSignOut = async () => {
		setIsSigningOut(true);
		setSignOutModalOpen(false);
		await supabase.auth.signOut();
		router.push("/login");
	};

	const openDeleteModal = () => {
		setDeletePassword("");
		setDeleteConfirmText("");
		setDeleteError("");
		setShowDeletePassword(false);
		setDeleteModalOpen(true);
	};

	const confirmDeleteAccount = async () => {
		setDeleteError("");
		if (!deletePassword) {
			setDeleteError("Enter your password to continue");
			return;
		}
		if (deleteConfirmText !== "DELETE") {
			setDeleteError("Type DELETE to confirm");
			return;
		}

		setIsDeleting(true);
		try {
			const response = await fetch("/api/account/delete", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					password: deletePassword,
					confirm: deleteConfirmText,
				}),
			});
			const result = await response.json().catch(() => null);
			if (!response.ok) {
				setDeleteError(
					result?.error || "Could not delete your account. Please try again.",
				);
				return;
			}
			await supabase.auth.signOut();
			router.push("/login");
		} catch {
			setDeleteError("Could not delete your account. Please try again.");
		} finally {
			setIsDeleting(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
				<div className="text-gray-500 dark:text-gray-400">
					Loading settings...
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
					href={
						isProfessional ? "/dashboard/professional" : "/dashboard/client"
					}
					label="Dashboard"
				/>
			</nav>

			<div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
				<div>
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
						Account Settings
					</h2>
					<p className="text-gray-500 dark:text-gray-400 mt-1">
						Manage your account details and preferences
					</p>
				</div>

				{message && (
					<div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
						{message}
					</div>
				)}
				{error && (
					<div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
						{error}
					</div>
				)}

				<div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
						Profile
					</h3>
					<div>
						<label
							htmlFor="settings-full-name"
							className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							Full name <span className="text-red-500">*</span>
						</label>
						<input
							id="settings-full-name"
							type="text"
							placeholder="Full name"
							value={profile.full_name}
							onChange={(e) =>
								setProfile((prev) => ({ ...prev, full_name: e.target.value }))
							}
							className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
						/>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label
								htmlFor="settings-phone"
								className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								Phone
							</label>
							<input
								id="settings-phone"
								type="text"
								placeholder="Phone"
								value={profile.phone}
								onChange={(e) =>
									setProfile((prev) => ({ ...prev, phone: e.target.value }))
								}
								className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
							/>
						</div>
						<div>
							<label
								htmlFor="settings-country"
								className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								Country
							</label>
							<input
								id="settings-country"
								type="text"
								placeholder="Country"
								value={profile.country}
								onChange={(e) =>
									setProfile((prev) => ({ ...prev, country: e.target.value }))
								}
								className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
							/>
						</div>
					</div>
					<div>
						<label
							htmlFor="settings-city"
							className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							City
						</label>
						<input
							id="settings-city"
							type="text"
							placeholder="City"
							value={profile.city}
							onChange={(e) =>
								setProfile((prev) => ({ ...prev, city: e.target.value }))
							}
							className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
						/>
					</div>
					<div>
						<label
							htmlFor="settings-bio"
							className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							Bio
						</label>
						<textarea
							id="settings-bio"
							rows={3}
							placeholder="Bio"
							value={profile.bio}
							onChange={(e) =>
								setProfile((prev) => ({ ...prev, bio: e.target.value }))
							}
							className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 resize-none dark:text-white dark:placeholder-gray-400"
						/>
					</div>

					{isProfessional && (
						<div className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
							<div className="flex items-center justify-between">
								<p className="font-medium text-gray-900 dark:text-white">
									Payout Details
								</p>
								{payoutEditable && (
									<button
										type="button"
										onClick={cancelPayoutEdit}
										className="text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
									>
										Cancel
									</button>
								)}
							</div>

							{payoutEditable ? (
								<>
									<label
										htmlFor="settings-bank"
										className="block text-sm font-medium text-gray-700 dark:text-gray-300"
									>
										Bank
									</label>
									<select
										id="settings-bank"
										value={profile.bank_name}
										onChange={(e) =>
											setProfile((prev) => ({
												...prev,
												bank_name: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
									>
										<option value="">Select bank</option>
										{banks.map((bank) => (
											<option
												key={`${bank.code}-${bank.name}`}
												value={bank.code}
											>
												{bank.name}
											</option>
										))}
									</select>
									<div>
										<label
											htmlFor="settings-bank-account-number"
											className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
										>
											Bank account number
										</label>
										<input
											id="settings-bank-account-number"
											type="text"
											placeholder="Bank account number"
											maxLength={10}
											value={profile.bank_account_number}
											onChange={(e) =>
												setProfile((prev) => ({
													...prev,
													bank_account_number: e.target.value.replace(
														/[^0-9]/g,
														"",
													),
												}))
											}
											className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
										/>
									</div>
									<div>
										<label
											htmlFor="settings-bank-account-name"
											className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
										>
											Bank account name
										</label>
										<input
											id="settings-bank-account-name"
											type="text"
											placeholder="Bank account name"
											value={profile.bank_account_name}
											onChange={(e) =>
												setProfile((prev) => ({
													...prev,
													bank_account_name: e.target.value,
												}))
											}
											className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
										/>
									</div>
								</>
							) : (
								<div className="space-y-3 text-sm">
									<div>
										<p className="text-gray-500 dark:text-gray-400">Bank</p>
										<p className="mt-0.5 font-medium text-gray-900 dark:text-white">
											{banks.find((b) => b.code === profile.bank_name)?.name ||
												profile.bank_name ||
												"Not set"}
										</p>
									</div>
									<div>
										<p className="text-gray-500 dark:text-gray-400">
											Bank account number
										</p>
										<p className="mt-0.5 font-medium text-gray-900 dark:text-white">
											{maskAccountNumber(profile.bank_account_number)}
										</p>
									</div>
									<div>
										<p className="text-gray-500 dark:text-gray-400">
											Bank account name
										</p>
										<p className="mt-0.5 font-medium text-gray-900 dark:text-white">
											{profile.bank_account_name || "Not set"}
										</p>
									</div>
								</div>
							)}

							{payoutEditable ? (
								<p className="text-xs text-gray-500 dark:text-gray-400">
									Changes are applied when you click Save Profile.
								</p>
							) : (
								<button
									type="button"
									onClick={openPayoutModal}
									className="px-4 py-2 rounded-xl border border-green-600 text-green-600 font-semibold hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
								>
									Edit payout details
								</button>
							)}

							<div>
								<p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									GIS Software &amp; Tools
								</p>
								<p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
									Highlight the GIS tools you use in delivery workflows.
								</p>
								<div className="flex flex-wrap gap-2">
									{softwareToolOptions.map((tool) => {
										const isSelected = softwareTools.includes(tool);
										return (
											<button
												key={tool}
												type="button"
												onClick={() =>
													setSoftwareTools((prev) =>
														isSelected
															? prev.filter((item) => item !== tool)
															: [...prev, tool],
													)
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
						</div>
					)}

					<LoadingButton
						type="button"
						onClick={saveProfile}
						isLoading={isSavingProfile}
						loadingText="Saving..."
						className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
					>
						Save Profile
					</LoadingButton>
				</div>

				<div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
						Notification Preferences
					</h3>
					<label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
						<input
							type="checkbox"
							checked={preferences.notification_email}
							onChange={(e) =>
								setPreferences((prev) => ({
									...prev,
									notification_email: e.target.checked,
								}))
							}
							className="dark:text-white dark:placeholder-gray-400"
						/>
						Email notifications
					</label>
					<label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
						<input
							type="checkbox"
							checked={preferences.notification_messages}
							onChange={(e) =>
								setPreferences((prev) => ({
									...prev,
									notification_messages: e.target.checked,
								}))
							}
							className="dark:text-white dark:placeholder-gray-400"
						/>
						Message notifications
					</label>
					<label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
						<input
							type="checkbox"
							checked={preferences.notification_marketing}
							onChange={(e) =>
								setPreferences((prev) => ({
									...prev,
									notification_marketing: e.target.checked,
								}))
							}
							className="dark:text-white dark:placeholder-gray-400"
						/>
						Product and marketing updates
					</label>
					<LoadingButton
						type="button"
						onClick={savePreferences}
						isLoading={isSavingPreferences}
						loadingText="Saving..."
						className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
					>
						Save Preferences
					</LoadingButton>
				</div>

				<div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
						Security
					</h3>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Use a password of at least 8 characters to secure your account.
					</p>
					<button
						type="button"
						onClick={openPasswordModal}
						className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
					>
						Change Password
					</button>
				</div>

				<div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-3">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
						Legal
					</h3>
					<Link
						href="/terms"
						className="block text-sm text-green-600 hover:text-green-700"
					>
						Terms and Conditions
					</Link>
					<Link
						href="/privacy"
						className="block text-sm text-green-600 hover:text-green-700"
					>
						Privacy Policy
					</Link>
				</div>

				<div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
						Sign Out
					</h3>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						You will need to sign in again to access your account.
					</p>
					<button
						type="button"
						onClick={handleSignOut}
						disabled={isSigningOut}
						className="px-5 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold disabled:opacity-50"
					>
						{isSigningOut ? "Signing out..." : "Sign out"}
					</button>
				</div>

				<div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-100 dark:border-red-900/40 p-6 space-y-4">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
						Delete Account
					</h3>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Your personal details, payout details and portfolio are erased and
						you can no longer sign in. Your open jobs are closed. Records that
						other people rely on, such as past contracts, payments and
						messages, are kept without your personal details. This cannot be
						undone. You cannot delete your account while a contract is in
						progress.
					</p>
					<button
						type="button"
						onClick={openDeleteModal}
						className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
					>
						Delete my account
					</button>
				</div>
			</div>

			{deleteModalOpen && (
				<SettingsModal
					title="Delete your account?"
					onClose={() => {
						if (!isDeleting) setDeleteModalOpen(false);
					}}
				>
					<div className="mt-4 space-y-4">
						<p className="text-sm text-gray-500 dark:text-gray-400">
							This permanently erases your personal details and signs you out.
							It cannot be undone.
						</p>
						{deleteError && (
							<div
								role="alert"
								className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400"
							>
								{deleteError}
							</div>
						)}
						<div>
							<label
								htmlFor="delete-password"
								className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								Your password
							</label>
							<div className="relative">
								<input
									id="delete-password"
									type={showDeletePassword ? "text" : "password"}
									autoComplete="current-password"
									value={deletePassword}
									onChange={(e) => setDeletePassword(e.target.value)}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 pr-11 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
								/>
								<button
									type="button"
									onClick={() => setShowDeletePassword((prev) => !prev)}
									className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
									aria-label={
										showDeletePassword ? "Hide password" : "Show password"
									}
								>
									{showDeletePassword ? (
										<EyeOff className="w-4 h-4" />
									) : (
										<Eye className="w-4 h-4" />
									)}
								</button>
							</div>
						</div>
						<div>
							<label
								htmlFor="delete-confirm"
								className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								Type DELETE to confirm
							</label>
							<input
								id="delete-confirm"
								type="text"
								autoComplete="off"
								value={deleteConfirmText}
								onChange={(e) => setDeleteConfirmText(e.target.value)}
								className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
							/>
						</div>
						<div className="flex items-center justify-end gap-3 pt-1">
							<button
								type="button"
								onClick={() => setDeleteModalOpen(false)}
								disabled={isDeleting}
								className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
							>
								Cancel
							</button>
							<LoadingButton
								type="button"
								onClick={confirmDeleteAccount}
								isLoading={isDeleting}
								loadingText="Deleting..."
								className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-70"
							>
								Delete account
							</LoadingButton>
						</div>
					</div>
				</SettingsModal>
			)}

			{passwordModalOpen && (
				<SettingsModal
					title="Change Password"
					onClose={() => setPasswordModalOpen(false)}
				>
					<div className="mt-4 space-y-4">
						{passwordModalError && (
							<div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
								{passwordModalError}
							</div>
						)}
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
								Current password
							</label>
							<div className="relative">
								<input
									type={showCurrentPassword ? "text" : "password"}
									placeholder="Current password"
									value={passwordForm.currentPassword}
									onChange={(e) =>
										setPasswordForm((prev) => ({
											...prev,
											currentPassword: e.target.value,
										}))
									}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 pr-11 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
								/>
								<button
									type="button"
									onClick={() => setShowCurrentPassword((prev) => !prev)}
									className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
									aria-label={
										showCurrentPassword ? "Hide current password" : "Show current password"
									}
								>
									{showCurrentPassword ? (
										<EyeOff className="w-4 h-4" />
									) : (
										<Eye className="w-4 h-4" />
									)}
								</button>
							</div>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
								New password
							</label>
							<div className="relative">
								<input
									type={showNewPassword ? "text" : "password"}
									placeholder="New password"
									value={passwordForm.newPassword}
									onChange={(e) =>
										setPasswordForm((prev) => ({
											...prev,
											newPassword: e.target.value,
										}))
									}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 pr-11 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
								/>
								<button
									type="button"
									onClick={() => setShowNewPassword((prev) => !prev)}
									className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
									aria-label={
										showNewPassword ? "Hide new password" : "Show new password"
									}
								>
									{showNewPassword ? (
										<EyeOff className="w-4 h-4" />
									) : (
										<Eye className="w-4 h-4" />
									)}
								</button>
							</div>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
								Confirm new password
							</label>
							<div className="relative">
								<input
									type={showConfirmPassword ? "text" : "password"}
									placeholder="Confirm new password"
									value={passwordForm.confirmPassword}
									onChange={(e) =>
										setPasswordForm((prev) => ({
											...prev,
											confirmPassword: e.target.value,
										}))
									}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 pr-11 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
								/>
								<button
									type="button"
									onClick={() => setShowConfirmPassword((prev) => !prev)}
									className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
									aria-label={
										showConfirmPassword
											? "Hide confirm password"
											: "Show confirm password"
									}
								>
									{showConfirmPassword ? (
										<EyeOff className="w-4 h-4" />
									) : (
										<Eye className="w-4 h-4" />
									)}
								</button>
							</div>
						</div>
						<div className="flex items-center justify-end gap-3 pt-1">
							<button
								type="button"
								onClick={() => setPasswordModalOpen(false)}
								className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
								disabled={isSavingPassword}
							>
								Cancel
							</button>
							<LoadingButton
								type="button"
								onClick={saveNewPassword}
								isLoading={isSavingPassword}
								loadingText="Updating..."
								className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-70"
							>
								Update Password
							</LoadingButton>
						</div>
					</div>
				</SettingsModal>
			)}

			{payoutModalOpen && (
				<SettingsModal
					title="Edit Payout Details"
					onClose={() => setPayoutModalOpen(false)}
				>
					<div className="mt-4 space-y-4">
						<p className="text-sm text-gray-500 dark:text-gray-400">
							Enter your current password to unlock payout details.
						</p>
						{payoutModalError && (
							<div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
								{payoutModalError}
							</div>
						)}
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
								Current password
							</label>
							<div className="relative">
								<input
									type={showPayoutPassword ? "text" : "password"}
									placeholder="Current password"
									value={payoutModalPassword}
									onChange={(e) => setPayoutModalPassword(e.target.value)}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 pr-11 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
								/>
								<button
									type="button"
									onClick={() => setShowPayoutPassword((prev) => !prev)}
									className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
									aria-label={
										showPayoutPassword ? "Hide password" : "Show password"
									}
								>
									{showPayoutPassword ? (
										<EyeOff className="w-4 h-4" />
									) : (
										<Eye className="w-4 h-4" />
									)}
								</button>
							</div>
						</div>
						<div className="flex items-center justify-end gap-3 pt-1">
							<button
								type="button"
								onClick={() => setPayoutModalOpen(false)}
								className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
								disabled={isPayoutAuthLoading}
							>
								Cancel
							</button>
							<LoadingButton
								type="button"
								onClick={confirmPayoutAuth}
								isLoading={isPayoutAuthLoading}
								loadingText="Verifying..."
								className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-70"
							>
								Unlock
							</LoadingButton>
						</div>
					</div>
				</SettingsModal>
			)}

			<ActionModal
				open={signOutModalOpen}
				onClose={() => setSignOutModalOpen(false)}
				onConfirm={confirmSignOut}
				variant="danger"
				title="Sign out of your account?"
				description="You will need to sign in again to access your account."
				confirmLabel="Sign out"
				cancelLabel="Stay signed in"
				isProcessing={isSigningOut}
			/>
		</div>
	);
}
