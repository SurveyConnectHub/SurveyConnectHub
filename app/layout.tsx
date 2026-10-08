import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import PublicLayoutShell from "@/components/PublicLayoutShell";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
});

export const metadata: Metadata = {
	title: {
		default: "SurveyConnectHub – Marketplace for Geospatial Professionals",
		template: "%s | SurveyConnectHub",
	},
	description:
		"Connect with verified surveying and geospatial professionals. Post jobs, submit proposals, and get work done — securely, with escrow payments.",
	metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.surveyconnecthub.com"),
	keywords: [
		"surveying",
		"geospatial",
		"land survey",
		"GIS",
		"freelance surveyors",
		"Nigeria",
		"Africa",
		"marketplace",
	],
	authors: [{ name: "SurveyConnectHub" }],
	creator: "SurveyConnectHub",
	openGraph: {
		type: "website",
		locale: "en_US",
		url: "/",
		siteName: "SurveyConnectHub",
		title: "SurveyConnectHub – Marketplace for Geospatial Professionals",
		description:
			"Connect with verified surveying and geospatial professionals. Post jobs, submit proposals, and get work done — securely, with escrow payments.",
		images: [
			{
				url: "/logo.png",
				width: 1200,
				height: 630,
				alt: "SurveyConnect",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "SurveyConnectHub – Marketplace for Geospatial Professionals",
		description:
			"Connect with verified surveying and geospatial professionals. Post jobs, submit proposals, and get work done — securely, with escrow payments.",
		images: ["/logo.png"],
	},
	icons: {
		icon: "/favicon.ico",
		apple: "/logo.png",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${inter.variable} ${jetbrainsMono.variable}`}
		>
			<body>
				<ThemeProvider>
					<PublicLayoutShell>{children}</PublicLayoutShell>
				</ThemeProvider>
				<Analytics />
			</body>
		</html>
	);
}
