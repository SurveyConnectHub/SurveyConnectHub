import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "404 – Page Not Found",
};

export default function NotFound() {
	return (
		<div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
			{/* Logo */}
			<img
				src="/logo.png"
				alt="SurveyConnect"
				width={64}
				height={64}
				className="w-16 h-16 mb-8 opacity-80"
			/>

			{/* 404 */}
			<h1 className="text-8xl font-bold text-green-500 mb-2">404</h1>

			{/* Message */}
			<h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
				Page not found
			</h2>
			<p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8">
				Looks like this page wandered off the map. Even our best surveyors
				couldn&apos;t locate it.
			</p>

			{/* Actions */}
			<div className="flex gap-3 flex-wrap justify-center">
				<Link
					href="/"
					className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
				>
					Go home
				</Link>
				<Link
					href="/jobs"
					className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium rounded-lg transition-colors"
				>
					Browse jobs
				</Link>
			</div>
		</div>
	);
}
