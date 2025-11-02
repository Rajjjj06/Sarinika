"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DashboardNav } from "@/components/dashboard-nav"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { Plus, Calendar, TrendingUp, Heart } from "lucide-react"
import { motion, useInView } from "framer-motion"
import { useAuth } from "@/contexts/auth-context"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore"

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

interface JournalEntry {
  id: string
  content: string
  emotion: string
  mentalState: string
  createdAt: any
}

// Emotion to mood score mapping
const EMOTION_SCORES: Record<string, number> = {
  Happy: 9,
  Calm: 8,
  Energetic: 8,
  Thoughtful: 6,
  Anxious: 4,
  Sad: 3,
}

// Calculate streak based on activity dates
function calculateStreak(activityDates: Date[]): number {
  if (activityDates.length === 0) return 0

  const uniqueDates = Array.from(new Set(activityDates.map(d => d.toDateString())))
    .map(d => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime())

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const hasToday = uniqueDates.some(d => d.getTime() === today.getTime())
  const hasYesterday = uniqueDates.some(d => d.getTime() === yesterday.getTime())

  if (!hasToday && !hasYesterday) {
    return 0
  }

  let streak = 0
  let currentDate = hasToday ? new Date(today) : new Date(yesterday)

  for (let i = 0; i < uniqueDates.length; i++) {
    const activityDate = new Date(uniqueDates[i])
    activityDate.setHours(0, 0, 0, 0)

    const expectedDate = new Date(currentDate)
    expectedDate.setDate(expectedDate.getDate() - i)

    if (activityDate.getTime() === expectedDate.getTime()) {
      streak++
    } else {
      break
    }
  }

  return streak
}

