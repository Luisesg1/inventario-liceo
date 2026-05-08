import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Capturar tokens del hash ANTES de que createClient los limpie
const hashParams  = new URLSearchParams(window.location.hash.slice(1))
const queryParams = new URLSearchParams(window.location.search)

// Flujo legacy (hash): type=recovery en el fragment
const esRecuperacionHash = hashParams.get('type') === 'recovery'

// Flujo PKCE (moderno): Supabase envía ?code=... sin indicar el tipo en la URL.
// Lo guardamos en sessionStorage al llegar, para que App.jsx sepa que es recovery
// incluso después de que createClient consuma y limpie el code.
const codigoPKCE = queryParams.get('code')
if (codigoPKCE) {
  sessionStorage.setItem('supabase_pkce_recovery', '1')
}
const esRecuperacionPKCE = !!sessionStorage.getItem('supabase_pkce_recovery')

export const esRecuperacion = esRecuperacionHash || esRecuperacionPKCE

// Si es recovery por hash legacy, guardamos tokens para setSession manual
export const recoveryTokens = esRecuperacionHash
  ? {
      access_token:  hashParams.get('access_token')  ?? '',
      refresh_token: hashParams.get('refresh_token') ?? '',
    }
  : null

// Con PKCE, createClient detecta el ?code= automáticamente y dispara PASSWORD_RECOVERY
export const supabase = createClient(url, key)

// Limpiar flag de sessionStorage después de que Supabase procese el code
if (codigoPKCE) {
  setTimeout(() => sessionStorage.removeItem('supabase_pkce_recovery'), 5000)
}