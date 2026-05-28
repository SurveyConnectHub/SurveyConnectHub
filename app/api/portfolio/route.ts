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
	const safeSandbox = sandbox || "allow-scripts allow-same-origin allow-popups";

	return `<iframe src="${url.toString()}" width="${safeWidth}" height="${safeHeight}" loading="${safeLoading}" referrerpolicy="${safeReferrer}" sandbox="${safeSandbox}"${allowFullScreen ? " allowfullscreen" : ""}></iframe>`;
};

export async function POST(request: NextRequest) {
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

		if (!(await checkRateLimit(`portfolio:create:${user.id}`, 10, 60))) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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

		if (!preview_image_url || typeof preview_image_url !== "string") {
			return NextResponse.json(
				{ error: "Preview image is required" },
				{ status: 400 },
			);
		}

		if (!title || typeof title !== "string" || !title.trim()) {
			return NextResponse.json({ error: "Title is required" }, { status: 400 });
		}

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
			: [];

		const resolvedFileUrl =
			file_url && typeof file_url === "string" && file_url.trim()
				? file_url.trim()
				: preview_image_url;

		const { data, error } = await supabase
			.from("portfolio_items")
			.insert({
				professional_id: user.id,
				title: title.trim(),
				description:
					typeof description === "string" ? description.trim() : null,
				project_type:
					typeof project_type === "string" ? project_type.trim() : null,
				data_sources:
					typeof data_sources === "string" ? data_sources.trim() : null,
				crs: typeof crs === "string" ? crs.trim() : null,
				scale_resolution:
					typeof scale_resolution === "string" ? scale_resolution.trim() : null,
				software_used: softwareList,
				file_url: resolvedFileUrl,
				preview_image_url: preview_image_url.trim(),
				map_embed_html: sanitizedMap,
				updated_at: new Date().toISOString(),
			})
			.select("*")
			.single();

		if (error) {
			console.error("Failed to create portfolio item:", error);
			return NextResponse.json(
				{ error: "Failed to create portfolio item" },
				{ status: 500 },
			);
		}

		return NextResponse.json({ item: data });
	} catch (error) {
		console.error("Portfolio create error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
