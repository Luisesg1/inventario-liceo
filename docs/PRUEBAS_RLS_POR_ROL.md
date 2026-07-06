# Checklist de pruebas RLS por rol — Fase 2 de seguridad

Valida las migraciones `0003`→`0009` (aplicadas **en ese orden**). Para cada rol:
prueba **positiva** (lo que debe funcionar en la app) y **negativa** (lo que NO debe
poder hacerse ni siquiera por API directa).

## Cómo hacer una prueba negativa (API directa)
Las pruebas 🔒 comprueban que la base de datos bloquea aunque el usuario esquive la UI.
Estando logueado en la app, abre la consola del navegador (F12 → Console) y usa el
cliente ya inicializado. Si `supabase` no es global, pega este helper una vez:

```js
// Reusa la sesión activa de la app
const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
const sb = createClient(
  'https://TU-PROYECTO.supabase.co',      // VITE_SUPABASE_URL
  'TU_ANON_KEY',                          // VITE_SUPABASE_ANON_KEY
  { auth: { storageKey: 'sb-TU-PROYECTO-auth-token' } } // reutiliza el token guardado
);
// Test de lectura:
console.table((await sb.from('contrataciones').select('*')).data);
```
> ✅ Esperado en una prueba 🔒 = `data` vacío (`[]`) o `error` de política. ❌ Fallo = devuelve filas.

Antes de empezar, ten a mano **una cuenta de prueba por rol** (o cambia el rol de una
cuenta desde Usuarios, como admin).

---

## 0. Humo / smoke test (cualquier usuario)
- [ ] El **login carga con el logo y nombre** del establecimiento (branding público OK).
- [ ] Tras iniciar sesión, el **menú lateral** muestra solo los módulos del rol.
- [ ] No hay errores rojos en la consola al navegar por los módulos visibles.

---

## 1. 👑 admin
Positivas:
- [ ] Ve y opera **todos** los módulos (Inventario, Personal, Ausencias, Comp., Tickets, Reglamentos, Requerimientos, Papelera, Usuarios, Ajustes).
- [ ] **Usuarios**: cambia el rol de otro usuario → guarda sin error.
- [ ] **Ajustes**: edita branding y **ve/edita el código de invitación**.
- [ ] **Papelera**: restaura y elimina permanentemente un registro.
- [ ] Borra una ausencia de tipo compensatorio → el **saldo se restaura** sin warning.
Negativas: (ninguna — admin tiene bypass por diseño)

---

## 2. 🏛️ directivo  (inventario, sin tickets/requerimientos/ausencias)
Positivas:
- [ ] Ve el **Inventario**; agrega, edita, importa CSV y exporta un bien.
- [ ] Registra un **préstamo** y una **incidencia** → el stock del bien se ajusta.
- [ ] Ve la **auditoría de inventario**.
Negativas:
- [ ] 🔒 `await sb.from('tickets').select('*')` → **0 filas** (no gestiona tickets).
- [ ] 🔒 `await sb.from('requerimientos').select('*')` → **0 filas**.
- [ ] 🔒 `await sb.from('ausencias').select('*')` → **0 filas**.
- [ ] En Ajustes **no** aparece la personalización (vetado a directivo).

---

## 3. 🧑‍🏫 docente / coordinador / asistente / administrativo  (tickets + mis ausencias)
Positivas:
- [ ] **Crea un ticket** y aparece en la lista.
- [ ] En Tickets ve **solo los suyos** (no los de otros).
- [ ] **Mis ausencias** muestra sus propias ausencias (incluidas las cargadas contra su RUT).
- [ ] Exporta sus tickets.
Negativas:
- [ ] 🔒 `await sb.from('tickets').select('*')` → devuelve **solo filas con su propio `creado_por`**, ninguna ajena.
- [ ] 🔒 `await sb.from('ausencias').select('*')` → **solo las propias** (por id o RUT), ninguna de otro funcionario.
- [ ] 🔒 `await sb.from('contrataciones').select('*')` → **0 filas**.
- [ ] 🔒 `await sb.from('bienes').select('*')` → **0 filas** (sin ver_inventario).
- [ ] 🔒 **Escalada:** `await sb.from('usuarios').update({rol:'admin'}).eq('id', USER_ID)` → **error** "solo un administrador puede cambiar el rol".
- [ ] 🔒 **Código invitación:** `await sb.from('configuracion').select('*').eq('clave','codigo_invitacion')` → **0 filas**.
- [ ] 🔒 **Auditoría ajena:** intentar insertar en `audit_logs` con `usuario_id` de otro → **error** de política.

