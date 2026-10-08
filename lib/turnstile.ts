const TURNSTILE_VERIFY_URL =
	"https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(
	token: unknown,
	remoteIp?: string | null,
): Promise<boolean> {
	const secret = process.env.TURNSTILE_SECRET_KEY;
	if (!secret || typeof token !== "string" || !token) return false;

	const body = new URLSearchParams({ secret, response: token });
	if (remoteIp) body.set("remoteip", remoteIp);

	try {
		const response = await fetch(TURNSTILE_VERIFY_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body,
			cache: "no-store",
		});
		if (!response.ok) return false;
		const result = (await response.json()) as { success?: boolean };
		return result.success === true;
	} catch (error) {
		console.error("Turnstile verification failed:", error);
		return false;
	}
}
