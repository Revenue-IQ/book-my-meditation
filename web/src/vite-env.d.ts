/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Clerk publishable key — present only in Clerk-mode builds (see .env.example). */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
