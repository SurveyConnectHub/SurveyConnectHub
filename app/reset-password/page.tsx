"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import { Turnstile } from "@marsidev/react-turnstile";

export default function ResetPasswordPage() {
	const router = useRouter();
	const supabase = createClient();

	const [formData, setFormData] = useState({
		password: "",
		confirmPassword: "",
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [turnstileToken, setTurnstileToken] = useState("");

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFormData({ ...formData, [e.target.name]: e.target.value });
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!turnstileToken) {
			setError("Please complete the bot verification.");
			return;
		}

		if (formData.password.length < 8) {
			setError("Password must be at least 8 characters");
			return;
		}
		if (formData.password !== formData.confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		setLoading(true);

		try {
			const verificationResponse = await fetch("/api/auth/verify-turnstile", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token: turnstileToken }),
			});
			if (!verificationResponse.ok) {
				throw new Error("Bot verification failed");
			}

			const { error: updateError } = await supabase.auth.updateUser({
				password: formData.password,
			});
			if (updateError) throw updateError;

			await supabase.auth.signOut();
			router.push("/login?reset=success");
		} catch (err: any) {
			setError(
				err.message ||
					"Could not reset your password. The link may be invalid or expired.",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center py-12 px-4 transition-colors duration-300 relative">
			<div className="absolute top-6 left-6">
				<BackButton href="/" label="Home" />
			</div>
			<div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 border border-transparent dark:border-gray-800">
				<div className="text-center mb-8">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">
						Survey<span className="text-green-600">ConnectHub</span>
					</h1>
					<p className="text-gray-500 dark:text-gray-400 mt-2">
						Set a new password
					</p>
				</div>

				{error && (
					<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
						{error}
					</div>
				)}

				<form
					onSubmit={handleSubmit}
					className="space-y-5"
				>
					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							New Password <span className="text-red-500">*</span>
						</label>
						<div className="relative">
							<input
								type={showPassword ? "text" : "password"}
								name="password"
								value={formData.password}
								onChange={handleChange}
								required
								placeholder="Min. 8 characters"
								className="w-full px-4 py-3 pr-11 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 dark:placeholder-gray-400"
							/>
							<button
								type="button"
								onClick={() => setShowPassword((prev) => !prev)}
								className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
								aria-label={showPassword ? "Hide password" : "Show password"}
							>
								{showPassword ? (
									<EyeOff className="w-4 h-4" />
								) : (
									<Eye className="w-4 h-4" />
								)}
							</button>
						</div>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Confirm New Password <span className="text-red-500">*</span>
						</label>
						<div className="relative">
							<input
								type={showConfirmPassword ? "text" : "password"}
								name="confirmPassword"
								value={formData.confirmPassword}
								onChange={handleChange}
								required
								placeholder="Repeat your new password"
								className="w-full px-4 py-3 pr-11 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 dark:placeholder-gray-400"
							/>
							<Turnstile
								siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
								onSuccess={setTurnstileToken}
								onExpire={() => setTurnstileToken("")}
								onError={() => setTurnstileToken("")}
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

					<button
						type="submit"
						disabled={loading}
						className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-3 rounded-xl transition-colors"
					>
						{loading ? "Updating password..." : "Update password"}
					</button>

					<p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-6">
						<Link
							href="/login"
							className="text-green-600 font-semibold hover:underline"
						>
							Back to sign in
						</Link>
					</p>
				</form>
			</div>
		</div>
	);
}
