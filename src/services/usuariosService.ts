import { invocarFuncion } from './edgeFunctions'

// ── Servicio de Usuarios (Edge Functions con service_role) ───────────────────
// Operaciones sobre cuentas que requieren privilegios de servidor: creación en
// Auth + tabla usuarios, edición de email/password, y eliminación (revoca Auth).
// Cada una devuelve { data, error, status } uniforme (ver invocarFuncion).

export interface CrearUsuarioPayload {
  nombre: string
  rut: string
  email: string
  rol: string
  passwordOverride?: string
  skipEmail?: boolean
}

export interface EditarUsuarioPayload {
  userId: string
  email?: string
  password?: string
}

// Crea un usuario.
export const crearUsuario = (payload: CrearUsuarioPayload) =>
  invocarFuncion('crear-usuario', payload)

// Edita email y/o password de un usuario.
export const editarUsuario = (payload: EditarUsuarioPayload) =>
  invocarFuncion('editar-usuario', payload)

// Elimina un usuario (revoca Auth y limpia sus filas).
export const eliminarUsuario = (userId: string) =>
  invocarFuncion('eliminar-usuario', { userId })
