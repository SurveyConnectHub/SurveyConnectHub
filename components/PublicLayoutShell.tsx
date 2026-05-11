"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

const PRIVATE_PREFIXES = [
	"/dashboard",
	"/messages",
	"/payments",
	"/profile",
	"/settings",
	"/onboarding",
];

export default function PublicLayoutShell({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname() || "";
	const isPrivate = PRIVATE_PREFIXES.some((prefix) =>
		pathname.startsWith(prefix),
	);

	return (
		<div className="min-h-screen flex flex-col">
			<div className="flex-1">{children}</div>
			{!isPrivate && <Footer />}
		</div>
	);
}
