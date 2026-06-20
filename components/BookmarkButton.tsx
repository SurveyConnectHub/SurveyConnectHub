"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark } from "lucide-react";

interface BookmarkButtonProps {
	jobId: string;
}

export default function BookmarkButton({ jobId }: BookmarkButtonProps) {
	const [isSaved, setIsSaved] = useState(false);
	const [savedJobId, setSavedJobId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const checkSaved = async () => {
			try {
				const res = await fetch(`/api/saved-jobs/${jobId}`);
				if (res.ok) {
					const data = await res.json();
					setIsSaved(data.isSaved);
					setSavedJobId(data.savedJobId);
				}
			} catch (err) {
				console.error("BookmarkButton: failed to check saved status:", err);
			} finally {
				setLoading(false);
			}
		};
		checkSaved();
	}, [jobId]);

	const toggleSave = useCallback(async () => {
		try {
			if (isSaved) {
				const res = await fetch(`/api/saved-jobs/${jobId}`, { method: "DELETE" });
				if (res.ok) {
					setIsSaved(false);
					setSavedJobId(null);
				}
			} else {
				const res = await fetch("/api/saved-jobs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ jobId }),
				});
				if (res.ok) {
					const data = await res.json();
					setIsSaved(true);
					setSavedJobId(data.savedJob.id);
				}
			}
		} catch (err) {
			console.error("BookmarkButton: failed to toggle save:", err);
		}
	}, [isSaved, jobId]);

	if (loading) {
		return (
			<button
				disabled
				className="p-2 rounded-xl text-gray-300 dark:text-gray-600 cursor-not-allowed"
				aria-label="Loading"
			>
				<Bookmark className="w-5 h-5" />
			</button>
		);
	}

	return (
		<button
			onClick={toggleSave}
			className={`p-2 rounded-xl transition-colors ${
				isSaved
					? "text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 bg-green-50 dark:bg-green-900/20"
					: "text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
			}`}
			aria-label={isSaved ? "Unsave job" : "Save job"}
			title={isSaved ? "Unsave job" : "Save job"}
		>
			<Bookmark className={`w-5 h-5 ${isSaved ? "fill-current" : ""}`} />
		</button>
	);
}
