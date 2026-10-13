import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const sql = readFileSync(
	path.join(
		process.cwd(),
		"supabase",
		"migrations",
		"20261013_public_jobs_and_view_lockdown.sql",
	),
	"utf8",
);

function viewDefinition(name: string): string {
	const match = sql.match(
		new RegExp(`VIEW public\\.${name}[\\s\\S]*?;`, "i"),
	);
	expect(match, `view ${name} should be defined`).not.toBeNull();
	return match![0];
}

describe("public jobs and view lockdown migration", () => {
	it("exposes only open jobs, with no identity, description or exact location", () => {
		const view = viewDefinition("public_jobs");
		expect(view).toMatch(/WHERE\s+j\.status\s*=\s*'open'/i);
		for (const column of [
			"client_id",
			"description",
			"location\\b",
			"attachments",
			"brief_attachment_url",
			"screening_questions",
		]) {
			expect(view, column).not.toMatch(new RegExp(`j\\.${column}`, "i"));
		}
		expect(view).toMatch(/j\.title/);
		expect(view).toMatch(/j\.location_country/);
	});

	it("grants the public jobs view to logged-out visitors", () => {
		expect(sql).toMatch(
			/GRANT SELECT ON public\.public_jobs TO anon, authenticated/i,
		);
	});

	it("restricts the full jobs table to signed-in users", () => {
		expect(sql).toMatch(
			/CREATE POLICY "jobs_select_open" ON public\.jobs\s+FOR SELECT TO authenticated/i,
		);
	});

	it("removes anonymous access from both profile views", () => {
		expect(sql).toMatch(/REVOKE ALL ON public\.public_profiles FROM anon/i);
		expect(sql).toMatch(
			/REVOKE ALL ON public\.public_professional_profiles FROM anon, authenticated/i,
		);
		expect(sql).toMatch(
			/GRANT SELECT ON public\.public_professional_profiles TO authenticated/i,
		);
		expect(sql).not.toMatch(
			/GRANT SELECT ON public\.public_professional_profiles TO anon/i,
		);
	});

	it("no longer exposes total_earned", () => {
		expect(viewDefinition("public_professional_profiles")).not.toMatch(
			/total_earned/i,
		);
	});
});
