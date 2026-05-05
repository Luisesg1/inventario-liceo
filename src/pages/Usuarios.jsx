import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import "./Usuarios.css";

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crear-usuario`;

const COLORES_ROL = {
  admin: { bg: "#dbeafe", color: "#1d4ed8", label: "Admin" },
  editor: { bg: "#ede9fe", color: "#6d28d9", label: "Editor" },
  encargado: { bg: "#f3f4f6", color: "#4b5563", label: "Encargado" },
};

export default function Usuarios({ usuario }) {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Estado formulario de creación
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ nombre: "", email: "", password: "", rol: "encargado" });
  const [creando, setCreando] = useState(false);
  const [errorForm, setErrorForm] = useState(null);
  const [exitoForm, setExitoForm] = useState(null);

  // Estado para cambio de rol
  const [cambiandoRol, setCambiandoRol] = useState(null);

  // Estado para eliminación con confirmación modal
  const [eliminando, setEliminando] = useState(null);
  const [confirmEliminar, setConfirmEliminar] = useState(null); // { id, nombre }

  // Estado para edición
  const [editando, setEditando] = useState(null); // id del usuario que se está editando
  const [formEditar, setFormEditar] = useState({ nombre: "", email: "", password: "" });
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState(null);

  // esAdmin: usa la lista cargada como fuente de verdad (más confiable que el prop)
  const usuarioEnLista = usuarios.find((u) => u.id === usuario?.id);
  const esAdmin = (usuarioEnLista?.rol ?? usuario?.rol) === "admin";

  useEffect(() => {
    cargarUsuarios();
  }, []);

  async function cargarUsuarios() {
    setCargando(true);
    setError(null);
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .order("nombre");
    if (error) {
      setError("No se pudieron cargar los usuarios.");
    } else {
      setUsuarios(data || []);
    }
    setCargando(false);
  }

  // ─── Crear usuario via Edge Function ────────────────────────────────────────
  async function handleCrearUsuario(e) {
    e.preventDefault();
    setCreando(true);
    setErrorForm(null);
    setExitoForm(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setErrorForm("Tu sesión expiró. Por favor recarga la página.");
        setCreando(false);
        return;
      }

      const res = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorForm(json.error || "Error al crear el usuario.");
      } else {
        setExitoForm(`Usuario "${json.usuario.nombre}" creado exitosamente.`);
        setForm({ nombre: "", email: "", password: "", rol: "encargado" });
        await cargarUsuarios();
        setTimeout(() => {
          setMostrarForm(false);
          setExitoForm(null);
        }, 2000);
      }
    } catch (err) {
      setErrorForm("Error de red al contactar el servidor.");
    } finally {
      setCreando(false);
    }
  }

  // ─── Cambiar rol ────────────────────────────────────────────────────────────
  async function handleCambiarRol(id, nuevoRol) {
    setCambiandoRol(id);
    const { error } = await supabase
      .from("usuarios")
      .update({ rol: nuevoRol })
      .eq("id", id);
    if (!error) {
      setUsuarios((prev) =>
        prev.map((u) => (u.id === id ? { ...u, rol: nuevoRol } : u))
      );
    }
    setCambiandoRol(null);
  }

  // ─── Confirmar eliminación ───────────────────────────────────────────────────
  function handleSolicitarEliminar(u) {
    setConfirmEliminar({ id: u.id, nombre: u.nombre });
  }

  async function handleEliminarConfirmado() {
    if (!confirmEliminar) return;
    setEliminando(confirmEliminar.id);
    const { error } = await supabase.from("usuarios").delete().eq("id", confirmEliminar.id);
    if (!error) {
      setUsuarios((prev) => prev.filter((u) => u.id !== confirmEliminar.id));
    }
    setEliminando(null);
    setConfirmEliminar(null);
  }

  // ─── Editar usuario ─────────────────────────────────────────────────────────
  function handleAbrirEdicion(u) {
    setEditando(u.id);
    setFormEditar({ nombre: u.nombre, email: u.email, password: "" });
    setErrorEdicion(null);
  }

  function handleCerrarEdicion() {
    setEditando(null);
    setFormEditar({ nombre: "", email: "", password: "" });
    setErrorEdicion(null);
  }

  async function handleGuardarEdicion(id) {
    setGuardandoEdicion(true);
    setErrorEdicion(null);

    const updates = { nombre: formEditar.nombre, email: formEditar.email };

    const { error } = await supabase
      .from("usuarios")
      .update(updates)
      .eq("id", id);

    if (error) {
      setErrorEdicion("Error al guardar los cambios.");
    } else {
      setUsuarios((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...updates } : u))
      );
      // Si hay nueva contraseña, actualizarla via auth admin (requeriría Edge Function)
      // Por ahora solo actualizamos nombre y email en la tabla
      handleCerrarEdicion();
    }

    setGuardandoEdicion(false);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>

      {/* ── Modal de confirmación de eliminación ── */}
      {confirmEliminar && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "#fff", borderRadius: 14, padding: 28,
            maxWidth: 380, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 600, textAlign: "center" }}>
              ¿Eliminar usuario?
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#6b7280", textAlign: "center" }}>
              Estás a punto de eliminar a <strong>{confirmEliminar.nombre}</strong>. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setConfirmEliminar(null)}
                style={{
                  flex: 1, border: "1px solid #d1d5db", background: "#fff",
                  borderRadius: 8, padding: "10px 0", cursor: "pointer",
                  fontWeight: 500, fontSize: 14,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarConfirmado}
                disabled={!!eliminando}
                style={{
                  flex: 1, background: eliminando ? "#fca5a5" : "#dc2626",
                  color: "#fff", border: "none", borderRadius: 8,
                  padding: "10px 0", cursor: eliminando ? "not-allowed" : "pointer",
                  fontWeight: 500, fontSize: 14,
                }}
              >
                {eliminando ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Gestión de usuarios</h2>
        {esAdmin && (
          <button
            onClick={() => { setMostrarForm(!mostrarForm); setErrorForm(null); setExitoForm(null); }}
            style={{
              background: "#2563eb", color: "#fff", border: "none",
              borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 500,
            }}
          >
            {mostrarForm ? "Cancelar" : "+ Nuevo usuario"}
          </button>
        )}
      </div>

      {/* ── Formulario de creación ── */}
      {mostrarForm && esAdmin && (
        <form
          onSubmit={handleCrearUsuario}
          style={{
            background: "#f9fafb", border: "1px solid #e5e7eb",
            borderRadius: 12, padding: 24, marginBottom: 24,
          }}
        >
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Crear nuevo usuario</h3>

          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={estiloLabel}>
                Nombre
                <input
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Nombre completo"
                  style={estiloInput}
                />
              </label>
              <label style={estiloLabel}>
                Rol
                <select
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value })}
                  style={estiloInput}
                >
                  <option value="encargado">Encargado</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>
            <label style={estiloLabel}>
              Correo electrónico
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="correo@liceo.cl"
                style={estiloInput}
              />
            </label>
            <label style={estiloLabel}>
              Contraseña
              <input
                required
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                style={estiloInput}
              />
            </label>
          </div>

          {errorForm && (
            <p style={{ color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", margin: "12px 0 0", fontSize: 14 }}>
              {errorForm}
            </p>
          )}
          {exitoForm && (
            <p style={{ color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", margin: "12px 0 0", fontSize: 14 }}>
              ✓ {exitoForm}
            </p>
          )}

          <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setMostrarForm(false)}
              style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creando}
              style={{
                background: creando ? "#93c5fd" : "#2563eb",
                color: "#fff", border: "none", borderRadius: 8,
                padding: "8px 20px", cursor: creando ? "not-allowed" : "pointer", fontWeight: 500,
              }}
            >
              {creando ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      )}

      {/* ── Lista de usuarios ── */}
      {cargando ? (
        <p style={{ color: "#6b7280", textAlign: "center", padding: 40 }}>Cargando usuarios...</p>
      ) : error ? (
        <p style={{ color: "#dc2626", textAlign: "center", padding: 40 }}>{error}</p>
      ) : (
        <div className="usuarios-lista" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {usuarios.map((u) => {
            const esYo = u.id === usuario?.id;
            const esEsteAdmin = u.rol === "admin";
            const colRol = COLORES_ROL[u.rol] || COLORES_ROL.encargado;
            const estaEditando = editando === u.id;

            return (
              <div
                key={u.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  opacity: eliminando === u.id ? 0.5 : 1,
                  transition: "opacity 0.2s",
                  overflow: "hidden",
                }}
              >
                {/* Fila principal */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px",
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: colRol.bg, color: colRol.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 600, fontSize: 16, flexShrink: 0,
                  }}>
                    {u.nombre?.charAt(0).toUpperCase() || "?"}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                      {u.nombre}
                      {esYo && (
                        <span style={{ fontSize: 11, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "1px 6px" }}>
                          Tú
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.email}
                    </div>
                  </div>

                  {/* Selector de rol — bloqueado para el admin propio */}
                  <select
                    value={u.rol}
                    disabled={cambiandoRol === u.id || esYo || !esAdmin}
                    onChange={(e) => handleCambiarRol(u.id, e.target.value)}
                    style={{
                      border: "none", borderRadius: 6, padding: "4px 8px",
                      background: colRol.bg, color: colRol.color,
                      fontWeight: 500, fontSize: 13,
                      cursor: (esYo || !esAdmin) ? "not-allowed" : "pointer",
                      appearance: "none",
                      // Mostrar flecha solo si el admin puede cambiarlo
                      paddingRight: (esAdmin && !esYo) ? 20 : 8,
                    }}
                  >
                    <option value="encargado">Encargado</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>

                  {/* Acciones — solo admin, no sobre sí mismo */}
                  {esAdmin && !esYo && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {/* Botón editar */}
                      <button
                        onClick={() => estaEditando ? handleCerrarEdicion() : handleAbrirEdicion(u)}
                        title="Editar usuario"
                        style={{
                          background: estaEditando ? "#e0e7ff" : "none",
                          border: estaEditando ? "1px solid #c7d2fe" : "none",
                          color: estaEditando ? "#4338ca" : "#9ca3af",
                          cursor: "pointer", padding: "4px 8px",
                          borderRadius: 6, flexShrink: 0, fontSize: 14,
                        }}
                      >
                        ✏️
                      </button>

                      {/* Botón eliminar */}
                      <button
                        onClick={() => handleSolicitarEliminar(u)}
                        title="Eliminar usuario"
                        style={{
                          background: "none", border: "none",
                          color: "#9ca3af", cursor: "pointer",
                          padding: "4px 8px", borderRadius: 6, flexShrink: 0,
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>

                {/* Panel de edición inline */}
                {estaEditando && esAdmin && (
                  <div style={{
                    borderTop: "1px solid #e5e7eb",
                    padding: "16px",
                    background: "#f9fafb",
                  }}>
                    <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                      Editar datos del usuario
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <label style={estiloLabel}>
                        Nombre
                        <input
                          value={formEditar.nombre}
                          onChange={(e) => setFormEditar({ ...formEditar, nombre: e.target.value })}
                          style={estiloInput}
                        />
                      </label>
                      <label style={estiloLabel}>
                        Correo electrónico
                        <input
                          type="email"
                          value={formEditar.email}
                          onChange={(e) => setFormEditar({ ...formEditar, email: e.target.value })}
                          style={estiloInput}
                        />
                      </label>
                    </div>
                    <label style={{ ...estiloLabel, marginBottom: 12 }}>
                      Nueva contraseña <span style={{ color: "#9ca3af", fontWeight: 400 }}>(dejar vacío para no cambiar)</span>
                      <input
                        type="password"
                        value={formEditar.password}
                        onChange={(e) => setFormEditar({ ...formEditar, password: e.target.value })}
                        placeholder="Mínimo 6 caracteres"
                        minLength={6}
                        style={estiloInput}
                      />
                    </label>

                    {errorEdicion && (
                      <p style={{ color: "#dc2626", fontSize: 13, margin: "0 0 10px" }}>{errorEdicion}</p>
                    )}

                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        onClick={handleCerrarEdicion}
                        style={{
                          border: "1px solid #d1d5db", background: "#fff",
                          borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13,
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleGuardarEdicion(u.id)}
                        disabled={guardandoEdicion}
                        style={{
                          background: guardandoEdicion ? "#93c5fd" : "#2563eb",
                          color: "#fff", border: "none", borderRadius: 8,
                          padding: "7px 16px", cursor: guardandoEdicion ? "not-allowed" : "pointer",
                          fontWeight: 500, fontSize: 13,
                        }}
                      >
                        {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const estiloLabel = {
  display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 500, color: "#374151",
};
const estiloInput = {
  border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px",
  fontSize: 14, outline: "none", background: "#fff", width: "100%", boxSizing: "border-box",
};