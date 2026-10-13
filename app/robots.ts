import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const envBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const base = envBase || "https://www.surveyconnecthub.com";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /jobs itself is public; only what sits behind login is listed here.
      disallow: [
        "/dashboard/",
        "/admin/",
        "/payments/",
        "/messages/",
        "/jobs/",
        "/api/",
        "/professionals",
        "/onboarding/",
        "/settings/",
        "/verification",
        "/profile",
        "/notifications",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
