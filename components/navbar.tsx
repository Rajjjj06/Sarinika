"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Brain } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

export function Navbar() {
  const { user, loading } = useAuth()

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <span className="text-foreground">Serenica</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {!loading && (
              <>
                {user ? (
                  <Link href="/dashboard">
                    <Button size="sm">Get Started</Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/login">
                      <Button variant="outline" size="sm">
                        Sign In
                      </Button>
                    </Link>
                    <Link href="/login">
                      <Button size="sm">Get Started</Button>
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