// Calculate average mood from journals
function calculateMoodScore(journalEntries: any[]): number {
  if (journalEntries.length === 0) return 0
  
  const scores: number[] = []
  for (const journal of journalEntries) {
    const emotionScore = EMOTION_SCORES[journal.emotion] || 5
    scores.push(emotionScore)
  }
  
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

export default function DashboardPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [stats, setStats] = useState({
    streak: 0,
    totalEntries: 0,
    avgMood: 0,
  })
  const [loading, setLoading] = useState(true)
  const [moodData, setMoodData] = useState<any[]>([])
  const [streakData, setStreakData] = useState<any[]>([])

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return

      try {
        // Load recent journal entries
        const journalsQuery = query(
          collection(db, "journalEntries"),
          where("userId", "==", user.uid)
        )
        const journalsSnapshot = await getDocs(journalsQuery)

        const journalEntries: JournalEntry[] = []
        journalsSnapshot.forEach(doc => {
          const data = doc.data()
          journalEntries.push({
            id: doc.id,
            content: data.content || "",
            emotion: data.emotion || "Thoughtful",
            mentalState: data.mentalState || "Reflective",
            createdAt: data.createdAt,
          })
        })

        // Sort by createdAt descending
        journalEntries.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0
          const bTime = b.createdAt?.toMillis?.() || 0
          return bTime - aTime
        })

        // Get last 3 entries
        setEntries(journalEntries.slice(0, 3))

        // Also load chats for streak calculation
        const chatsQuery = query(
          collection(db, "chats"),
          where("userId", "==", user.uid)
        )
        const chatsSnapshot = await getDocs(chatsQuery)

        // Collect all activity dates
        const activityDates: Date[] = []
        
        // Add journal dates
        for (const journal of journalEntries) {
          if (journal.createdAt && journal.createdAt.toDate) {
            activityDates.push(journal.createdAt.toDate())
          }
        }

        // Add chat dates
        chatsSnapshot.forEach(doc => {
          const data = doc.data()
          if (data.createdAt && data.createdAt.toDate) {
            activityDates.push(data.createdAt.toDate())
          }
          if (data.updatedAt && data.updatedAt.toDate) {
            activityDates.push(data.updatedAt.toDate())
          }
        })

        // Calculate statistics
        const streak = calculateStreak(activityDates)
        const totalEntries = journalEntries.length
        const avgMood = calculateMoodScore(journalEntries)

        setStats({
          streak,
          totalEntries,
          avgMood: Math.round(avgMood * 10) / 10,
        })

        // Prepare mood data for last 7 days
        const last7Days: any[] = []
        for (let i = 6; i >= 0; i--) {
          const date = new Date()
          date.setDate(date.getDate() - i)
          date.setHours(0, 0, 0, 0) // Set to midnight for proper comparison
          
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
          
          // Find entries for this day
          const dayEntries = journalEntries.filter(entry => {
            if (!entry.createdAt?.toDate) return false
            const entryDate = entry.createdAt.toDate()
            const entryDateMidnight = new Date(entryDate)
            entryDateMidnight.setHours(0, 0, 0, 0)
            return entryDateMidnight.getTime() === date.getTime()
          })

          if (dayEntries.length > 0) {
            const avgMood = dayEntries.reduce((sum, entry) => 
              sum + (EMOTION_SCORES[entry.emotion] || 5), 0
            ) / dayEntries.length
            last7Days.push({ day: dayName, mood: Math.round(avgMood * 10) / 10 })
          } else {
            // No data for this day - use 0 to show no activity
            last7Days.push({ day: dayName, mood: 0 })
          }
        }

        setMoodData(last7Days)

        // Prepare weekly entries data
        const last4Weeks: any[] = []
        const now = new Date()
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date(now)
          weekStart.setDate(weekStart.getDate() - (i * 7 + 6))
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekEnd.getDate() + 6)

          const weekEntries = journalEntries.filter(entry => {
            if (!entry.createdAt?.toDate) return false
            const entryDate = entry.createdAt.toDate()
            return entryDate >= weekStart && entryDate <= weekEnd
          })

          last4Weeks.push({
            week: `Week ${4 - i}`,
            entries: weekEntries.length,
          })
        }

        setStreakData(last4Weeks)
      } catch (error) {
        console.error("Error loading dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()

    // Reload data when window regains focus (user comes back from creating journal)
    const handleFocus = () => {
      loadDashboardData()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [user, pathname])

  const formatJournalDate = (createdAt: any) => {
    if (!createdAt?.toDate) return "Unknown"
    const date = createdAt.toDate()
    const now = new Date()
    
    // Normalize both dates to midnight for accurate day comparison
    const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    const diffTime = nowMidnight.getTime() - dateMidnight.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="min-h-screen gradient-bg">
      <DashboardNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex justify-between items-center mb-8"
        >
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
        </motion.div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="p-6 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Current Streak</p>
                  <p className="text-3xl font-bold text-foreground">{stats.streak} {stats.streak === 1 ? 'day' : 'days'}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Calendar className="w-6 h-6 text-primary" />
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
                  <p className="text-sm text-muted-foreground mb-1">Total Entries</p>
                  <p className="text-3xl font-bold text-foreground">{stats.totalEntries}</p>
                </div>
                <div className="p-3 bg-secondary/10 rounded-lg">
                  <Heart className="w-6 h-6 text-secondary" />
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
                  <p className="text-sm text-muted-foreground mb-1">Avg. Mood</p>
                  <p className="text-3xl font-bold text-foreground">{stats.avgMood.toFixed(1)}/10</p>
                </div>
                <div className="p-3 bg-accent/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-accent" />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <ScrollCard delay={0.6}>
            <Card className="p-6 hover:shadow-lg transition-all">
              <h2 className="text-lg font-semibold text-foreground mb-4">Weekly Mood Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={moodData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" />
                  <YAxis domain={[0, 10]} stroke="var(--color-muted-foreground)" />
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
          </ScrollCard>

          <ScrollCard delay={0.8}>
            <Card className="p-6 hover:shadow-lg transition-all">
              <h2 className="text-lg font-semibold text-foreground mb-4">Journal Entries</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={streakData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="week" stroke="var(--color-muted-foreground)" />
                  <YAxis 
                    stroke="var(--color-muted-foreground)" 
                    ticks={[0, 5, 10, 15, 20, 25, 30]}
                    domain={[0, 30]}
                  />
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
          </ScrollCard>
        </div>

        {/* Recent Entries */}
        <ScrollCard delay={1}>
          <Card className="p-6 hover:shadow-lg transition-all">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Entries</h2>
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No journal entries yet. Start writing to track your progress!</p>
              </div>
            ) : (
              entries.map((entry) => (
                <Link key={entry.id} href={`/journal/${entry.id}`}>
                  <div className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-foreground">{formatJournalDate(entry.createdAt)}</h3>
                      <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">{entry.emotion}</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {entry.content.length > 100 ? `${entry.content.substring(0, 100)}...` : entry.content}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
          </Card>
        </ScrollCard>
      </main>
    </div>
  )
}
