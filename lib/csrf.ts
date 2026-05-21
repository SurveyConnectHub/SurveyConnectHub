export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const extraOrigins = process.env.NEXT_PUBLIC_APP_URLS;
  const allowedOrigins = new Set<string>();
  if (appUrl) {
    allowedOrigins.add(appUrl);
  }
  if (extraOrigins) {
    extraOrigins
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => allowedOrigins.add(value));
  }
  allowedOrigins.add("http://localhost:3000");
  allowedOrigins.add("https://surveyconnect.vercel.app");
  if (allowedOrigins.size === 0) return false;
  const requestOrigin = origin ?? new URL(request.url).origin;
  return allowedOrigins.has(requestOrigin);
}
