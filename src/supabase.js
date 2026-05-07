import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Capturar URL ANTES de que createClient la modifique
console.log('[supabase.js] search ANTES de createClient:', window.location.search)
console.log('[supabase.js] hash ANTES de createClient:', window.location.hash)

export const esRecuperacion =
  new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'

export const supabase = createClient(url, key)

console.log('[supabase.js] search DESPUÉS de createClient:', window.location.search)