# Sesión de Auditoría y Correcciones — 2026-07-20

## Contexto

Continuación de auditoría técnica iniciada en sesión anterior (2026-07-09).
Se verificó compatibilidad entre migraciones pendientes y nuevos módulos desarrollados por el usuario
(Hoja de Vida, estado de contrataciones, desactivación de cuentas, constraints únicos RUT/correo/teléfono).

---

## 1. Análisis de compatibilidad (migraciones pendientes vs nuevos módulos)

### Problema detectado antes de aplicar F04
`HojaVida.jsx` lee la tabla `usuarios` usando solo el permiso `ver_hoja_vida`.
La función `puede_listar_usuarios()` en la migración F04 no incluía ese permiso →
un usuario con solo `ver_hoja_vida` vería lista vacía silenciosamente tras aplicar F04.

**Fix:** Se agregaron `ver_hoja_vida`, `crear_hoja_vida`, `editar_hoja_vida` a `puede_listar_usuarios()`
antes de aplicar la migración.

**Commit:** `12f1659` — `fix(rls): add ver_hoja_vida perms to puede_listar_usuarios()`

---

## 2. Migraciones SQL aplicadas (SQL Editor de Supabase)

### F03 — `20260710000004_rpc_log_auditoria.sql`
- Crea RPC `log_auditoria()` SECURITY DEFINER
- El cliente ya no inserta en `audit_logs` directamente; el RPC deriva `usuario_id/nombre/rol` de `auth.uid()`
- Elimina política `audit_logs_insert` permisiva

### F04 — `20260710000005_rls_usuarios_pii.sql` ⚠️ ALTO RIESGO
- Restringe SELECT en `usuarios`: solo fila propia OR `puede_listar_usuarios()`
- Crea función `puede_listar_usuarios()` — cubre ausencias, compensatorios, personal, usuarios, auditoría, hoja de vida
- Crea RPC `ids_usuarios_mi_rut()` — reemplaza escaneo completo en flujo "Mis ausencias" de docentes
- Incluye reversión de emergencia al final del archivo

### F05 — `20260710000006_rate_limit.sql`
- Crea tabla `rate_limit` con RLS activa (sin políticas → solo service_role)
- Crea función `consumir_rate_limit()` — ventana fija por clave/IP, atómica vía UPSERT
- Protege endpoint `register-user` contra fuerza bruta en código de invitación

### RPC set_cuenta_activa — `20260720000001_rpc_set_cuenta_activa.sql`
- Crea función `set_cuenta_activa(p_usuario_id, p_activo)` SECURITY DEFINER
- Valida `es_admin() OR gestionar_usuarios` antes de cambiar campo `activo`
- Impide que permisos de ausencias (`crear_ausencias`/`editar_ausencias`) puedan desactivar cuentas

---

## 3. Edge Functions redeployadas

Todas con `--no-verify-jwt`:

| Función | Cambios incluidos |
|---|---|
| `register-user` | Rate limit, CORS restringido, Deno.serve(), permisos desde BD |
| `crear-usuario` | CORS restringido, passwordTemporal condicional |
| `editar-usuario` | CORS restringido |
| `eliminar-usuario` | CORS restringido, hard-delete fila usuarios |
| `restaurar-backup` | CORS restringido |
| `backup-mensual` | CORS restringido |
| `notify-ausencia` | Deno.serve() |
| `notify-new-ticket` | Deno.serve() |
| `notify-permiso-administrativo` | Deno.serve() |
| `notify-ticket` | Deno.serve() |
| `notify-ticket-status` | Deno.serve() |

---

## 4. Bugs corregidos en código

### `HojaVida.jsx:520` — Query con RUT formateado
**Problema:** `.in('rut', fmts)` enviaba variantes con puntos/guiones que no coinciden
con los valores normalizados en BD → PostgREST devolvía 400 bajo F04.

**Fix:** Reemplazado por `.eq('rut', rn)` usando RUT ya normalizado.

**Commit:** `139619c` — `fix(hoja-vida): use normalized RUT in usuarios query to avoid PostgREST 400`

