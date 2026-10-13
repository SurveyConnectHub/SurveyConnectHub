import { describe, expect, it } from "vitest";
import { isKnownRoute, isPublicPath } from "@/lib/routes";

describe("route rules", () => {
	it("lets logged-out visitors open the public pages", () => {
		for (const path of [
			"/",
			"/jobs",
			"/jobs/",
			"/robots.txt",
			"/sitemap.xml",
			"/login",
			"/signup",
			"/forgot-password",
			"/reset-password",
			"/terms",
			"/privacy",
		]) {
			expect(isPublicPath(path), path).toBe(true);
		}
	});

	it("keeps everything behind login private", () => {
		for (const path of [
			"/jobs/post",
			"/jobs/123/apply",
			"/professionals",
			"/professionals/abc",
			"/dashboard/client",
			"/dashboard/professional",
			"/admin",
			"/messages",
			"/payments/xyz",
			"/settings",
			"/profile",
			"/verification",
			"/onboarding/professional",
			"/notifications",
			"/api/apply",
			"/api/admin/force-release",
		]) {
			expect(isPublicPath(path), path).toBe(false);
		}
	});

	it("allows machine callers that have no session cookie", () => {
		expect(isPublicPath("/api/webhooks/paystack")).toBe(true);
		expect(isPublicPath("/api/paystack/verify")).toBe(true);
		// A look-alike prefix must not slip through.
		expect(isPublicPath("/api/paystackevil")).toBe(false);
		expect(isPublicPath("/api/webhooksx")).toBe(false);
	});

	it("treats real app routes as known and scanner paths as unknown", () => {
		for (const path of [
			"/",
			"/jobs",
			"/jobs/post",
			"/dashboard/client",
			"/professionals/abc",
			"/api/apply",
			"/robots.txt",
			"/login",
		]) {
			expect(isKnownRoute(path), path).toBe(true);
		}
		for (const path of [
			"/wp-admin/setup-config.php",
			"/wp-login.php",
			"/llms.txt",
			"/.env",
			"/.git/config",
			"/phpmyadmin",
			"/Jobs",
		]) {
			expect(isKnownRoute(path), path).toBe(false);
		}
	});
});
