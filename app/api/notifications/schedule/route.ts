import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp } from "firebase/firestore"
import { doc, getDoc } from "firebase/firestore"
import { NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/types/notifications"
import {
  shouldSendDailyReminder,
  shouldSendWeeklyInsights,
  shouldSendStreakWarning,
} from "@/lib/utils/notification-timing"

/**
 * This endpoint should be called periodically (e.g., via cron job or scheduled function)
 * to check if scheduled notifications should be sent
 */
export async function POST(request: NextRequest) {
  try {
    // Get all users (in production, you'd want to paginate this)
    const usersQuery = query(collection(db, "users"))
    const usersSnapshot = await getDocs(usersQuery)

    const notificationsCreated: string[] = []

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id

      try {
        // Get user preferences
        const prefsRef = doc(db, "notificationPreferences", userId)
        const prefsSnap = await getDoc(prefsRef)
        const preferences: NotificationPreferences = prefsSnap.exists()
          ? (prefsSnap.data() as NotificationPreferences)
          : DEFAULT_NOTIFICATION_PREFERENCES

        // Check daily reminder
        if (shouldSendDailyReminder(preferences)) {
          // Check if we already sent today
          const todayStart = new Date()
          todayStart.setHours(0, 0, 0, 0)
          const todayEnd = new Date()
          todayEnd.setHours(23, 59, 59, 999)

          const existingQuery = query(
            collection(db, "notifications"),
            where("userId", "==", userId),
            where("type", "==", "daily_reminder"),
            where("createdAt", ">=", Timestamp.fromDate(todayStart)),
            where("createdAt", "<=", Timestamp.fromDate(todayEnd))
          )

          const existing = await getDocs(existingQuery)
          if (existing.empty) {
            const notificationRef = await addDoc(collection(db, "notifications"), {
              userId,
              type: "daily_reminder",
              title: "Time for Your Daily Journal 📝",
              message: "Take a moment to reflect on your day. How are you feeling?",
              read: false,
              actionUrl: "/journal/new",
              actionLabel: "Write Journal",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
            notificationsCreated.push(notificationRef.id)
          }
        }

        // Check weekly insights
        if (shouldSendWeeklyInsights(preferences)) {
          // Check if we already sent this week
          const weekAgo = new Date()
          weekAgo.setDate(weekAgo.getDate() - 7)

          const existingQuery = query(
            collection(db, "notifications"),
            where("userId", "==", userId),
            where("type", "==", "weekly_insights"),
            where("createdAt", ">=", Timestamp.fromDate(weekAgo))
          )

          const existing = await getDocs(existingQuery)
          if (existing.empty) {
            const notificationRef = await addDoc(collection(db, "notifications"), {
              userId,
              type: "weekly_insights",
              title: "Your Weekly Insights Are Ready 📊",
              message: "Check out your weekly wellness insights and progress summary.",
              read: false,
              actionUrl: "/insights",
              actionLabel: "View Insights",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
            notificationsCreated.push(notificationRef.id)
          }
        }

        // Check streak warnings (this is also handled in /check, but we can schedule it here too)
        if (shouldSendStreakWarning(preferences)) {
          // The actual streak warning logic is in /check endpoint
          // This is just a placeholder for scheduled checks
        }
      } catch (error) {
        console.error(`Error processing notifications for user ${userId}:`, error)
        // Continue with next user
      }
    }

    return NextResponse.json({
      success: true,
      notificationsCreated: notificationsCreated.length,
      notificationIds: notificationsCreated,
    })
  } catch (error) {
    console.error("Error in scheduled notification check:", error)
    return NextResponse.json({ error: "Failed to check scheduled notifications" }, { status: 500 })
  }
}

