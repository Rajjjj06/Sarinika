import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit,
  doc,
  getDoc,
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
 * Check and create notifications based on user activity, streaks, and mood
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Get user preferences
    const prefsRef = doc(db, "notificationPreferences", userId)
    const prefsSnap = await getDoc(prefsRef)
    const preferences: NotificationPreferences = prefsSnap.exists()
      ? (prefsSnap.data() as NotificationPreferences)
      : DEFAULT_NOTIFICATION_PREFERENCES

    const createdNotifications: string[] = []

    // 1. Check streak and create notifications
    const streakNotifications = await checkStreakNotifications(userId, preferences)
    createdNotifications.push(...streakNotifications)

    // 2. Check mood and create notifications
    const moodNotifications = await checkMoodNotifications(userId, preferences)
    createdNotifications.push(...moodNotifications)

    // 3. Check milestones
    const milestoneNotifications = await checkMilestoneNotifications(userId, preferences)
    createdNotifications.push(...milestoneNotifications)

    return NextResponse.json({
      success: true,
      notificationsCreated: createdNotifications.length,
      notificationIds: createdNotifications,
    })
  } catch (error) {
    console.error("Error checking notifications:", error)
    return NextResponse.json({ error: "Failed to check notifications" }, { status: 500 })
  }
}

/**
 * Check streak and create appropriate notifications
 */
