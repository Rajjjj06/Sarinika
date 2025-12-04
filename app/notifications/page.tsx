"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DashboardNav } from "@/components/dashboard-nav"
import { Bell, Check, CheckCheck, Filter, Trash2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Notification, NotificationType } from "@/lib/types/notifications"
import { formatDistanceToNow, format } from "date-fns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { db } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore"

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "unread" | NotificationType>("all")

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      loadNotifications()
    }
  }, [user, filter])

  const loadNotifications = async () => {
    if (!user) return

    setLoading(true)
    try {
      // Query directly from Firestore (client-side has auth context)
      const unreadOnly = filter === "unread"
      
      let notificationsQuery
      if (unreadOnly) {
        notificationsQuery = query(
          collection(db, "notifications"),
          where("userId", "==", user.uid),
          where("read", "==", false),
          orderBy("createdAt", "desc"),
          limit(100)
        )
      } else {
        notificationsQuery = query(
          collection(db, "notifications"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(100)
        )
      }

      const snapshot = await getDocs(notificationsQuery)
      let loadedNotifications: Notification[] = []

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data()
        loadedNotifications.push({
          id: docSnapshot.id,
          ...data,
        } as Notification)
      })

      // Filter by type if not "all" or "unread"
      if (filter !== "all" && filter !== "unread") {
        loadedNotifications = loadedNotifications.filter((n) => n.type === filter)
      }

      setNotifications(loadedNotifications)
    } catch (error) {
      console.error("Error loading notifications:", error)
      toast.error("Failed to load notifications")
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    if (!user) return

    try {
      // Update directly in Firestore (client-side has auth context)
      const notificationRef = doc(db, "notifications", notificationId)
      await updateDoc(notificationRef, { 
        read: true,
        updatedAt: serverTimestamp(),
      })

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      )
      toast.success("Marked as read")
    } catch (error) {
      console.error("Error marking notification as read:", error)
      toast.error("Failed to mark as read")
    }
  }

  const markAllAsRead = async () => {
    if (!user) return

    try {
      const unreadNotifications = notifications.filter((n) => !n.read)
      await Promise.all(
        unreadNotifications.map((n) => {
          const notificationRef = doc(db, "notifications", n.id)
          return updateDoc(notificationRef, { 
            read: true,
            updatedAt: serverTimestamp(),
          })
        })
      )

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      toast.success("All notifications marked as read")
    } catch (error) {
      console.error("Error marking all as read:", error)
      toast.error("Failed to mark all as read")
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl)
    }
  }

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "streak_achievement":
      case "milestone":
        return "🎉"
      case "streak_warning":
        return "🔥"
      case "mood_alert":
        return "💙"
      case "mood_improvement":
        return "🌟"
      case "daily_reminder":
        return "📝"
      case "weekly_insights":
        return "📊"
      default:
        return "🔔"
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen gradient-bg">
        <DashboardNav />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading notifications...</p>
          </Card>
        </main>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="min-h-screen gradient-bg">
      <DashboardNav />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
              <Bell className="w-8 h-8" />
              Notifications
            </h1>
            {unreadCount > 0 && (
              <p className="text-muted-foreground">
                {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} variant="outline" size="sm" className="gap-2">
              <CheckCheck className="w-4 h-4" />
              Mark All Read
            </Button>
          )}
        </div>

        <Card className="p-6">
          <Tabs defaultValue="all" onValueChange={(value) => setFilter(value as any)}>
            <TabsList className="mb-6">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
              <TabsTrigger value="streak_achievement">Streaks</TabsTrigger>
              <TabsTrigger value="milestone">Milestones</TabsTrigger>
              <TabsTrigger value="mood_alert">Mood</TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="mt-0">
              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg mb-2">No notifications</p>
                  <p className="text-sm text-muted-foreground">
                    {filter === "unread"
                      ? "You're all caught up!"
                      : "You'll see notifications here when they arrive."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer ${
                        !notification.read ? "bg-accent/30 border-primary/20" : ""
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-2xl flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground mb-1">
                                {notification.title}
                              </h3>
                              <p className="text-sm text-muted-foreground mb-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>
                                  {notification.createdAt?.toDate
                                    ? formatDistanceToNow(notification.createdAt.toDate(), {
                                        addSuffix: true,
                                      })
                                    : "Just now"}
                                </span>
                                {notification.createdAt?.toDate && (
                                  <span>•</span>
                                )}
                                {notification.createdAt?.toDate && (
                                  <span>
                                    {format(notification.createdAt.toDate(), "MMM d, yyyy 'at' h:mm a")}
                                  </span>
                                )}
                                {notification.actionLabel && (
                                  <>
                                    <span>•</span>
                                    <span className="text-primary font-medium">
                                      {notification.actionLabel} →
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!notification.read && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    markAsRead(notification.id)
                                  }}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </main>
    </div>
  )
}

