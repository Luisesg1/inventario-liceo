import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock del token para no depender de una sesión real.
vi.mock('../utils/auth', () => ({ getAccessToken: () => Promise.resolve('tok-123') }))

import { invocarFuncion } from './edgeFunctions'

describe('invocarFuncion — contrato uniforme { data, error, status }', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('respuesta OK: devuelve data y error null', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ usuario: { id: 'u1' } }) })
    ))
    const r = await invocarFuncion('crear-usuario', { nombre: 'X' })
    expect(r.error).toBeNull()
    expect(r.status).toBe(200)
    expect(r.data.usuario.id).toBe('u1')
  })

  it('error HTTP: propaga el mensaje del cuerpo y el status', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'Correo duplicado' }) })
    ))
    const r = await invocarFuncion('crear-usuario', {})
    expect(r.error).toBe('Correo duplicado')
    expect(r.status).toBe(400)
  })

  it('error de red: error genérico y status 0', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))))
    const r = await invocarFuncion('crear-usuario', {})
    expect(r.error).toBe('No se pudo conectar.')
    expect(r.status).toBe(0)
    expect(r.data).toBeNull()
  })

  it('envía el token en el header Authorization', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })
    )
    vi.stubGlobal('fetch', fetchMock)
    await invocarFuncion('editar-usuario', { userId: 'u1' })
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers.Authorization).toBe('Bearer tok-123')
    expect(opts.method).toBe('POST')
  })
})