### `Personal.jsx:876/906` — Activar/desactivar cuenta sin protección server-side
**Problema:** `usuarios.update({ activo })` directo pasaba la política `usuarios_update`
que incluye `crear_ausencias`/`editar_ausencias` → un gestor de ausencias podía desactivar
cuentas de otros usuarios sin tener permisos de gestión de usuarios.

**Fix:** Reemplazado por `supabase.rpc('set_cuenta_activa', { p_usuario_id, p_activo })`
que valida `es_admin() OR gestionar_usuarios` server-side.

**Commit:** `4197b26` — `fix(seguridad): proteger activar/desactivar cuenta con RPC server-side`

---

## 5. Hallazgos descartados (ya protegidos por RLS)

| Hallazgo | Estado |
|---|---|
| `HojaVida.jsx:601–639` writes a `hv_*` tables | RLS existente exige `editar_hoja_vida` — seguro |
| `Personal.jsx:908` `contrataciones.update({ estado })` | RLS `contrataciones_update` exige `editar_contrataciones` — seguro |
| `HojaVida.jsx:515` upsert `hv_personas` en vista | RLS insert exige `ver_hoja_vida` — comportamiento intencional |

---

## 6. Deploy frontend

- Build: `npm run build` — sin errores, 2440 módulos
- Subido como `dist.zip` a cPanel → extraído en `public_html/sistema.liceojhj.cl/`
- `index.html` + `assets/` al nivel correcto

---

## 7. Estado final

| Ítem | Estado |
|---|---|
| Migraciones F03/F04/F05 | ✅ Aplicadas |
| Migración set_cuenta_activa | ✅ Aplicada |
| Edge functions (11) | ✅ Redeployadas |
| Bug HojaVida RUT query | ✅ Corregido y deployado |
| Protección activar/desactivar cuenta | ✅ Corregido y deployado |
| Frontend en producción | ✅ sistema.liceojhj.cl |

---

## 8. Refactors estructurales — estado final

Los hallazgos de alta complejidad se abordaron en esta sesión:

- **F07** ✅ — Sesión expirada: interceptor global de 401 en supabase.js dispara
  evento `sesion-expirada`; App.jsx muestra banner y cierra sesión al instante
  (antes: hasta 30s de espera). Helper `getAccessToken`/`getUserId` centraliza
  los 8 `getSession()` dispersos. Commits `55c315c`, `15d30f2`.
- **F14** ✅ — Vitest 4 + primera suite. `permisos.test.js` cubre invariantes de
  seguridad del motor; `edgeFunctions.test.ts` cubre el contrato de servicios.
  Scripts `npm test` / `npm run test:run`. Commits `ee5d907`, `1d3260d`.
- **F21** ✅ — Backups admin-only end to end (backend ya lo exigía; el frontend
  ofrecía permisos granulares fantasma). Módulo marcado `adminOnly`, excluido de
  los editores de roles/usuarios; guardas de ruta en `esAdmin`. Commit `4e12b80`.
- **F23** ✅ (núcleo) — Capa `src/services/`: TODA la comunicación con Edge
  Functions pasa por servicios (edgeFunctions, usuarios, notificaciones, backups,
  registro). Ninguna página invoca `functions/v1` ni `functions.invoke` directo.
  Commits `1d3260d`, `3ee9759`. La extracción de los `supabase.from()` de tabla a
  servicios se deja como mejora incremental (retorno decreciente; cada query es
  específica de su página).
- **F13** ✅ (setup incremental) — tsconfig con `allowJs`+`checkJs:false` (JS
  convive sin type-check; los `.ts` sí se verifican), `strict` para código nuevo,
  script `npm run typecheck`. Capa de servicios + `utils/auth` convertidos a `.ts`
  con tipos. Las páginas `.jsx` se migran gradualmente. Commit `909aefb`.

- **F08** ✅ — Rutas declarativas. La cadena de ~35 `{paginaSegura === 'x' && ...}`
  y el useEffect de redirección se reemplazaron por `<Routes>` (una `<Route>` por
  path desde RUTA_A_PAGINA) + `<PaginaGuard>` que emite `<Navigate>` cuando el
  motor redirige a una página segura, y `renderPagina()` (tabla data-driven).
  Conserva el hub `paginaSegura` como fuente única de guardas — enfoque data-driven
  de bajo riesgo, no una migración que dispersara las guardas. Commit `faa4029`.
