import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { notificationId, userId, markAllAsRead } = body

    if (markAllAsRead && userId) {
      // Mark all notifications as read for user
      // Note: Firestore doesn't support bulk updates easily, so we'd need to fetch and update each
      // For now, we'll handle this on the client side or use a cloud function
      return NextResponse.json({ error: "Bulk update not implemented. Use individual updates." }, { status: 400 })
    }

    if (!notificationId) {
      return NextResponse.json({ error: "notificationId is required" }, { status: 400 })
    }

    // Verify the notification belongs to the user
    const notificationRef = doc(db, "notifications", notificationId)
    const notificationSnap = await getDoc(notificationRef)

    if (!notificationSnap.exists()) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }

    const notificationData = notificationSnap.data()
    if (userId && notificationData.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    await updateDoc(notificationRef, {
      read: true,
      updatedAt: serverTimestamp(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error marking notification as read:", error)
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 })
  }
}

