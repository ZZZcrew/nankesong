import CryptoJS from 'crypto-js'

const APPID = import.meta.env.VITE_TENCENT_ASR_APPID
const SECRETID = import.meta.env.VITE_TENCENT_ASR_SECRETID
const SECRETKEY = import.meta.env.VITE_TENCENT_ASR_SECRETKEY
export const HAS_TTS_CREDENTIALS = Boolean(APPID && SECRETID && SECRETKEY)

const HOST = 'tts.cloud.tencent.com'
const PATH = '/stream_ws'

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function buildSignedUrl(text: string, voiceType: number): string {
  const now = Math.floor(Date.now() / 1000)
  const params: Record<string, string | number> = {
    Action: 'TextToStreamAudioWS',
    AppId: APPID!,
    Codec: 'mp3', // mp3 可直接丢给 <audio> 播放,pcm 需自己 decode
    EnableSubtitle: 0,
    Expired: now + 24 * 60 * 60,
    ModelType: 1,
    SampleRate: 16000,
    SecretId: SECRETID!,
    SessionId: uuid(),
    Speed: 0, // 语速,[-2, 2]
    Text: text,
    Timestamp: now,
    VoiceType: voiceType,
    Volume: 0, // 音量,[-10, 10]
  }
  // 字典序排序后拼接
  const keys = Object.keys(params).sort()
  const queryStr = keys.map((k) => `${k}=${params[k]}`).join('&')
  const signStr = `GET${HOST}${PATH}?${queryStr}`
  const sig = CryptoJS.HmacSHA1(signStr, SECRETKEY!)
  const base64Sig = CryptoJS.enc.Base64.stringify(sig)
  // Text 要 urlencode,其他不用(按文档描述);Signature 要 urlencode
  const encodedQuery = keys
    .map((k) => `${k}=${k === 'Text' ? encodeURIComponent(String(params[k])) : params[k]}`)
    .join('&')
  return `wss://${HOST}${PATH}?${encodedQuery}&Signature=${encodeURIComponent(base64Sig)}`
}

export type SynthesizeResult = {
  audio: ArrayBuffer // 完整 MP3 数据
  sessionId: string
}

export function synthesizeSentence(
  text: string,
  options: { voiceType?: number; signal?: AbortSignal } = {},
): Promise<SynthesizeResult> {
  if (!HAS_TTS_CREDENTIALS) {
    return Promise.reject(new Error('未配置腾讯云 TTS 凭证'))
  }
  const voiceType = options.voiceType ?? 101001 // 智瑜 情感女声

  return new Promise((resolve, reject) => {
    const url = buildSignedUrl(text, voiceType)
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    const chunks: ArrayBuffer[] = []
    let sessionId = ''
    let settled = false

    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
      try {
        ws.close()
      } catch {
        // ignore
      }
    }

    options.signal?.addEventListener('abort', () => {
      settle(() => reject(new DOMException('aborted', 'AbortError')))
    })

    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        try {
          const msg = JSON.parse(ev.data) as {
            code?: number
            message?: string
            final?: number
            session_id?: string
          }
          if (msg.code && msg.code !== 0) {
            settle(() => reject(new Error(`TTS ${msg.code}: ${msg.message}`)))
            return
          }
          if (msg.session_id) sessionId = msg.session_id
          if (msg.final === 1) {
            const total = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0))
            let offset = 0
            for (const c of chunks) {
              total.set(new Uint8Array(c), offset)
              offset += c.byteLength
            }
            settle(() => resolve({ audio: total.buffer, sessionId }))
          }
        } catch (err) {
          settle(() => reject(err instanceof Error ? err : new Error(String(err))))
        }
      } else if (ev.data instanceof ArrayBuffer) {
        chunks.push(ev.data)
      }
    }

    ws.onerror = () => {
      settle(() => reject(new Error('TTS WebSocket 错误')))
    }
    ws.onclose = (ev) => {
      if (!settled) {
        settle(() => reject(new Error(`TTS 连接关闭: code=${ev.code} reason=${ev.reason}`)))
      }
    }
  })
}
