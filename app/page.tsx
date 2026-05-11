import Link from "next/link";
import Image from "next/image";
import {
	Globe,
	Lock,
	Ruler,
	Map,
	Helicopter,
	Camera,
	Zap,
	Satellite,
	Building,
	BarChart3,
	Waves,
	Pickaxe,
	HardHat,
	CheckCircle2,
} from "lucide-react";

export default function LandingPage() {
	return (
		<div className="min-h-screen bg-white">
			{/* Navbar */}
			<nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Image
						src="/logo.png"
						alt="SurveyConnectHub"
						width={40}
						height={40}
						className="h-10 w-auto"
					/>
					<h1 className="text-2xl font-bold text-gray-900">
						Survey<span className="text-green-600">ConnectHub</span>
					</h1>
				</div>
				<div className="flex items-center gap-4">
					<Link
						href="/login"
						className="text-gray-600 hover:text-gray-900 font-medium text-sm"
					>
						Log in
					</Link>
					<Link
						href="/signup"
						className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
					>
						Get Started
					</Link>
				</div>
			</nav>

			{/* Hero Section */}
			<section className="bg-gradient-to-br from-green-50 to-white py-20 px-6">
				<div className="max-w-4xl mx-auto text-center">
					<div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-sm font-semibold px-4 py-2 rounded-full mb-6">
						<Globe className="w-4 h-4" />
						Built for Africa - Going Global
					</div>
					<h2 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
						The Marketplace for
						<span className="text-green-600"> Geospatial</span>
						<br />
						Professionals
					</h2>
					<p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
						Connect with verified surveyors, GIS analysts, drone pilots,
						cartographers and more. Post jobs or find work — all in one
						platform.
					</p>
					<div className="flex items-center justify-center gap-4 flex-wrap">
						<Link
							href="/signup"
							className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-4 rounded-2xl text-lg transition-colors"
						>
							Post a Job
						</Link>
						<Link
							href="/signup"
							className="bg-white hover:bg-gray-50 text-gray-900 font-semibold px-8 py-4 rounded-2xl text-lg border-2 border-gray-200 transition-colors"
						>
							Find Work
						</Link>
					</div>
				</div>
			</section>

			{/* Stats Section */}
			<section className="py-16 px-6 bg-white">
				<div className="max-w-4xl mx-auto">
					<div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
						<div>
							<p className="text-4xl font-bold text-green-600">15+</p>
							<p className="text-gray-500 mt-1 text-sm">Profession Types</p>
						</div>
						<div>
							<p className="text-4xl font-bold text-green-600">100%</p>
							<p className="text-gray-500 mt-1 text-sm">Verified Pros</p>
						</div>
						<div>
							<p className="text-4xl font-bold text-green-600">95%</p>
							<p className="text-gray-500 mt-1 text-sm">Goes to Professional</p>
						</div>
						<div>
							<p className="flex justify-center text-green-600">
								<Lock className="w-10 h-10" />
							</p>
							<p className="text-gray-500 mt-1 text-sm">Secure Escrow</p>
						</div>
					</div>
				</div>
			</section>

			{/* How It Works */}
			<section className="py-20 px-6 bg-gray-50">
				<div className="max-w-5xl mx-auto">
					<div className="text-center mb-16">
						<h3 className="text-3xl font-bold text-gray-900">How It Works</h3>
						<p className="text-gray-500 mt-3">Simple. Secure. Professional.</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-16">
						<div>
							<h4 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
								<span className="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">
									C
								</span>
								For Clients
							</h4>
							<div className="space-y-6">
								{[
									{
										n: 1,
										title: "Post Your Job",
										desc: "Describe your project, set your budget and timeline",
									},
									{
										n: 2,
										title: "Review Applications",
										desc: "Browse verified professionals who apply to your job",
									},
									{
										n: 3,
										title: "Pay Securely",
										desc: "Funds held in escrow — released only when you approve",
									},
								].map((s) => (
									<div
										key={s.n}
										className="flex gap-4"
									>
										<div className="bg-green-100 text-green-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
											{s.n}
										</div>
										<div>
											<p className="font-semibold text-gray-900">{s.title}</p>
											<p className="text-gray-500 text-sm mt-1">{s.desc}</p>
										</div>
									</div>
								))}
							</div>
						</div>
						<div>
							<h4 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
								<span className="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">
									P
								</span>
								For Professionals
							</h4>
							<div className="space-y-6">
								{[
									{
										n: 1,
										title: "Get Verified",
										desc: "Upload your ID and professional license to get verified",
									},
									{
										n: 2,
										title: "Apply to Jobs",
										desc: "Browse open projects and submit your proposal",
									},
									{
										n: 3,
										title: "Get Paid",
										desc: "Deliver your work and receive 95% directly to your account",
									},
								].map((s) => (
									<div
										key={s.n}
										className="flex gap-4"
									>
										<div className="bg-green-100 text-green-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
											{s.n}
										</div>
										<div>
											<p className="font-semibold text-gray-900">{s.title}</p>
											<p className="text-gray-500 text-sm mt-1">{s.desc}</p>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Professions Section */}
			<section className="py-20 px-6 bg-white">
				<div className="max-w-5xl mx-auto">
					<div className="text-center mb-12">
						<h3 className="text-3xl font-bold text-gray-900">
							All Geospatial Professions
						</h3>
						<p className="text-gray-500 mt-3">
							One platform for every geospatial discipline
						</p>
					</div>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						{[
							{ Icon: Ruler, label: "Land Surveyors" },
							{ Icon: Map, label: "GIS Analysts" },
							{ Icon: Helicopter, label: "Drone Pilots" },
							{ Icon: Map, label: "Cartographers" },
							{ Icon: Camera, label: "Photogrammetrists" },
							{ Icon: Zap, label: "LiDAR Specialists" },
							{ Icon: Satellite, label: "Remote Sensing" },
							{ Icon: Building, label: "Urban Planners" },
							{ Icon: BarChart3, label: "Spatial Scientists" },
							{ Icon: Waves, label: "Hydrographic" },
							{ Icon: Pickaxe, label: "Mining Surveyors" },
							{ Icon: HardHat, label: "Construction" },
						].map((item) => (
							<div
								key={item.label}
								className="bg-gray-50 rounded-2xl p-4 text-center hover:bg-green-50 hover:border-green-200 border-2 border-transparent transition-all"
							>
								<div className="flex justify-center mb-2">
									<item.Icon className="w-8 h-8 text-gray-700" />
								</div>
								<p className="text-sm font-medium text-gray-700">
									{item.label}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Why SurveyConnectHub */}
			<section className="py-20 px-6 bg-gray-50">
				<div className="max-w-5xl mx-auto">
					<div className="text-center mb-12">
						<h3 className="text-3xl font-bold text-gray-900">
							Why SurveyConnectHub?
						</h3>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						{[
							{
								Icon: CheckCircle2,
								title: "Verified Professionals",
								desc: "Every professional is ID verified and license checked before they can work on your project",
							},
							{
								Icon: Lock,
								title: "Secure Escrow Payments",
								desc: "Your money is held safely until you approve the work. No risk of paying for nothing",
							},
							{
								Icon: Globe,
								title: "Built for Africa",
								desc: "Designed specifically for Africa with local payment options, growing globally",
							},
						].map((item) => (
							<div
								key={item.title}
								className="bg-white rounded-2xl p-6 shadow-sm"
							>
								<div className="mb-4">
									<item.Icon className="w-10 h-10 text-green-600" />
								</div>
								<h4 className="text-lg font-bold text-gray-900 mb-2">
									{item.title}
								</h4>
								<p className="text-gray-500 text-sm">{item.desc}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-20 px-6 bg-green-600">
				<div className="max-w-3xl mx-auto text-center">
					<h3 className="text-4xl font-bold text-white mb-4">
						Ready to get started?
					</h3>
					<p className="text-green-100 text-lg mb-10">
						Join geospatial professionals and clients on SurveyConnectHub
					</p>
					<div className="flex items-center justify-center gap-4 flex-wrap">
						<Link
							href="/signup"
							className="bg-white hover:bg-gray-100 text-green-600 font-bold px-8 py-4 rounded-2xl text-lg transition-colors"
						>
							Sign Up Free
						</Link>
						<Link
							href="/jobs"
							className="bg-green-700 hover:bg-green-800 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-colors"
						>
							Browse Jobs
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
