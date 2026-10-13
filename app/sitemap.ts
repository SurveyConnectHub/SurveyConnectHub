import { MetadataRoute } from "next";

// Only pages a logged-out visitor can open belong here.
export default function sitemap(): MetadataRoute.Sitemap {
  const envBase = process.env.NEXT_PUBLIC_APP_URL;
  const base = (envBase ? envBase.replace(/\/+$/, "") : null) ??
    "https://www.surveyconnecthub.com";
  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/jobs`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
