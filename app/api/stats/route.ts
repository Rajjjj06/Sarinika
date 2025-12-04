import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore"

// Emotion to mood score mapping
const EMOTION_SCORES: Record<string, number> = {
  Happy: 9,
  Calm: 8,
  Energetic: 8,
  Thoughtful: 6,
  Anxious: 4,
  Sad: 3,
}

interface JournalEntry {
  emotion: string
  mentalState: string
  createdAt: Timestamp
}

interface ChatMessage {
  role: string
  content: string
}

interface ChatDocument {
  messages: ChatMessage[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

/**
 * Calculate streak based on activity dates
 * Streak counts if user has journal or chat activity on consecutive days
 */
function calculateStreak(activityDates: Date[]): number {
  if (activityDates.length === 0) return 0

  // Sort dates in descending order and get unique dates only
  const uniqueDates = Array.from(new Set(activityDates.map(d => d.toDateString())))
    .map(d => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime())

  // Check if today or yesterday is included, if not, streak is broken
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const hasToday = uniqueDates.some(d => d.getTime() === today.getTime())
  const hasYesterday = uniqueDates.some(d => d.getTime() === yesterday.getTime())

  if (!hasToday && !hasYesterday) {
    return 0 // Streak is broken if no activity today or yesterday
  }

  let streak = 0
  let currentDate = hasToday ? new Date(today) : new Date(yesterday)

  // Count consecutive days from most recent
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

/**
 * Calculate mood score from journal emotion, mental state, and chat context
 */
function calculateMoodScore(journals: JournalEntry[], chats: ChatDocument[]): number {
  const scores: number[] = []

  // Add journal emotion scores
  for (const journal of journals) {
    const emotionScore = EMOTION_SCORES[journal.emotion] || 5
    scores.push(emotionScore)
  }

  // Analyze chat messages for sentiment indicators
  for (const chat of chats) {
    const messages = chat.messages || []
    let chatScore = 5 // Neutral

    // Simple sentiment analysis based on keywords
    const positiveWords = [
      "good", "great", "better", "happy", "amazing", "wonderful", "excited", 
      "relieved", "confident", "hopeful", "optimistic", "proud", "grateful"
    ]
    const negativeWords = [
      "bad", "terrible", "awful", "sad", "anxious", "worried", "stressed",
      "depressed", "tired", "overwhelmed", "hopeless", "frustrated", "angry"
    ]

    for (const message of messages) {
      if (message.role === "user") {
        const content = message.content.toLowerCase()
        const positiveCount = positiveWords.filter(word => content.includes(word)).length
        const negativeCount = negativeWords.filter(word => content.includes(word)).length

        if (positiveCount > negativeCount) {
          chatScore += 0.5
        } else if (negativeCount > positiveCount) {
          chatScore -= 0.5
        }
      }
    }

    scores.push(Math.max(1, Math.min(10, chatScore)))
  }

  if (scores.length === 0) return 0
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    // Fetch journal entries
    const journalsQuery = query(
      collection(db, "journalEntries"),
      where("userId", "==", userId)
    )
    const journalsSnapshot = await getDocs(journalsQuery)
    
    const journalEntries: JournalEntry[] = []
    journalsSnapshot.forEach(doc => {
      const data = doc.data()
      journalEntries.push({
        emotion: data.emotion || "Thoughtful",
        mentalState: data.mentalState || "Reflective",
        createdAt: data.createdAt,
      })
    })

    // Fetch chats
    const chatsQuery = query(
      collection(db, "chats"),
      where("userId", "==", userId)
    )
    const chatsSnapshot = await getDocs(chatsQuery)
    
    const chats: ChatDocument[] = []
    chatsSnapshot.forEach(doc => {
      const data = doc.data()
      chats.push({
        messages: data.messages || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      })
    })

    // Collect all activity dates
    const activityDates: Date[] = []
    
    // Add journal dates
    for (const journal of journalEntries) {
      if (journal.createdAt && journal.createdAt.toDate) {
        activityDates.push(journal.createdAt.toDate())
      }
    }

    // Add chat dates (both create and update)
    for (const chat of chats) {
      if (chat.createdAt && chat.createdAt.toDate) {
        activityDates.push(chat.createdAt.toDate())
      }
      if (chat.updatedAt && chat.updatedAt.toDate) {
        activityDates.push(chat.updatedAt.toDate())
      }
    }

    // Calculate statistics
    const streak = calculateStreak(activityDates)
    const totalEntries = journalEntries.length
    const avgMood = calculateMoodScore(journalEntries, chats)

    return NextResponse.json({
      streak,
      totalEntries,
      avgMood: Math.round(avgMood * 10) / 10,
      journalCount: journalEntries.length,
      chatCount: chats.length,
    })
  } catch (error) {
    console.error("Error fetching statistics:", error)
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    )
  }
}

