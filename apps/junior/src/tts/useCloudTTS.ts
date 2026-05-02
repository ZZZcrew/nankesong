import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HAS_TTS_CREDENTIALS, synthesizeSentence } from './tencentTTS'

export type TTSStatus =
  | 'idle'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'blocked'
  | 'unsupported'
  | 'error'

export type UseCloudTTS = {
  sentences: string[]
  activeIdx: number
  status: TTSStatus
  error: string | null
  play: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  skip: () => void
}

function splitSentences(text: string): string[] {
  if (!text) return []
  return text
    .split(/(?<=[。！？!?\.])\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function useCloudTTS(text: string): UseCloudTTS {
  const sentences = useMemo(() => splitSentences(text), [text])
  const [activeIdx, setActiveIdx] = useState(-1)
  const [status, setStatus] = useState<TTSStatus>(HAS_TTS_CREDENTIALS ? 'idle' : 'unsupported')
  const [error, setError] = useState<string | null>(
    HAS_TTS_CREDENTIALS ? null : '未配置腾讯云 TTS 凭证',
  )

  const idxRef = useRef(0)
  const cancelledRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const cleanupAudio = () => {
    const a = audioRef.current
    if (a) {
      try {
        a.pause()
        a.removeAttribute('src')
        a.load()
      } catch {
        // ignore
      }
      audioRef.current = null
    }
  }

  const speakFrom = useCallback(
    async (startIdx: number) => {
      if (!HAS_TTS_CREDENTIALS || sentences.length === 0) return
      cancelledRef.current = false
      idxRef.current = startIdx
      setStatus('playing')

      for (let i = startIdx; i < sentences.length; i++) {
        if (cancelledRef.current) return
        idxRef.current = i
        setActiveIdx(i)

        const abort = new AbortController()
        abortRef.current = abort

        let audioUrl: string | null = null
        try {
          console.log('[Tencent TTS] 合成句子:', sentences[i])
          const { audio } = await synthesizeSentence(sentences[i], { signal: abort.signal })
          if (cancelledRef.current) return
          const blob = new Blob([audio], { type: 'audio/mp3' })
          audioUrl = URL.createObjectURL(blob)

          await new Promise<void>((resolve, reject) => {
            const a = new Audio(audioUrl!)
            audioRef.current = a
            a.onended = () => resolve()
            a.onerror = () => reject(new Error('audio play error'))
            a.play().catch(reject)
          })
          if (audioUrl) URL.revokeObjectURL(audioUrl)
          audioUrl = null
        } catch (err) {
          if (audioUrl) URL.revokeObjectURL(audioUrl)
          if (cancelledRef.current) return
          if (err instanceof DOMException && err.name === 'NotAllowedError') {
            // 浏览器 autoplay 阻止,需要用户手势
            setStatus('blocked')
            return
          }
          // 其他错误(鉴权/服务未开通/网络等)立即中断,不再继续
          // 否则字幕会因为每句都立即失败而瞬间跑完全部
          const msg = err instanceof Error ? err.message : String(err)
          console.error('[Tencent TTS] 合成失败,中断本次播报:', msg)
          setError(msg)
          setStatus('error')
          return
        }
      }

      if (!cancelledRef.current) {
        setStatus('ended')
        setActiveIdx(sentences.length - 1)
      }
    },
    [sentences],
  )

  const play = useCallback(() => {
    if (!HAS_TTS_CREDENTIALS) {
      setStatus('unsupported')
      return
    }
    if (sentences.length === 0) return
    speakFrom(0)
  }, [sentences, speakFrom])

  const pause = useCallback(() => {
    const a = audioRef.current
    if (a && !a.paused) {
      a.pause()
      setStatus('paused')
    }
  }, [])

  const resume = useCallback(() => {
    const a = audioRef.current
    if (a && a.paused) {
      a.play().catch(() => {
        setStatus('blocked')
      })
      setStatus('playing')
    }
  }, [])

  const stop = useCallback(() => {
    cancelledRef.current = true
    abortRef.current?.abort()
    cleanupAudio()
    setStatus('idle')
    setActiveIdx(-1)
  }, [])

  const skip = useCallback(() => {
    cancelledRef.current = true
    abortRef.current?.abort()
    cleanupAudio()
    setStatus('ended')
    setActiveIdx(sentences.length > 0 ? sentences.length - 1 : -1)
  }, [sentences])

  // text 变化时:取消旧,启动新
  useEffect(() => {
    if (!HAS_TTS_CREDENTIALS) {
      setStatus('unsupported')
      return
    }
    cancelledRef.current = false
    idxRef.current = 0
    setActiveIdx(-1)
    setStatus('idle')

    if (sentences.length === 0) return

    const tid = window.setTimeout(() => speakFrom(0), 0)

    return () => {
      cancelledRef.current = true
      window.clearTimeout(tid)
      abortRef.current?.abort()
      cleanupAudio()
    }
  }, [sentences, speakFrom])

  return { sentences, activeIdx, status, error, play, pause, resume, stop, skip }
}
