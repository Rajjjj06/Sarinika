import { Organization, WebApplication, FAQPage } from "./structured-data-types"

interface StructuredDataProps {
  type: "organization" | "webapplication" | "faq"
  data: Organization | WebApplication | FAQPage
}

export function StructuredData({ type, data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          ...data,
        }),
      }}
    />
  )
}

