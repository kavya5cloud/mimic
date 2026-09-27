# Mimic

**Mimic the expert.** An AI layer on your desktop that sees your screen, listens to your voice, flies its own cursor to exactly where you need to act, and talks you through it, in any app.

> Hold a key. Ask out loud. Mimic shows you, on your own screen.

---

## What it does

- **Ask:** "Where's the export button?" Mimic's cursor flies to it and a short spoken answer explains what to do.
- **Guide:** Follow expert workflows step by step ("Make a pivot table in Excel"). Mimic points at each step and checks that you did it.
- **Do:** *(coming later)* Mimic performs a single action after you explicitly confirm it.

Mimic works across every app, including native apps with no API, plugin, or web page to hook into.

## Features

- Push-to-talk voice interaction (hold to speak, release to ask)
- Screen-aware answers from hotkey-triggered screenshots
- Mimic's own animated cursor, drawn in a click-through overlay (your real mouse is never moved)
- The **Island**: a Dynamic Island-style status hub at the top of the screen. It blends into the notch on MacBooks and floats as a glass pill on Windows and other displays.
- Live captions alongside spoken responses
- Multi-display and mixed-DPI support
- Cancel anytime: press the hotkey again or hit `Esc`
- Glass design system with support for reduced motion and reduced transparency

## Platforms

| Platform | Status |
|---|---|
| Windows 11 | Supported (first-class) |
| Windows 10 (2004+) | Supported (glass falls back to non-native blur) |
| macOS 13+ | Supported, including notch integration |

## How it works

```
hold hotkey ─▶ capture screenshot + start mic
release     ─▶ speech-to-text ─▶ AI (screenshot + transcript + short history)
            ─▶ [POINT] tag streams first ─▶ Mimic cursor flies to target
            ─▶ spoken answer ─▶ text-to-speech + captions in the Island
            ─▶ cursor returns to following your mouse
```

The AI only **proposes** where to point. Deterministic code in the desktop app validates every proposal before anything happens on screen: stale screens, cancelled requests, and out-of-bounds coordinates are all rejected.

### Protocol (v1)

```
[POINT:x,y:label]            point on the cursor's screen
[POINT:x,y:label:screen2]    point on another screen
[POINT:none]                 no pointing needed
[NOTFOUND:thing]             target not visible
[STEP_DONE] / [STEP_NOT_DONE]  Guide mode verification
```

## Architecture

| Layer | Tech |
|---|---|
| Desktop app | Electron (overlays, Island, capture, hotkeys, audio) |
| Backend / API | Next.js (auth, API proxy, prompts, usage metering, rate limiting) |
| Database | Neon PostgreSQL |
| Auth | Better Auth (Google sign-in via system browser) |
| AI reasoning | Anthropic |
| Speech | OpenAI (speech-to-text and text-to-speech) |

Provider API keys live only on the server. The desktop app never talks to AI providers directly.

## Getting started

### Prerequisites

- Node.js 20+
- A Neon PostgreSQL database
- Anthropic and OpenAI API keys
- Google OAuth credentials (for sign-in)

### 1. Install

```bash
git clone https://github.com/<your-org>/mimic.git
cd mimic
npm install
```

### 2. Configure environment

Create `.env` for the web backend:

```bash
DATABASE_URL=postgres://...          # Neon pooled connection string
BETTER_AUTH_SECRET=...               # long random string
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

No provider keys go in the desktop app's environment.

### 3. Run

```bash
# backend
npm run dev:web

# desktop app (in another terminal)
npm run dev:desktop
```

To run the full loop without real provider keys, start the backend with the mock provider:

```bash
MIMIC_PROVIDER=mock npm run dev:web
```

> Script names are examples. Match them to the scripts in `package.json`.

### 4. Grant permissions

- **macOS:** Screen Recording, Microphone, and Input Monitoring (for hold-to-talk). Restart Mimic after granting Screen Recording.
- **Windows:** Microphone access in Settings → Privacy & security → Microphone.

Permissions are tied to the app's code signature. Use signed builds when testing permissions, or they may reset on every rebuild.

## Usage

1. Hold the hotkey (default configurable in Settings) and ask your question.
2. Release. The Island shows Mimic thinking, then the cursor flies to the answer while Mimic speaks.
3. Press the hotkey again or `Esc` to interrupt at any time.
4. Open the Island to browse Guide workflows, recent answers, and settings.

## Privacy

- Mimic captures your screen **only while you hold the hotkey**. Never in the background.
- Screenshots and audio are not stored on your device or our servers.
- We do not log screenshots, audio, transcripts, prompts, or AI responses. Only metadata such as latency and error types is recorded.
- Mimic's own windows are hidden from screen capture, so they're also hidden from your screen shares and recordings.
- Text on your screen is treated as content, never as instructions to Mimic.

Screenshots and transcripts are sent to our AI providers (Anthropic, OpenAI) to generate responses, subject to their API data policies.

## Development

```bash
npm run typecheck
npm test
npm run build
```



## Roadmap

- [x] Voice → AI → pointing → speech loop (mock provider)
- [ ] Real provider validation and grounding accuracy eval
- [ ] The Island (all states, notch + Windows pill)
- [ ] Glass design system and Mimic cursor
- [ ] Guide mode with expert workflows
- [ ] Signed builds, auto-update, crash reporting
- [ ] Private beta
- [ ] Do mode (confirmed actions)
- [ ] Expert workflow recorder and creator marketplace

## License

Proprietary. All rights reserved.
