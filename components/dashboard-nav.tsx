"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Brain, LayoutDashboard, BookOpen, TrendingUp, User, LogOut, MessageCircle } from "lucide-react"

export function DashboardNav() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname.startsWith(path)

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <span className="text-foreground">Sarinika</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {[
              { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
              { href: "/journal/new", icon: BookOpen, label: "Journal" },
              { href: "/chat", icon: MessageCircle, label: "Chat" },
              { href: "/insights", icon: TrendingUp, label: "Insights" },
              { href: "/profile", icon: User, label: "Profile" },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <Button variant={isActive(item.href) ? "default" : "ghost"} size="sm" className="gap-2">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>

          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}
