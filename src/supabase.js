import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Leer ANTES de createClient (que puede limpiar el hash)
export const esRecuperacion =
  new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'

export const supabase = createClient(url, key, {
  auth: { flowType: 'implicit' },
})