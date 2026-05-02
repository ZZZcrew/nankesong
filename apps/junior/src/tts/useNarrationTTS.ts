import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type TTSStatus =
  | 'idle'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'blocked'
  | 'unsupported'

export type UseNarrationTTS = {
  sentences: string[]
  activeIdx: number
  status: TTSStatus
  play: () => void
  pause: () => void
  resume: () => void
  stop: () => void
}

function splitSentences(text: string): string[] {
  if (!text) return []
  return text
    .split(/(?<=[。！？!?\.])\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function useNarrationTTS(text: string): UseNarrationTTS {
  const sentences = useMemo(() => splitSentences(text), [text])
  const [activeIdx, setActiveIdx] = useState(-1)
  const [status, setStatus] = useState<TTSStatus>('idle')

  const idxRef = useRef(0)
  const cancelledRef = useRef(false)
  const blockCheckRef = useRef<number | null>(null)

  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

  const speakFrom = useCallback(
    (startIdx: number) => {
      if (!supported || sentences.length === 0) return
      cancelledRef.current = false
      idxRef.current = startIdx

      const speakAt = (i: number) => {
        if (cancelledRef.current) return
        if (i >= sentences.length) {
          setStatus('ended')
          setActiveIdx(sentences.length - 1)
          return
        }
        const u = new SpeechSynthesisUtterance(sentences[i])
        u.lang = 'zh-CN'
        u.rate = 0.9
        u.onend = () => {
          if (cancelledRef.current) return
          idxRef.current = i + 1
          speakAt(i + 1)
        }
        u.onerror = () => {
          if (cancelledRef.current) return
          idxRef.current = i + 1
          speakAt(i + 1)
        }
        setActiveIdx(i)
        window.speechSynthesis.speak(u)
      }

      window.speechSynthesis.cancel()
      setStatus('playing')
      speakAt(startIdx)
    },
    [sentences, supported],
  )

  const play = useCallback(() => {
    if (!supported) {
      setStatus('unsupported')
      return
    }
    if (sentences.length === 0) return
    speakFrom(0)

    if (blockCheckRef.current) window.clearTimeout(blockCheckRef.current)
    blockCheckRef.current = window.setTimeout(() => {
      const s = window.speechSynthesis
      if (!s.speaking && !s.paused) setStatus('blocked')
    }, 1000)
  }, [sentences, speakFrom, supported])

  const pause = useCallback(() => {
    if (!supported) return
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause()
      setStatus('paused')
    }
  }, [supported])

  const resume = useCallback(() => {
    if (!supported) return
    if (window.speechSynthesis.paused) {
      try {
        window.speechSynthesis.resume()
        setStatus('playing')
      } catch {
        speakFrom(idxRef.current)
      }
    }
  }, [speakFrom, supported])

  const stop = useCallback(() => {
    if (!supported) return
    cancelledRef.current = true
    window.speechSynthesis.cancel()
    setStatus('idle')
    setActiveIdx(-1)
  }, [supported])

  useEffect(() => {
    if (!supported) {
      setStatus('unsupported')
      return
    }
    cancelledRef.current = false
    idxRef.current = 0
    setActiveIdx(-1)
    setStatus('idle')

    if (sentences.length === 0) return

    const tid = window.setTimeout(() => speakFrom(0), 0)

    if (blockCheckRef.current) window.clearTimeout(blockCheckRef.current)
    blockCheckRef.current = window.setTimeout(() => {
      const s = window.speechSynthesis
      if (!s.speaking && !s.paused && !cancelledRef.current) setStatus('blocked')
    }, 1200)

    return () => {
      cancelledRef.current = true
      window.clearTimeout(tid)
      if (blockCheckRef.current) window.clearTimeout(blockCheckRef.current)
      window.speechSynthesis.cancel()
    }
  }, [sentences, speakFrom, supported])

  return { sentences, activeIdx, status, play, pause, resume, stop }
}
