"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DashboardNav } from "@/components/dashboard-nav"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles } from "lucide-react"

const moods = ["Happy", "Calm", "Anxious", "Sad", "Thoughtful", "Energetic"]

export default function NewJournalPage() {
  const router = useRouter()
  const [mood, setMood] = useState("Calm")
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    // Simulate save
    setTimeout(() => {
      setLoading(false)
      router.push("/dashboard")
    }, 1000)
  }

  return (
    <div className="min-h-screen gradient-bg-soft">
      <DashboardNav />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-8 slide-up bg-card/60 backdrop-blur-md shadow-xl">
          <h1 className="text-3xl font-bold text-foreground mb-2">New Journal Entry</h1>
          <p className="text-muted-foreground mb-8">Take a moment to reflect and express your thoughts and feelings.</p>

          <div className="space-y-6">
            {/* Mood Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">How are you feeling?</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {moods.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMood(m)}
                    className={`p-3 rounded-lg font-medium transition-all ${
                      mood === m
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">Your thoughts</label>
              <Textarea
                placeholder="Write your thoughts, feelings, and reflections here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-64"
              />
            </div>

            {/* AI Insights Preview */}
            {content.length > 50 && (
              <Card className="p-4 bg-accent/5 border border-accent/20">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground text-sm">AI Insights</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your entry will be analyzed to provide personalized insights and recommendations.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button variant="outline" onClick={() => router.back()} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading || !content.trim()} className="flex-1">
                {loading ? "Saving..." : "Save Entry"}
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  )
}
