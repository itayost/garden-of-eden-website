import type { MetadataRoute } from "next";
import { SITE_URL } from "../../content/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/dashboard",
          "/auth",
          "/onboarding",
          "/api",
          "/print",
          "/join/pay",
          "/join/success",
          "/join/failed",
          "/join/agreement",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
