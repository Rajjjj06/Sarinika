"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Brain, LayoutDashboard, BookOpen, TrendingUp, User, LogOut, MessageCircle, Menu, X } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

export function DashboardNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { logout } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
      router.push("/login")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const isActive = (path: string) => pathname.startsWith(path)

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/journal/new", icon: BookOpen, label: "Journal" },
    { href: "/chat", icon: MessageCircle, label: "Chat" },
    { href: "/insights", icon: TrendingUp, label: "Insights" },
    { href: "/profile", icon: User, label: "Profile" },
  ]

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <span className="text-foreground">Serenica</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button variant={isActive(item.href) ? "default" : "ghost"} size="sm" className="gap-2">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2 hidden sm:flex"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card">
          <div className="px-4 py-2 space-y-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive(item.href)
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
              </Link>
            ))}
            <div 
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted text-foreground mt-2 cursor-pointer"
              onClick={async () => {
                setMobileMenuOpen(false)
                await handleLogout()
              }}
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
