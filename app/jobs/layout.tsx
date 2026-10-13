import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Browse Survey & Geospatial Jobs | SurveyConnectHub",
	description:
		"Open land surveying, GIS, drone, LiDAR and mapping jobs from clients who pay through escrow. Sign up free to apply.",
};

export default function JobsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
