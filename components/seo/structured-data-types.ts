export interface Organization {
  "@type": "Organization"
  name: string
  description: string
  url: string
  logo?: string
  sameAs?: string[]
  contactPoint?: {
    "@type": "ContactPoint"
    contactType: string
    availableLanguage: string
  }
}

export interface WebApplication {
  "@type": "WebApplication"
  name: string
  description: string
  url: string
  applicationCategory: string
  operatingSystem: string
  offers?: {
    "@type": "Offer"
    price: string
    priceCurrency: string
  }
  aggregateRating?: {
    "@type": "AggregateRating"
    ratingValue: string
    ratingCount: string
  }
  featureList?: string[]
}

export interface FAQPage {
  "@type": "FAQPage"
  mainEntity: Array<{
    "@type": "Question"
    name: string
    acceptedAnswer: {
      "@type": "Answer"
      text: string
    }
  }>
}

