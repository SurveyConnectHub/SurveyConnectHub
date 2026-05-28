import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";

const ALLOWED_HOST_SUFFIXES = [
	"arcgis.com",
	"mapbox.com",
	"google.com",
	"openstreetmap.org",
	"carto.com",
	"qgiscloud.com",
	"kepler.gl",
	"maptiler.com",
	"cesium.com",
];

const isAllowedHost = (host: string) =>
	ALLOWED_HOST_SUFFIXES.some(
		(suffix) => host === suffix || host.endsWith(`.${suffix}`),
	);

const sanitizeIframeHtml = (input: string | null): string | null => {
	if (!input) return null;
	const trimmed = input.trim();
	if (!trimmed) return null;

	const match = trimmed.match(/<iframe\b[^>]*>/i);
	if (!match) return null;

	const tag = match[0];
	const attrsSource = tag
		.replace(/^<iframe/i, "")
		.replace(/>$/i, " ")
		.trim();

	let src: string | null = null;
	let width: string | null = null;
	let height: string | null = null;
	let loading: string | null = null;
	let referrerpolicy: string | null = null;
	let sandbox: string | null = null;
	const allowFullScreen = /allowfullscreen/i.test(tag);

	const attrRegex = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g;
	let attrMatch: RegExpExecArray | null;
	while ((attrMatch = attrRegex.exec(attrsSource)) !== null) {
		const key = attrMatch[1].toLowerCase();
		const value = attrMatch[2];
		if (key === "src") src = value;
		if (key === "width") width = value;
		if (key === "height") height = value;
		if (key === "loading") loading = value;
		if (key === "referrerpolicy") referrerpolicy = value;
		if (key === "sandbox") sandbox = value;
	}

	if (!src) return null;

	let url: URL;
	try {
		url = new URL(src);
	} catch {
		return null;
	}

	if (url.protocol !== "https:") return null;
	if (!isAllowedHost(url.hostname)) return null;

	const safeWidth = width && /^\d{2,4}%?$/.test(width) ? width : "100%";
	const safeHeight = height && /^\d{2,4}$/.test(height) ? height : "360";
	const safeLoading = loading === "eager" ? "eager" : "lazy";
	const safeReferrer = referrerpolicy || "no-referrer";
	const safeSandbox =
		sandbox || "allow-scripts allow-same-origin allow-popups";

	return `<iframe src="${url.toString()}" width="${safeWidth}" height="${safeHeight}" loading="${safeLoading}" referrerpolicy="${safeReferrer}" sandbox="${safeSandbox}"${allowFullScreen ? " allowfullscreen" : ""}></iframe>`;
};

export async function PATCH(
	request: NextRequest,
	context: { params: Promise<{ id: string }> },
) {
	try {
		if (!validateOrigin(request)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!(await checkRateLimit(`portfolio:update:${user.id}`, 20, 60))) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}

		const { id } = await context.params;
		if (!id) {
			return NextResponse.json({ error: "Missing id" }, { status: 400 });
		}

		const body = await request.json().catch(() => ({}));
		const {
			title,
			description,
			project_type,
			data_sources,
			crs,
			scale_resolution,
			software_used,
			file_url,
			preview_image_url,
			map_embed_html,
		} = body ?? {};

		const sanitizedMap = map_embed_html
			? sanitizeIframeHtml(String(map_embed_html))
			: null;
		if (map_embed_html && !sanitizedMap) {
			return NextResponse.json(
				{ error: "Invalid map embed HTML" },
				{ status: 400 },
			);
		}

		const softwareList = Array.isArray(software_used)
			? software_used.filter((item) => typeof item === "string")
			: null;

		const updates: Record<string, any> = {
			updated_at: new Date().toISOString(),
		};

		if (typeof title === "string") updates.title = title.trim();
		if (typeof description === "string") updates.description = description.trim();
		if (typeof project_type === "string")
			updates.project_type = project_type.trim();
		if (typeof data_sources === "string")
			updates.data_sources = data_sources.trim();
		if (typeof crs === "string") updates.crs = crs.trim();
		if (typeof scale_resolution === "string")
			updates.scale_resolution = scale_resolution.trim();
		if (softwareList) updates.software_used = softwareList;
		if (typeof file_url === "string") {
			const trimmed = file_url.trim();
			if (trimmed) {
				updates.file_url = trimmed;
			} else if (typeof preview_image_url === "string") {
				updates.file_url = preview_image_url.trim();
			}
		}
		if (typeof preview_image_url === "string") {
			const trimmedPreview = preview_image_url.trim();
			if (trimmedPreview) updates.preview_image_url = trimmedPreview;
		}
		if (map_embed_html) updates.map_embed_html = sanitizedMap;
		if (map_embed_html === "") updates.map_embed_html = null;

		const { data, error } = await supabase
			.from("portfolio_items")
			.update(updates)
			.eq("id", id)
			.eq("professional_id", user.id)
			.select("*")
			.single();

		if (error) {
			console.error("Failed to update portfolio item:", error);
			return NextResponse.json(
				{ error: "Failed to update portfolio item" },
				{ status: 500 },
			);
		}

		return NextResponse.json({ item: data });
	} catch (error) {
		console.error("Portfolio update error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function DELETE(
	request: NextRequest,
	context: { params: Promise<{ id: string }> },
) {
	try {
		if (!validateOrigin(request)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!(await checkRateLimit(`portfolio:delete:${user.id}`, 10, 60))) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}

		const { id } = await context.params;
		if (!id) {
			return NextResponse.json({ error: "Missing id" }, { status: 400 });
		}

		const { data: existing } = await supabase
			.from("portfolio_items")
			.select("preview_image_url")
			.eq("id", id)
			.eq("professional_id", user.id)
			.single();

		if (!existing) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		const { error } = await supabase
			.from("portfolio_items")
			.delete()
			.eq("id", id)
			.eq("professional_id", user.id);

		if (error) {
			console.error("Failed to delete portfolio item:", error);
			return NextResponse.json(
				{ error: "Failed to delete portfolio item" },
				{ status: 500 },
			);
		}

		if (existing.preview_image_url) {
			await supabase.storage
				.from("portfolio-images")
				.remove([existing.preview_image_url])
				.catch(() => {});
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Portfolio delete error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
