"use client"

import { Card } from "@/components/ui/card"
import { DashboardNav } from "@/components/dashboard-nav"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { Brain, TrendingUp, Zap } from "lucide-react"

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Your Insights</h1>
          <p className="text-muted-foreground mt-1">AI-powered analysis of your mental wellness patterns</p>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
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

          <Card className="p-6">
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

          <Card className="p-6">
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
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
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

          <Card className="p-6">
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
        </div>

        {/* Themes */}
        <Card className="p-6">
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
      </main>
    </div>
  )
}
