import { invocarFuncion } from './edgeFunctions'

// ── Servicio de Usuarios (Edge Functions con service_role) ───────────────────
// Operaciones sobre cuentas que requieren privilegios de servidor: creación en
// Auth + tabla usuarios, edición de email/password, y eliminación (revoca Auth).
// Cada una devuelve { data, error } uniforme (ver invocarFuncion).

// Crea un usuario. payload: { nombre, rut, email, rol }
export const crearUsuario = (payload) => invocarFuncion('crear-usuario', payload)

// Edita email y/o password de un usuario. payload: { userId, email?, password? }
export const editarUsuario = (payload) => invocarFuncion('editar-usuario', payload)

// Elimina un usuario (revoca Auth y limpia sus filas).
export const eliminarUsuario = (userId) => invocarFuncion('eliminar-usuario', { userId })
