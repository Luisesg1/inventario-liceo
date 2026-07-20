import { describe, it, expect } from 'vitest'
import { construirPermisos } from './permisos'

// Motor de permisos: función pura. Estos tests fijan las invariantes de
// seguridad que no deben romperse en ningún refactor futuro.

const admin   = { rol: 'admin', id: 'a1', nombre: 'Admin' }
const docente = { rol: 'docente', id: 'd1', nombre: 'Docente' }

describe('construirPermisos — bypass de admin', () => {
  const perm = construirPermisos(admin, {})

  it('admin puede ver cualquier módulo aunque el JSONB esté vacío', () => {
    expect(perm.esAdmin).toBe(true)
    expect(perm.can('permiso_inexistente_cualquiera')).toBe(true)
    expect(perm.puedeVerInventario).toBe(true)
    expect(perm.puedeVerBackups).toBe(true)
    expect(perm.puedeAccederUsuarios).toBe(true)
  })

  it('admin no tiene ninguna página bloqueada', () => {
    expect(perm.paginaBloqueada('backups')).toBe(false)
    expect(perm.paginaBloqueada('usuarios')).toBe(false)
    expect(perm.paginaBloqueada('auditoria_general')).toBe(false)
  })
})

describe('construirPermisos — módulos obligatorios', () => {
  it('un docente sin permisos igual recibe los obligatorios', () => {
    const perm = construirPermisos(docente, {})
    expect(perm.can('ver_propias_ausencias')).toBe(true)
    expect(perm.can('crear_ticket')).toBe(true)
    expect(perm.can('ver_reglamentos')).toBe(true)
    expect(perm.can('descargar_reglamentos')).toBe(true)
  })

  it('las páginas obligatorias nunca se bloquean para un no-admin', () => {
    const perm = construirPermisos(docente, {})
    expect(perm.paginaBloqueada('tickets')).toBe(false)
    expect(perm.paginaBloqueada('mis_ausencias')).toBe(false)
    expect(perm.paginaBloqueada('reglamentos')).toBe(false)
  })
})

describe('construirPermisos — F21 Backups admin-only', () => {
  it('un no-admin NO ve Backups aunque su JSONB traiga las claves', () => {
    const perm = construirPermisos(docente, {
      ver_backups: true, crear_backups: true, restaurar_backups: true,
      eliminar_backups: true, ver_actividad_backups: true,
    })
    expect(perm.puedeVerBackups).toBe(false)
    expect(perm.permisosBackups.crear).toBe(false)
    expect(perm.permisosBackups.restaurar).toBe(false)
    expect(perm.permisosBackups.eliminar).toBe(false)
    expect(perm.paginaBloqueada('backups')).toBe(true)
  })

  it('un no-admin con ver_actividad_backups no obtiene auditoría general', () => {
    const perm = construirPermisos(docente, { ver_actividad_backups: true })
    expect(perm.puedeVerAuditoriaGeneral).toBe(false)
  })

  it('el admin sí ve Backups completo', () => {
    const perm = construirPermisos(admin, {})
    expect(perm.puedeVerBackups).toBe(true)
    expect(perm.permisosBackups.restaurar).toBe(true)
  })
})

describe('construirPermisos — F04 acceso a datos de personal por permiso', () => {
  it('un docente base no accede a Personal ni a Usuarios', () => {
    const perm = construirPermisos(docente, {})
    expect(perm.puedeVerPersonal).toBe(false)
    expect(perm.puedeAccederUsuarios).toBe(false)
  })

  it('un no-admin con ver_contrataciones sí accede a Personal', () => {
    const perm = construirPermisos(docente, { ver_contrataciones: true })
    expect(perm.puedeVerPersonal).toBe(true)
  })
})

describe('construirPermisos — entradas límite', () => {
  it('usuario null no rompe y no concede nada sensible', () => {
    const perm = construirPermisos(null, null)
    expect(perm.esAdmin).toBe(false)
    expect(perm.puedeVerBackups).toBe(false)
    expect(perm.puedeAccederUsuarios).toBe(false)
  })
})
