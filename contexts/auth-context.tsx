"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, googleProvider, db } from "@/lib/firebase"
import { useRouter } from "next/navigation"

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Clear localStorage if user changed (logout or different user login)
      const previousUserId = localStorage.getItem("serenica_user_id")
      if (previousUserId && previousUserId !== user?.uid) {
        // Different user logged in, clear their chat data
        localStorage.removeItem("serenica_chat_history")
        localStorage.removeItem("serenica_current_chat_id")
        localStorage.removeItem("serenica_chat_id")
      }
      
      if (user) {
        // Store current user ID
        localStorage.setItem("serenica_user_id", user.uid)
      } else {
        // User logged out, clear all chat data
        localStorage.removeItem("serenica_chat_history")
        localStorage.removeItem("serenica_current_chat_id")
        localStorage.removeItem("serenica_chat_id")
        localStorage.removeItem("serenica_user_id")
      }
      
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user

      // Check if user exists in Firestore
      const userDocRef = doc(db, "users", user.uid)
      const userDoc = await getDoc(userDocRef)

      // If user doesn't exist, create a new user document
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } else {
        // Update last login time
        await setDoc(userDocRef, {
          updatedAt: serverTimestamp(),
        }, { merge: true })
      }
    } catch (error) {
      console.error("Error signing in with Google:", error)
      throw error
    }
  }

  const logout = async () => {
    try {
      // Clear localStorage on logout
      localStorage.removeItem("serenica_chat_history")
      localStorage.removeItem("serenica_current_chat_id")
      localStorage.removeItem("serenica_chat_id")
      localStorage.removeItem("serenica_user_id")
      
      await signOut(auth)
    } catch (error) {
      console.error("Error signing out:", error)
      throw error
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

