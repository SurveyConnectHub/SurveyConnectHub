"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/ui/BackButton";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

export default function ForgotPasswordPage() {
	const supabase = createClient();
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [sent, setSent] = useState(false);
	const [turnstileToken, setTurnstileToken] = useState("");
	const turnstileRef = useRef<TurnstileInstance>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!turnstileToken) {
			setError("Please complete the bot verification.");
			return;
		}
		setLoading(true);

		try {
			const { error: resetError } = await supabase.auth.resetPasswordForEmail(
				email.trim(),
				{
					redirectTo: `${window.location.origin}/reset-password`,
					captchaToken: turnstileToken,
				},
			);
			if (resetError) throw resetError;
			setSent(true);
		} catch (err: any) {
			setError(
				err.message || "Could not send the reset link. Please try again.",
			);
		} finally {
			setLoading(false);
			setTurnstileToken("");
			turnstileRef.current?.reset();
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
						Forgot your password?
					</p>
				</div>

				{error && (
					<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
						{error}
					</div>
				)}

				{sent ? (
					<div>
						<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg mb-6 text-sm">
							If an account exists for that email, a reset link has been
							sent. Check your inbox (and spam) within the next few
							minutes.
						</div>
						<Link
							href="/login"
							className="block text-center text-green-600 font-semibold hover:underline"
						>
							Back to sign in
						</Link>
					</div>
				) : (
					<form
						onSubmit={handleSubmit}
						className="space-y-5"
					>
						<p className="text-sm text-gray-500 dark:text-gray-400">
							Enter the email associated with your account and we&apos;ll
							send you a single-use link to reset your password.
						</p>
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
								Email Address <span className="text-red-500">*</span>
							</label>
							<input
								type="email"
								name="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								placeholder="john@example.com"
								className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 dark:placeholder-gray-400"
							/>
						</div>

						<Turnstile
							ref={turnstileRef}
							siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
							onSuccess={setTurnstileToken}
							onExpire={() => setTurnstileToken("")}
							onError={() => setTurnstileToken("")}
						/>
						<button
							type="submit"
							disabled={loading}
							className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-3 rounded-xl transition-colors"
						>
							{loading ? "Sending link..." : "Send reset link"}
						</button>

						<p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-6">
							Remembered it?{" "}
							<Link
								href="/login"
								className="text-green-600 font-semibold hover:underline"
							>
								Back to sign in
							</Link>
						</p>
					</form>
				)}
			</div>
		</div>
	);
}
