import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Minus, Send, Bot, User, Mic, MicOff, Maximize2, Minimize2 } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { MarkdownText } from '@/components/ui/MarkdownText'
import type { ChatMessage } from '@/types'
import client from '@/api/client'

const containsArabic = (text: string) => /[؀-ۿ]/.test(text)

// ── Level meter bar colours (green → yellow → red) ──────────────────────────
const BAR_COUNT = 20
const barColour = (i: number) =>
  i < 13 ? 'bg-green-500' : i < 17 ? 'bg-yellow-400' : 'bg-red-500'

export function FloatingChat() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [maximized, setMaximized] = useState(false)
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

  // ── Voice state ─────────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordingSecs, setRecordingSecs] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0) // 0-100, drives the VU meter

  // ── Voice refs ───────────────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  // Refs that mirror state — safe to read inside RAF / setTimeout closures
  const isRecordingRef = useRef(false)
  const recordingSecsRef = useRef(0)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  // Keep refs in sync with state
  useEffect(() => { isRecordingRef.current = isRecording }, [isRecording])
  useEffect(() => { recordingSecsRef.current = recordingSecs }, [recordingSecs])

  // Auto-grow textarea — resets to auto first so shrinking also works
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  useEffect(() => {
    if (open) { setUnread(0); setMinimized(false) }
  }, [open])

  useEffect(() => {
    if (open && !minimized)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [messages, open, minimized])

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      audioCtxRef.current?.close().catch(() => {})
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // ── Chat ────────────────────────────────────────────────────────────────────

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim()
    if (!text || typing) return
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() }
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
      const reply: string =
        data.data?.reply ?? data.reply ?? data.message ?? 'Sorry, I could not understand that.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date().toISOString() }])
      if (!open || minimized) setUnread(n => n + 1)
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I am having trouble connecting. Please try again.', timestamp: new Date().toISOString() },
      ])
    } finally {
      setTyping(false)
    }
  }

  // ── Voice recording helpers ─────────────────────────────────────────────────

  const stopTimer = () => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
    setRecordingSecs(0)
  }

  const stopLevelMonitoring = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setAudioLevel(0)
  }

  // Shared stop logic — called by both the mic button and the silence detector.
  // Uses isRecordingRef so it's safe to call from inside a RAF/setTimeout closure.
  const stopRecording = () => {
    if (!isRecordingRef.current) return  // prevent double-stop
    isRecordingRef.current = false
    setIsRecording(false)
    setIsTranscribing(true)
    stopTimer()
    stopLevelMonitoring()
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop())
    }
  }

  /**
   * Attach an AudioContext to the microphone stream.
   * - Drives the live VU meter (BAR_COUNT bars in the UI).
   * - Auto-stops recording after SILENCE_MS ms of silence once the user
   *   has spoken for at least MIN_SPEECH_S seconds — so they don't have
   *   to press the button a second time.
   */
  const startLevelMonitoring = (stream: MediaStream, onSilence: () => void) => {
    const SILENCE_THRESHOLD = 6   // level 0-100; below this = silence
    const SILENCE_MS = 2500        // auto-stop after 2.5 s of continuous silence
    const MIN_SPEECH_S = 1.5       // don't auto-stop until at least 1.5 s recorded

    try {
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.75  // smooth rapid fluctuations
      ctx.createMediaStreamSource(stream).connect(analyser)
      audioCtxRef.current = ctx

      const buf = new Uint8Array(analyser.frequencyBinCount)
      let silenceMs = 0
      let prevTime = performance.now()
      let frame = 0

      const tick = (now: number) => {
        if (!isRecordingRef.current) return

        const dt = now - prevTime
        prevTime = now

        analyser.getByteFrequencyData(buf)
        // Scale to 0-100; multiply by 2.2 so normal speech sits mid-range
        const avg = buf.reduce((s, v) => s + v, 0) / buf.length
        const level = Math.min(100, Math.round((avg / 255) * 220))

        // Update UI at ~20 fps (every 3rd frame) to avoid excessive re-renders
        if (++frame % 3 === 0) setAudioLevel(level)

        // Silence detection
        if (level < SILENCE_THRESHOLD) {
          silenceMs += dt
          if (silenceMs >= SILENCE_MS && recordingSecsRef.current >= MIN_SPEECH_S) {
            onSilence()   // triggers stopRecording
            return        // exit RAF loop
          }
        } else {
          silenceMs = 0   // reset on any speech
        }

        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    } catch {
      // AudioContext may be unavailable (some mobile browsers, HTTPS only etc.)
    }
  }

  /**
   * Called by MediaRecorder's onstop event.
   * Assembles audio chunks → sends to /chatbot/voice → fills input with transcript.
   */
  const handleRecordingStop = useCallback(async () => {
    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
    const blob = new Blob(audioChunksRef.current, { type: mimeType })

    // Blob under ~4 kB ≈ less than 0.5 s of audio — Whisper would hallucinate
    if (blob.size < 4000) {
      setIsTranscribing(false)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Recording was too short. Please hold 🎤 and speak for at least one second.', timestamp: new Date().toISOString() },
      ])
      return
    }

    const filename = mimeType.includes('ogg') ? 'recording.ogg' : 'recording.webm'
    const formData = new FormData()
    formData.append('audio', blob, filename)

    try {
      const res = await client.post('/chatbot/voice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30_000,
      })
      const transcribed: string = res.data?.text || ''
      if (!transcribed) throw new Error('empty')
      setInput(transcribed)
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Could not transcribe audio. Please check your connection or type your message.', timestamp: new Date().toISOString() },
      ])
    } finally {
      setIsTranscribing(false)
    }
  }, [])

  /**
   * Mic button handler.
   * First press  → request mic, start recording + level monitoring.
   * Second press → stop (same as silence detector calling stopRecording).
   */
  const toggleRecording = async () => {
    if (isRecording) { stopRecording(); return }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      })

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg;codecs=opus'

      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = handleRecordingStop
      mediaRecorderRef.current = recorder
      recorder.start(100)

      setRecordingSecs(0)
      isRecordingRef.current = true
      setIsRecording(true)

      recordingTimerRef.current = setInterval(() => setRecordingSecs(s => s + 1), 1000)
      startLevelMonitoring(stream, stopRecording)
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Microphone access denied. Please allow microphone access in your browser settings.', timestamp: new Date().toISOString() },
      ])
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const inputIsArabic = containsArabic(input)
  const busy = typing || isRecording || isTranscribing
  const bubbleMaxW = maximized ? 'max-w-[60%]' : 'max-w-[75%]'

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
          className={`fixed z-50 flex flex-col rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden transition-all duration-300 ${
            minimized
              ? 'bottom-6 right-6 h-14 w-80'
              : maximized
              ? 'inset-4'
              : 'bottom-6 right-6 w-[380px] h-[480px]'
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
              onClick={() => { setMinimized(m => !m); setMaximized(false) }}
              className="p-1 rounded hover:bg-white/10 text-white"
              aria-label="Minimize"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setMaximized(m => !m); setMinimized(false) }}
              className="p-1 rounded hover:bg-white/10 text-white"
              aria-label={maximized ? 'Restore' : 'Maximize'}
            >
              {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button onClick={() => { setOpen(false); setMaximized(false) }} className="p-1 rounded hover:bg-white/10 text-white" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${msg.role === 'assistant' ? 'bg-[#0055BB]' : 'bg-gray-300'}`}>
                      {msg.role === 'assistant' ? <Bot className="h-4 w-4 text-white" /> : <User className="h-4 w-4 text-gray-600" />}
                    </div>
                    <div
                      className={`${bubbleMaxW} rounded-2xl px-3 py-2 ${msg.role === 'user' ? 'bg-[#0055BB] text-white rounded-tr-sm text-sm' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm shadow-sm'}`}
                      dir={msg.role === 'user' && containsArabic(msg.content) ? 'rtl' : 'ltr'}
                    >
                      {msg.role === 'user' ? msg.content : <MarkdownText content={msg.content} />}
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

              {/* VU meter — only visible while recording ──────────────────── */}
              {isRecording && (
                <div className="flex items-end gap-[2px] px-4 py-1 bg-white border-t border-gray-50 h-7 flex-shrink-0">
                  {Array.from({ length: BAR_COUNT }, (_, i) => {
                    const threshold = ((i + 1) / BAR_COUNT) * 100
                    const lit = audioLevel >= threshold
                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-t-sm transition-colors duration-75 ${lit ? barColour(i) : 'bg-gray-100'}`}
                        // Bars grow taller toward the right like a classic equalizer
                        style={{ height: `${3 + i * 0.9}px` }}
                      />
                    )
                  })}
                </div>
              )}

              {/* Input row */}
              <div className="flex items-end gap-2 p-3 border-t border-gray-100 bg-white flex-shrink-0">
                <textarea
                  ref={inputRef}
                  rows={1}
                  dir={inputIsArabic ? 'rtl' : 'ltr'}
                  className="flex-1 resize-none overflow-y-auto rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0055BB] focus:border-[#0055BB] disabled:opacity-60 leading-5"
                  style={{ maxHeight: '120px' }}
                  placeholder={
                    isRecording
                      ? `🔴 ${recordingSecs}s — will stop automatically on silence`
                      : isTranscribing
                      ? 'Transcribing…'
                      : 'Type or 🎤 speak in Arabic or English…'
                  }
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && !busy) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  disabled={busy}
                />

                {/* Mic / stop button */}
                <button
                  onClick={toggleRecording}
                  disabled={typing || isTranscribing}
                  title={isRecording ? 'Stop recording' : 'Speak in Arabic or English'}
                  aria-label={isRecording ? 'Stop recording' : 'Start voice recording'}
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                    isRecording ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  {isTranscribing
                    ? <Spinner size="sm" />
                    : isRecording
                    ? <MicOff className="h-4 w-4" />
                    : <Mic className="h-4 w-4" />}
                </button>

                {/* Send button */}
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || busy}
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
