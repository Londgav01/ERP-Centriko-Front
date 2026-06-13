# Auditoría de refactorización — Frontend ERP Gestión de Obra

> Fase 1 · 2026-06-11 · Rama `refactor-frontend`
> Alcance: todo `src/` (15.091 líneas en 53 archivos; ~12.600 líneas en 24 páginas).

---

## A. Código duplicado entre páginas (cuantificado)

| # | Patrón duplicado | Repeticiones | Dónde |
|---|------------------|--------------|-------|
| A1 | `fmtCOP` (función idéntica de 3 líneas con `Intl.NumberFormat('es-CO')`) | **16 definiciones** + 4 inline en el HTML de impresión de FacturasPage | Todas las páginas con dinero |
| A2 | `fmtMiles` | 3 definiciones | Materiales, Capítulos, Proyectos |
| A3 | Mapas de badge (`BADGE_ESTADO`, `BADGE`, `BADGE_PRIORIDAD`, `BADGE_NOVEDAD`, `BADGE_ESPECIALIDAD`, `BADGE_ESTADO_CT/AV`) | **17 mapas en 14 archivos**, varios con claves idénticas (ej. `BORRADOR→badge-neutral`, `ANULADO→badge-danger`) | Casi todas las páginas |
| A4 | Modal a mano (`modal-overlay` con `e.target === e.currentTarget`, header con botón X, footer Cancelar/acción con spinner) | **33 modales en 18 páginas** | Todo el ciclo documental y maestros |
| A5 | Encabezado de página (`page-header` + `page-title` + `page-subtitle` + botón "Nuevo X" condicionado por rol) | ~22 páginas | Todas |
| A6 | Estado de carga (`page-loading` + `Loader2 className="spinner"`) y estados vacíos (`search-empty-state` con icono + texto) | Presente en las 22 páginas con tabla (174 ocurrencias sumando modal/alert/spinner) | Todas |
| A7 | Manejo de error API: `err.response?.data?.error \|\| 'Error...'` + `toast.error(msg)` | **48 veces en 23 archivos** | Todas |
| A8 | Interfaces de dominio re-declaradas localmente: `Proyecto` ×8, `Edificacion` ×9, `Capitulo` ×5, `Material` ×2, `Proveedor` ×2, `Contratista` ×2 | ~28 declaraciones, **con campos inconsistentes entre copias** (ej. `Edificacion` en StockPage no tiene `proyecto_id`; `Capitulo` cambia campos según página) | Páginas |
| A9 | Constantes de negocio duplicadas: `FORMAS_PAGO` idéntica en CZ y OC; `TIPOS_CONTRATO` en CTPage (array) y ContratoDetallePage (Record); `ESTADOS` de CT repetida en ReportesPage (`ESTADOS_CT`) | ~10 archivos | CT, CZ, OC, AN, RS, Reportes |
| A10 | RBAC inline: `['ADMIN','COORDINADOR'].includes(usuario?.rol \|\| '')` y variantes (`puedeCrear`, `puedeAprobar`, `puedeGestionar`, `puedeEditar` — 4 nombres para lo mismo) | **17 ocurrencias en 13 páginas** | Ciclo documental |
| A11 | Cascada Proyecto → Edificación → Capítulo (`handleProyecto`/`handleEdificio` + `edificaciones.filter(...)` + `capitulos.filter(...)`) | 6 páginas (RS, SA, CT, Reportes, Capítulos, Dashboard) | Filtros y modales |
| A12 | Carga inicial con `Promise.all([api.get('/api/proyectos'), '/api/edificaciones', '/api/capitulos', ...])` | ~8 páginas | Ciclo documental |
| A13 | `confirm()` nativo del navegador para anular/eliminar/aprobar | **19 llamadas en 10 páginas** (mientras los formularios sí usan modal propio → inconsistencia visual) | Presupuesto, RS, CZ, OC, AV, AN, CT, Facturas, Categorías |
| A14 | Formateo de fecha `new Date(f + 'T00:00:00').toLocaleDateString('es-CO')` | ~15 ocurrencias | Tablas de documentos |
| A15 | Debounce manual con `useRef<ReturnType<typeof setTimeout>>` | 4+ páginas (Proveedores, Materiales, RS, CZ) | Búsquedas |
| A16 | `cargarLista` con filtros como parámetros (patrón correcto, pero re-escrito a mano) | **21 implementaciones** con 4 nombres distintos | Todas las páginas con lista |

**Estimación:** entre A1–A16 hay del orden de **3.500–4.500 líneas eliminables** (~30 % del código de páginas) sin tocar comportamiento.

