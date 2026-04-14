/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** WebSocket URL for `npm run server` room relay (e.g. `ws://127.0.0.1:8787`). */
  readonly VITE_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
