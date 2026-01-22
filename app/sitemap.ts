import { MetadataRoute } from "next"

// Use a static date to ensure deterministic builds
// Update this date when sitemap content actually changes
const SITEMAP_LAST_MODIFIED = "2026-01-22"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://motif.webrenew.com"
  const lastModified = new Date(SITEMAP_LAST_MODIFIED)

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/tools/component-extractor`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tools/color-palette`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tools/typography-matcher`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tools/design-critique`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tools/brand-kit`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ]
}
