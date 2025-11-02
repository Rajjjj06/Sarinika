"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DashboardNav } from "@/components/dashboard-nav"
import { ArrowLeft } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface JournalEntry {
  id: string
  content: string
  emotion: string
  mentalState: string
  createdAt: any
  updatedAt: any
}

export default function JournalDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, loading: authLoading } = useAuth()
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadJournalEntry = async () => {
      if (!user || authLoading) return

      const journalId = params.id as string
      if (!journalId) {
        router.push("/dashboard")
        return
      }

      try {
        const journalDoc = await getDoc(doc(db, "journalEntries", journalId))
        if (!journalDoc.exists()) {
          alert("Journal entry not found")
          router.push("/dashboard")
          return
        }

        const data = journalDoc.data()
        if (data.userId !== user.uid) {
          alert("You don't have permission to view this entry")
          router.push("/dashboard")
          return
        }

        setEntry({
          id: journalDoc.id,
          content: data.content || "",
          emotion: data.emotion || "Thoughtful",
          mentalState: data.mentalState || "Reflective",
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        })
      } catch (error) {
        console.error("Error loading journal entry:", error)
        alert("Failed to load journal entry")
        router.push("/dashboard")
      } finally {
        setLoading(false)
      }
    }

    loadJournalEntry()
  }, [user, authLoading, params.id, router])

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "Unknown"
    const date = timestamp.toDate()
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen gradient-bg-soft">
        <DashboardNav />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </main>
      </div>
    )
  }

  if (!entry) {
    return null
  }

  return (
    <div className="min-h-screen gradient-bg-soft">
      <DashboardNav />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="p-8 slide-up bg-card/60 backdrop-blur-md shadow-xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Journal Entry</h1>
            <p className="text-muted-foreground">{formatDate(entry.createdAt)}</p>
          </div>

          <div className="flex gap-3 mb-6">
            <span className="text-sm px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">
              {entry.emotion}
            </span>
            <span className="text-sm px-3 py-1 bg-accent/10 text-accent-foreground rounded-full">
              {entry.mentalState}
            </span>
          </div>

          <div className="prose prose-lg max-w-none">
            <div className="text-foreground whitespace-pre-wrap leading-relaxed">
              {entry.content}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Last updated: {formatDate(entry.updatedAt)}
            </p>
          </div>
        </Card>
      </main>
    </div>
  )
}

