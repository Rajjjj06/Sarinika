"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CheckCircle, Users, Lightbulb } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="min-h-screen gradient-bg-soft">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* About Section */}
        <section className="mb-16 slide-up">
          <h1 className="text-4xl font-bold text-foreground mb-6">About Sarinika</h1>
          <p className="text-lg text-muted-foreground mb-4">
            Sarinika is an AI-powered mental health companion designed to help you understand your emotions, track your
            wellness journey, and grow through mindful journaling and personalized insights.
          </p>
          <p className="text-lg text-muted-foreground">
            We believe that mental health is just as important as physical health, and everyone deserves access to tools
            that support their emotional well-being.
          </p>
        </section>

        {/* Mission */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-8">Our Mission</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Lightbulb,
                title: "Empower",
                description: "Give people the tools to understand and manage their mental health",
              },
              {
                icon: Users,
                title: "Connect",
                description: "Build a supportive community around mental wellness",
              },
              {
                icon: CheckCircle,
                title: "Transform",
                description: "Help people achieve lasting positive change in their lives",
              },
            ].map((item, idx) => (
              <Card key={idx} className="p-6">
                <item.icon className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-8">Why Sarinika?</h2>
          <div className="space-y-4">
            {[
              "AI-powered insights that understand your emotional patterns",
              "Private and secure journaling with end-to-end encryption",
              "Personalized recommendations based on your wellness data",
              "Beautiful, calming interface designed for mindfulness",
              "Track your progress and celebrate your growth",
              "Available 24/7 for your mental health support",
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 bg-card rounded-lg">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-foreground">{feature}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Start?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of people taking control of their mental health with Sarinika.
          </p>
          <Link href="/login">
            <Button size="lg">Get Started Today</Button>
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  )
}
