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

