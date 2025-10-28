"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DashboardNav } from "@/components/dashboard-nav"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { Plus, Calendar, TrendingUp, Heart } from "lucide-react"

const moodData = [
  { day: "Mon", mood: 7 },
  { day: "Tue", mood: 6 },
  { day: "Wed", mood: 8 },
  { day: "Thu", mood: 7 },
  { day: "Fri", mood: 9 },
  { day: "Sat", mood: 8 },
  { day: "Sun", mood: 7 },
]

const streakData = [
  { week: "Week 1", entries: 5 },
  { week: "Week 2", entries: 6 },
  { week: "Week 3", entries: 7 },
  { week: "Week 4", entries: 8 },
]

export default function DashboardPage() {
  const [entries, setEntries] = useState([
    { id: 1, date: "Today", mood: "Happy", preview: "Had a great day at work today..." },
    { id: 2, date: "Yesterday", mood: "Calm", preview: "Spent time meditating and reflecting..." },
    { id: 3, date: "2 days ago", mood: "Thoughtful", preview: "Thinking about my goals and aspirations..." },
  ])

  return (
    <div className="min-h-screen gradient-bg">
      <DashboardNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Welcome Back</h1>
            <p className="text-muted-foreground mt-1">Here's your mental wellness overview</p>
          </div>
          <Link href="/journal/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Entry
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Streak</p>
                <p className="text-3xl font-bold text-foreground">12 days</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Entries</p>
                <p className="text-3xl font-bold text-foreground">47</p>
              </div>
              <div className="p-3 bg-secondary/10 rounded-lg">
                <Heart className="w-6 h-6 text-secondary" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Avg. Mood</p>
                <p className="text-3xl font-bold text-foreground">7.6/10</p>
              </div>
              <div className="p-3 bg-accent/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Weekly Mood Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={moodData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" />
                <YAxis stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="mood"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-primary)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Journal Entries</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={streakData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="week" stroke="var(--color-muted-foreground)" />
                <YAxis stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="entries" fill="var(--color-secondary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Recent Entries */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Entries</h2>
          <div className="space-y-4">
            {entries.map((entry) => (
              <Link key={entry.id} href={`/journal/${entry.id}`}>
                <div className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-foreground">{entry.date}</h3>
                    <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">{entry.mood}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{entry.preview}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </main>
    </div>
  )
}