---

## 4. 🛠️ soporte  (gestiona todos los tickets)
Positivas:
- [ ] Ve **todos** los tickets; cambia estado/prioridad y responde.
- [ ] Ve el **banner de alertas** de tickets abiertos en el Dashboard.
- [ ] Elimina un ticket (soft-delete) y aparece en Papelera si tiene acceso.
- [ ] Ve la **auditoría de tickets**.
Negativas:
- [ ] 🔒 `await sb.from('requerimientos').select('*')` → **0 filas** (módulo negado a soporte).
- [ ] 🔒 `await sb.from('contrataciones').select('*')` → **0 filas**.
- [ ] 🔒 Cambiar su propio rol → **error** (prueba de escalada).

---

## 5. 📋 visor_requerimientos  (ver requerimientos + tickets)
Positivas:
- [ ] Ve el listado de **Requerimientos**.
- [ ] Ve/crea tickets según su preset.
Negativas:
- [ ] 🔒 `await sb.from('requerimientos').insert({...})` → **error** (solo lectura, sin crear_requerimiento).
- [ ] 🔒 `await sb.from('ausencias').select('*')` → **0 filas**.
- [ ] 🔒 Navegar por URL a `/personal` o `/usuarios` → redirige a una página permitida.

---

## 6. Gestor de módulos (permisos individuales, no admin)
Usa un usuario al que le asignes permisos puntuales desde **Usuarios → editar permisos**.

### 6a. Gestor de Personal (ver/crear/editar contrataciones + documentos)
- [ ] Ve y crea contrataciones/reemplazos; **sube y descarga** un documento.
- [ ] 🔒 Otro usuario **sin** permiso de documentos: `await sb.storage.from('personal-docs').download('ruta/archivo.pdf')` → **error** (bucket privado, ahora gateado).

### 6b. Gestor de Ausencias (crear/editar/eliminar ausencias)
- [ ] Registra una ausencia para cualquier funcionario; la edita.
- [ ] Borra una ausencia de **tipo compensatorio** → el **saldo compensatorio se restaura** (no falla por RLS del cross-módulo).
- [ ] Ve **todas** las ausencias del personal (tiene ver_ausencias).

### 6c. Gestor de Reglamentos
- [ ] Sube un documento y una nueva versión; lo descarga.
- [ ] Abrir/descargar un reglamento **incrementa los contadores** sin error.

### 6d. Gestor de Requerimientos
- [ ] Crea, edita e importa requerimientos; sube una imagen.

---

## 7. Pruebas transversales de integridad
- [ ] **Papelera → restaurar** un registro de cada módulo (bien, ausencia, ticket, requerimiento, reglamento) → vuelve a estar activo.
- [ ] **Papelera → eliminar permanentemente** con el permiso `eliminar_permanentemente` → se borra; **sin** ese permiso → error.
- [ ] Tras aplicar todo, revisar en Supabase → **Advisors / Security** que no queden tablas de negocio con RLS deshabilitada.
- [ ] 🔒 Con un usuario cualquiera, recorrer esta lista y confirmar **0 filas** en las tablas de módulos que no le corresponden:
      `bienes, categorias(*), prestamos, incidencias, contrataciones, reemplazos, personal_documentos, ausencias, dias_compensatorios, tickets, reglamentos, requerimientos`.
      (*) `categorias` es referencia y **sí** es legible por todos: es la única excepción esperada.

---

## Si algo falla
- **`RUN` de una migración da error de columna/tabla** → cópialo; probablemente un nombre
  distinto en `usuarios`/`permisos_usuario`/`configuracion` (creadas a mano).
- **Un rol legítimo ve 0 filas donde debería ver datos** → falta un permiso en su OR de SELECT;
  anota tabla + rol.
- **Una prueba 🔒 devuelve filas** → quedó una política permisiva vieja sin borrar
  (revisar `pg_policies` de esa tabla) o falta el gate.
