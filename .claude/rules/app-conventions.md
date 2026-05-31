# Service-Layer Conventions (Nexus DGA)

Adapted from Zincro's app-conventions. Zincro's version is mostly multi-app frontend doctrine (tri-token auth, `pages/`, CLI catalog) that **has no Nexus analog** — Nexus is a single Express API + one Vite web app with one HMAC session. Only the backend service-layer + observability spirit carries over. Applies to `apps/api/src/services/**`.

## Singletons + ctx threading
- A Governor/Resolver/Workflow is a class with a **singleton export**: `export const recordGovernor = new RecordGovernor()`. Callers import the instance, never `new` it.
- Identity flows through one object: `ActorContext` (`apps/api/src/substrate/actor.ts`), built by `actorContext(req)` from the existing scope. Never thread loose `userId`/`role` args — pass `ctx`. Reuse the existing `requireScope`/`requireEditor` gates ([scope-model](scope-model.md)); the DGA does **not** introduce a parallel auth.

## Handlers stay thin
Routes/handlers do: gate (`requireScope`/`requireEditor`) → build `ctx` → call one governor/resolver/workflow → return JSON. No business logic, no SQL in handlers ([db-layer](db-layer.md) N4). A handler is "migrated" when it delegates to a compiled `dist/services/...` entry; the route URL never changes.

## Errors
Governors throw plain `Error` with a human message for business rejections; the handler maps to HTTP (validation/precondition → 400/409, not-found → 404). Don't invent an error-class hierarchy — match the existing handler error shape.

## Observability
Server-side: keep using the existing logging; governors `console.log` their event emissions (the EventBus already does). Don't add a telemetry framework — Nexus has none and Zincro's `frontend_errors`/CLI stack is out of scope here.

## What we deliberately did NOT port
Tri-token auth, `pages/`/`features/` placement, `ShellRenderer`, `client-api.ts` per-app pattern, the `zincro` CLI, SSE `useLiveStream` — none exist in Nexus. If a chat/AI surface lands later (Action/Resolver scanners are built for it), revisit.
