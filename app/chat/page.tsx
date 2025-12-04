"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DashboardNav } from "@/components/dashboard-nav"
import { Send, Loader2, MessageSquarePlus } from "lucide-react"
import { useRef, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useAuth } from "@/contexts/auth-context"
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection } from "firebase/firestore"
import { encryptMessages, decryptMessages, isStillEncrypted } from "@/lib/crypto"
import { checkNotifications } from "@/lib/utils/check-notifications"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

const STORAGE_KEY = "serenica_chat_history"

export default function ChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  // Load messages from localStorage or Firestore on mount
  useEffect(() => {
    if (!user) return

    const loadChat = async () => {
      // Verify that localStorage data belongs to current user
      const storedUserId = localStorage.getItem("serenica_user_id")
      if (storedUserId && storedUserId !== user.uid) {
        // Different user's data in localStorage, clear it
        localStorage.removeItem("serenica_chat_history")
        localStorage.removeItem("serenica_current_chat_id")
        localStorage.removeItem("serenica_chat_id")
        return
      }

      // First check if there's a chat ID to load from Firestore
      const chatId = localStorage.getItem("serenica_chat_id")
      if (chatId) {
        try {
          const chatDoc = await getDoc(doc(db, "chats", chatId))
          if (chatDoc.exists()) {
            const data = chatDoc.data()
            // Verify chat belongs to current user
            if (data.userId !== user.uid) {
              console.warn("Chat does not belong to current user, clearing")
              localStorage.removeItem("serenica_chat_id")
              localStorage.removeItem("serenica_current_chat_id")
              localStorage.removeItem("serenica_chat_history")
              return
            }
            
            const encryptedMessages = data.messages || []
            // Decrypt messages when loading from Firestore
            const decryptedMessages = await decryptMessages(encryptedMessages, user.uid)
            setMessages(decryptedMessages as Message[])
            setCurrentChatId(chatId)
            localStorage.setItem("serenica_current_chat_id", chatId)
            localStorage.setItem("serenica_user_id", user.uid)
            localStorage.removeItem("serenica_chat_id")
          }
        } catch (error) {
          console.error("Error loading chat from Firestore:", error)
        }
      } else {
        // Check if we have a current chat ID stored
        const savedChatId = localStorage.getItem("serenica_current_chat_id")
        const savedMessages = localStorage.getItem(STORAGE_KEY)
        
        if (savedChatId && savedMessages) {
          try {
            // Verify the chat belongs to current user by checking Firestore
            const chatDoc = await getDoc(doc(db, "chats", savedChatId))
            if (chatDoc.exists()) {
              const data = chatDoc.data()
              if (data.userId !== user.uid) {
                // Chat belongs to different user, clear localStorage
                localStorage.removeItem("serenica_chat_history")
                localStorage.removeItem("serenica_current_chat_id")
                return
              }
            }
            
            const parsed = JSON.parse(savedMessages)
            // Messages in localStorage are unencrypted (for quick access)
            // But if they came from Firestore, they might be encrypted
            // Try to decrypt them (will return original if not encrypted)
            const decryptedMessages = await decryptMessages(parsed, user.uid)
            setMessages(decryptedMessages as Message[])
            setCurrentChatId(savedChatId)
            localStorage.setItem("serenica_user_id", user.uid)
          } catch (error) {
            console.error("Error loading chat history:", error)
            // Clear potentially corrupted data
            localStorage.removeItem("serenica_chat_history")
            localStorage.removeItem("serenica_current_chat_id")
          }
        }
      }
    }

    loadChat()
  }, [user])

  // Save messages to Firestore whenever they change (debounced)
  useEffect(() => {
    if (!user || messages.length === 0) return

    const saveToFirestore = async () => {
      try {
        // Generate a smart name from the first user message
        const firstUserMessage = messages.find((msg) => msg.role === "user")
        let chatName = "New Conversation"
        
        if (firstUserMessage && firstUserMessage.content) {
          const content = firstUserMessage.content
          // Take first 50 characters, truncate at word boundary
          const maxLength = 50
          if (content.length > maxLength) {
            const truncated = content.substring(0, maxLength)
            const lastSpace = truncated.lastIndexOf(" ")
            chatName = lastSpace > 0 ? truncated.substring(0, lastSpace) + "..." : truncated + "..."
          } else {
            chatName = content
          }
        }

        // Encrypt messages before saving to Firestore
        console.log("Encrypting messages for Firestore...", { messageCount: messages.length })
        const encryptedMessages = await encryptMessages(messages, user.uid)
        console.log("Messages encrypted successfully")

        if (currentChatId) {
          // Update existing chat - don't change the name
          console.log("Updating existing chat in Firestore:", currentChatId)
          await updateDoc(doc(db, "chats", currentChatId), {
            messages: encryptedMessages,
            updatedAt: serverTimestamp(),
          })
          console.log("Chat updated successfully in Firestore")
        } else {
          // Create new chat with auto-generated ID and smart name
          console.log("Creating new chat in Firestore...")
          const newChatRef = doc(collection(db, "chats"))
          await setDoc(newChatRef, {
            userId: user.uid,
            name: chatName,
            messages: encryptedMessages,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
          console.log("New chat created in Firestore:", newChatRef.id, {
            userId: user.uid,
            name: chatName,
            messageCount: encryptedMessages.length
          })
          setCurrentChatId(newChatRef.id)
          localStorage.setItem("serenica_current_chat_id", newChatRef.id)
          localStorage.setItem("serenica_user_id", user.uid)
          
          // Check and create notifications for new chats (streaks, milestones, mood)
          // Stores notifications in Firestore for notification center
          try {
            await checkNotifications(user.uid)
          } catch (error) {
            console.error("Error checking notifications:", error)
            // Don't block if notification check fails
          }
        }

        // Also save to localStorage for quick access (unencrypted for performance)
        // Note: localStorage is less secure but faster for quick access
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
        localStorage.setItem("serenica_user_id", user.uid)
      } catch (error) {
        console.error("Error saving to Firestore:", error)
        console.error("Error details:", {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          userId: user.uid,
          messageCount: messages.length,
          currentChatId: currentChatId
        })
        // Fallback to localStorage if Firestore fails
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
        alert("Failed to save chat to database. Check browser console for details.")
      }
    }

    // Debounce to avoid too many saves during streaming
    const timeoutId = setTimeout(() => {
      saveToFirestore()
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [messages, user, currentChatId])


  const handleNewChat = async () => {
    // Clear current chat
    setMessages([])
    setCurrentChatId(null)
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem("serenica_current_chat_id")
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const input = inputRef.current?.value
    if (input?.trim() && !isLoading) {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: input,
      }

      setMessages((prev) => [...prev, userMessage])
      if (inputRef.current) {
        inputRef.current.value = ""
      }

      setIsLoading(true)

      try {
        // Send messages to API
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to get response")
        }

        // Read streaming response
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error("No response body reader available")
        }
        
        const decoder = new TextDecoder("utf-8")
        const assistantMessageId = (Date.now() + 1).toString()
        let accumulatedContent = ""

        // Create assistant message
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: "assistant",
          content: "",
        }

        setMessages((prev) => [...prev, assistantMessage])

        // Read stream chunks
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            if (value) {
              // Decode chunk (handle partial UTF-8 characters properly)
              const chunk = decoder.decode(value, { stream: true })
              
              if (chunk) {
                accumulatedContent += chunk

                // Update only the assistant message with accumulated content
                // Use functional update to ensure we're working with latest state
                setMessages((prev) => {
                  // Find the assistant message by ID
                  const messageIndex = prev.findIndex(
                    (msg) => msg.id === assistantMessageId && msg.role === "assistant"
                  )
                  
                  if (messageIndex !== -1) {
                    // Create new array with updated message
                    const updated = [...prev]
                    updated[messageIndex] = {
                      ...updated[messageIndex],
                      content: accumulatedContent,
                    }
                    return updated
                  }
                  
                  return prev
                })
              }
            }
          }
          
          // Final decode for any remaining buffer
          const finalChunk = decoder.decode()
          if (finalChunk) {
            accumulatedContent += finalChunk
            setMessages((prev) => {
              const messageIndex = prev.findIndex(
                (msg) => msg.id === assistantMessageId && msg.role === "assistant"
              )
              
              if (messageIndex !== -1) {
                const updated = [...prev]
                updated[messageIndex] = {
                  ...updated[messageIndex],
                  content: accumulatedContent,
                }
                return updated
              }
              
              return prev
            })
          }
        } finally {
          reader.releaseLock()
        }
      } catch (error) {
        console.error("Error:", error)
        alert("Failed to send message. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen gradient-bg-alt">
      <DashboardNav />

      <div className="max-w-2xl mx-auto px-4 pt-20 pb-32">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground mb-2">Mindful Conversations</h1>
              <p className="text-muted-foreground">
                Chat with Serenica, your empathetic AI companion. Together, we'll explore your thoughts and feelings
                using evidence-based CBT techniques.
              </p>
            </div>
            {messages.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleNewChat} className="ml-4 flex items-center gap-2">
                <MessageSquarePlus className="w-4 h-4" />
                New Chat
              </Button>
            )}
          </div>
        </motion.div>

        {/* Chat Container */}
        <Card className="bg-card/40 backdrop-blur-xl border-border/30 shadow-xl h-[600px] flex flex-col">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center"
              >
                <div className="p-4 bg-primary/10 rounded-full mb-4">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 10h-2m0 0H10m2 0h2m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Start Your Journey</h3>
                <p className="text-muted-foreground max-w-xs">
                  Share what's on your mind. I'm here to listen and help you explore your thoughts with compassion.
                </p>
              </motion.div>
            ) : (
              messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-secondary text-secondary-foreground rounded-bl-none"
                    }`}
                  >
                    {isStillEncrypted(message.content) ? (
                      <div className="text-sm">
                        <p className="text-muted-foreground/70 italic mb-1">
                          ⚠️ This message was encrypted with an old system and cannot be decrypted.
                        </p>
                        <p className="text-xs text-muted-foreground/50 font-mono break-all">
                          {message.content.substring(0, 100)}...
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                </motion.div>
              ))
            )}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                <div className="bg-secondary text-secondary-foreground px-4 py-3 rounded-lg rounded-bl-none">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Serenica is thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-border/50 p-4 bg-card/30">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Share your thoughts..."
                disabled={isLoading}
                className="flex-1 px-4 py-2 rounded-lg bg-background border border-border/50 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              />
              <Button type="submit" disabled={isLoading} size="icon" className="rounded-lg">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              💡 Tip: Be specific about what's troubling you for more personalized support.
            </p>
          </div>
        </Card>

        {/* Disclaimer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 p-4 bg-accent/10 border border-accent/20 rounded-lg"
        >
          <p className="text-xs text-muted-foreground">
            <strong>Important:</strong> Serenica is an AI companion designed to support your mental wellness journey.
            This is not a substitute for professional medical advice, diagnosis, or treatment. If you're experiencing a
            mental health crisis, please reach out to a mental health professional or crisis helpline immediately.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
