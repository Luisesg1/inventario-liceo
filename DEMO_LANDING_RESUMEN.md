# Resumen — Demo, Landing Page y Proyecto (Inventario Liceo)

> Documento de memoria del trabajo hecho. Última actualización: 2026-07-30.

---

## 1. Artefactos publicados (Claude Artifacts)

| Artefacto | URL | Archivo fuente |
|-----------|-----|----------------|
| **Demo SaaS navegable** | https://claude.ai/code/artifact/53966726-c2c9-4889-8d3c-8b1acf33dbe1 | `scratchpad/colegium_demo.html` |
| **Landing page** | https://claude.ai/code/artifact/b4c5c6a7-422c-48f1-836d-475abb5810cb | `scratchpad/colegium_v2.html` |

Los archivos fuente viven en carpetas `scratchpad` de sesiones (temporales), NO en el repo. Para editarlos hay que re-abrir el HTML con Read/Edit y re-publicar al mismo `url`.

Ambos son **un solo HTML** con CSP que bloquea CDNs externos → todo inline (CSS, JS, SVG). Sin frameworks, sin librerías externas. Vanilla JS + CSS.

---

## 2. Identidad visual (compartida demo + landing)

- **Acento:** azul institucional. Demo dark: `--blue:#5b8cf0`. Landing/base light: `--blue:#1e4db7`.
- **Tipografía:** Inter (texto) + Space Grotesk (display) + system fallback.
- **Sistema de tokens CSS** (`:root` light + `:root[data-theme="dark"]`). Dark mode diseñado, no invertido.
- Radios, sombras, easing y badges unificados.
- **Iconografía:** Lucide inline (SVG). Motor propio `ICONS{}` + `ic(name)` + `hydrateIcons()` reemplaza placeholders `data-ic`. Grosor 2, 24×24, `currentColor`, linecap/linejoin round. **CERO emojis** en la demo.

---

## 3. Demo — estructura (igual a la app real)

**Marca:** emblema (escudo) + "Inventario" / "Liceo San Martín".
**Usuario:** Luis Soto · Administrador (avatar LS).
**Sidebar** — grupo único PRINCIPAL, orden exacto de la app real, con chevron `›`:

1. **Inicio** (dashboard) — KPIs animados, saludo "Buenos días, Luis", alertas, actividad reciente, contratos por vencer, acciones rápidas, gráfico de barras animado, distribución de cargos
2. **Inventario** — KPIs (Computadores/Proyectores/Tablets/Otros) + tabla activos (código, serie, responsable, ubicación, estado)
3. **Requerimientos** — solicitudes de compra (pendiente/aprobado/rechazado, monto, solicitante)
4. **Tickets** — mesa de ayuda (tabla: #, asunto, solicitante, fecha, prioridad, estado). *SIN* panel "Recursos de ayuda* (removido, no existe en la app real)
5. **Ausencias** — KPIs + tabla (tipo, fechas, días, reemplazante, estado)
6. **Personal** — tabla con búsqueda/filtros/paginación → clic abre **Hoja de Vida** con 7 pestañas (Personal, Contrato, Ausencias, Licencias, Documentos, Inventario, Auditoría)
7. **Reglamentos** — repositorio de documentos (tipo con badge de color, funcionario, fecha, tamaño, estado)
8. **Auditoría General** — timeline en tiempo real, filtros (módulo/usuario/texto), KPIs
9. **Papelera** — elementos eliminados, expiración 30 días, botón **Restaurar** funcional
10. **Ajustes** (configuración) — paneles con toggles: Establecimiento, Seguridad, Usuarios y roles, Notificaciones
11. **Backups** — **SOLO MANUALES** (automatización descartada). Historial, descarga, crear respaldo manual. KPIs: Último respaldo / Modo=Manual / Almacenados / Tamaño

Vistas heredadas aún accesibles (no en sidebar, sí por perfil/quick-actions): Licencias, Reemplazos, Contratos, Reportes.

### Funcionalidades demo
- SPA routing `showView(name)` + breadcrumbs
- **Tour guiado 12 pasos** (bienvenida + 11 módulos), prefocus con anillo azul en sidebar, botones Anterior/Siguiente/Omitir
- **NO hay buscador global en el topbar** (removido — la app real solo busca por categoría dentro de cada módulo)
- Panel de notificaciones
- Toasts (fondo navy fijo, funciona en light/dark, barra de color por tipo)
- Dark/light toggle, responsive (3 breakpoints: 1024/900/560)
- Contadores animados, sparklines SVG, gráfico de barras animado
- **NO hay atajos de teclado** (removidos — la app real no los tiene). Solo `Esc` cierra paneles.

### Dataset coherente (mismas personas cruzadas en todos los módulos)
Funcionarios: María González, Juan Pérez, Ana Torres, Pedro Rojas, Luis Reyes, Sofía Paredes, Rosa Quintero, Carlos Fuentes, Pamela Castillo, Roberto Silva. Admin: Luis Soto. Inspector: Ana López.

---

## 4. Landing page (`colegium_v2.html`)

- Hero con wordmark (gradiente por spans `.hw` + `.words-split`), skeleton loader, nav shrink al hacer scroll
- Secciones: beneficios, "Cómo funciona" (pasos interactivos clic→panel), FAQ, CTA final
- Animaciones premium: IntersectionObserver reveals, counters, timeline activo, chart SVG (stroke-dasharray), background drift (glow orbs), botones magnéticos, stagger
- Dark mode con tokens (todo `var(--*)`, sin `#fff` hardcodeados)
- **4 CTAs enlazan a la demo** (nueva pestaña): "Ver demo en vivo" (nav), "Explorar demo interactiva" (hero), "Explorar demo gratuita" (CTA final), "Ver demo" (footer)

---

## 5. Proyecto real (repo `inventario-liceo`)

Reglas de negocio obligatorias (ver `CLAUDE.md`):
1. **RUT = llave principal** de todo el sistema
2. No duplicados (RUT, correo, teléfono)
3. **Gestión de Usuarios = rama madre** (fuente única)
4. Registro normal → rol Docente por defecto
5. Usuarios desde Ausencias/Reemplazos → permiten asignar rol
6. Fuente única de información (no duplicar entre módulos)
7. Integridad: relaciones por RUT, cambios se reflejan sin perder histórico

Infra: migraciones SQL manuales en Supabase SQL Editor (NO `db push`); edge functions con `--no-verify-jwt`. Frontend en cPanel (`public_html/sistema.liceojhj.cl`), dominio liceojhj.cl.

---

## 6. Pendientes / notas
- Para verificar la demo visualmente hace falta login en el navegador de la herramienta (el artifact es privado).
- Si se agrega un módulo nuevo al sidebar: agregar vista `#view-X`, `BREADCRUMBS.X`, render fn, llamada en init, paso de tour, e ícono en `ICONS{}`.
- Redeploy demo/landing: Read el HTML fuente → Edit → `Artifact` con el mismo `url`.
