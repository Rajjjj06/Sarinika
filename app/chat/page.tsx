"use client"

import type React from "react"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DashboardNav } from "@/components/dashboard-nav"
import { Send, Loader2 } from "lucide-react"
import { useRef, useEffect } from "react"
import { motion } from "framer-motion"

export default function ChatPage() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const input = inputRef.current?.value
    if (input?.trim()) {
      sendMessage({ text: input })
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  return (
    <div className="min-h-screen gradient-bg-alt">
      <DashboardNav />

      <div className="max-w-2xl mx-auto px-4 pt-20 pb-32">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Mindful Conversations</h1>
          <p className="text-muted-foreground">
            Chat with Sarinika, your empathetic AI companion. Together, we'll explore your thoughts and feelings using
            evidence-based CBT techniques.
          </p>
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
                    <p className="text-sm leading-relaxed">
                      {message.parts[0]?.type === "text" ? message.parts[0].text : "Message"}
                    </p>
                  </div>
                </motion.div>
              ))
            )}

            {status === "in_progress" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                <div className="bg-secondary text-secondary-foreground px-4 py-3 rounded-lg rounded-bl-none">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Sarinika is thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border/50 p-4 bg-card/30">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Share your thoughts..."
                disabled={status === "in_progress"}
                className="flex-1 px-4 py-2 rounded-lg bg-background border border-border/50 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              />
              <Button type="submit" disabled={status === "in_progress"} size="icon" className="rounded-lg">
                {status === "in_progress" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
            <strong>Important:</strong> Sarinika is an AI companion designed to support your mental wellness journey.
            This is not a substitute for professional medical advice, diagnosis, or treatment. If you're experiencing a
            mental health crisis, please reach out to a mental health professional or crisis helpline immediately.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
