"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Building2, Eye, EyeOff, Map } from "lucide-react";

export default function SignupPage() {
	const router = useRouter();
	const supabase = createClient();

	const [formData, setFormData] = useState({
		fullName: "",
		email: "",
		password: "",
		confirmPassword: "",
		role: "" as "client" | "professional" | "",
		country: "",
		phone: "",
		agreedTerms: false,
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
	) => {
		const target = e.target as HTMLInputElement;
		const value = target.type === "checkbox" ? target.checked : target.value;
		setFormData({ ...formData, [target.name]: value });
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (!formData.role) {
			setError("Please select whether you are a Client or Professional");
			return;
		}
		if (formData.password !== formData.confirmPassword) {
			setError("Passwords do not match");
			return;
		}
		if (formData.password.length < 8) {
			setError("Password must be at least 8 characters");
			return;
		}
		if (!formData.agreedTerms) {
			setError("Please agree to the Terms of Service and Privacy Policy");
			return;
		}

		setLoading(true);

		try {
			const { data: authData, error: authError } = await supabase.auth.signUp({
				email: formData.email,
				password: formData.password,
			});

			if (authError) throw authError;
			if (!authData.user) throw new Error("Signup failed");

			const { error: profileError } = await supabase.from("profiles").insert({
				id: authData.user.id,
				role: formData.role,
				full_name: formData.fullName,
				email: formData.email,
				phone: formData.phone,
				country: formData.country,
			});

			if (profileError) throw profileError;

			if (formData.role === "client") {
				const { error: clientError } = await supabase
					.from("client_profiles")
					.insert({ id: authData.user.id });

				if (clientError) throw clientError;

				router.push("/dashboard/client");
			} else {
				const { error: professionalError } = await supabase
					.from("professional_profiles")
					.insert({
						id: authData.user.id,
						profession_type: "other",
						years_experience: 0,
						license_number: null,
						verification_status: "rejected",
					});

				if (professionalError) throw professionalError;

				router.push("/onboarding/professional");
			}
		} catch (err: any) {
			setError(err.message || "Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center py-12 px-4 transition-colors duration-300">
			<div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 border border-transparent dark:border-gray-800">
				{/* Header */}
				<div className="text-center mb-8">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">
						Survey<span className="text-green-600">ConnectHub</span>
					</h1>
					<p className="text-gray-500 dark:text-gray-400 mt-2">
						Create your account
					</p>
				</div>

				{/* Error Message */}
				{error && (
					<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
						{error}
					</div>
				)}

				<form
					onSubmit={handleSubmit}
					className="space-y-5"
				>
					{/* Role Selection */}
					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							I am a... <span className="text-red-500">*</span>
						</label>
						<div className="grid grid-cols-2 gap-3">
							<button
								type="button"
								onClick={() => setFormData({ ...formData, role: "client" })}
								className={`p-4 rounded-xl border-2 text-center transition-all ${
									formData.role === "client"
										? "border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
										: "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
								}`}
							>
								<div className="flex justify-center mb-1">
									<Building2 className="w-6 h-6" />
								</div>
								<div className="font-semibold">Client</div>
								<div className="text-xs mt-1">I need geospatial services</div>
							</button>

							<button
								type="button"
								onClick={() =>
									setFormData({ ...formData, role: "professional" })
								}
								className={`p-4 rounded-xl border-2 text-center transition-all ${
									formData.role === "professional"
										? "border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
										: "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
								}`}
							>
								<div className="flex justify-center mb-1">
									<Map className="w-6 h-6" />
								</div>
								<div className="font-semibold">Professional</div>
								<div className="text-xs mt-1">I offer geospatial services</div>
							</button>
						</div>
					</div>

					{/* Full Name */}
					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Full Name <span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							name="fullName"
							value={formData.fullName}
							onChange={handleChange}
							required
							placeholder="John Doe"
							className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 dark:placeholder-gray-400"
						/>
					</div>

					{/* Email */}
					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Email Address <span className="text-red-500">*</span>
						</label>
						<input
							type="email"
							name="email"
							value={formData.email}
							onChange={handleChange}
							required
							placeholder="john@example.com"
							className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 dark:placeholder-gray-400"
						/>
					</div>

					{/* Phone */}
					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Phone Number
						</label>
						<input
							type="tel"
							name="phone"
							value={formData.phone}
							onChange={handleChange}
							placeholder="+234 800 000 0000"
							className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 dark:placeholder-gray-400"
						/>
					</div>

					{/* Country */}
					<div>
						<label
							htmlFor="country"
							className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							Country <span className="text-red-500">*</span>
						</label>
						<select
							id="country"
							name="country"
							value={formData.country}
							onChange={handleChange}
							required
							className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 dark:placeholder-gray-400"
						>
							<option value="">Select your country</option>
							<option value="Nigeria">Nigeria</option>
							<option value="Ghana">Ghana</option>
							<option value="Kenya">Kenya</option>
							<option value="South Africa">South Africa</option>
							<option value="Côte d'Ivoire">Côte d&apos;Ivoire</option>
							<option value="Senegal">Senegal</option>
							<option value="Tanzania">Tanzania</option>
							<option value="Uganda">Uganda</option>
							<option value="United Kingdom">United Kingdom</option>
							<option value="United States">United States</option>
							<option value="Canada">Canada</option>
							<option value="Australia">Australia</option>
							<option value="Other">Other</option>
						</select>
					</div>

					{/* Password */}
					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Password <span className="text-red-500">*</span>
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

					{/* Confirm Password */}
					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Confirm Password <span className="text-red-500">*</span>
						</label>
						<div className="relative">
							<input
								type={showConfirmPassword ? "text" : "password"}
								name="confirmPassword"
								value={formData.confirmPassword}
								onChange={handleChange}
								required
								placeholder="Repeat your password"
								className="w-full px-4 py-3 pr-11 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 dark:placeholder-gray-400"
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

					<label className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
						<input
							type="checkbox"
							name="agreedTerms"
							checked={formData.agreedTerms}
							onChange={handleChange}
							className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 dark:border-gray-700"
							required
						/>
						<span>
							I agree to the{" "}
							<Link
								href="/terms"
								target="_blank"
								rel="noreferrer"
								className="text-green-600 hover:underline"
							>
								Terms of Service
							</Link>{" "}
							and{" "}
							<Link
								href="/privacy"
								target="_blank"
								rel="noreferrer"
								className="text-green-600 hover:underline"
							>
								Privacy Policy
							</Link>
						</span>
					</label>

					{/* Submit Button */}
					<button
						type="submit"
						disabled={loading}
						className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-3 rounded-xl transition-colors"
					>
						{loading ? "Creating account..." : "Create Account"}
					</button>
				</form>

				{/* Login Link */}
				<p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-6">
					Already have an account?{" "}
					<Link
						href="/login"
						className="text-green-600 font-semibold hover:underline"
					>
						Log in
					</Link>
				</p>
			</div>
		</div>
	);
}
