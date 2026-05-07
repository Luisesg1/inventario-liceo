# Design System — Liceo Bicentenario JHJ

## Identidad visual

Los colores vienen directamente del escudo/logo institucional del liceo: azul marino profundo y dorado. La UI debe sentirse seria, confiable y elegante — propia de una institución educativa, no de una startup.

---

## Paleta de colores

### Primarios
| Token | Valor | Uso |
|-------|-------|-----|
| `navy-deep` | `#0b1545` | Fondo oscuro extremo, gradiente inicio |
| `navy-core` | `#1a237e` | Color institucional principal, headers de tabla, conteos |
| `navy-mid` | `#1e3a8f` | Variante media para gradientes |
| `navy-light` | `#0f1e6a` | Gradiente fin |

### Acento dorado
| Token | Valor | Uso |
|-------|-------|-----|
| `gold-core` | `#d4a017` | Borde activo, spinner, badges de filtro |
| `gold-deep` | `#c49012` | Inicio de gradiente en botones CTA |
| `gold-bright` | `#e6b820` | Fin de gradiente en botones CTA |
| `gold-glow` | `#f0d060` | Texto dorado sobre fondos oscuros (nav activo, bienvenida) |
| `gold-pale` | `#f0c830` | Fin de barras de progreso |

### Superficie
| Token | Valor | Uso |
|-------|-------|-----|
| `surface-white` | `#ffffff` | Cards, paneles, tabla |
| `surface-soft` | `#f8faff` | Inputs, fondos de campos |
| `surface-tint` | `#f0f2ff` | Fondo de categorías activas en grilla |
| `surface-hover` | `#f5f7ff` | Hover en filas de tabla |

### Semánticos
| Token | Valor | Uso |
|-------|-------|-----|
| `green` | `#16a34a` | Estado Bueno |
| `yellow` | `#d97706` | Estado Regular |
| `red` | `#dc2626` | Estado Malo / alertas |
| `gray` | `#9ca3af` | Estado Baja / texto secundario |

---

## Tipografía

- **Familia**: `"Segoe UI", system-ui, sans-serif`
- Sin fuentes externas (carga rápida en red escolar)

| Rol | Tamaño | Peso |
|-----|--------|------|
| Título de página (topbar) | 17px | 700 |
| Título de sección | 15–22px | 700 |
| Etiqueta de sección (uppercase) | 11px | 700, letter-spacing 0.07em |
| Cuerpo / tabla | 13–14px | 400–500 |
| Labels de campo | 11.5px | 600, uppercase |
| Código / serial | `Courier New` monospace | 12px |

---

## Layout

### Estructura global
```
.layout (flex column, 100vh)
  .topbar        — 54px, glassmorphism sobre fondo navy
  .content       — flex 1, overflow-y auto, padding 24px
```

### Sidebar
- **Posición**: fixed, overlay (no desplaza contenido)
- **Ancho**: 248px
- **Fondo**: `linear-gradient(180deg, rgba(8,15,55,0.97), rgba(14,24,80,0.97))`
- **Backdrop filter**: blur(20px)
- **Borde**: `1px solid rgba(212,160,23,0.18)` (dorado sutil)
- Se abre con botón hamburguesa; se cierra con overlay semitransparente

### Fondo global
```css
background: linear-gradient(160deg, #0b1545 0%, #1a237e 45%, #0f1e6a 100%);
```

---

## Componentes

### Cards / Paneles
- `background: #ffffff`
- `border-radius: 14px`
- `box-shadow: 0 4px 20px rgba(0,0,0,0.10–0.12)`
- KPI cards: `border-left: 4px solid #d4a017`
- Formularios: `border-top: 4px solid #d4a017`

### Tabla de datos
- Header: `linear-gradient(135deg, #1a237e, #1e3a8f)`, texto blanco 85%
- Header border-bottom: `2px solid rgba(212,160,23,0.3)`
- Celdas: `background: #fff`, `color: #111827`
- Separador: `border-bottom: 1px solid #f0f4ff`
- Hover: `background: #f5f7ff`
- Border-radius en esquinas: 14px

### Botones

| Tipo | Estilo |
|------|--------|
| **CTA principal** (Agregar, Nuevo) | Gradiente dorado `#c49012 → #e6b820`, texto navy `#0d1b5e`, bold 700 |
| **Acción primaria** (Guardar, Crear) | Gradiente navy `#1a237e → #2563eb`, texto blanco |
| **Acción secundaria** (Cancelar) | `rgba(255,255,255,0.12)`, borde sutil, texto blanco 80% |
| **Destructivo** (Eliminar) | Gradiente rojo `#dc2626 → #ef4444` |
| **Ghost** (Importar, Filtros) | `rgba(255,255,255,0.10)`, borde `rgba(255,255,255,0.22)` |

### Badges de estado
```
Bueno   → bg #dcfce7, texto #166534
Regular → bg #fef9c3, texto #854d0e
Malo    → bg #fee2e2, texto #991b1b
Baja    → bg #f3f4f6, texto #6b7280
```

### Inputs / Selects
- `background: #f8faff`, borde `#e5e7eb`
- Focus: `border-color: #1a237e`, `box-shadow: 0 0 0 3px rgba(26,35,126,0.10)`
- Border-radius: 9px

### Nav items (sidebar)
- Normal: `color: rgba(255,255,255,0.5)`
- Hover: `rgba(255,255,255,0.88)`, fondo `rgba(255,255,255,0.05)`
- Activo: `color: #f0d060`, fondo `rgba(212,160,23,0.10)`, `border-left: 3px solid #d4a017`

---

## Patrones de diseño

### Jerarquía visual sobre fondo oscuro
- Títulos de página: blanco puro `#ffffff`
- Nombre de usuario / dato destacado: dorado `#f0d060`
- Texto secundario / descriptivo: `rgba(255,255,255,0.5–0.6)`
- Todo lo que requiere legibilidad detallada va dentro de una card blanca

### Línea dorada decorativa
Se usa como acento vertical antes de títulos importantes:
```css
::before {
  content: '';
  width: 4px; height: 16px;
  background: linear-gradient(180deg, #d4a017, #f0d060);
  border-radius: 2px;
}
```

### Estado de carga
- Spinner: `border-top-color: #d4a017` sobre fondo sutil blanco/15%
- Texto: `rgba(255,255,255,0.55)`

### Responsive breakpoints
| Breakpoint | Cambio principal |
|------------|-----------------|
| ≤ 768px | Sidebar overlay, topbar compacto, padding reducido |
| ≤ 700px | Charts pasan a columna única |
| ≤ 480px | KPIs en 2 columnas, padding mínimo |
| ≤ 500px | Cards de usuario en wrap, botones apilados |

---

## Anti-patrones a evitar

- No usar texto oscuro directamente sobre el fondo navy (siempre ir a card blanca)
- No mezclar border-radius inconsistentes (usar 9px inputs, 12–14px cards)
- No usar azul genérico (`#3b82f6`, `#2563eb`) para elementos primarios — el navy `#1a237e` es el institucional
- No poner tablas sin `background: #fff` explícito — heredan el fondo navy y quedan ilegibles
- No usar foco azul genérico en inputs — usar navy con opacidad 10%
