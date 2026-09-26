# Mimic — Phase 2 status

Implemented:

- Protected multi-display Electron overlay (`setContentProtection(true)`).
- Ctrl+Option / Ctrl+Alt global push-to-talk through `uiohook-napi`, routed to the active display overlay.
- Cmd/Ctrl+Shift+Space type fallback, with overlay focusability toggled only while the ask box is open.
- Electron `desktopCapturer` capture abstraction; capture starts at release and excludes protected overlay content through the default native protection path.
- OpenAI transcription proxy with language auto-detection.
- Anthropic SSE normalization into plain streamed Mimic protocol text.
- Incremental `POINT/ACTION/DONE/SAY` parser.
- Idle cursor spring-follow plus quadratic Bezier fly-to with distance-based 380–900 ms duration and tap ring.
- Answer card positioned below/right of the Mimic cursor and constrained to the viewport.
- Sentence-by-sentence TTS streaming queue, with audio/request cancellation when the user talks again.
- Per-stage metadata-only telemetry: capture, STT, first token, POINT parsed, first TTS byte, audio start.
- Desktop-to-web access-token bridge so the local transparent overlay can authenticate API requests without weakening the proxy boundary.
- No screenshots, audio, full prompts, or provider responses are logged.

Prototype note: `mimic.zip` was not present in the mounted workspace, so this is not represented as a source-for-source port. The Phase 2 seams match the approved protocol and are ready to accept the prototype implementation later.
