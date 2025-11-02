"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DashboardNav } from "@/components/dashboard-nav"
import { User, Mail, Bell, MessageSquare, Trash2, BookOpen } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { db } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { useRouter } from "next/navigation"

interface ChatHistory {
  id: string
  name: string
  messages: Array<{
    id: string
    role: "user" | "assistant"
    content: string
  }>
  createdAt: any
  updatedAt: any
}

interface JournalEntry {
  id: string
  content: string
  emotion: string
  mentalState: string
  createdAt: any
  updatedAt: any
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    bio: "",
    photoURL: "",
  })
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState({
    dailyReminder: true,
    weeklyInsights: true,
    milestones: true,
  })
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([])
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [editingName, setEditingName] = useState<string | null>(null)
  const [newName, setNewName] = useState("")

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const loadProfile = async () => {
      if (user) {
        try {
          setProfile({
            name: user.displayName || "",
            email: user.email || "",
            bio: "",
            photoURL: user.photoURL || "",
          })

          // Load chat histories from Firestore
          const chatsRef = collection(db, "chats")
          const q = query(chatsRef, where("userId", "==", user.uid))
          const querySnapshot = await getDocs(q)

          const histories: ChatHistory[] = []
          querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data()
            histories.push({
              id: docSnapshot.id,
              name: data.name || "Untitled Chat",
              messages: data.messages || [],
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            })
          })

          // Sort by updatedAt descending
          histories.sort((a, b) => {
            const aTime = a.updatedAt?.toMillis?.() || 0
            const bTime = b.updatedAt?.toMillis?.() || 0
            return bTime - aTime
          })

          setChatHistories(histories)

          // Load journal entries from Firestore
          const journalsRef = collection(db, "journalEntries")
          const journalsQuery = query(journalsRef, where("userId", "==", user.uid))
          const journalsSnapshot = await getDocs(journalsQuery)

          const entries: JournalEntry[] = []
          journalsSnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data()
            entries.push({
              id: docSnapshot.id,
              content: data.content || "",
              emotion: data.emotion || "Thoughtful",
              mentalState: data.mentalState || "Reflective",
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            })
          })

          // Sort by createdAt descending (newest first)
          entries.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0
            const bTime = b.createdAt?.toMillis?.() || 0
            return bTime - aTime
          })

          setJournalEntries(entries)
        } catch (error) {
          console.error("Error loading profile:", error)
        } finally {
          setLoading(false)
        }
      }
    }

    loadProfile()
  }, [user])

  const handleSave = async () => {
    alert("Profile updated successfully!")
  }

  const handleDeleteHistory = async (id: string) => {
    if (confirm("Are you sure you want to delete this chat history?")) {
      try {
        await deleteDoc(doc(db, "chats", id))
        setChatHistories(chatHistories.filter((history) => history.id !== id))
      } catch (error) {
        console.error("Error deleting chat:", error)
        alert("Failed to delete chat")
      }
    }
  }

  const handleStartEditing = (history: ChatHistory) => {
    setEditingName(history.id)
    setNewName(history.name)
  }

  const handleSaveName = async (id: string) => {
    try {
      await updateDoc(doc(db, "chats", id), {
        name: newName,
        updatedAt: serverTimestamp(),
      })
      setChatHistories(
        chatHistories.map((history) => (history.id === id ? { ...history, name: newName } : history))
      )
      setEditingName(null)
    } catch (error) {
      console.error("Error updating chat name:", error)
      alert("Failed to update chat name")
    }
  }

  const handleContinueChat = (history: ChatHistory) => {
    // Store chat ID in localStorage for the chat page to load
    localStorage.setItem("serenica_chat_id", history.id)
    localStorage.setItem("serenica_chat_history", JSON.stringify(history.messages))
    router.push("/chat")
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown"
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString()
    }
    return new Date(timestamp).toLocaleDateString()
  }

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return "Unknown"
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    }
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Show loading while checking auth or loading profile
  if (authLoading || loading) {
    return (
      <div className="min-h-screen gradient-bg">
        <DashboardNav />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your profile...</p>
          </Card>
        </main>
      </div>
    )
  }

  // Don't show anything if user is not logged in (will redirect)
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen gradient-bg">
      <DashboardNav />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Profile Settings</h1>

        {/* Profile Photo */}
        <Card className="p-8 mb-6">
          <div className="flex items-center gap-6">
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.name || "Profile"}
                className="w-24 h-24 rounded-full object-cover border-4 border-primary"
                onError={(e) => {
                  console.log("Image load error, photoURL:", profile.photoURL)
                  e.currentTarget.style.display = "none"
                }}
              />
            ) : null}
            {!profile.photoURL && (
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-12 h-12 text-primary" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-foreground">{profile.name || "User"}</h2>
              <p className="text-muted-foreground">{profile.email}</p>
            </div>
          </div>
        </Card>

        {/* Profile Info */}
        <Card className="p-8 mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
              <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} disabled />
              <p className="text-xs text-muted-foreground mt-1">Managed by Google authentication</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Bio</label>
              <Input
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                placeholder="Tell us about yourself"
              />
            </div>

            <Button className="w-full sm:w-auto" onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </Card>

        {/* Email & Security */}
        <Card className="p-8 mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email & Security
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
              <Input type="email" value={profile.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">Email is managed by Google authentication</p>
            </div>
          </div>
        </Card>

        {/* Journal Entries */}
        <Card className="p-8 mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Journal Entries
          </h2>

          {journalEntries.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No journal entries yet</p>
              <Button onClick={() => router.push("/journal/new")}>Create Your First Entry</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {journalEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 border border-border rounded-lg hover:bg-accent/10 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        {formatDateTime(entry.createdAt)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-medium">
                          {entry.emotion}
                        </span>
                        <span className="text-xs px-2 py-1 bg-accent/10 text-accent-foreground rounded-full">
                          {entry.mentalState}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-foreground line-clamp-2">
                    {entry.content.length > 150 ? `${entry.content.substring(0, 150)}...` : entry.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Chat History */}
        <Card className="p-8 mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Chat History
          </h2>

          {chatHistories.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No chat history yet</p>
              <Button onClick={() => router.push("/chat")}>Start Your First Conversation</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {chatHistories.map((history) => (
                <div
                  key={history.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/10 transition-colors"
                >
                  <div className="flex-1">
                    {editingName === history.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="max-w-xs"
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleSaveName(history.id)}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingName(null)
                            setNewName("")
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <h3 className="font-semibold text-foreground">{history.name}</h3>
                        <span className="text-xs text-muted-foreground">
                          {history.messages.length} messages • {formatDate(history.updatedAt)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingName !== history.id && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartEditing(history)}
                          className="text-xs"
                        >
                          Rename
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleContinueChat(history)}
                          className="text-xs"
                        >
                          Continue
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteHistory(history.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Notifications */}
        <Card className="p-8">
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </h2>

          <div className="space-y-4">
            {[
              { key: "dailyReminder", label: "Daily Reminder", desc: "Get reminded to journal daily" },
              { key: "weeklyInsights", label: "Weekly Insights", desc: "Receive weekly wellness insights" },
              { key: "milestones", label: "Milestones", desc: "Celebrate your achievements" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div>
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications[item.key as keyof typeof notifications]}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      [item.key]: e.target.checked,
                    })
                  }
                  className="w-5 h-5 rounded"
                />
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  )
}
