"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/ui/BackButton";
import { CardSkeleton } from "@/components/ui/Skeleton";
import ActionModal from "@/components/ui/ActionModal";
import { Plus, Pencil, Trash2, UploadCloud } from "lucide-react";
import type { PortfolioItem } from "@/types/database";

const softwareToolOptions = [
	"ArcGIS Pro",
	"QGIS",
	"ArcGIS Online",
	"Google Earth Engine",
	"GRASS GIS",
	"ENVI",
	"Global Mapper",
	"AutoCAD Civil 3D",
	"Pix4D",
	"Agisoft Metashape",
	"GDAL/OGR",
	"PostGIS",
	"FME",
	"Blender GIS",
	"Other",
];

const PORTFOLIO_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PORTFOLIO_IMAGE_SIZE = 5 * 1024 * 1024;

const emptyForm = {
	title: "",
	description: "",
	project_type: "",
	data_sources: "",
	crs: "",
	scale_resolution: "",
	software_used: [] as string[],
	file_url: "",
	map_embed_html: "",
	preview_image_url: "",
};

export default function PortfolioManagerPage() {
	const router = useRouter();
	const supabase = useMemo(() => createClient(), []);

	const [items, setItems] = useState<PortfolioItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [userId, setUserId] = useState("");
	const [previewImageFile, setPreviewImageFile] = useState<File | null>(null);
	const [previewImageError, setPreviewImageError] = useState("");
	const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
	const [formData, setFormData] = useState({ ...emptyForm });
	const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
	const [editorOpen, setEditorOpen] = useState(false);
	const [deleteCandidate, setDeleteCandidate] = useState<PortfolioItem | null>(
		null,
	);

	const buildSignedUrl = useCallback(async (path: string) => {
		if (!path) return "";
		if (path.startsWith("http")) return path;
		const { data } = await supabase.storage
			.from("portfolio-images")
			.createSignedUrl(path, 60 * 60);
		return data?.signedUrl || "";
	}, [supabase]);

	const loadItems = useCallback(async (ownerId: string) => {
		setLoading(true);
		setError("");
		try {
			const { data, error: loadError } = await supabase
				.from("portfolio_items")
				.select("*")
				.eq("professional_id", ownerId)
				.order("created_at", { ascending: false });

			if (loadError) throw loadError;
			setItems(data || []);

			const previews: Record<string, string> = {};
			await Promise.all(
				(data || []).map(async (item) => {
					const url = await buildSignedUrl(item.preview_image_url);
					if (url) previews[item.id] = url;
				}),
			);
			setPreviewUrls(previews);
		} catch (err: any) {
			console.error("Failed to load portfolio items", err);
			setError("Failed to load portfolio items.");
		} finally {
			setLoading(false);
		}
	}, [buildSignedUrl, supabase]);

	useEffect(() => {
		const init = async () => {
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

			if (!profile || profile.role !== "professional") {
				router.push("/dashboard/client");
				return;
			}

			setUserId(user.id);
			await loadItems(user.id);
		};

		init();
	}, [loadItems, router, supabase]);

	const resetEditor = () => {
		setFormData({ ...emptyForm });
		setPreviewImageFile(null);
		setPreviewImageError("");
		setEditingItem(null);
		setEditorOpen(false);
	};

	const openEditor = (item?: PortfolioItem) => {
		if (item) {
			setEditingItem(item);
			setFormData({
				title: item.title || "",
				description: item.description || "",
				project_type: item.project_type || "",
				data_sources: item.data_sources || "",
				crs: item.crs || "",
				scale_resolution: item.scale_resolution || "",
				software_used: item.software_used || [],
				file_url: item.file_url || "",
				map_embed_html: item.map_embed_html || "",
				preview_image_url: item.preview_image_url || "",
			});
		} else {
			setEditingItem(null);
			setFormData({ ...emptyForm });
		}
		setEditorOpen(true);
		setPreviewImageFile(null);
		setPreviewImageError("");
	};

	const handleSubmit = async () => {
		setSaving(true);
		setError("");

		if (!formData.title.trim()) {
			setError("Project title is required.");
			setSaving(false);
			return;
		}

		if (!editingItem && !previewImageFile) {
			setError("Preview image is required.");
			setSaving(false);
			return;
		}

		try {
			let previewPath = formData.preview_image_url;
			if (previewImageFile) {
				const cleanName = previewImageFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
				previewPath = `${userId}/portfolio-preview-${Date.now()}-${cleanName}`;

				const { error: uploadError } = await supabase.storage
					.from("portfolio-images")
					.upload(previewPath, previewImageFile, {
						contentType: previewImageFile.type,
						upsert: false,
					});

				if (uploadError) throw uploadError;
			}

			if (editingItem) {
				const response = await fetch(`/api/portfolio/${editingItem.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						title: formData.title,
						description: formData.description,
						project_type: formData.project_type,
						data_sources: formData.data_sources,
						crs: formData.crs,
						scale_resolution: formData.scale_resolution,
						software_used: formData.software_used,
						file_url: formData.file_url,
						preview_image_url: previewPath,
						map_embed_html: formData.map_embed_html,
					}),
				});

				const result = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(result?.error || "Failed to update portfolio item");
				}

				const updated = result.item as PortfolioItem;
				setItems((prev) =>
					prev.map((item) => (item.id === updated.id ? updated : item)),
				);

				if (previewPath) {
					const signedUrl = await buildSignedUrl(previewPath);
					setPreviewUrls((prev) => ({ ...prev, [updated.id]: signedUrl }));
				}
			} else {
				const response = await fetch("/api/portfolio", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						title: formData.title,
						description: formData.description,
						project_type: formData.project_type,
						data_sources: formData.data_sources,
						crs: formData.crs,
						scale_resolution: formData.scale_resolution,
						software_used: formData.software_used,
						file_url: formData.file_url,
						preview_image_url: previewPath,
						map_embed_html: formData.map_embed_html,
					}),
				});

				const result = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(result?.error || "Failed to create portfolio item");
				}

				const created = result.item as PortfolioItem;
				setItems((prev) => [created, ...prev]);
				const signedUrl = await buildSignedUrl(previewPath);
				setPreviewUrls((prev) => ({ ...prev, [created.id]: signedUrl }));
			}

			resetEditor();
		} catch (err: any) {
			console.error("Portfolio save failed", err);
			setError(err?.message || "Failed to save portfolio item.");
		} finally {
			setSaving(false);
		}
	};

	const requestDelete = (item: PortfolioItem) => {
		setDeleteCandidate(item);
	};

	const confirmDelete = async () => {
		if (!deleteCandidate) return;
		const item = deleteCandidate;
		setDeleteCandidate(null);
		setSaving(true);
		setError("");

		try {
			const response = await fetch(`/api/portfolio/${item.id}`, {
				method: "DELETE",
			});
			if (!response.ok) {
				const result = await response.json().catch(() => ({}));
				throw new Error(result?.error || "Failed to delete portfolio item");
			}
			setItems((prev) => prev.filter((entry) => entry.id !== item.id));
			setPreviewUrls((prev) => {
				const next = { ...prev };
				delete next[item.id];
				return next;
			});
		} catch (err: any) {
			console.error("Portfolio delete failed", err);
			setError(err?.message || "Failed to delete portfolio item.");
		} finally {
			setSaving(false);
		}
	};

	const handleImageChange = (file: File | null) => {
		setPreviewImageError("");
		if (!file) {
			setPreviewImageFile(null);
			return;
		}

		if (!PORTFOLIO_IMAGE_TYPES.includes(file.type)) {
			setPreviewImageError("Only JPG, PNG, or WebP images are allowed.");
			setPreviewImageFile(null);
			return;
		}

		if (file.size > MAX_PORTFOLIO_IMAGE_SIZE) {
			const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
			setPreviewImageError(`Image is ${sizeMB}MB — max size is 5MB.`);
			setPreviewImageFile(null);
			return;
		}

		setPreviewImageFile(file);
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
			<nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
				<h1 className="text-xl font-bold text-gray-900 dark:text-white">
					Survey<span className="text-green-600">ConnectHub</span>
				</h1>
				<BackButton href="/dashboard/professional" label="Dashboard" />
			</nav>

			<div className="max-w-5xl mx-auto px-6 py-8">
				<div className="flex items-center justify-between mb-8 flex-wrap gap-4">
					<div>
						<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
							My Portfolio
						</h2>
						<p className="text-gray-500 dark:text-gray-400 mt-1">
							Showcase your best geospatial projects
						</p>
					</div>
					<button
						type="button"
						onClick={() => openEditor()}
						className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
					>
						<Plus className="w-4 h-4" />
						Add Portfolio Item
										<button
				</div>
											onClick={() => requestDelete(item)}
				{error && (
					<div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-6">
						{error}
					</div>
				)}

				{loading ? (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<CardSkeleton />
						<CardSkeleton />
					</div>
				) : items.length === 0 ? (
					<div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center border border-gray-100 dark:border-gray-800">
						<p className="text-gray-500 dark:text-gray-400">
							No portfolio items yet.
						</p>
						<button
							type="button"
							onClick={() => openEditor()}
							className="mt-4 inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
						>
							<UploadCloud className="w-4 h-4" />
							Add your first project
						</button>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{items.map((item) => (
							<div
								key={item.id}
								className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
							>
								{previewUrls[item.id] && (
									<div className="relative w-full h-44">
										<Image
											src={previewUrls[item.id]}
											alt={item.title || "Portfolio preview"}
											fill
											sizes="(max-width: 768px) 100vw, 50vw"
											className="object-cover"
										/>
									</div>
								)}
								<div className="p-5 space-y-3">
									</div>

									<ActionModal
										open={Boolean(deleteCandidate)}
										onClose={() => setDeleteCandidate(null)}
										onConfirm={confirmDelete}
										variant="danger"
										title="Delete this portfolio item?"
										description={
											deleteCandidate?.title
												? `"${deleteCandidate.title}" will be removed from your portfolio.`
												: "This item will be removed from your portfolio."
										}
										confirmLabel="Delete item"
										cancelLabel="Keep item"
										isProcessing={saving}
									/>
										<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
											{item.title || "Untitled project"}
										</h3>
										<p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
											{item.description || "No description provided."}
										</p>
									</div>
									<div className="flex items-center gap-2 flex-wrap">
										{item.project_type && (
											<span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
												{item.project_type}
											</span>
										)}
										{item.crs && (
											<span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
												{item.crs}
											</span>
										)}
										{item.scale_resolution && (
											<span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
												{item.scale_resolution}
											</span>
										)}
									</div>
									<div className="flex items-center gap-3 text-sm">
										<button
											type="button"
											onClick={() => openEditor(item)}
											className="inline-flex items-center gap-1 text-green-600 hover:text-green-700"
										>
											<Pencil className="w-4 h-4" />
											Edit
										</button>
										<button
											type="button"
											onClick={() => handleDelete(item)}
											className="inline-flex items-center gap-1 text-red-500 hover:text-red-600"
										>
											<Trash2 className="w-4 h-4" />
											Delete
										</button>
										<Link
											href={`/professionals/${userId}`}
											className="ml-auto text-sm text-gray-500 hover:text-gray-700"
										>
											Preview
										</Link>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{editorOpen && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center px-4 z-50">
					<div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 border border-gray-100 dark:border-gray-800">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
								{editingItem ? "Edit Portfolio Item" : "Add Portfolio Item"}
							</h3>
							<button
								type="button"
								onClick={resetEditor}
								className="text-sm text-gray-500 hover:text-gray-700"
							>
								Close
							</button>
						</div>

						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Project Title <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									value={formData.title}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, title: e.target.value }))
									}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Description
								</label>
								<textarea
									rows={3}
									value={formData.description}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											description: e.target.value,
										}))
									}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white resize-none"
								/>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										Project Type
									</label>
									<input
										type="text"
										value={formData.project_type}
										onChange={(e) =>
											setFormData((prev) => ({
												...prev,
												project_type: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										Data Sources
									</label>
									<input
										type="text"
										value={formData.data_sources}
										onChange={(e) =>
											setFormData((prev) => ({
												...prev,
												data_sources: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										CRS
									</label>
									<input
										type="text"
										value={formData.crs}
										onChange={(e) =>
											setFormData((prev) => ({ ...prev, crs: e.target.value }))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										Scale / Resolution
									</label>
									<input
										type="text"
										value={formData.scale_resolution}
										onChange={(e) =>
											setFormData((prev) => ({
												...prev,
												scale_resolution: e.target.value,
											}))
										}
										className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"
									/>
								</div>
							</div>

							<div>
								<p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Software Used
								</p>
								<div className="flex flex-wrap gap-2">
									{softwareToolOptions.map((tool) => {
										const isSelected = formData.software_used.includes(tool);
										return (
											<button
												key={tool}
												type="button"
												onClick={() =>
													setFormData((prev) => ({
														...prev,
														software_used: isSelected
															? prev.software_used.filter((item) => item !== tool)
															: [...prev.software_used, tool],
													}))
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

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Supporting Link (optional)
								</label>
								<input
									type="url"
									value={formData.file_url}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											file_url: e.target.value,
										}))
									}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"
									placeholder="https://example.com/report.pdf"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Map Embed (iframe HTML)
								</label>
								<textarea
									rows={3}
									value={formData.map_embed_html}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											map_embed_html: e.target.value,
										}))
									}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white resize-none"
									placeholder="<iframe src=...></iframe>"
								/>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
									Supported providers: ArcGIS, Mapbox, Google Maps, OSM, CARTO.
								</p>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Preview Image {editingItem ? "(optional)" : "*"}
								</label>
								<input
									type="file"
									accept="image/png,image/jpeg,image/webp"
									onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
									className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"
								/>
								{previewImageError && (
									<p className="text-xs text-red-500 mt-1">
										{previewImageError}
									</p>
								)}
							</div>
						</div>

						<div className="mt-6 flex items-center justify-between">
							<button
								type="button"
								onClick={resetEditor}
								className="text-sm text-gray-500 hover:text-gray-700"
							>
								Cancel
							</button>
							<button
								type="button"
								disabled={saving}
								onClick={handleSubmit}
								className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors disabled:opacity-50"
							>
								{saving ? "Saving..." : "Save Portfolio Item"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
