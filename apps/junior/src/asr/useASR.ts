import { useCallback, useEffect, useRef, useState } from 'react'

export type ASRStatus = 'idle' | 'listening' | 'unsupported' | 'denied' | 'error'

export type UseASR = {
  status: ASRStatus
  interim: string
  finalTranscript: string
  error: string | null
  start: (onFinal?: (text: string) => void) => void
  stop: () => void
}

// 仅 demo/本地开发用:把 API Key 暴露在前端不安全,生产必须走后端代理。
const API_KEY = import.meta.env.VITE_STEP_API_KEY as string | undefined
const HAS_CREDENTIALS = Boolean(API_KEY)
const ENDPOINT = 'https://api.stepfun.com/v1/audio/asr/sse'
const TARGET_SAMPLE_RATE = 16000

function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

function concatInt16(chunks: Int16Array[]): Int16Array {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Int16Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out
}

// 线性下采样:srcRate -> 16000
function downsample(buf: Float32Array, srcRate: number, dstRate = TARGET_SAMPLE_RATE): Float32Array {
  if (srcRate === dstRate) return buf
  const ratio = srcRate / dstRate
  const newLen = Math.round(buf.length / ratio)
  const out = new Float32Array(newLen)
  let oOff = 0
  let iOff = 0
  while (oOff < newLen) {
    const next = Math.round((oOff + 1) * ratio)
    let acc = 0
    let count = 0
    for (let i = iOff; i < next && i < buf.length; i++) {
      acc += buf[i]
      count++
    }
    out[oOff] = count > 0 ? acc / count : 0
    oOff++
    iOff = next
  }
  return out
}

function int16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(binary)
}

// 从 SSE 事件 JSON 里尽力抽出文本片段,兼容多种命名。
type SSEEvent = {
  type?: string
  delta?: string
  text?: string
  transcript?: string
  result?: { text?: string; transcript?: string }
  data?: { text?: string; transcript?: string; delta?: string }
}

function pickInterim(ev: SSEEvent): { delta?: string; full?: string } {
  const full =
    ev.text ??
    ev.transcript ??
    ev.result?.text ??
    ev.result?.transcript ??
    ev.data?.text ??
    ev.data?.transcript
  const delta = ev.delta ?? ev.data?.delta
  return { delta, full }
}

function isDoneEvent(ev: SSEEvent): boolean {
  const t = ev.type ?? ''
  return t.includes('done') || t.includes('completed') || t === 'transcript.text.done'
}

export function useASR(_lang = 'zh-CN'): UseASR {
  const [status, setStatus] = useState<ASRStatus>(HAS_CREDENTIALS ? 'idle' : 'unsupported')
  const [interim, setInterim] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [error, setError] = useState<string | null>(
    HAS_CREDENTIALS ? null : '未配置阶跃 ASR 凭证 (VITE_STEP_API_KEY)',
  )

  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const procRef = useRef<ScriptProcessorNode | null>(null)
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const pcmChunksRef = useRef<Int16Array[]>([])
  const finalizeRef = useRef<((t: string) => void) | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const stoppedRef = useRef(false)

  const cleanupAudio = useCallback(() => {
    try {
      procRef.current?.disconnect()
    } catch {
      // ignore
    }
    try {
      srcRef.current?.disconnect()
    } catch {
      // ignore
    }
    try {
      ctxRef.current?.close()
    } catch {
      // ignore
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    procRef.current = null
    srcRef.current = null
    ctxRef.current = null
    streamRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      stoppedRef.current = true
      abortRef.current?.abort()
      cleanupAudio()
    }
  }, [cleanupAudio])

  const recognize = useCallback(async (pcmBase64: string) => {
    const abort = new AbortController()
    abortRef.current = abort
    let resp: Response
    try {
      resp = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          audio: {
            data: pcmBase64,
            input: {
              transcription: {
                model: 'stepaudio-2.5-asr',
                language: 'zh',
                enable_itn: true,
              },
              format: {
                type: 'pcm',
                codec: 'pcm_s16le',
                rate: TARGET_SAMPLE_RATE,
                bits: 16,
                channel: 1,
              },
            },
          },
        }),
        signal: abort.signal,
      })
    } catch (err) {
      if (stoppedRef.current && err instanceof DOMException && err.name === 'AbortError') return
      throw err
    }

    if (!resp.ok || !resp.body) {
      const detail = await resp.text().catch(() => '')
      throw new Error(`Stepfun ASR ${resp.status}: ${detail || resp.statusText}`)
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let accumDelta = ''
    let lastFull = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split(/\r?\n\r?\n/)
      buffer = events.pop() ?? ''
      for (const block of events) {
        for (const line of block.split(/\r?\n/)) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (!payload || payload === '[DONE]') continue
          let ev: SSEEvent
          try {
            ev = JSON.parse(payload) as SSEEvent
          } catch {
            continue
          }
          const { delta, full } = pickInterim(ev)
          if (delta) accumDelta += delta
          if (full) lastFull = full
          const shown = lastFull || accumDelta
          if (shown) setInterim(shown)
          if (isDoneEvent(ev) && (lastFull || accumDelta)) {
            return (lastFull || accumDelta).trim()
          }
        }
      }
    }
    return (lastFull || accumDelta).trim()
  }, [])

  const start = useCallback(
    async (onFinal?: (text: string) => void) => {
      if (!HAS_CREDENTIALS) {
        setStatus('unsupported')
        return
      }
      pcmChunksRef.current = []
      stoppedRef.current = false
      setInterim('')
      setFinalTranscript('')
      setError(null)
      finalizeRef.current = onFinal ?? null

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (err) {
        const name = err instanceof DOMException ? err.name : ''
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setStatus('denied')
        } else {
          setError(err instanceof Error ? err.message : String(err))
          setStatus('error')
        }
        return
      }
      streamRef.current = stream

      const Ctx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      let ctx: AudioContext
      try {
        ctx = new Ctx({ sampleRate: TARGET_SAMPLE_RATE })
      } catch {
        ctx = new Ctx()
      }
      ctxRef.current = ctx

      const src = ctx.createMediaStreamSource(stream)
      srcRef.current = src
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      procRef.current = proc

      proc.onaudioprocess = (ev) => {
        if (stoppedRef.current) return
        const ch = ev.inputBuffer.getChannelData(0)
        const ds = downsample(ch, ctx.sampleRate)
        pcmChunksRef.current.push(floatToInt16(ds))
      }
      src.connect(proc)
      // ScriptProcessor 在部分浏览器需要连到 destination 才会触发 onaudioprocess
      proc.connect(ctx.destination)

      setStatus('listening')
    },
    [],
  )

  const stop = useCallback(() => {
    if (stoppedRef.current) return
    stoppedRef.current = true
    cleanupAudio()

    const pcm = concatInt16(pcmChunksRef.current)
    pcmChunksRef.current = []

    if (pcm.length === 0) {
      setStatus('idle')
      finalizeRef.current = null
      return
    }

    const base64 = int16ToBase64(pcm)
    recognize(base64)
      .then((text) => {
        const finalText = text.trim()
        if (finalText) setFinalTranscript(finalText)
        const cb = finalizeRef.current
        finalizeRef.current = null
        setStatus('idle')
        if (cb && finalText) cb(finalText)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[Stepfun ASR] 识别失败:', msg)
        setError(msg)
        setStatus('error')
        finalizeRef.current = null
      })
  }, [cleanupAudio, recognize])

  return { status, interim, finalTranscript, error, start, stop }
}
