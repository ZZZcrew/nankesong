// 注：文件名沿用 tencentTTS.ts 以避免动上层组件，实际已切换为阶跃 (Stepfun) TTS。
// curl 等价：
//   POST https://api.stepfun.com/v1/audio/speech
//   Authorization: Bearer $STEP_API_KEY
//   body: { model, voice, input, instruction? }
//   响应体直接为音频二进制 (默认 mp3)。

const API_KEY = import.meta.env.VITE_STEP_API_KEY as string | undefined
const ENDPOINT = 'https://api.stepfun.com/v1/audio/speech'
const DEFAULT_MODEL = 'stepaudio-2.5-tts'
const DEFAULT_VOICE = 'cixingnansheng'

export const HAS_TTS_CREDENTIALS = Boolean(API_KEY)

export type SynthesizeResult = {
  audio: ArrayBuffer
  sessionId: string
}

export type SynthesizeOptions = {
  /** 兼容旧签名,已弃用:阶跃 API 不使用数字 voiceType */
  voiceType?: number
  voice?: string
  model?: string
  instruction?: string
  signal?: AbortSignal
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export async function synthesizeSentence(
  text: string,
  options: SynthesizeOptions = {},
): Promise<SynthesizeResult> {
  if (!HAS_TTS_CREDENTIALS) {
    throw new Error('未配置阶跃 TTS 凭证 (VITE_STEP_API_KEY)')
  }

  const body: Record<string, string> = {
    model: options.model ?? DEFAULT_MODEL,
    voice: options.voice ?? DEFAULT_VOICE,
    input: text,
  }
  if (options.instruction) body.instruction = options.instruction

  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: options.signal,
  })

  if (!resp.ok) {
    let detail = ''
    try {
      detail = await resp.text()
    } catch {
      // ignore
    }
    throw new Error(`Stepfun TTS ${resp.status}: ${detail || resp.statusText}`)
  }

  const audio = await resp.arrayBuffer()
  return { audio, sessionId: uuid() }
}
