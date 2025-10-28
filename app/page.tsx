"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Heart, Brain, Sparkles, TrendingUp } from "lucide-react"
import { motion, useInView } from "framer-motion"

function FeatureCard({ feature, index }: { feature: any; index: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.6, delay: index * 0.2 }}
    >
      <Card className="p-6 hover:shadow-lg transition-all hover:scale-105">
        <feature.icon className="w-8 h-8 text-primary mb-4" />
        <h3 className="text-xl font-semibold mb-2 text-foreground">{feature.title}</h3>
        <p className="text-muted-foreground">{feature.description}</p>
      </Card>
    </motion.div>
  )
}

function ScrollSection({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.6 }}
      className={className}
    >
      {children}
    </motion.section>
  )
}

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false)

  return (
    <div className="min-h-screen gradient-bg-soft">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 flex justify-center"
          >
            <div className="p-3 bg-primary/10 rounded-full">
              <Brain className="w-8 h-8 text-primary" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 text-balance"
          >
            Your Personal AI{" "}
            <span className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Mental Health
            </span>{" "}
            Companion
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg sm:text-xl text-muted-foreground mb-8 text-balance max-w-2xl mx-auto"
          >
            Serenica helps you understand your emotions, track your mental wellness, and grow through AI-powered
            insights and mindful journaling.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
          >
            <Link href="/login">
              <Button size="lg" className="w-full sm:w-auto">
                Get Started
              </Button>
            </Link>
            <Link href="/about">
              <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent">
                Learn More
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <ScrollSection className="py-16 px-4 sm:px-6 lg:px-8 bg-card/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">Why Choose Serenica?</h2>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Heart,
                title: "Emotional Awareness",
                description: "Track your emotions and understand patterns in your mental health journey.",
              },
              {
                icon: Sparkles,
                title: "AI-Powered Insights",
                description: "Get personalized recommendations and insights based on your journal entries.",
              },
              {
                icon: TrendingUp,
                title: "Progress Tracking",
                description: "Visualize your growth and celebrate milestones in your wellness journey.",
              },
            ].map((feature, idx) => (
              <FeatureCard key={idx} feature={feature} index={idx} />
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* CTA Section */}
      <ScrollSection className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 text-foreground">Ready to Start Your Journey?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of people taking control of their mental health with Serenica.
          </p>
          <Link href="/login">
            <Button size="lg" className="w-full sm:w-auto">
              Sign Up Now
            </Button>
          </Link>
        </div>
      </ScrollSection>

      <Footer />
    </div>
  )
}