## B. Componentes que exceden ~300 líneas y cómo dividirlos

Las 18 páginas principales exceden el umbral. Las críticas:

| Archivo | Líneas | División propuesta |
|---|---|---|
| [CTPage.tsx](../src/pages/ct/CTPage.tsx) | 1.325 | Contenedor `CTPage` (datos + lista) + 4 componentes: `CTFormModal` (nuevo contrato con selector de actividades), `CTDetalleModal`, `CTHolguraModal`, `CTEditarModal`. Constantes (`TIPOS_CONTRATO`, `ESTADOS`, badges) a `lib/constantes` |
| [PresupuestoPage.tsx](../src/pages/presupuesto/PresupuestoPage.tsx) | 1.005 | Contenedor + `ArbolCapitulo`/`ArbolSubcapitulo`/`FilaActividad` (árbol presentacional), `BarraProgreso`, y 3 modales CRUD (capítulo/sub/actividad) que comparten un `FormModal` genérico |
| [AVPage.tsx](../src/pages/av/AVPage.tsx) | 804 | Contenedor + `AVFormModal` (acta con items) + `AVDetalleModal` |
| [FacturasPage.tsx](../src/pages/facturas/FacturasPage.tsx) | 690 | Contenedor + `FacturaFormModal` + `FacturaDetalleModal` + **extraer la plantilla HTML de impresión a `utils/imprimirFactura.ts`** (hoy hay ~80 líneas de template string con `Intl.NumberFormat` inline dentro del componente) |
| [RSPage.tsx](../src/pages/rs/RSPage.tsx) | 633 | Contenedor + `RSFormModal` + `RSDetalleModal` + **`MaterialAutocomplete`** (el buscador con debounce + sugerencias + último precio es un componente completo embebido, 29 referencias `matBusqueda/matSugerencias/...`) |
| [CZPage.tsx](../src/pages/cz/CZPage.tsx) / [OCPage.tsx](../src/pages/oc/OCPage.tsx) / [SAPage.tsx](../src/pages/sa/SAPage.tsx) / [EAPage.tsx](../src/pages/ea/EAPage.tsx) | 604/589/589/584 | Mismo esquema: contenedor + FormModal + DetalleModal por página |
| [DashboardPage.tsx](../src/pages/dashboard/DashboardPage.tsx) | 563 | Contenedor + tarjetas KPI (`KpiCard`) + secciones presentacionales |
| [MaterialesPage.tsx](../src/pages/materiales/MaterialesPage.tsx) ~ [ProveedoresPage.tsx](../src/pages/proveedores/ProveedoresPage.tsx) (530–318) | — | Con los genéricos de Fase 2 bajan solas a <250 líneas sin dividirse; dividir solo si tras migrar siguen >300 |

Regla general: **contenedor** (estado, llamadas API, permisos) por página + **presentacionales** (tabla, modales, filas) que reciben props tipadas.

## C. Lógica repetida → hooks y utils propuestos

| Propuesto | Reemplaza | Notas críticas |
|---|---|---|
| `utils/formato.ts` → `fmtCOP`, `fmtMiles`, `fmtFecha` | A1, A2, A14 | Mismo `Intl.NumberFormat('es-CO')`, COP sin decimales. Restricción respetada |
| `utils/errores.ts` → `getApiError(err, fallback)` | A7 | Devuelve `err.response?.data?.error ?? fallback` |
| `lib/constantes.ts` (o carpeta `constants/`) → estados por documento, prioridades, formas de pago, tipos de contrato, mapas de badge, `ROLES` y grupos de permiso | A3, A9, A10 | **Strings copiados carácter a carácter de los existentes (tildes incluidas: `EN_EJECUCIÓN`, `ENVIADA_PROV`, `15 DÍAS`…)** |
| `types/` poblado: `types/maestros.ts`, `types/documentos.ts` | A8 | Una sola interfaz por entidad con el superset real de campos que devuelve la API; las páginas dejan de re-declararlas |
| `hooks/useListado.ts` — lista + `cargarLista(params)` + integración `usePagination` (`pag.reset()` tras cada carga) | A16 | **Mantiene el patrón de filtros como parámetros directos**: `cargar(filtros)` recibe los valores explícitos, nunca lee estado React dentro del hook |
| `hooks/useFormModal.ts` — `form/set/abrirNuevo/abrirEditar/cerrar` + `guardar` con toast y error | Lógica de formulario de las ~18 páginas | POST/PUT según `editId`; mensajes de toast configurables |
| `hooks/useCascadaUbicacion.ts` — proyecto → edificación → capítulo | A11 | Filtra en memoria sobre catálogos ya cargados (como hoy); resetea hijos al cambiar padre |
| `hooks/useDebounce.ts` (o `useBusquedaDebounced`) | A15 | 300–350 ms como hoy |
| `hooks/usePermisos.ts` — `puede('crear_rs')` o helpers `esAlguno(...roles)` | A10 | Solo encapsula los arrays actuales; **no cambia ninguna regla RBAC** |

