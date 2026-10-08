import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const migration = (name: string) =>
	readFileSync(
		path.join(process.cwd(), "supabase", "migrations", name),
		"utf8",
	);

describe("security migration contracts", () => {
	it("locks profile privilege fields during self-updates", () => {
		const sql = migration("20261007_lock_profiles_privileged_fields.sql");
		expect(sql).toMatch(/current_profile\.role\s*=\s*role/i);
		expect(sql).toMatch(/current_profile\.is_admin\s+IS\s+NOT\s+DISTINCT\s+FROM\s+is_admin/i);
	});

	it("creates safe public views and webhook idempotency storage", () => {
		const sql = migration("20261007_security_hardening.sql");
		expect(sql).toMatch(/public_profiles/i);
		expect(sql).toMatch(/public_professional_profiles/i);
		expect(sql).toMatch(/paystack_webhook_events/i);
		expect(sql).toMatch(/event_key\s+text\s+PRIMARY\s+KEY/i);
	});
});
