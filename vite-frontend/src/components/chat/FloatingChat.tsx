import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Minus, Send, Bot, User, Mic, Maximize2, Minimize2, Square } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { MarkdownText } from '@/components/ui/MarkdownText'
import type { ChatMessage } from '@/types'
import client from '@/api/client'

const containsArabic = (text: string) => /[؀-ۿ]/.test(text)

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// Animated waveform bars shown while recording (ChatGPT style)
function WaveformBars({ level }: { level: number }) {
  const BAR_COUNT = 5
  const heights = [0.4, 0.7, 1.0, 0.7, 0.4]
  return (
    <div className="flex items-center gap-[3px]">
      {heights.map((h, i) => {
        const animated = level > 10
        const barH = animated ? Math.max(4, Math.round(h * level * 0.28)) : 4
        return (
          <div
            key={i}
            className="w-[3px] rounded-full bg-white transition-all duration-75"
            style={{
              height: `${Math.min(barH, 20)}px`,
              opacity: animated ? 0.9 : 0.5,
            }}
          />
        )
      })}
    </div>
  )
}

export function FloatingChat() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your NFC Healthcare Assistant. I can help you with your health records, medications, nearby hospitals, and more. How can I help you today?',
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [unread, setUnread] = useState(0)

  // Voice state
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordingSecs, setRecordingSecs] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)

  // Voice refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const isRecordingRef = useRef(false)
  const recordingSecsRef = useRef(0)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { isRecordingRef.current = isRecording }, [isRecording])
  useEffect(() => { recordingSecsRef.current = recordingSecs }, [recordingSecs])

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

  // ── Voice recording ─────────────────────────────────────────────────────────

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

  const stopRecording = () => {
    if (!isRecordingRef.current) return
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

  const startLevelMonitoring = (stream: MediaStream, onSilence: () => void) => {
    const SILENCE_THRESHOLD = 6
    const SILENCE_MS = 2500
    const MIN_SPEECH_S = 1.5

    try {
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.75
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
        const avg = buf.reduce((s, v) => s + v, 0) / buf.length
        const level = Math.min(100, Math.round((avg / 255) * 220))
        if (++frame % 3 === 0) setAudioLevel(level)
        if (level < SILENCE_THRESHOLD) {
          silenceMs += dt
          if (silenceMs >= SILENCE_MS && recordingSecsRef.current >= MIN_SPEECH_S) {
            onSilence()
            return
          }
        } else {
          silenceMs = 0
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch { /* AudioContext unavailable */ }
  }

  const handleRecordingStop = useCallback(async () => {
    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
    const blob = new Blob(audioChunksRef.current, { type: mimeType })

    if (blob.size < 4000) {
      setIsTranscribing(false)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Recording was too short. Please hold the mic and speak for at least one second.', timestamp: new Date().toISOString() },
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

  const toggleRecording = async () => {
    if (isRecording) { stopRecording(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 16000 },
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
  const bubbleMaxW = maximized ? 'max-w-[60%]' : 'max-w-[78%]'
  const fmtSecs = `${Math.floor(recordingSecs / 60)}:${String(recordingSecs % 60).padStart(2, '0')}`

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#0055BB] text-white shadow-2xl hover:bg-[#0044a0] active:scale-95 transition-all duration-200 focus:outline-none"
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={`fixed z-50 flex flex-col bg-white shadow-2xl overflow-hidden transition-all duration-300 ${
            minimized
              ? 'bottom-6 right-6 h-[58px] w-[340px] rounded-2xl'
              : maximized
              ? 'inset-4 rounded-2xl'
              : 'bottom-6 right-6 w-[380px] h-[560px] rounded-2xl'
          }`}
          style={{ border: '1px solid rgba(0,0,0,0.08)' }}
        >
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div
            className="flex items-center gap-3 px-4 py-3 flex-shrink-0 select-none"
            style={{ background: 'linear-gradient(135deg, #0055BB 0%, #0070f3 100%)' }}
          >
            {/* Avatar */}
            <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/30">
              <Bot className="h-5 w-5 text-white" />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">Healthcare Assistant</p>
              <p className="text-[11px] text-blue-100 leading-tight">
                {isRecording ? (
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                    Listening…
                  </span>
                ) : isTranscribing ? 'Transcribing…' : typing ? 'Typing…' : 'Online'}
              </p>
            </div>

            {/* Window controls */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => { setMinimized(m => !m); setMaximized(false) }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70 hover:bg-white/15 hover:text-white transition-colors"
                aria-label="Minimize"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { setMaximized(m => !m); setMinimized(false) }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70 hover:bg-white/15 hover:text-white transition-colors"
                aria-label={maximized ? 'Restore' : 'Maximize'}
              >
                {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => { setOpen(false); setMaximized(false) }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70 hover:bg-white/15 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* ── Messages ───────────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ background: '#f7f8fc' }}>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 items-end ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${msg.role === 'assistant' ? 'bg-[#0055BB]' : 'bg-gray-200'}`}>
                      {msg.role === 'assistant'
                        ? <Bot className="h-3.5 w-3.5 text-white" />
                        : <User className="h-3.5 w-3.5 text-gray-500" />}
                    </div>

                    <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`${bubbleMaxW} px-3.5 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-[#0055BB] text-white rounded-2xl rounded-br-md'
                            : 'bg-white text-gray-800 rounded-2xl rounded-bl-md shadow-sm border border-gray-100'
                        }`}
                        dir={containsArabic(msg.content) ? 'rtl' : 'ltr'}
                      >
                        {msg.role === 'user' ? msg.content : <MarkdownText content={msg.content} />}
                      </div>
                      <span className="text-[10px] text-gray-400 px-1">{fmtTime(msg.timestamp)}</span>
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {typing && (
                  <div className="flex gap-2 items-end">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#0055BB]">
                      <Bot className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                      <div className="flex gap-1 items-center h-4">
                        <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce [animation-delay:0ms]" />
                        <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce [animation-delay:160ms]" />
                        <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce [animation-delay:320ms]" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* ── Input area ─────────────────────────────────────────────── */}
              <div className="flex-shrink-0 p-3 bg-white border-t border-gray-100">
                {/* Recording overlay — replaces the text input while mic is active */}
                {isRecording ? (
                  <div className="flex items-center gap-3 px-3 py-2 bg-red-500 rounded-2xl">
                    {/* Waveform */}
                    <WaveformBars level={audioLevel} />

                    {/* Timer */}
                    <span className="flex-1 text-sm font-medium text-white tabular-nums">{fmtSecs}</span>

                    {/* Stop button */}
                    <button
                      onClick={stopRecording}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-red-500 hover:bg-red-50 transition-colors"
                      aria-label="Stop recording"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                    </button>
                  </div>
                ) : isTranscribing ? (
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200">
                    <Spinner size="sm" />
                    <span className="text-sm text-gray-500">Transcribing your voice…</span>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      dir={inputIsArabic ? 'rtl' : 'ltr'}
                      className="flex-1 resize-none overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-[#0055BB]/30 focus:border-[#0055BB] disabled:opacity-50 transition-colors placeholder:text-gray-400"
                      style={{ maxHeight: '120px' }}
                      placeholder="Ask anything…"
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

                    {/* Mic button */}
                    <button
                      onClick={toggleRecording}
                      disabled={typing || isTranscribing}
                      title="Speak in Arabic or English"
                      aria-label="Start voice recording"
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-40 transition-colors focus:outline-none"
                    >
                      <Mic className="h-4 w-4" />
                    </button>

                    {/* Send button */}
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || busy}
                      aria-label="Send"
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#0055BB] text-white disabled:opacity-40 hover:bg-[#0044a0] active:scale-95 transition-all focus:outline-none"
                    >
                      {typing ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
