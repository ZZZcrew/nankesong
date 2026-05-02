/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUBMIT_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
