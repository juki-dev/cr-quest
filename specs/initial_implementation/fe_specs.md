# Especificación técnica — Frontend

Traduce [pm_specs.md](pm_specs.md) en arquitectura y tareas concretas para `/frontend`, apoyado en el contrato de API definido en [be_specs.md § 4](be_specs.md#4-contrato-de-api) (fuente única de verdad de los endpoints — no se redefine aquí). Igual que en be_specs, lo marcado **🔎 Hallazgo** es un vacío que pm_specs no resolvía y que esta especificación cierra.

Convención de IDs: `FE-<área>.<n>`.

---

## 1. Decisiones de arquitectura (ADR-lite)

### ADR-1 · Next.js App Router
**Decisión:** Next.js 15+, App Router, React Server Components donde no hay interactividad (layout, disclaimer, shell de `/ranking`) y Client Components donde sí la hay (área de práctica, formularios).
**Por qué:** es el modelo soportado activamente por Next.js; server components reducen el JS que baja al cliente en las partes estáticas.

### ADR-2 · Autenticación: formularios propios contra la API de Cognito, no Hosted UI
**Decisión:** llamadas server-side a Cognito (`InitiateAuth`, `SignUp`, `ConfirmSignUp` vía `@aws-sdk/client-cognito-identity-provider`) desde Route Handlers de Next.js, con pantallas de registro/login propias en español.
**Alternativa descartada:** Cognito Hosted UI (o NextAuth con provider de Cognito apuntando al Hosted UI). Se descarta porque el Hosted UI no permite igualar el diseño del mockup ni garantizar el español al 100% sin proxys de theming adicionales — y RQ-5.15 pide explícitamente pantallas propias.
**Consecuencia:** el frontend asume la responsabilidad de manejar el flujo de contraseña y confirmación de email que Hosted UI daría gratis; se acepta ese costo por control de UX.

### ADR-3 · Los tokens de Cognito nunca llegan al JavaScript del navegador (patrón BFF)
**Decisión:** los Route Handlers de Next.js actúan como *backend-for-frontend*: reciben usuario/contraseña, llaman a Cognito, y guardan el `id token` / `refresh token` en **cookies `httpOnly`, `secure`, `sameSite=lax`**. Todas las llamadas de negocio (`/api/scenarios/next`, `/api/attempts`, etc.) también pasan por Route Handlers que leen la cookie server-side, adjuntan el `Authorization: Bearer` hacia la API Gateway real, y renuevan el token con el refresh token cuando expira.
**Por qué:** si el JWT vive en `localStorage` o en JS accesible, cualquier XSS lo roba. Con `httpOnly` el navegador nunca puede leerlo. El costo es un salto de red adicional (browser → Next.js → API Gateway) que a la escala de 28 voluntarios es irrelevante.
**Alternativa descartada:** exponer el token al cliente y llamar a la API Gateway directo desde el navegador — menos código, pero es la superficie de robo de sesión que ADR-3 evita.

### ADR-4 · Data fetching con TanStack Query
**Decisión:** TanStack Query para todas las llamadas desde Client Components (caso actual, envío de intento, leaderboard, cola de revisión), con los Route Handlers de ADR-3 como única capa intermedia.
**Por qué:** maneja loading/error/retry/cache sin escribir ese código a mano; encaja bien con RQ-5.17 (estados de carga y error visibles).
**Alternativa descartada:** Zustand/Redux para estado global — no hay estado de cliente complejo que lo justifique; el estado real vive en el servidor (DynamoDB) y TanStack Query ya cachea eso.

### ADR-5 · Estilos: puerto directo del mockup, no un framework de utilidades nuevo
**Decisión:** el [mockup.html](../mockup.html) ya define un sistema de diseño completo (variables CSS, tipografía IBM Plex, componentes). Se porta tal cual a CSS Modules + un archivo de tokens (`:root` con las mismas custom properties), en vez de reescribirlo en Tailwind u otro sistema.
**Por qué:** cero riesgo de traducción — el mockup es el spec visual, copiarlo reduce a cero la deriva entre diseño aprobado e implementación. Introducir Tailwind aquí sería una reescritura sin beneficio funcional.

### ADR-6 · dnd-kit con tres sensores obligatorios
**Decisión:** `PointerSensor` + `KeyboardSensor` + `TouchSensor` registrados siempre juntos en el `DndContext` de la pantalla de práctica (nunca condicionalmente por dispositivo).
**Por qué:** es literalmente el motivo por el que pm_specs eligió dnd-kit sobre react-beautiful-dnd (RQ-5.3, RQ-5.4); omitir un sensor por "optimización" reintroduce el problema que la elección de librería buscaba evitar.

### ADR-7 · Hosting: AWS Amplify Hosting
**Decisión:** desplegar el frontend con AWS Amplify Hosting (soporta Next.js SSR de forma nativa, construible desde CDK con `@aws-cdk/aws-amplify-alpha`), en la misma cuenta AWS que el backend.
**Alternativa descartada:** Vercel — más simple de configurar, pero introduce un proveedor fuera del perímetro AWS que el resto del proyecto evita deliberadamente (Bedrock, Cognito, DynamoDB están todos en AWS por decisión explícita del spec original). Amplify Hosting mantiene todo bajo el mismo CDK y la misma cuenta de facturación.
**Consecuencia:** las variables de entorno del build (URL de la API Gateway, IDs de User Pool/App Client) se inyectan desde los outputs del stack de backend, no se hardcodean.

---

## 2. Estructura de carpetas

```
/frontend
  app/
    (auth)/
      login/page.tsx
      registro/page.tsx
    (protegido)/
      layout.tsx            # valida sesión, redirige a /login si no hay cookie
      practica/page.tsx      # ruta raíz autenticada — pantalla del mockup
      ranking/page.tsx
      revision/
        layout.tsx           # valida grupo instructor, 403 en cliente si no
        page.tsx             # lista de borradores
        [scenarioId]/page.tsx
    api/
      auth/login/route.ts
      auth/registro/route.ts
      auth/logout/route.ts
      auth/refresh/route.ts
      scenarios/next/route.ts      # proxy BFF -> API Gateway
      attempts/route.ts            # proxy BFF
      leaderboard/route.ts         # proxy BFF
      review/scenarios/route.ts    # proxy BFF
      review/scenarios/[id]/route.ts
  components/
    practica/
      NarrativeCard.tsx
      StepPool.tsx
      SequenceSlots.tsx
      FeedbackPanel.tsx
    sidebar/
      ProfileCard.tsx
      LeaderboardWidget.tsx
    ranking/RankingTable.tsx
    revision/ReviewQueue.tsx
    revision/ReviewDetail.tsx
    ui/                       # botones, tarjetas, disclaimer — genéricos
  lib/
    apiClient.ts              # wrapper fetch tipado para llamar a los Route Handlers propios
    cognito.ts                # llamadas server-side a Cognito (usado solo por Route Handlers)
    session.ts                # lectura/escritura de cookies httpOnly
  styles/
    tokens.css                # variables portadas del mockup
    globals.css
```

- [ ] **FE-PKG.1** · P0 · ⟵ RQ-0.1 · Paquete `/frontend` inicializado dentro del monorepo pnpm, sin dependencia directa de `@cr-quest/domain` (los datos de dominio llegan siempre vía API, nunca importados en el bundle del cliente — ver FE-DATA.5).

---

## 3. Mapa de rutas y protección por rol

| Ruta | Acceso | Server/Client | Notas |
| :--- | :--- | :--- | :--- |
| `/login`, `/registro` | Público | Server shell + Client form | ⟵ RQ-5.15 |
| `/practica` | `voluntario`, `instructor` | Client (drag&drop) | Pantalla principal del mockup, ⟵ RQ-5.1 |
| `/ranking` | Cualquier autenticado | Server (datos iniciales) + Client (refetch) | ⟵ RQ-5.11 |
| `/revision` | Solo `instructor` | Client | ⟵ RQ-5.12 |
| `/revision/[scenarioId]` | Solo `instructor` | Client | ⟵ RQ-5.13, RQ-5.14 |

- [ ] **FE-ROUTE.1** · P0 · ⟵ RQ-5.15 · `layout.tsx` del grupo `(protegido)` valida la cookie de sesión server-side (RSC) y redirige a `/login` antes de renderizar cualquier hijo — nunca depender solo de ocultar UI en el cliente.
- [ ] **FE-ROUTE.2** · P0 · ⟵ RQ-2.6, RQ-5.12 · `layout.tsx` de `/revision` lee el claim `cognito:groups` de la sesión (propagado por el Route Handler de login, ver FE-AUTH.3) y bloquea el render si no incluye `instructor`. Esto es defensa en profundidad de UI — la autorización real ya la hace el backend (BE-API.6); si un `voluntario` fuerza la URL, no debe ver contenido aunque el backend fuera a rechazarlo de todos modos.
- [ ] **FE-ROUTE.3** · P1 · **Code splitting de `/revision`**: el bundle de esa ruta no se descarga para usuarios `voluntario`, que son la mayoría.
  *Aceptación:* verificar en el analizador de bundle de Next.js que `/revision` no aparece en el chunk compartido de `/practica`.

---

## 4. Componentes — mapeo directo al mockup

Cada componente reproduce una sección exacta del mockup, referenciada por línea:

| Componente | Origen en mockup | Requerimiento |
| :--- | :--- | :--- |
| `NarrativeCard` | [mockup.html:352-361](../mockup.html#L352-L361) | RQ-5.1 |
| `StepPool` | [mockup.html:365-368](../mockup.html#L365-L368) | RQ-5.1, RQ-5.2 |
| `SequenceSlots` | [mockup.html:369-372](../mockup.html#L369-L372) | RQ-5.1, RQ-5.2 |
| `FeedbackPanel` | [mockup.html:380](../mockup.html#L380), estilos `.feedback` | RQ-5.6 |
| `ProfileCard` (sidebar) | [mockup.html:386-404](../mockup.html#L386-L404) | RQ-5.9 |
| `LeaderboardWidget` (sidebar, top parcial) | [mockup.html:406-479](../mockup.html#L406-L479) | RQ-5.10 |
| `RankingTable` (página completa) | mismo diseño de fila, sin recorte | RQ-5.11 |
| `ReviewQueue` / `ReviewDetail` | no existe en el mockup — diseño nuevo, ver FE-COMP.6 | RQ-5.12, RQ-5.13 |

- [ ] **FE-COMP.1** · P0 · ⟵ RQ-5.1 · `NarrativeCard` recibe `{ narrative: string }` y renderiza la tarjeta con el eyebrow "Caso publicado" tal como el mockup.
- [ ] **FE-COMP.2** · P0 · ⟵ RQ-5.2 · `StepPool` y `SequenceSlots` comparten estado a través del componente padre de `/practica` (no vía contexto global — el estado de drag&drop es local a esta pantalla).
- [ ] **FE-COMP.3** · P0 · ⟵ RQ-5.6 · `FeedbackPanel` recibe la respuesta completa de `POST /api/attempts` (contrato en be_specs § 4) y colorea cada slot: correcto (azul) vs incorrecto (rojo), replicando `.slot.correct` / `.slot.incorrect` del mockup.
- [ ] **FE-COMP.4** · P0 · ⟵ RQ-5.9, RQ-5.10 · `ProfileCard` y `LeaderboardWidget` consumen el mismo hook (`useLeaderboard`, ver FE-DATA.2) — sin duplicar la llamada de red entre ambos.
- [ ] **FE-COMP.5** · P1 · ⟵ RQ-5.11 · `RankingTable` reutiliza el componente de fila (`RankRow`) que también usa `LeaderboardWidget`, para que el estilo nunca diverja entre el sidebar y la página completa.
- [ ] **FE-COMP.6** · P0 · ⟵ RQ-5.13 · 🔎 Hallazgo: el mockup no cubre el panel de revisión (D2 lo agregó después). Diseño mínimo propuesto: `ReviewQueue` es una lista de tarjetas (mismo `.card` del sistema de diseño) con narrativa truncada + fecha; `ReviewDetail` muestra narrativa completa (editable si `action=publicar`) junto a la lista de `correctSequence` en modo lectura, y dos botones que reusan `.btn-primary` (Publicar) / `.btn-secondary` (Rechazar) ya definidos en el mockup — mantiene consistencia visual sin inventar un lenguaje de diseño nuevo.

---

## 5. Integración de datos

- [ ] **FE-DATA.1** · P0 · ⟵ RQ-5.1 · `useScenario()`: `useQuery` sobre `/api/scenarios/next`, `staleTime: Infinity` (el caso no cambia hasta que el usuario pide uno nuevo explícitamente — ver RQ-5.8).
- [ ] **FE-DATA.2** · P0 · ⟵ RQ-5.9, RQ-5.10 · `useLeaderboard()`: `useQuery` sobre `/api/leaderboard`, invalidado tras un `submitAttempt` exitoso que cambie `totalPoints`.
- [ ] **FE-DATA.3** · P0 · ⟵ RQ-5.6 · `useSubmitAttempt()`: `useMutation` sobre `POST /api/attempts`; en `onSuccess` invalida `useLeaderboard` y el hook de perfil.
- [ ] **FE-DATA.4** · P0 · ⟵ RQ-5.12 · `useReviewQueue()` / `useReviewAction()`: mismos patrones, solo montados dentro de `/revision`.
- [ ] **FE-DATA.5** · P0 · ⟵ RQ-4.12 · El cliente **nunca** recibe ni almacena `correctSequence` para el flujo de práctica — solo lo ve el panel de revisión, que es contenido de instructor, no de voluntario. Verificar que ningún hook de `/practica` toque ese campo aunque el backend lo expusiera por error (defensa adicional a BE-API.1).
- [ ] **FE-DATA.6** · P1 · ⟵ RQ-5.17 · Todo hook expone `{ data, isLoading, isError }` consumido de forma consistente por un componente `<AsyncBoundary>` compartido, para no repetir el manejo de estados en cada pantalla.

---

## 6. Drag-and-drop accesible (dnd-kit)

- [ ] **FE-DND.1** · P0 · ⟵ RQ-5.2, ADR-6 · `DndContext` en `/practica` con los tres sensores de ADR-6 registrados simultáneamente.
- [ ] **FE-DND.2** · P0 · ⟵ RQ-5.3 · Con `KeyboardSensor`: foco tabulable en cada chip del pool y cada slot; Espacio/Enter levanta el elemento, flechas lo mueven entre posiciones, Espacio/Enter de nuevo lo suelta — comportamiento estándar de dnd-kit, no reinventar el manejo de teclado del mockup (que usaba "click coloca en el siguiente slot vacío" como atajo adicional, no como reemplazo).
- [ ] **FE-DND.3** · P0 · ⟵ RQ-5.3 · Región `aria-live="polite"` que anuncia "Paso [label] movido a la posición [n]" en cada reordenamiento — dnd-kit expone los callbacks necesarios (`onDragEnd`) para disparar el anuncio; no viene gratis, hay que cablearlo.
- [ ] **FE-DND.4** · P0 · ⟵ RQ-5.4 · `TouchSensor` con `activationConstraint` (delay corto + tolerancia de movimiento) para que el arrastre táctil no dispare scroll de página accidentalmente.
  *Aceptación:* probado en un dispositivo táctil real, no solo en emulador de DevTools (RQ-5.4 lo exige explícitamente en pm_specs).
- [ ] **FE-DND.5** · P1 · ⟵ RQ-5.7 · Botón "Limpiar" resetea el `DndContext` devolviendo todos los pasos al pool en orden aleatorio, replicando `mockup.html:600-606`.

---

## 7. Autenticación

- [ ] **FE-AUTH.1** · P0 · ⟵ RQ-5.15, ADR-2 · Formularios de registro (email, contraseña, nombre para mostrar) y login, en español, con validación de campos antes de enviar.
- [ ] **FE-AUTH.2** · P0 · ⟵ RQ-2.9 · El campo "nombre para mostrar" del registro se envía al backend para poblar `STATS.displayName` (be_specs § 3) — sin este dato el ranking no puede mostrar nombres.
- [ ] **FE-AUTH.3** · P0 · ⟵ ADR-3 · El Route Handler de login guarda en la cookie de sesión tanto el token como el grupo (`cognito:groups`) decodificado del JWT, para que `layout.tsx` (FE-ROUTE.2) no tenga que decodificar el token en cada request.
- [ ] **FE-AUTH.4** · P0 · ⟵ ADR-3 · Renovación silenciosa: si un Route Handler de proxy recibe `401` de la API Gateway, intenta refrescar con el refresh token antes de propagar el error al cliente.
- [ ] **FE-AUTH.5** · P1 · **Confirmación de email** vía el flujo estándar de Cognito (`ConfirmSignUp`), con pantalla propia en español para ingresar el código recibido.
- [ ] **FE-AUTH.6** · P1 · Logout limpia las cookies `httpOnly` desde el Route Handler correspondiente (el cliente no puede hacerlo directamente, por diseño de ADR-3).

---

## 8. Sistema de diseño

- [ ] **FE-STYLE.1** · P0 · ⟵ ADR-5 · `styles/tokens.css` reproduce exactamente las custom properties de [mockup.html:10-21](../mockup.html#L10-L21) (`--rojo`, `--azul`, `--superficie`, etc.) — sin renombrarlas, para que cualquier futura comparación contra el mockup sea directa.
- [ ] **FE-STYLE.2** · P0 · ⟵ RQ-5.16 · Se porta el bloque `@media (prefers-reduced-motion: reduce)` ([mockup.html:25-27](../mockup.html#L25-L27)) globalmente, no solo en los componentes migrados desde el mockup.
- [ ] **FE-STYLE.3** · P0 · ⟵ RQ-5.16 · Breakpoints de layout (`grid-template-columns` de `.layout` y `.work-grid`) portados literalmente ([mockup.html:70-80](../mockup.html#L70-L80), [mockup.html:112-120](../mockup.html#L112-L120)).
- [ ] **FE-STYLE.4** · P2 · ⟵ RQ-5.18 · Tokens documentados como tal (no dispersos en cada componente) para reutilización en el panel de revisión, que es UI nueva sin equivalente en el mockup.

---

## 9. Accesibilidad y responsive

- [ ] **FE-A11Y.1** · P0 · ⟵ RQ-5.3 · Todo control interactivo (chip, slot, botón) tiene `:focus-visible` visible, portado de `mockup.html:160` y `mockup.html:219`.
- [ ] **FE-A11Y.2** · P0 · ⟵ RQ-5.4 · Layout usable desde 360px de ancho sin scroll horizontal.
- [ ] **FE-A11Y.3** · P1 · ⟵ RQ-T.5 · El disclaimer (RQ-T.5) se implementa como componente `ui/Disclaimer.tsx` presente en el layout raíz autenticado, no repetido a mano en cada página — un único punto de verdad para su texto.

---

## 10. Testing

- [ ] **FE-TEST.1** · P0 · ⟵ RQ-5.2, RQ-5.6 · Tests de componente (Testing Library + Vitest) para `SequenceSlots` y `FeedbackPanel`: reordenar, enviar incompleto (bloquea), enviar completo (colorea según respuesta mockeada).
- [ ] **FE-TEST.2** · P0 · ⟵ RQ-5.3, RQ-5.4 · Suite E2E (Playwright) que completa un escenario **solo con teclado** y otra que lo completa con eventos de puntero simulando touch — son los dos casos que pm_specs marca como criterio de aceptación explícito y que un test de componente no puede cubrir de forma creíble.
- [ ] **FE-TEST.3** · P0 · ⟵ RQ-2.7, RQ-5.12 · E2E de autorización: un usuario `voluntario` autenticado que navega a `/revision` no ve contenido de instructor (verifica FE-ROUTE.2 end-to-end, no solo la lógica aislada).
- [ ] **FE-TEST.4** · P1 · ⟵ RQ-5.17 · Tests de estados de carga/error simulando fallas de red en cada hook de la sección 5.
- [ ] **FE-TEST.5** · P2 · Test visual de regresión (captura de pantalla) sobre `/practica` para detectar deriva respecto al mockup aprobado.

---

## 11. Despliegue

- [ ] **FE-DEPLOY.1** · P0 · ⟵ ADR-7, RQ-8.1 · Stack de CDK (`@aws-cdk/aws-amplify-alpha`) que construye y despliega `/frontend`, recibiendo como variables de build los outputs del stack de backend (URL de API Gateway, `userPoolId`, `userPoolClientId`).
- [ ] **FE-DEPLOY.2** · P1 · Entornos separados de piloto y desarrollo en Amplify Hosting, cada uno apuntando a su propio stack de backend (consistente con BE-DATA de be_specs sobre entornos).

---

## 12. Checklist de trazabilidad

1. Cada componente de la sección 4 mapea a una línea concreta del mockup, o queda marcado 🔎 Hallazgo si es UI nueva (panel de revisión).
2. Ningún hook de `/practica` (sección 5) puede acceder a `correctSequence` — verificado tanto en el contrato de backend como en el cliente (defensa en profundidad).
3. Los tres sensores de dnd-kit (ADR-6) están presentes en el mismo `DndContext`, no condicionados por `userAgent` ni por tamaño de pantalla.
4. Ningún token de Cognito aparece en `localStorage`, `sessionStorage` ni en una variable de JS accesible desde DevTools — confirmar inspeccionando el Application tab del navegador contra la build real, no solo leyendo el código.
