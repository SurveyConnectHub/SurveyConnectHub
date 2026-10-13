// Route rules used by middleware.ts.
//
// Two lists drive everything:
//   - PUBLIC_*: paths a logged-out visitor may open.
//   - KNOWN_ROOTS: every real top-level route in the app. A path whose first
//     segment is not listed here gets a real 404 instead of a login redirect.
//
// IMPORTANT: when you add a new top-level folder under `app/` (for example
// `app/invoices`), add its name to KNOWN_ROOTS, otherwise the middleware will
// answer 404 for it.

const PUBLIC_EXACT = new Set(["/", "/jobs", "/robots.txt", "/sitemap.xml"]);

const PUBLIC_ROOTS = new Set([
	"login",
	"signup",
	"forgot-password",
	"reset-password",
	"terms",
	"privacy",
]);

// Called by machines or before a session exists. Each route does its own
// verification (e.g. the payment webhook checks the gateway signature).
const PUBLIC_API_PREFIXES = ["/api/paystack", "/api/webhooks"];

const KNOWN_ROOTS = new Set([
	...PUBLIC_ROOTS,
	"admin",
	"api",
	"dashboard",
	"jobs",
	"messages",
	"notifications",
	"onboarding",
	"payments",
	"professionals",
	"profile",
	"settings",
	"verification",
]);

export function normalizePath(pathname: string): string {
	return pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : pathname;
}

function firstSegment(pathname: string): string {
	return pathname.split("/")[1] ?? "";
}

export function isKnownRoute(pathname: string): boolean {
	const path = normalizePath(pathname);
	if (PUBLIC_EXACT.has(path)) return true;
	return KNOWN_ROOTS.has(firstSegment(path));
}

export function isPublicPath(pathname: string): boolean {
	const path = normalizePath(pathname);
	if (PUBLIC_EXACT.has(path)) return true;
	if (PUBLIC_ROOTS.has(firstSegment(path))) return true;
	return PUBLIC_API_PREFIXES.some(
		(prefix) => path === prefix || path.startsWith(`${prefix}/`),
	);
}