async function checkStreakNotifications(
  userId: string,
  preferences: NotificationPreferences
): Promise<string[]> {
  const created: string[] = []

  if (!preferences.streakWarnings.enabled && !preferences.milestones.enabled) {
    return created
  }

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

  // Check for streak warnings
  if (preferences.streakWarnings.enabled && streak > 0 && !hasToday) {
    // Check if we already sent a warning today
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const existingWarningQuery = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("type", "==", "streak_warning"),
      where("createdAt", ">=", Timestamp.fromDate(todayStart)),
      where("createdAt", "<=", Timestamp.fromDate(todayEnd))
    )

    const existingWarnings = await getDocs(existingWarningQuery)
    if (existingWarnings.empty) {
      const notificationRef = await addDoc(collection(db, "notifications"), {
        userId,
        type: "streak_warning",
        title: "Don't Break Your Streak! 🔥",
        message: `You're on a ${streak}-day streak! Journal or chat today to keep it going.`,
        read: false,
        actionUrl: "/journal/new",
        actionLabel: "Write Journal",
        metadata: { streak },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      created.push(notificationRef.id)
    }
  }

  // Check for streak achievements (milestones: 7, 14, 30, 50, 100 days)
  if (preferences.milestones.enabled && streak > 0) {
    const milestones = [7, 14, 30, 50, 100]
    for (const milestone of milestones) {
      if (streak === milestone) {
        // Check if we already notified about this milestone
        const milestoneQuery = query(
          collection(db, "notifications"),
          where("userId", "==", userId),
          where("type", "==", "streak_achievement"),
          where("metadata.streak", "==", milestone),
          orderBy("createdAt", "desc"),
          limit(1)
        )

        const existing = await getDocs(milestoneQuery)
        if (existing.empty) {
          const notificationRef = await addDoc(collection(db, "notifications"), {
            userId,
            type: "streak_achievement",
            title: `🎉 ${milestone}-Day Streak Achieved!`,
            message: `Amazing! You've maintained your journaling streak for ${milestone} days. Keep up the great work!`,
            read: false,
            actionUrl: "/dashboard",
            actionLabel: "View Dashboard",
            metadata: { streak: milestone },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
          created.push(notificationRef.id)
        }
      }
    }
  }

  return created
}

/**
 * Check mood and create notifications
 */
async function checkMoodNotifications(
  userId: string,
  preferences: NotificationPreferences
): Promise<string[]> {
  const created: string[] = []

  if (!preferences.moodAlerts.enabled) {
    return created
  }

  // Get recent journal entries (last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const journalsQuery = query(
    collection(db, "journalEntries"),
    where("userId", "==", userId),
    where("createdAt", ">=", Timestamp.fromDate(sevenDaysAgo)),
    orderBy("createdAt", "desc")
  )

  const journalsSnapshot = await getDocs(journalsQuery)
  const recentJournals: Array<{ emotion: string; createdAt: any }> = []

  journalsSnapshot.forEach((doc) => {
    const data = doc.data()
    recentJournals.push({
      emotion: data.emotion || "Thoughtful",
      createdAt: data.createdAt,
    })
  })

  if (recentJournals.length === 0) {
    return created
  }

  // Calculate average mood from recent entries
  const moodScores = recentJournals.map((j) => EMOTION_SCORES[j.emotion] || 5)
  const avgMood = moodScores.reduce((sum, score) => sum + score, 0) / moodScores.length

  // Check if mood is below threshold
  if (avgMood <= preferences.moodAlerts.threshold) {
    // Check if we already sent a mood alert recently (within last 24 hours)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const existingAlertQuery = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("type", "==", "mood_alert"),
      where("createdAt", ">=", Timestamp.fromDate(yesterday))
    )

    const existingAlerts = await getDocs(existingAlertQuery)
    if (existingAlerts.empty) {
      const notificationRef = await addDoc(collection(db, "notifications"), {
        userId,
        type: "mood_alert",
        title: "We're Here for You 💙",
        message: `We noticed you've been feeling down lately. Would you like to chat or journal about it?`,
        read: false,
        actionUrl: "/chat",
        actionLabel: "Start Chat",
        metadata: { moodScore: Math.round(avgMood * 10) / 10 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      created.push(notificationRef.id)
    }
  }

  // Check for mood improvement
  if (recentJournals.length >= 3) {
    const recent3 = recentJournals.slice(0, 3)
    const older3 = recentJournals.slice(3, 6)

    if (older3.length >= 3) {
      const recentAvg =
        recent3.reduce((sum, j) => sum + (EMOTION_SCORES[j.emotion] || 5), 0) / 3
      const olderAvg =
        older3.reduce((sum, j) => sum + (EMOTION_SCORES[j.emotion] || 5), 0) / 3

      if (recentAvg > olderAvg + 1) {
        // Check if we already sent improvement notification
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)

        const existingQuery = query(
          collection(db, "notifications"),
          where("userId", "==", userId),
          where("type", "==", "mood_improvement"),
          where("createdAt", ">=", Timestamp.fromDate(yesterday))
        )

        const existing = await getDocs(existingQuery)
        if (existing.empty) {
          const notificationRef = await addDoc(collection(db, "notifications"), {
            userId,
            type: "mood_improvement",
            title: "Great Progress! 🌟",
            message: `Your mood has been improving! Keep up the great work with your journaling.`,
            read: false,
            actionUrl: "/dashboard",
            actionLabel: "View Progress",
            metadata: { moodScore: Math.round(recentAvg * 10) / 10 },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
          created.push(notificationRef.id)
        }
      }
    }
  }

  return created
}

/**
 * Check for milestone achievements (total entries)
 */
async function checkMilestoneNotifications(
  userId: string,
  preferences: NotificationPreferences
): Promise<string[]> {
  const created: string[] = []

  if (!preferences.milestones.enabled) {
    return created
  }

  const journalsQuery = query(collection(db, "journalEntries"), where("userId", "==", userId))
  const journalsSnapshot = await getDocs(journalsQuery)
  const totalEntries = journalsSnapshot.size

  const milestones = [5, 10, 25, 50, 100, 250, 500]
  for (const milestone of milestones) {
    if (totalEntries === milestone) {
      // Check if we already notified about this milestone
      const milestoneQuery = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        where("type", "==", "milestone"),
        where("metadata.milestone", "==", `${milestone} entries`),
        orderBy("createdAt", "desc"),
        limit(1)
      )

      const existing = await getDocs(milestoneQuery)
      if (existing.empty) {
        const notificationRef = await addDoc(collection(db, "notifications"), {
          userId,
          type: "milestone",
          title: `🎉 ${milestone} Journal Entries!`,
          message: `Congratulations! You've written ${milestone} journal entries. That's amazing progress!`,
          read: false,
          actionUrl: "/dashboard",
          actionLabel: "View Dashboard",
          metadata: { milestone: `${milestone} entries` },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        created.push(notificationRef.id)
      }
    }
  }

  return created
}

