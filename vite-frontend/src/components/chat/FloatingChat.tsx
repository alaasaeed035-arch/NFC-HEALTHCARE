import React, { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Minus, Send, Bot, User } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { MarkdownText } from '@/components/ui/MarkdownText'
import type { ChatMessage } from '@/types'
import client from '@/api/client'

export function FloatingChat() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your NFC Healthcare assistant. How can I help you today?',
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Un-minimize and clear badge only when chat transitions to open
  useEffect(() => {
    if (open) {
      setUnread(0)
      setMinimized(false)
    }
  }, [open])

  // Auto-scroll when new messages arrive (only when visible)
  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [messages, open, minimized])

  const sendMessage = async () => {
    if (!input.trim() || typing) return
    const userMsg: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }
    // Snapshot history before adding the new message to state
    const historyForAPI = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setTyping(true)
    try {
      const res = await client.post('/chatbot/message', {
        message: userMsg.content,
        conversation_history: historyForAPI,
      })
      const data = res.data
      const reply: string = data.data?.reply ?? data.reply ?? data.message ?? 'Sorry, I could not understand that.'
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
      if (!open || minimized) setUnread(n => n + 1)
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I am having trouble connecting right now. Please try again later.',
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setTyping(false)
    }
  }

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#0055BB] text-white shadow-xl hover:bg-[#0044a0] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0055BB] focus:ring-offset-2"
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden transition-all duration-200 ${
            minimized ? 'h-14 w-80' : 'w-[380px] h-[480px]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-3 bg-[#0055BB] px-4 py-3 flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Healthcare Assistant</p>
              <p className="text-xs text-blue-200">Always here to help</p>
            </div>
            <button
              onClick={() => setMinimized(m => !m)}
              className="p-1 rounded hover:bg-white/10 text-white"
              aria-label="Minimize"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-white/10 text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                        msg.role === 'assistant' ? 'bg-[#0055BB]' : 'bg-gray-300'
                      }`}
                    >
                      {msg.role === 'assistant'
                        ? <Bot className="h-4 w-4 text-white" />
                        : <User className="h-4 w-4 text-gray-600" />}
                    </div>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                        msg.role === 'user'
                          ? 'bg-[#0055BB] text-white rounded-tr-sm text-sm'
                          : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm shadow-sm'
                      }`}
                    >
                      {msg.role === 'user'
                        ? msg.content
                        : <MarkdownText content={msg.content} />}
                    </div>
                  </div>
                ))}
                {typing && (
                  <div className="flex gap-2">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#0055BB]">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                      <div className="flex gap-1 items-center">
                        <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                        <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                        <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="flex items-center gap-2 p-3 border-t border-gray-100 bg-white flex-shrink-0">
                <input
                  type="text"
                  className="flex-1 rounded-full border border-gray-300 bg-gray-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0055BB] focus:border-[#0055BB]"
                  placeholder="Type your message..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  disabled={typing}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || typing}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#0055BB] text-white disabled:opacity-50 hover:bg-[#0044a0] transition-colors"
                  aria-label="Send"
                >
                  {typing ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
