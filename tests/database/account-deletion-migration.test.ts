import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const sql = readFileSync(
	path.join(
		process.cwd(),
		"supabase",
		"migrations",
		"20261014_account_deletion.sql",
	),
	"utf8",
);

function viewDefinition(name: string): string {
	const match = sql.match(new RegExp(`VIEW public\\.${name}[\\s\\S]*?;`, "i"));
	expect(match, `view ${name} should be defined`).not.toBeNull();
	return match![0];
}

describe("account deletion migration", () => {
	it("adds the soft-delete columns", () => {
		expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false/i);
		expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS deleted_at timestamptz/i);
	});

	it("hides deleted users from the profile views", () => {
		expect(viewDefinition("public_profiles")).toMatch(/WHERE is_deleted = false/i);
		expect(viewDefinition("public_professional_profiles")).toMatch(
			/p\.is_deleted = false/i,
		);
	});

	it("hides open jobs of deleted clients from the public list", () => {
		expect(viewDefinition("public_jobs")).toMatch(/c\.is_deleted = true/i);
	});

	it("keeps the profile views closed to logged-out visitors", () => {
		expect(sql).toMatch(
			/REVOKE ALL ON public\.public_professional_profiles FROM anon, authenticated/i,
		);
		expect(sql).not.toMatch(/GRANT SELECT ON public\.public_professional_profiles TO anon/i);
		expect(sql).not.toMatch(/GRANT SELECT ON public\.public_profiles TO anon/i);
	});
});
