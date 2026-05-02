/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TENCENT_ASR_APPID?: string
  readonly VITE_TENCENT_ASR_SECRETID?: string
  readonly VITE_TENCENT_ASR_SECRETKEY?: string
  readonly VITE_STEP_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
