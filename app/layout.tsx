import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
import { Toaster } from "sonner"
import { Providers } from "@/components/providers"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: "Motif - AI-Powered Design Workflow Tool by Webrenew",
    template: "%s | Motif by Webrenew",
  },
  description:
    "Multi-step AI-powered design workflow tool by Webrenew. Create visual node-based workflows to extract components, generate color palettes, match typography, and build complete brand systems. Built in partnership with Vercel's v0.",
  keywords: [
    "AI design tools",
    "design workflow",
    "component extraction",
    "color palette generator",
    "typography matcher",
    "brand kit generator",
    "design critique",
    "React components",
    "Tailwind CSS",
    "v0",
    "Webrenew",
  ],
  authors: [{ name: "Webrenew", url: "https://webrenew.com" }],
  creator: "Webrenew",
  publisher: "Webrenew",
  generator: "v0.app",
  metadataBase: new URL("https://motif.webrenew.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://motif.webrenew.com",
    title: "Motif - AI-Powered Design Workflow Tool by Webrenew",
    description:
      "Multi-step AI-powered design workflow tool. Create visual node-based workflows to extract components, generate color palettes, and build complete brand systems. Built by Webrenew in partnership with Vercel's v0.",
    siteName: "Motif by Webrenew",
    images: [
      {
        url: "/opengraph.png",
        width: 1200,
        height: 630,
        alt: "Motif - AI-Powered Design Workflow Tool by Webrenew",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Motif - AI-Powered Design Workflow Tool by Webrenew",
    description:
      "Multi-step AI-powered design workflow tool. Create visual node-based workflows to extract components, generate color palettes, and build complete brand systems.",
    images: ["/opengraph.png"],
    creator: "@webrenew",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/images/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/images/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
    ],
    shortcut: "/icon.svg",
    apple: [
      {
        url: "/images/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/icon.svg",
        color: "#a855f7",
      },
      {
        rel: "android-chrome",
        url: "/images/android-chrome-192x192.png",
      },
      {
        rel: "android-chrome",
        url: "/images/android-chrome-512x512.png",
      },
    ],
  },
  manifest: "/manifest.json",
  verification: {
    google: "your-google-verification-code", // Add your Google Search Console verification
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Motif",
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "Multi-step AI-powered design workflow tool. Create visual node-based workflows to extract components, generate color palettes, match typography, and build complete brand systems.",
    author: {
      "@type": "Organization",
      name: "Webrenew",
      url: "https://webrenew.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Webrenew",
      url: "https://webrenew.com",
    },
    creator: {
      "@type": "Organization",
      name: "Webrenew",
      url: "https://webrenew.com",
    },
    softwareVersion: "1.0",
    url: "https://motif.webrenew.com",
    screenshot: "https://motif.webrenew.com/opengraph.png",
  }

  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <Script id="structured-data" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(jsonLd)}
        </Script>
        <Providers>
          {children}
        </Providers>
        <Toaster
          position="bottom-right"
          gap={8}
          closeButton
          style={{ right: "1rem", bottom: "5rem" }}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                "flex items-center gap-3 w-[320px] px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-700 shadow-lg text-sm text-neutral-100 font-medium",
              title: "text-neutral-100 font-medium",
              description: "text-neutral-400 text-xs mt-0.5",
              closeButton:
                "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors",
              success: "border-emerald-600/50 [&>svg]:text-emerald-400",
              error: "border-red-600/50 [&>svg]:text-red-400",
              warning: "border-amber-600/50 [&>svg]:text-amber-400",
              info: "border-blue-600/50 [&>svg]:text-blue-400",
            },
          }}
        />
        <Analytics />
      </body>
    </html>
  )
}
