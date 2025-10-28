"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DashboardNav } from "@/components/dashboard-nav"
import { User, Mail, Lock, Bell } from "lucide-react"

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    name: "Sarah Johnson",
    email: "sarah@example.com",
    bio: "Mental health advocate and wellness enthusiast",
  })

  const [notifications, setNotifications] = useState({
    dailyReminder: true,
    weeklyInsights: true,
    milestones: true,
  })

  return (
    <div className="min-h-screen gradient-bg">
      <DashboardNav />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Profile Settings</h1>

        {/* Profile Info */}
        <Card className="p-8 mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
              <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Bio</label>
              <Input
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                placeholder="Tell us about yourself"
              />
            </div>

            <Button className="w-full sm:w-auto">Save Changes</Button>
          </div>
        </Card>

        {/* Email & Password */}
        <Card className="p-8 mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email & Security
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Password</label>
              <Button variant="outline" className="w-full sm:w-auto flex items-center gap-2 bg-transparent">
                <Lock className="w-4 h-4" />
                Change Password
              </Button>
            </div>
          </div>
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
