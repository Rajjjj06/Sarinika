import { NotificationPreferences } from "@/lib/types/notifications"

/**
 * Get user's optimal notification time based on their activity patterns
 * This analyzes when they typically journal or chat
 */
export async function getOptimalNotificationTime(
  userId: string,
  preferences: NotificationPreferences
): Promise<string> {
  // For now, use the user's preference time
  // In the future, this could analyze activity patterns and suggest optimal times
  return preferences.dailyReminder.time || "09:00"
}

/**
 * Check if current time is within quiet hours
 */
export function isQuietHours(preferences: NotificationPreferences): boolean {
  if (!preferences.quietHours.enabled) {
    return false
  }

  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentTime = currentHour * 60 + currentMinute

  const [startHour, startMinute] = preferences.quietHours.start.split(":").map(Number)
  const [endHour, endMinute] = preferences.quietHours.end.split(":").map(Number)

  const startTime = startHour * 60 + startMinute
  const endTime = endHour * 60 + endMinute

  // Handle quiet hours that span midnight (e.g., 22:00 to 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime
  }

  return currentTime >= startTime && currentTime <= endTime
}

/**
 * Check if it's time to send a daily reminder based on user preferences
 */
export function shouldSendDailyReminder(preferences: NotificationPreferences): boolean {
  if (!preferences.dailyReminder.enabled) {
    return false
  }

  if (isQuietHours(preferences)) {
    return false
  }

  const now = new Date()
  const [prefHour, prefMinute] = preferences.dailyReminder.time.split(":").map(Number)
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  // Check if current time matches preference time (within 1 hour window)
  const prefTime = prefHour * 60 + prefMinute
  const currentTime = currentHour * 60 + currentMinute

  // Allow 1 hour window for sending reminders
  return Math.abs(currentTime - prefTime) <= 60
}

/**
 * Check if it's time to send weekly insights
 */
export function shouldSendWeeklyInsights(preferences: NotificationPreferences): boolean {
  if (!preferences.weeklyInsights.enabled) {
    return false
  }

  if (isQuietHours(preferences)) {
    return false
  }

  const now = new Date()
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  const currentDay = dayNames[now.getDay()]
  const prefDay = preferences.weeklyInsights.day.toLowerCase()

  if (currentDay !== prefDay) {
    return false
  }

  const [prefHour, prefMinute] = preferences.weeklyInsights.time.split(":").map(Number)
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  const prefTime = prefHour * 60 + prefMinute
  const currentTime = currentHour * 60 + currentMinute

  // Allow 1 hour window
  return Math.abs(currentTime - prefTime) <= 60
}

/**
 * Check if it's time to send streak warning
 */
export function shouldSendStreakWarning(preferences: NotificationPreferences): boolean {
  if (!preferences.streakWarnings.enabled) {
    return false
  }

  if (isQuietHours(preferences)) {
    return false
  }

  const now = new Date()
  const [prefHour, prefMinute] = preferences.streakWarnings.time.split(":").map(Number)
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  const prefTime = prefHour * 60 + prefMinute
  const currentTime = currentHour * 60 + currentMinute

  // Allow 1 hour window
  return Math.abs(currentTime - prefTime) <= 60
}

