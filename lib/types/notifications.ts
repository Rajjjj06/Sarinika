export type NotificationType =
  | "daily_reminder"
  | "milestone"
  | "streak_warning"
  | "streak_achievement"
  | "streak_recovery"
  | "weekly_insights"
  | "mood_alert"
  | "mood_improvement"
  | "encouragement"

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  actionUrl?: string
  actionLabel?: string
  createdAt: any
  updatedAt: any
  expiresAt?: any
  metadata?: {
    streak?: number
    milestone?: string
    moodScore?: number
    [key: string]: any
  }
}

export interface NotificationPreferences {
  dailyReminder: {
    enabled: boolean
    time: string // "09:00"
    channel: "in_app" | "push" | "both"
  }
  weeklyInsights: {
    enabled: boolean
    day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"
    time: string
    channel: "in_app" | "push" | "both"
  }
  milestones: {
    enabled: boolean
    channel: "in_app" | "push" | "both"
  }
  streakWarnings: {
    enabled: boolean
    time: string // When to send warning if no activity
    channel: "in_app" | "push" | "both"
  }
  moodAlerts: {
    enabled: boolean
    threshold: number // Mood score threshold (1-10)
    channel: "in_app" | "push" | "both"
  }
  quietHours: {
    enabled: boolean
    start: string // "22:00"
    end: string // "08:00"
  }
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  dailyReminder: {
    enabled: true,
    time: "09:00",
    channel: "both",
  },
  weeklyInsights: {
    enabled: true,
    day: "monday",
    time: "10:00",
    channel: "in_app",
  },
  milestones: {
    enabled: true,
    channel: "both",
  },
  streakWarnings: {
    enabled: true,
    time: "20:00",
    channel: "both",
  },
  moodAlerts: {
    enabled: true,
    threshold: 4,
    channel: "both",
  },
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "08:00",
  },
}

