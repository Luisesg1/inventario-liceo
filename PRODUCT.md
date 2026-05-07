# Product — Sistema de Inventario Liceo Bicentenario JHJ

## Qué es

Aplicación web interna para gestionar el inventario de bienes del Liceo Bicentenario Juan Haroldo Johansson (JHJ), una institución educativa chilena. Reemplaza hojas de cálculo manuales con un sistema centralizado y multiusuario.

## Usuarios

- **Administradores**: acceso total — crear/editar/eliminar bienes, categorías y usuarios
- **Operadores**: acceso de solo lectura o edición limitada — consultar inventario e imprimir fichas

## Funcionalidades principales

1. **Inventario de bienes** — registro con nombre, categoría, estado, ubicación, responsable, código, observaciones. Para computadores: marca, modelo, número de serie, licencias de software.
2. **Categorías personalizables** — con ícono emoji, ordenables por drag & drop, con pin para favoritos
3. **Dashboard con estadísticas** — KPIs totales, gráfico donut de estado, barras por categoría, grilla de categorías, tabla de bienes que requieren atención
4. **Filtros avanzados** — búsqueda por texto, estado (Bueno / Regular / Malo / Baja), categoría
5. **Importación CSV** — carga masiva de bienes con previsualización y validación
6. **Exportación PDF** — ficha de bien individual para impresión o archivo
7. **Gestión de usuarios** — crear cuentas, asignar roles, sistema de contraseña temporal con cambio forzado al primer login
8. **Responsive** — funciona en escritorio, tablet y celular

## Stack

- React 18 + Vite (frontend)
- Supabase (PostgreSQL + Auth + Edge Functions)
- CSS puro con clases (sin framework de estilos)
- Recharts (gráficos)

## Contexto de uso

La app corre en el navegador dentro del establecimiento. Los usuarios son funcionarios del liceo, no técnicos. La interfaz debe ser clara, directa y digna — refleja la identidad institucional del colegio.
