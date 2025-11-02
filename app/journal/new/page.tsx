"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DashboardNav } from "@/components/dashboard-nav"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

export default function NewJournalPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  const handleSave = async () => {
    if (!content.trim() || !user) return

    setLoading(true)
    setAnalyzing(true)

    try {
      // Step 1: Analyze the journal entry with AI
      const analyzeResponse = await fetch("/api/journal/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      })

      if (!analyzeResponse.ok) {
        throw new Error("Failed to analyze journal entry")
      }

      const analysis = await analyzeResponse.json()
      const { emotion, mentalState } = analysis

      // Step 2: Save to Firestore with AI-determined emotion and mental state
      await addDoc(collection(db, "journalEntries"), {
        userId: user.uid,
        content: content.trim(),
        emotion: emotion,
        mentalState: mentalState,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // Step 3: Navigate to dashboard
      router.push("/dashboard")
    } catch (error) {
      console.error("Error saving journal entry:", error)
      alert("Failed to save journal entry. Please try again.")
    } finally {
      setLoading(false)
      setAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen gradient-bg-soft">
      <DashboardNav />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-8 slide-up bg-card/60 backdrop-blur-md shadow-xl">
          <h1 className="text-3xl font-bold text-foreground mb-2">New Journal Entry</h1>
          <p className="text-muted-foreground mb-8">Take a moment to reflect and express your thoughts and feelings.</p>

          <div className="space-y-6">
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
                    <p className="font-medium text-foreground text-sm">AI Analysis</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your entry will be automatically analyzed to identify your emotions and mental state.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {analyzing && (
              <Card className="p-4 bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <p className="text-sm text-foreground">Analyzing your entry...</p>
                </div>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button variant="outline" onClick={() => router.back()} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading || !content.trim() || !user} className="flex-1">
                {loading ? (analyzing ? "Analyzing..." : "Saving...") : "Save Entry"}
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  )
}
