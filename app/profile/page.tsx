"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DashboardNav } from "@/components/dashboard-nav"
import { User, Mail, Bell, MessageSquare, Trash2, BookOpen, Clock, Download, Upload, Key } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/types/notifications"
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
  setDoc,
  getDoc,
} from "firebase/firestore"
import { useRouter } from "next/navigation"
import { decryptMessages, decryptMessage, exportEncryptionKey, importEncryptionKey, isStillEncrypted } from "@/lib/crypto"

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
    dailyReminder: { enabled: true, time: "09:00", channel: "both" as const },
    weeklyInsights: { enabled: true, day: "monday" as const, time: "10:00", channel: "in_app" as const },
    milestones: { enabled: true, channel: "both" as const },
    streakWarnings: { enabled: true, time: "20:00", channel: "both" as const },
    moodAlerts: { enabled: true, threshold: 4, channel: "both" as const },
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
  })
  const [savedNotifications, setSavedNotifications] = useState<typeof notifications | null>(null)
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([])
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [editingName, setEditingName] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [exportedKey, setExportedKey] = useState<string>("")
  const [importKeyValue, setImportKeyValue] = useState<string>("")
  const [showImportInput, setShowImportInput] = useState(false)
  const [keyActionLoading, setKeyActionLoading] = useState(false)

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

          // Load notification preferences directly from Firestore
          try {
            const prefsRef = doc(db, "notificationPreferences", user.uid)
            const prefsSnap = await getDoc(prefsRef)
            if (prefsSnap.exists()) {
              const data = prefsSnap.data() as typeof notifications
              // Remove any extra fields like updatedAt that might be in Firestore
              const cleanData = {
                dailyReminder: data.dailyReminder || notifications.dailyReminder,
                weeklyInsights: data.weeklyInsights || notifications.weeklyInsights,
                milestones: data.milestones || notifications.milestones,
                streakWarnings: data.streakWarnings || notifications.streakWarnings,
                moodAlerts: data.moodAlerts || notifications.moodAlerts,
                quietHours: data.quietHours || notifications.quietHours,
              }
              setNotifications(cleanData)
              // Store a deep copy of the saved state
              setSavedNotifications(JSON.parse(JSON.stringify(cleanData)))
            } else {
              // If no preferences exist, use defaults and mark as saved
              setSavedNotifications(JSON.parse(JSON.stringify(notifications)))
            }
          } catch (error) {
            console.error("Error loading notification preferences:", error)
            // On error, mark current state as saved to prevent save button from being enabled
            setSavedNotifications(JSON.parse(JSON.stringify(notifications)))
          }

          // Load chat histories from Firestore
          const chatsRef = collection(db, "chats")
          const q = query(chatsRef, where("userId", "==", user.uid))
          const querySnapshot = await getDocs(q)

          const histories: ChatHistory[] = []
          // Decrypt messages for each chat
          for (const docSnapshot of querySnapshot.docs) {
            const data = docSnapshot.data()
            const encryptedMessages = data.messages || []
            // Decrypt messages when loading from Firestore
            const decryptedMessages = await decryptMessages(encryptedMessages, user.uid)
            histories.push({
              id: docSnapshot.id,
              name: data.name || "Untitled Chat",
              messages: decryptedMessages,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            })
          }

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
          for (const docSnapshot of journalsSnapshot.docs) {
            const data = docSnapshot.data()
            // Decrypt the journal content
            const decryptedContent = await decryptMessage(data.content || "", user.uid)
            entries.push({
              id: docSnapshot.id,
              content: decryptedContent,
              emotion: data.emotion || "Thoughtful",
              mentalState: data.mentalState || "Reflective",
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            })
          }

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
    if (!user) return
    
    try {
      // Save notification preferences directly to Firestore (client-side has auth context)
      const prefsRef = doc(db, "notificationPreferences", user.uid)
      await setDoc(
        prefsRef,
        {
          ...notifications,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )

      // Update saved state to match current state (deep copy)
      setSavedNotifications(JSON.parse(JSON.stringify(notifications)))
      alert("Notification preferences saved successfully!")
    } catch (error) {
      console.error("Error saving preferences:", error)
      alert("Failed to save notification preferences. Please try again.")
    }
  }

  // Check if notifications have changed (memoized to react to changes)
  const hasNotificationChanges = useMemo(() => {
    if (savedNotifications === null) return false
    return JSON.stringify(notifications) !== JSON.stringify(savedNotifications)
  }, [notifications, savedNotifications])

  const updateNotificationPreference = (key: string, value: any) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: { ...prev[key as keyof typeof prev], ...value },
    }))
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
    if (!user) return
    // Store chat ID in localStorage for the chat page to load
    localStorage.setItem("serenica_chat_id", history.id)
    localStorage.setItem("serenica_chat_history", JSON.stringify(history.messages))
    localStorage.setItem("serenica_user_id", user.uid)
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

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
              <Input type="email" value={profile.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">Email is managed by Google authentication</p>
            </div>

            {/* Encryption Key Backup & Restore */}
            <div className="pt-6 border-t border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Key className="w-5 h-5" />
                Encryption Key Backup
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your data is encrypted with a key stored in your browser. If you clear your browser data,
                you'll lose access to your encrypted messages and journal entries unless you have a backup.
              </p>

              {/* Export Key Section */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!user) return
                      setKeyActionLoading(true)
                      try {
                        const key = await exportEncryptionKey(user.uid)
                        setExportedKey(key)
                        alert("Encryption key exported successfully! Please save it in a secure location.")
                      } catch (error: any) {
                        console.error("Error exporting key:", error)
                        alert(`Failed to export key: ${error.message}`)
                      } finally {
                        setKeyActionLoading(false)
                      }
                    }}
                    disabled={keyActionLoading}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Encryption Key
                  </Button>
                </div>

                {exportedKey && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Your Encryption Key (save this securely):
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={exportedKey}
                        readOnly
                        className="font-mono text-xs bg-muted"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(exportedKey)
                          alert("Key copied to clipboard!")
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ⚠️ Keep this key secure! Anyone with this key can decrypt your data.
                    </p>
                  </div>
                )}
              </div>

              {/* Import Key Section */}
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowImportInput(!showImportInput)}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Restore Encryption Key
                  </Button>
                </div>

                {showImportInput && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Paste your backup encryption key:
                      </label>
                      <Input
                        type="text"
                        value={importKeyValue}
                        onChange={(e) => setImportKeyValue(e.target.value)}
                        placeholder="Paste your encryption key here..."
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={async () => {
                          if (!user) return
                          if (!importKeyValue.trim()) {
                            alert("Please enter your encryption key")
                            return
                          }

                          if (
                            !confirm(
                              "Warning: This will overwrite your current encryption key. " +
                                "Make sure you have the correct key, or you may lose access to your data. Continue?"
                            )
                          ) {
                            return
                          }

                          setKeyActionLoading(true)
                          try {
                            await importEncryptionKey(user.uid, importKeyValue.trim())
                            alert("Encryption key restored successfully! You can now access your encrypted data.")
                            setImportKeyValue("")
                            setShowImportInput(false)
                          } catch (error: any) {
                            console.error("Error importing key:", error)
                            alert(`Failed to import key: ${error.message}`)
                          } finally {
                            setKeyActionLoading(false)
                          }
                        }}
                        disabled={keyActionLoading || !importKeyValue.trim()}
                      >
                        Restore Key
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setShowImportInput(false)
                          setImportKeyValue("")
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use this if you've cleared your browser data and need to restore access to your encrypted data.
                    </p>
                  </div>
                )}
              </div>
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

          <div className="space-y-6">
            {/* Daily Reminder */}
            <div className="p-4 border border-border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Daily Reminder</p>
                  <p className="text-sm text-muted-foreground">Get reminded to journal daily</p>
                </div>
                <Switch
                  checked={notifications.dailyReminder.enabled}
                  onCheckedChange={(checked) =>
                    updateNotificationPreference("dailyReminder", { enabled: checked })
                  }
                />
              </div>
              {notifications.dailyReminder.enabled && (
                <div className="flex items-center gap-3 pl-4">
                  <Label className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time:
                  </Label>
                  <Input
                    type="time"
                    value={notifications.dailyReminder.time}
                    onChange={(e) =>
                      updateNotificationPreference("dailyReminder", { time: e.target.value })
                    }
                    className="w-32"
                  />
                </div>
              )}
            </div>

            {/* Weekly Insights */}
            <div className="p-4 border border-border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Weekly Insights</p>
                  <p className="text-sm text-muted-foreground">Receive weekly wellness insights</p>
                </div>
                <Switch
                  checked={notifications.weeklyInsights.enabled}
                  onCheckedChange={(checked) =>
                    updateNotificationPreference("weeklyInsights", { enabled: checked })
                  }
                />
              </div>
              {notifications.weeklyInsights.enabled && (
                <div className="flex items-center gap-3 pl-4 flex-wrap">
                  <Label className="text-sm">Day:</Label>
                  <Select
                    value={notifications.weeklyInsights.day}
                    onValueChange={(value: any) =>
                      updateNotificationPreference("weeklyInsights", { day: value })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">Monday</SelectItem>
                      <SelectItem value="tuesday">Tuesday</SelectItem>
                      <SelectItem value="wednesday">Wednesday</SelectItem>
                      <SelectItem value="thursday">Thursday</SelectItem>
                      <SelectItem value="friday">Friday</SelectItem>
                      <SelectItem value="saturday">Saturday</SelectItem>
                      <SelectItem value="sunday">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time:
                  </Label>
                  <Input
                    type="time"
                    value={notifications.weeklyInsights.time}
                    onChange={(e) =>
                      updateNotificationPreference("weeklyInsights", { time: e.target.value })
                    }
                    className="w-32"
                  />
                </div>
              )}
            </div>

            {/* Milestones */}
            <div className="p-4 border border-border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Milestones</p>
                  <p className="text-sm text-muted-foreground">Celebrate your achievements</p>
                </div>
                <Switch
                  checked={notifications.milestones.enabled}
                  onCheckedChange={(checked) =>
                    updateNotificationPreference("milestones", { enabled: checked })
                  }
                />
              </div>
            </div>

            {/* Streak Warnings */}
            <div className="p-4 border border-border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Streak Warnings</p>
                  <p className="text-sm text-muted-foreground">Get warned if you're about to break your streak</p>
                </div>
                <Switch
                  checked={notifications.streakWarnings.enabled}
                  onCheckedChange={(checked) =>
                    updateNotificationPreference("streakWarnings", { enabled: checked })
                  }
                />
              </div>
              {notifications.streakWarnings.enabled && (
                <div className="flex items-center gap-3 pl-4">
                  <Label className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Warning Time:
                  </Label>
                  <Input
                    type="time"
                    value={notifications.streakWarnings.time}
                    onChange={(e) =>
                      updateNotificationPreference("streakWarnings", { time: e.target.value })
                    }
                    className="w-32"
                  />
                </div>
              )}
            </div>

            {/* Mood Alerts */}
            <div className="p-4 border border-border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Mood Alerts</p>
                  <p className="text-sm text-muted-foreground">Get notified when your mood is low</p>
                </div>
                <Switch
                  checked={notifications.moodAlerts.enabled}
                  onCheckedChange={(checked) =>
                    updateNotificationPreference("moodAlerts", { enabled: checked })
                  }
                />
              </div>
              {notifications.moodAlerts.enabled && (
                <div className="flex items-center gap-3 pl-4">
                  <Label className="text-sm">Threshold (1-10):</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={notifications.moodAlerts.threshold}
                    onChange={(e) =>
                      updateNotificationPreference("moodAlerts", {
                        threshold: parseInt(e.target.value) || 4,
                      })
                    }
                    className="w-20"
                  />
                </div>
              )}
            </div>

            {/* Quiet Hours */}
            <div className="p-4 border border-border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Quiet Hours</p>
                  <p className="text-sm text-muted-foreground">Don't send notifications during these hours</p>
                </div>
                <Switch
                  checked={notifications.quietHours.enabled}
                  onCheckedChange={(checked) =>
                    updateNotificationPreference("quietHours", { enabled: checked })
                  }
                />
              </div>
              {notifications.quietHours.enabled && (
                <div className="flex items-center gap-3 pl-4 flex-wrap">
                  <Label className="text-sm">Start:</Label>
                  <Input
                    type="time"
                    value={notifications.quietHours.start}
                    onChange={(e) =>
                      updateNotificationPreference("quietHours", { start: e.target.value })
                    }
                    className="w-32"
                  />
                  <Label className="text-sm">End:</Label>
                  <Input
                    type="time"
                    value={notifications.quietHours.end}
                    onChange={(e) =>
                      updateNotificationPreference("quietHours", { end: e.target.value })
                    }
                    className="w-32"
                  />
                </div>
              )}
            </div>
          </div>

          <Button className="mt-6" onClick={handleSave}>
            Save Notification Preferences
          </Button>
        </Card>
      </main>
    </div>
  )
}
