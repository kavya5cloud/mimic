# Mimic — Phase 2 Voice + Overlay Foundation

Phase 1 contains the shared TypeScript monorepo, brand tokens/assets, Supabase auth/schema foundation, and the metered/rate-limited API boundary.

## Workspaces

- `apps/web` — Next.js App Router, auth UI/callback, and Vercel-hosted API Route Handlers.
- `apps/desktop` — Electron shell with secure deep-link auth and protected overlay window foundation.
- `packages/core` — shared Zod schemas and protocol types.
- `packages/ui` — shared design tokens and primitive UI styles.
- `supabase` — Phase 1–2 database migrations and local seed.

## Run

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm typecheck
pnpm build
```

For local Supabase development, use the Supabase CLI and apply `supabase/migrations`.

## Phase 1 scope

Included: monorepo, tokens, SVG logo/icon source, profiles/sessions/usage/skills, Google + magic-link auth scaffolding, Electron `mimic://` deep-link session handoff, API metering/rate limits, and metadata-only latency telemetry.

Excluded until Phase 5: purchases, payouts, creator revenue ledger, ratings.

## Privacy invariant

Never log screenshots, audio, full prompts, or provider responses. Telemetry contains only stage names, durations, request/run identifiers and non-content metadata.


## Supabase redirect URLs

For the desktop client, add `mimic://auth/callback` to the Supabase Auth redirect allow-list. The desktop client initiates PKCE OAuth/magic-link auth, opens the system browser, receives the custom-scheme callback, then exchanges the code in the same persisted Supabase client session.

## Vercel

`apps/web` is the Vercel deploy target. Its Next.js Route Handlers are the API proxy boundary, so web + API deploy as one application. Vercel supports streamed HTTP responses from Next.js Route Handlers. The Phase 1 API includes the authenticated, metered, rate-limited Anthropic streaming proxy. Request bodies and provider responses are never logged; only metadata telemetry is allowed.

## Phase 2

Phase 2 adds the protected desktop overlay, active-display push-to-talk, screen capture, transcription, streamed POINT/ACTION/DONE/SAY parsing, cursor motion, sentence-level TTS, interruption, type fallback, and stage telemetry.

Set `MIMIC_WEB_URL` for the desktop main window. The local transparent overlay uses the same value as its authenticated API origin and receives the current Supabase access token over the isolated Electron preload bridge.

Native dependency: `uiohook-napi` requires a desktop install/build on macOS or Windows. macOS Accessibility/Input Monitoring permissions and microphone permission are required for the corresponding features.
