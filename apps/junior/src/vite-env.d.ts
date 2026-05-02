/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TENCENT_ASR_APPID?: string
  readonly VITE_TENCENT_ASR_SECRETID?: string
  readonly VITE_TENCENT_ASR_SECRETKEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'tencentcloud-speech-sdk-js/app/webaudiospeechrecognizer.js' {
  type AsrResult = { voice_text_str: string; voice_id?: string }
  type AsrResultEvent = { result: AsrResult; voice_id?: string }

  export default class WebAudioSpeechRecognizer {
    constructor(params: {
      appid: string
      secretid: string
      engine_model_type: string
      voice_format?: number
      signCallback: (signStr: string) => string
      filter_dirty?: number
      filter_modal?: number
      filter_punc?: number
      convert_num_mode?: number
      needvad?: number
      hotword_id?: string
    })
    OnRecognitionStart(res: unknown): void
    OnSentenceBegin(res: AsrResultEvent): void
    OnRecognitionResultChange(res: AsrResultEvent): void
    OnSentenceEnd(res: AsrResultEvent): void
    OnRecognitionComplete(res: unknown): void
    OnError(err: unknown): void
    start(): void
    stop(): void
  }
}
