"use client"

import { toast } from "sonner"
import { db } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
  orderBy,
} from "firebase/firestore"
import { NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/types/notifications"

// Emotion to mood score mapping
const EMOTION_SCORES: Record<string, number> = {
  Happy: 9,
  Calm: 8,
  Energetic: 8,
  Thoughtful: 6,
  Anxious: 4,
  Sad: 3,
}

/**
 * Show toast notifications based on user activity (streaks, milestones, mood)
 * Simple approach - just shows toasts, doesn't store in Firestore
 */
export async function showActivityNotifications(userId: string): Promise<void> {
  try {
    // Get user preferences
    const prefsRef = doc(db, "notificationPreferences", userId)
    const prefsSnap = await getDoc(prefsRef)
    const preferences: NotificationPreferences = prefsSnap.exists()
      ? (prefsSnap.data() as NotificationPreferences)
      : DEFAULT_NOTIFICATION_PREFERENCES

    // Check and show streak notifications
    await checkAndShowStreakNotifications(userId, preferences)

    // Check and show milestone notifications
    await checkAndShowMilestoneNotifications(userId, preferences)

    // Check and show mood notifications
    await checkAndShowMoodNotifications(userId, preferences)
  } catch (error) {
    console.error("Error showing notifications:", error)
    // Don't throw - just log the error
  }
}

/**
 * Check streak and show toast notifications
 */
async function checkAndShowStreakNotifications(
  userId: string,
  preferences: NotificationPreferences
): Promise<void> {
  if (!preferences.milestones.enabled) return

  // Get user activity
  const journalsQuery = query(collection(db, "journalEntries"), where("userId", "==", userId))
  const chatsQuery = query(collection(db, "chats"), where("userId", "==", userId))

  const [journalsSnapshot, chatsSnapshot] = await Promise.all([
    getDocs(journalsQuery),
    getDocs(chatsQuery),
  ])

  const activityDates: Date[] = []

  journalsSnapshot.forEach((doc) => {
    const data = doc.data()
    if (data.createdAt?.toDate) {
      activityDates.push(data.createdAt.toDate())
    }
  })

  chatsSnapshot.forEach((doc) => {
    const data = doc.data()
    if (data.createdAt?.toDate) {
      activityDates.push(data.createdAt.toDate())
    }
    if (data.updatedAt?.toDate) {
      activityDates.push(data.updatedAt.toDate())
    }
  })

  // Calculate streak
  const uniqueDates = Array.from(new Set(activityDates.map((d) => d.toDateString())))
    .map((d) => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime())

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const hasToday = uniqueDates.some((d) => {
    const date = new Date(d)
    date.setHours(0, 0, 0, 0)
    return date.getTime() === today.getTime()
  })

  const hasYesterday = uniqueDates.some((d) => {
    const date = new Date(d)
    date.setHours(0, 0, 0, 0)
    return date.getTime() === yesterday.getTime()
  })

  let streak = 0
  if (hasToday || hasYesterday) {
    const startDate = hasToday ? new Date(today) : new Date(yesterday)
    for (let i = 0; i < uniqueDates.length; i++) {
      const activityDate = new Date(uniqueDates[i])
      activityDate.setHours(0, 0, 0, 0)
      const expectedDate = new Date(startDate)
      expectedDate.setDate(expectedDate.getDate() - i)

      if (activityDate.getTime() === expectedDate.getTime()) {
        streak++
      } else {
        break
      }
    }
  }

  // Show streak achievement toasts for milestones
  if (streak > 0) {
    const milestones = [7, 14, 30, 50, 100]
    if (milestones.includes(streak)) {
      toast.success(`🎉 ${streak}-Day Streak!`, {
        description: `Amazing! You've maintained your journaling streak for ${streak} days. Keep up the great work!`,
        duration: 5000,
      })
    }
  }
}

/**
 * Check milestones and show toast notifications
 */
async function checkAndShowMilestoneNotifications(
  userId: string,
  preferences: NotificationPreferences
): Promise<void> {
  if (!preferences.milestones.enabled) return

  const journalsQuery = query(collection(db, "journalEntries"), where("userId", "==", userId))
  const journalsSnapshot = await getDocs(journalsQuery)
  const totalEntries = journalsSnapshot.size

  const milestones = [5, 10, 25, 50, 100, 250, 500]
  if (milestones.includes(totalEntries)) {
    toast.success(`🎉 ${totalEntries} Journal Entries!`, {
      description: `Congratulations! You've written ${totalEntries} journal entries. That's amazing progress!`,
      duration: 5000,
    })
  }
}

/**
 * Check mood and show toast notifications
 */
async function checkAndShowMoodNotifications(
  userId: string,
  preferences: NotificationPreferences
): Promise<void> {
  if (!preferences.moodAlerts.enabled) return

  // Get recent journal entries (last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const journalsQuery = query(
    collection(db, "journalEntries"),
    where("userId", "==", userId),
    where("createdAt", ">=", Timestamp.fromDate(sevenDaysAgo)),
    orderBy("createdAt", "desc")
  )

  try {
    const journalsSnapshot = await getDocs(journalsQuery)
    const recentJournals: Array<{ emotion: string }> = []

    journalsSnapshot.forEach((doc) => {
      const data = doc.data()
      recentJournals.push({
        emotion: data.emotion || "Thoughtful",
      })
    })

    if (recentJournals.length === 0) return

    // Calculate average mood from recent entries
    const moodScores = recentJournals.map((j) => EMOTION_SCORES[j.emotion] || 5)
    const avgMood = moodScores.reduce((sum, score) => sum + score, 0) / moodScores.length

    // Show mood alert if below threshold
    if (avgMood <= preferences.moodAlerts.threshold) {
      toast.info("We're Here for You 💙", {
        description: "We noticed you've been feeling down lately. Would you like to chat or journal about it?",
        duration: 6000,
      })
    }

    // Show mood improvement if recent entries show improvement
    if (recentJournals.length >= 3) {
      const recent3 = recentJournals.slice(0, 3)
      const older3 = recentJournals.slice(3, 6)

      if (older3.length >= 3) {
        const recentAvg =
          recent3.reduce((sum, j) => sum + (EMOTION_SCORES[j.emotion] || 5), 0) / 3
        const olderAvg =
          older3.reduce((sum, j) => sum + (EMOTION_SCORES[j.emotion] || 5), 0) / 3

        if (recentAvg > olderAvg + 1) {
          toast.success("Great Progress! 🌟", {
            description: "Your mood has been improving! Keep up the great work with your journaling.",
            duration: 5000,
          })
        }
      }
    }
  } catch (error) {
    // If query fails (e.g., missing index), just skip mood notifications
    console.log("Skipping mood notifications (query may need index):", error)
  }
}

