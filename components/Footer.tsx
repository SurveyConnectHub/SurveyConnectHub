import Link from "next/link";

export default function Footer() {
	return (
		<footer className="border-t border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur">
			<div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-6 text-sm text-gray-600 dark:text-gray-300">
				<p>© 2026 SurveyConnectHub</p>
				<div className="flex items-center gap-6">
					<Link
						href="/terms"
						className="hover:text-gray-900 dark:hover:text-white transition-colors"
					>
						Terms of Service
					</Link>
					<Link
						href="/privacy"
						className="hover:text-gray-900 dark:hover:text-white transition-colors"
					>
						Privacy Policy
					</Link>
				</div>
			</div>
		</footer>
	);
}
