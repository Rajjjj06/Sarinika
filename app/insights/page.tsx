"use client"

import { useRef, useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { DashboardNav } from "@/components/dashboard-nav"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { Brain, TrendingUp, Zap } from "lucide-react"
import { motion, useInView } from "framer-motion"
import { useAuth } from "@/contexts/auth-context"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"

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

const COLORS = ["var(--color-primary)", "var(--color-secondary)", "var(--color-accent)", "#fbbf24", "#ef4444"]

// Emotion to mood score mapping
const EMOTION_SCORES: Record<string, number> = {
  Happy: 9,
  Calm: 8,
  Energetic: 8,
  Thoughtful: 6,
  Anxious: 4,
  Sad: 3,
}


export default function InsightsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [emotionData, setEmotionData] = useState<Array<{ emotion: string; count: number }>>([])
  const [dominantEmotion, setDominantEmotion] = useState<{ emotion: string; percentage: number }>({ emotion: "Thoughtful", percentage: 0 })
  const [wellnessScore, setWellnessScore] = useState<{ score: number; change: number }>({ score: 0, change: 0 })
  const [consistency, setConsistency] = useState(0)
  const [themes, setThemes] = useState<Array<{ title: string; mentions: number; trend: string }>>([])

  useEffect(() => {
    const loadInsightsData = async () => {
      if (!user) return

      try {
        // Load journal entries
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

        if (journalEntries.length === 0) {
          setLoading(false)
          return
        }

        // Calculate emotion distribution
        const emotionCounts: Record<string, number> = {}
        journalEntries.forEach(entry => {
          const emotion = entry.emotion || "Thoughtful"
          emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1
        })

        const emotionDataArray = Object.entries(emotionCounts)
          .map(([emotion, count]) => ({ emotion, count }))
          .sort((a, b) => b.count - a.count)

        setEmotionData(emotionDataArray)

        // Calculate dominant emotion
        if (emotionDataArray.length > 0) {
          const total = journalEntries.length
          const dominant = emotionDataArray[0]
          setDominantEmotion({
            emotion: dominant.emotion,
            percentage: Math.round((dominant.count / total) * 100),
          })
        }

        // Calculate wellness score (overall average)
        const scores: number[] = []
        journalEntries.forEach(entry => {
          const emotionScore = EMOTION_SCORES[entry.emotion] || 5
          scores.push(emotionScore)
        })
        const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length

        // Calculate change: compare last 7 days vs previous 7 days
        const now = new Date()
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const previous7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
        
        const recentEntries = journalEntries.filter(entry => {
          if (!entry.createdAt?.toDate) return false
          const entryDate = entry.createdAt.toDate()
          return entryDate >= last7Days
        })
        
        const previousEntries = journalEntries.filter(entry => {
          if (!entry.createdAt?.toDate) return false
          const entryDate = entry.createdAt.toDate()
          return entryDate >= previous7Days && entryDate < last7Days
        })

        let recentAvg = avgScore
        if (recentEntries.length > 0) {
          const recentScores = recentEntries.map(entry => EMOTION_SCORES[entry.emotion] || 5)
          recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length
        }

        let previousAvg = avgScore
        if (previousEntries.length > 0) {
          const previousScores = previousEntries.map(entry => EMOTION_SCORES[entry.emotion] || 5)
          previousAvg = previousScores.reduce((sum, score) => sum + score, 0) / previousScores.length
        }

        setWellnessScore({
          score: Math.round(avgScore * 10) / 10,
          change: Math.round((recentAvg - previousAvg) * 10) / 10,
        })

        // Calculate consistency (percentage of days with entries in last 30 days)
        const last30Days: Date[] = []
        for (let i = 29; i >= 0; i--) {
          const date = new Date()
          date.setDate(date.getDate() - i)
          date.setHours(0, 0, 0, 0)
          last30Days.push(date)
        }

        const daysWithEntries = new Set<string>()
        journalEntries.forEach(entry => {
          if (entry.createdAt?.toDate) {
            const entryDate = entry.createdAt.toDate()
            entryDate.setHours(0, 0, 0, 0)
            const dateStr = entryDate.toISOString().split('T')[0]
            
            // Check if this date is within last 30 days
            if (entryDate >= last30Days[0] && entryDate <= last30Days[29]) {
              daysWithEntries.add(dateStr)
            }
          }
        })

        const consistencyPercent = Math.round((daysWithEntries.size / 30) * 100)
        setConsistency(consistencyPercent)

        // Analyze themes from mental states
        const mentalStateCounts: Record<string, number> = {}
        
        journalEntries.forEach(entry => {
          const mentalState = entry.mentalState || "Reflective"
          mentalStateCounts[mentalState] = (mentalStateCounts[mentalState] || 0) + 1
        })

        // Calculate trends by comparing recent vs previous mental states
        // Reuse the date variables from wellness score calculation
        const recentMentalStates: Record<string, number> = {}
        const previousMentalStates: Record<string, number> = {}
        
        journalEntries.forEach(entry => {
          if (!entry.createdAt?.toDate) return
          const entryDate = entry.createdAt.toDate()
          const mentalState = entry.mentalState || "Reflective"
          
          if (entryDate >= last7Days) {
            recentMentalStates[mentalState] = (recentMentalStates[mentalState] || 0) + 1
          } else if (entryDate >= previous7Days && entryDate < last7Days) {
            previousMentalStates[mentalState] = (previousMentalStates[mentalState] || 0) + 1
          }
        })

        const themesArray = Object.entries(mentalStateCounts)
          .map(([title, mentions]) => {
            const recentCount = recentMentalStates[title] || 0
            const previousCount = previousMentalStates[title] || 0
            // Determine trend: up if increasing, down if decreasing, stable if same or no previous data
            let trend: "up" | "down" | "stable" = "stable"
            if (previousCount > 0) {
              if (recentCount > previousCount) {
                trend = "up"
              } else if (recentCount < previousCount) {
                trend = "down"
              }
            } else if (recentCount > 0 && previousCount === 0) {
              // New mental state appearing
              trend = "up"
            }
            
            return {
              title,
              mentions,
              trend,
            }
          })
          .sort((a, b) => b.mentions - a.mentions)
          .slice(0, 6) // Show top 6 mental states as themes

        setThemes(themesArray)
      } catch (error) {
        console.error("Error loading insights data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadInsightsData()

    // Reload data when window regains focus
    const handleFocus = () => {
      loadInsightsData()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [user])
  return (
    <div className="min-h-screen gradient-bg-alt">
      <DashboardNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 sm:mb-8"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Your Insights</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">AI-powered analysis of your mental wellness patterns</p>
        </motion.div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="p-4 sm:p-6 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Dominant Emotion</p>
                  {loading ? (
                    <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                  ) : (
                    <>
                      <p className="text-xl sm:text-2xl font-bold text-foreground truncate">{dominantEmotion.emotion}</p>
                      <p className="text-xs text-muted-foreground mt-2">{dominantEmotion.percentage}% of entries</p>
                    </>
                  )}
                </div>
                <div className="p-2 sm:p-3 bg-primary/10 rounded-lg flex-shrink-0 ml-2">
                  <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Card className="p-4 sm:p-6 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Wellness Score</p>
                  {loading ? (
                    <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                  ) : (
                    <>
                      <p className="text-xl sm:text-2xl font-bold text-foreground truncate">{wellnessScore.score.toFixed(1)}/10</p>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {wellnessScore.change > 0 ? `Up ${wellnessScore.change.toFixed(1)}` : wellnessScore.change < 0 ? `Down ${Math.abs(wellnessScore.change).toFixed(1)}` : "No change"} from previous period
                      </p>
                    </>
                  )}
                </div>
                <div className="p-2 sm:p-3 bg-secondary/10 rounded-lg flex-shrink-0 ml-2">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card className="p-4 sm:p-6 hover:shadow-lg transition-all sm:col-span-2 md:col-span-1">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Consistency</p>
                  {loading ? (
                    <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                  ) : (
                    <>
                      <p className="text-xl sm:text-2xl font-bold text-foreground truncate">{consistency}%</p>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {consistency >= 80 ? "Great journaling habit" : consistency >= 50 ? "Good consistency" : "Keep building the habit"}
                      </p>
                    </>
                  )}
                </div>
                <div className="p-2 sm:p-3 bg-accent/10 rounded-lg flex-shrink-0 ml-2">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <ScrollCard delay={0.6}>
            <Card className="p-4 sm:p-6 hover:shadow-lg transition-all">
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Emotion Distribution</h2>
              {loading ? (
                <div className="h-[250px] flex items-center justify-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : emotionData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center px-4">
                  <p className="text-sm sm:text-base text-muted-foreground text-center">No data available. Start journaling to see insights!</p>
                </div>
              ) : (
                <div className="w-full" style={{ height: '250px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={emotionData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis 
                        dataKey="emotion" 
                        stroke="var(--color-muted-foreground)" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        stroke="var(--color-muted-foreground)" 
                        tick={{ fontSize: 12 }}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="count" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </ScrollCard>

          <ScrollCard delay={0.8}>
            <Card className="p-4 sm:p-6 hover:shadow-lg transition-all">
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Emotion Breakdown</h2>
              {loading ? (
                <div className="h-[250px] flex items-center justify-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : emotionData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center px-4">
                  <p className="text-sm sm:text-base text-muted-foreground text-center">No data available. Start journaling to see insights!</p>
                </div>
              ) : (
                <div className="w-full" style={{ height: '250px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={emotionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ emotion, count }) => `${emotion}: ${count}`}
                        outerRadius="70%"
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
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </ScrollCard>
        </div>

        {/* Themes */}
        <ScrollCard delay={1}>
          <Card className="p-4 sm:p-6 hover:shadow-lg transition-all">
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Common Themes</h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : themes.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-sm sm:text-base text-muted-foreground">No themes detected yet. Keep journaling to discover patterns!</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {themes.map((theme, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 p-3 sm:p-4 border border-border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-medium text-foreground truncate">{theme.title}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{theme.mentions} mentions</p>
                  </div>
                  <div
                    className={`text-xs sm:text-sm font-medium whitespace-nowrap ${
                      theme.trend === "up" 
                        ? "text-secondary" 
                        : theme.trend === "down" 
                        ? "text-muted-foreground" 
                        : "text-muted-foreground"
                    }`}
                  >
                    {theme.trend === "up" 
                      ? "↑ Increasing" 
                      : theme.trend === "down" 
                      ? "↓ Decreasing" 
                      : "→ Stable"}
                  </div>
                </div>
              ))}
            </div>
          )}
          </Card>
        </ScrollCard>
      </main>
    </div>
  )
}