## D. Inconsistencias de nombres y estructura

1. **Nombres de funciones**: `cargarLista` / `cargar` / `cargarTodos` / `cargarCapitulos` para la misma operación (21 casos). Unificar en `cargarLista`.
2. **Constantes de formulario**: `EMPTY` vs `EMPTY_FORM` vs `EMPTY_CAP/SUB/ACT`. Unificar en `EMPTY_FORM`.
3. **Badges**: `BADGE` vs `BADGE_ESTADO` vs `BADGE_ESTADO_CT`. Desaparecen al centralizar.
4. **Permisos**: `puedeCrear` / `puedeGestionar` / `puedeEditar` / `puedeAprobar` con significados solapados.
5. **Variables de cascada**: `edifModal` / `edifFiltradas` / `edifFilt` para lo mismo.
6. **Sidebar.tsx** usa ~100 líneas de estilos inline (objetos `style={{}}` + `onMouseEnter/Leave` manuales) mientras todo lo demás usa clases CSS — único componente así.
7. **CSS fragmentado**: 8 páginas tienen `.css` propio, el resto usa `index.css` global (414 líneas). `RSPage.css` define clases "rs-*" que en realidad son genéricas (`rs-modal-wide`, `rs-icon-close`, `rs-autocomplete-*`) y que otras páginas necesitarían. `App.css` (184 líneas) parece resto del template de Vite — verificar y eliminar si no se usa.
8. **`types/index.ts`** tiene solo 20 líneas (Rol, Usuario, ApiResponse) mientras ~28 interfaces de dominio viven duplicadas en páginas.
9. **`hooks/useProyectoFiltro.ts`**: el archivo se llama así pero exporta `useEdificacionesPorProyecto`, y usa `any[]`. Renombrar archivo o función.
10. **`: any` — 100 ocurrencias en 25 archivos**: catch de errores (aceptable con `getApiError`), `set(key: string, val: any)` de formularios, respuestas API sin tipar (`actsDisp: any[]`, `ultimosPrecios: Record<string, any>`), `exportarCSV(datos: any[])`.
11. **Confirmaciones mixtas**: `confirm()` nativo (19 casos) vs modales propios → un `ConfirmModal` genérico unifica la UX (cambio visual mínimo pero es reemplazar un diálogo del navegador por uno propio; se hace página por página y se valida).
12. **Carpetas por sigla** (`pages/rs`, `pages/cz`…) vs rutas en español (`/requisiciones`, `/cotizaciones`): se mantiene tal cual — renombrar rutas rompería bookmarks y no aporta.

## E. Estructura de carpetas propuesta

La estructura actual ya es correcta en lo macro; **no se mueven páginas**. Solo se puebla lo que falta:

```
src/
├── components/
│   ├── ui/                  ← se amplía: PageHeader, FormModal, ConfirmModal, DataTable,
│   │                          FilterBar, EstadoBadge, LoadingState, EmptyState, RowActions,
│   │                          MaterialAutocomplete (+ existentes: Pagination, NumericInput,
│   │                          AlertaProyecto, ModalInactividad)
│   └── layout/              ← sin cambios (MainLayout, Sidebar; Sidebar migra inline→CSS)
├── hooks/                   ← + useListado, useFormModal, useCascadaUbicacion, useDebounce,
│   │                          usePermisos (existentes intactos: usePagination, useInactividad)
├── lib/
│   ├── api.ts               ← intacto
│   └── constantes.ts        ← NUEVO: estados, badges, prioridades, formas de pago, roles
├── types/
│   ├── index.ts             ← re-exporta todo
│   ├── maestros.ts          ← NUEVO: Proyecto, Edificacion, Capitulo, Material, Proveedor…
│   └── documentos.ts        ← NUEVO: RS, CZ, OC, EA, SA, CT, AN, AV, Factura + detalles
├── utils/
│   ├── exportarCSV.ts       ← intacto (solo se tipa la firma si es seguro)
│   ├── formato.ts           ← NUEVO: fmtCOP, fmtMiles, fmtFecha
│   └── errores.ts           ← NUEVO: getApiError
├── context/                 ← intactos (ProyectoContext NO se toca)
└── pages/<modulo>/          ← misma ubicación; cada página adelgaza y puede ganar
                               subcomponentes locales (ej. pages/ct/CTFormModal.tsx)
```

