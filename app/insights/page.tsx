"use client"

import { useRef } from "react"
import { Card } from "@/components/ui/card"
import { DashboardNav } from "@/components/dashboard-nav"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { Brain, TrendingUp, Zap } from "lucide-react"
import { motion, useInView } from "framer-motion"

function ScrollCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.6, delay }}
    >
      {children}
    </motion.div>
  )
}

const emotionData = [
  { emotion: "Happy", count: 15 },
  { emotion: "Calm", count: 12 },
  { emotion: "Thoughtful", count: 10 },
  { emotion: "Anxious", count: 5 },
  { emotion: "Sad", count: 3 },
]

const COLORS = ["var(--color-primary)", "var(--color-secondary)", "var(--color-accent)", "#fbbf24", "#ef4444"]

const themes = [
  { title: "Work & Career", mentions: 18, trend: "up" },
  { title: "Relationships", mentions: 14, trend: "stable" },
  { title: "Health & Wellness", mentions: 12, trend: "up" },
  { title: "Personal Growth", mentions: 10, trend: "up" },
]

export default function InsightsPage() {
  return (
    <div className="min-h-screen gradient-bg-alt">
      <DashboardNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-foreground">Your Insights</h1>
          <p className="text-muted-foreground mt-1">AI-powered analysis of your mental wellness patterns</p>
        </motion.div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="p-6 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Dominant Emotion</p>
                  <p className="text-2xl font-bold text-foreground">Happy</p>
                  <p className="text-xs text-muted-foreground mt-2">32% of entries</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Card className="p-6 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Wellness Score</p>
                  <p className="text-2xl font-bold text-foreground">7.8/10</p>
                  <p className="text-xs text-muted-foreground mt-2">Up 0.5 from last week</p>
                </div>
                <div className="p-3 bg-secondary/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-secondary" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card className="p-6 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Consistency</p>
                  <p className="text-2xl font-bold text-foreground">94%</p>
                  <p className="text-xs text-muted-foreground mt-2">Great journaling habit</p>
                </div>
                <div className="p-3 bg-accent/10 rounded-lg">
                  <Zap className="w-6 h-6 text-accent" />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <ScrollCard delay={0.6}>
            <Card className="p-6 hover:shadow-lg transition-all">
              <h2 className="text-lg font-semibold text-foreground mb-4">Emotion Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={emotionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="emotion" stroke="var(--color-muted-foreground)" />
                  <YAxis stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </ScrollCard>

          <ScrollCard delay={0.8}>
            <Card className="p-6 hover:shadow-lg transition-all">
              <h2 className="text-lg font-semibold text-foreground mb-4">Emotion Breakdown</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={emotionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ emotion, count }) => `${emotion}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {emotionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </ScrollCard>
        </div>

        {/* Themes */}
        <ScrollCard delay={1}>
          <Card className="p-6 hover:shadow-lg transition-all">
          <h2 className="text-lg font-semibold text-foreground mb-4">Common Themes</h2>
          <div className="space-y-3">
            {themes.map((theme, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div>
                  <p className="font-medium text-foreground">{theme.title}</p>
                  <p className="text-sm text-muted-foreground">{theme.mentions} mentions</p>
                </div>
                <div
                  className={`text-sm font-medium ${theme.trend === "up" ? "text-secondary" : "text-muted-foreground"}`}
                >
                  {theme.trend === "up" ? "↑ Increasing" : "→ Stable"}
                </div>
              </div>
            ))}
          </div>
          </Card>
        </ScrollCard>
      </main>
    </div>
  )
}
