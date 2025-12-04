import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about Serenica's mission to empower people with tools to understand and manage their mental health through AI-powered journaling and insights.",
  openGraph: {
    title: "About Serenica - Our Mission & Vision",
    description: "Learn about Serenica's mission to empower people with tools to understand and manage their mental health through AI-powered journaling and insights.",
    url: "/about",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "About Serenica",
    description: "Learn about Serenica's mission to empower people with tools to understand and manage their mental health.",
  },
  alternates: {
    canonical: "/about",
  },
}

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