Justificación: mover archivos genera ruido en git y riesgo sin beneficio; el problema no es dónde están las cosas sino lo que falta en `ui/`, `hooks/`, `types/` y constantes.

## F. Componentes genéricos a crear (Fase 2)

| Componente | Sustituye | Diseño |
|---|---|---|
| `PageHeader` | A5 | `title`, `subtitle`, `actions` (ReactNode) — el botón "Nuevo" sigue condicionado por rol en la página |
| `FormModal` | A4 (los 33 modales) | `open`, `title`, `onClose`, `onSubmit`, `footer` opcional, `loading`, `error`, `size`. Overlay con cierre por clic fuera idéntico al actual |
| `ConfirmModal` | A13 | Mensaje + botones confirmar/cancelar; variante peligro |
| `DataTable<T>` | A6 + tablas | `columns` tipadas, `data`, `loading`, `emptyIcon`, `emptyText`, y **recibe el objeto `pag` de `usePagination` y renderiza `<Pagination {...pag} />` adentro** — no reimplementa nada, 10 ítems/página intacto |
| `FilterBar` | filtros repetidos | Contenedor `page-filters` + selects de estado/proyecto/edificación componibles; los `onChange` siguen llamando `cargarLista(valorNuevo, …)` con parámetros directos |
| `EstadoBadge` | A3 | `<EstadoBadge estado={x} tipo="rs" />` lee el mapa central; fallback `badge-neutral` como hoy |
| `LoadingState` / `EmptyState` | A6 | Spinner `Loader2` y empty con icono/texto |
| `RowActions` | botones Ver/Editar/Aprobar/Anular por fila | Lista de acciones con icono, clase y visibilidad |
| `MaterialAutocomplete` | autocomplete de RS (y reutilizable en CZ/OC si aplica) | Debounce 300 ms, sugerencias, último precio opcional |

No se necesita **ninguna librería nueva**: todo se construye con React + lucide-react + CSS existente.

## G. Plan por fases (priorizado por impacto / riesgo)

| Fase | Contenido | Impacto | Riesgo |
|---|---|---|---|
| **2** | Fundaciones sin tocar páginas: `utils/formato`, `utils/errores`, `lib/constantes`, `types/`, hooks nuevos, componentes `ui/` nuevos. La app corre idéntica porque nada los importa aún | Alto (desbloquea todo) | Nulo |
| **3** | Piloto: migrar **ProveedoresPage** (maestro más representativo: búsqueda+debounce+filtros+modal+toggle). Valida los genéricos | Medio | Bajo |
| **4** | Resto de maestros: Materiales, Contratistas, Usuarios, Categorías, Proyectos, Edificaciones | Alto | Bajo |
| **5** | Piloto documental: **RSPage** (filtros, cascada, items, autocomplete, aprobar/rechazar/anular). Extrae `MaterialAutocomplete` y valida `ConfirmModal` | Alto | Medio |
| **6** | Ciclo de materiales: CZ, OC, EA, SA, Stock | Alto | Medio |
| **7** | Contratos: CT (la página más grande — dividir en 4 modales), ContratoDetalle, AN, AV, Facturas (extraer plantilla de impresión) | Alto | Medio |
| **8** | Presupuesto (árbol), Dashboard, Reportes, Capítulos + limpieza final (CSS huérfano, `App.css`, Sidebar inline→CSS, renombrar `useProyectoFiltro.ts`) | Medio | Medio |

Cada fase: lista de archivos creados/modificados/eliminados + checklist de verificación manual + `npm run dev` funcionando antes de continuar.

## H. Restricciones verificadas (se respetan en todo el plan)

- Contratos API y formato `{ ok, data }`: intactos (los hooks solo envuelven `api.get/post/put`).
- `usePagination` + `Pagination` (10/página): se integran en `DataTable`, no se reescriben.
- `cargarLista(filtros como parámetros)`: el hook `useListado` conserva el patrón explícitamente.
- `ProyectoContext` y su verificación de token: **no se toca**.
- Estados con tildes (`EN_EJECUCIÓN`, etc.): las constantes se copian literalmente de los archivos actuales.
- `exportarCSV` (`;` + BOM UTF-8): intacto.
- `fmtCOP` COP sin decimales `es-CO`: misma implementación, una sola vez.
- RBAC: mismos arrays de roles, solo centralizados.
- Sin librerías nuevas.
