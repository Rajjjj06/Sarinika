import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/types/notifications"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const prefsRef = doc(db, "notificationPreferences", userId)
    const prefsSnap = await getDoc(prefsRef)

    if (!prefsSnap.exists()) {
      // Return default preferences if none exist
      return NextResponse.json({ preferences: DEFAULT_NOTIFICATION_PREFERENCES })
    }

    const data = prefsSnap.data()
    return NextResponse.json({ preferences: data as NotificationPreferences })
  } catch (error) {
    console.error("Error fetching notification preferences:", error)
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, preferences } = body

    if (!userId || !preferences) {
      return NextResponse.json({ error: "userId and preferences are required" }, { status: 400 })
    }

    const prefsRef = doc(db, "notificationPreferences", userId)
    await setDoc(
      prefsRef,
      {
        ...preferences,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )

    return NextResponse.json({ success: true, preferences })
  } catch (error) {
    console.error("Error saving notification preferences:", error)
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 })
  }
}

