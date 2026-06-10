/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Google OAuth client ID for "Continue with Google" (public-by-design; optional override). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
