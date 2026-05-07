import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Capturar tokens del hash ANTES de que createClient los limpie
const hashParams = new URLSearchParams(window.location.hash.slice(1))
export const esRecuperacion = hashParams.get('type') === 'recovery'

// Si es recovery, guardamos los tokens para setSession manual en App.jsx
export const recoveryTokens = esRecuperacion
  ? {
      access_token:  hashParams.get('access_token')  ?? '',
      refresh_token: hashParams.get('refresh_token') ?? '',
    }
  : null

// Sin flowType explícito (PKCE default) — no intentará procesar tokens implícitos del hash
export const supabase = createClient(url, key)