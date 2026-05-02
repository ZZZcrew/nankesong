import { useCallback, useEffect, useRef, useState } from 'react'
import CryptoJS from 'crypto-js'
import WebAudioSpeechRecognizer from 'tencentcloud-speech-sdk-js/app/webaudiospeechrecognizer.js'

export type ASRStatus = 'idle' | 'listening' | 'unsupported' | 'denied' | 'error'

export type UseASR = {
  status: ASRStatus
  interim: string
  finalTranscript: string
  error: string | null
  start: (onFinal?: (text: string) => void) => void
  stop: () => void
}

type AsrResultEvent = { voice_text_str?: string; voice_id?: string }

// 仅 demo/本地开发用:把 SecretKey 暴露在前端不安全,生产必须走后端 STS。
// 详见 .env.example 里的说明。
const APPID = import.meta.env.VITE_TENCENT_ASR_APPID
const SECRETID = import.meta.env.VITE_TENCENT_ASR_SECRETID
const SECRETKEY = import.meta.env.VITE_TENCENT_ASR_SECRETKEY
const HAS_CREDENTIALS = Boolean(APPID && SECRETID && SECRETKEY)

function signCallback(signStr: string): string {
  const hash = CryptoJS.HmacSHA1(signStr, SECRETKEY ?? '')
  return CryptoJS.enc.Base64.stringify(hash)
}

type RecognizerInstance = InstanceType<typeof WebAudioSpeechRecognizer>

export function useASR(_lang = 'zh-CN'): UseASR {
  const [status, setStatus] = useState<ASRStatus>(HAS_CREDENTIALS ? 'idle' : 'unsupported')
  const [interim, setInterim] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [error, setError] = useState<string | null>(
    HAS_CREDENTIALS ? null : '未配置腾讯云 ASR 凭证(见 .env.example)',
  )

  const recRef = useRef<RecognizerInstance | null>(null)
  const accumRef = useRef('')
  const finalizeRef = useRef<((t: string) => void) | null>(null)

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop()
      } catch {
        // ignore
      }
      recRef.current = null
    }
  }, [])

  const start = useCallback((onFinal?: (text: string) => void) => {
    if (!HAS_CREDENTIALS) {
      setStatus('unsupported')
      return
    }
    accumRef.current = ''
    setInterim('')
    setFinalTranscript('')
    setError(null)
    finalizeRef.current = onFinal ?? null

    const rec = new WebAudioSpeechRecognizer({
      appid: APPID!,
      secretid: SECRETID!,
      engine_model_type: '16k_zh', // 标准版,5 小时/月免费。大模型版 16k_zh_large 不含免费额度
      voice_format: 1, // PCM
      filter_punc: 0, // 保留标点,方便前端按句分割
      filter_modal: 2, // 过滤语气词
      filter_dirty: 1, // 过滤脏词
      convert_num_mode: 1, // 数字转阿拉伯
      needvad: 1, // 启用 VAD
      signCallback,
    })

    rec.OnRecognitionStart = () => {
      console.log('[Tencent ASR] 开始识别')
      setStatus('listening')
    }
    rec.OnRecognitionResultChange = (res: AsrResultEvent) => {
      const text = res?.voice_text_str ?? ''
      console.log('[Tencent ASR] 中间结果:', text, res)
      setInterim(text)
    }
    rec.OnSentenceEnd = (res: AsrResultEvent) => {
      const text = res?.voice_text_str ?? ''
      console.log('[Tencent ASR] 一句话结束:', text, res)
      accumRef.current += text
      setFinalTranscript(accumRef.current)
      setInterim('')
    }
    rec.OnRecognitionComplete = () => {
      const finalText = accumRef.current.trim()
      console.log('[Tencent ASR] 识别结束,完整文本:', finalText)
      const cb = finalizeRef.current
      finalizeRef.current = null
      setStatus('idle')
      if (cb && finalText) cb(finalText)
    }
    rec.OnError = (err: unknown) => {
      // 打到 console 方便排查:可能是鉴权/网络/麦克风等多种原因
      console.error('[Tencent ASR] OnError raw:', err)
      const msg =
        typeof err === 'string'
          ? err
          : err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : err && typeof err === 'object'
              ? JSON.stringify(err)
              : '语音识别失败'
      // 麦克风被拒识别成 denied
      if (
        msg.includes('Permission denied') ||
        msg.includes('NotAllowed') ||
        msg.includes('权限')
      ) {
        setStatus('denied')
      } else {
        setError(msg)
        setStatus('error')
      }
      finalizeRef.current = null
    }

    recRef.current = rec
    try {
      rec.start()
      setStatus('listening')
    } catch (err) {
      setError(String(err))
      setStatus('error')
    }
  }, [])

  const stop = useCallback(() => {
    const rec = recRef.current
    if (!rec) return
    try {
      rec.stop()
    } catch {
      // ignore
    }
  }, [])

  return { status, interim, finalTranscript, error, start, stop }
}
