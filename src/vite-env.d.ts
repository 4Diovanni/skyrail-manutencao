/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_LOGIN_DOMAIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Versão do app (package.json), injetada pelo Vite no build. */
declare const __APP_VERSION__: string
