import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProviderWrapper } from "@/components/auth-provider-wrapper"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://serenica.app'),
  title: {
    default: "Serenica - AI Mental Health Journaling & Wellness Companion",
    template: "%s | Serenica"
  },
  description: "Your personal AI-powered mental health companion for mindfulness and self-reflection. Track emotions, gain insights, and grow through secure journaling with AI-powered analytics.",
  keywords: [
    "mental health",
    "journaling",
    "AI mental health",
    "wellness app",
    "mindfulness",
    "emotional wellness",
    "mental health tracker",
    "therapy journal",
    "self-reflection",
    "mental wellness",
    "anxiety journal",
    "depression support",
    "mood tracking",
    "emotional intelligence"
  ],
  authors: [{ name: "Serenica" }],
  creator: "Serenica",
  publisher: "Serenica",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Serenica",
    title: "Serenica - AI Mental Health Journaling & Wellness Companion",
    description: "Your personal AI-powered mental health companion for mindfulness and self-reflection. Track emotions, gain insights, and grow through secure journaling.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Serenica - AI Mental Health Journaling",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Serenica - AI Mental Health Journaling",
    description: "Your personal AI-powered mental health companion for mindfulness and self-reflection.",
    images: ["/og-image.png"],
    creator: "@serenica",
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
  verification: {
    // Add your verification codes here when available
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
    // yahoo: "your-yahoo-verification-code",
  },
  alternates: {
    canonical: "/",
  },
  category: "health",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <AuthProviderWrapper>
          {children}
        </AuthProviderWrapper>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
