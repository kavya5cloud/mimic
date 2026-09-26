import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MIMIC_PROTOCOL_SYSTEM, MimicStreamParser, easeInOutCubic, pointingDurationMs, quadraticBezier, splitSentences } from '@mimic/core';

async function apiUrl(path: string) {
  const base = await window.mimicDesktop?.getApiBase();
  return `${base ?? ''}${path}`;
}

async function authFetch(path: string, init: RequestInit = {}) {
  const token = await window.mimicDesktop?.getSession();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(await apiUrl(path), { ...init, headers });
}

const telemetryStage = ['capture', 'stt', 'first_token', 'point_parsed', 'first_tts_byte', 'audio_start'] as const;
type TelemetryStage = typeof telemetryStage[number];

async function recordStage(stage: TelemetryStage, runStartedAt: number, runId: string) {
  const payload = {
    runId,
    stage,
    durationMs: Math.round(performance.now() - runStartedAt),
    platform: navigator.userAgent.includes('Mac') ? 'macos' : 'windows',
    model: import.meta.env.VITE_MIMIC_MODEL || undefined
  };
  try {
    await authFetch('/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), keepalive: true });
  } catch { /* telemetry never blocks the interaction */ }
}

function useSpeechQueue() {
  const queue = useRef<string[]>([]);
  const running = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    queue.current = [];
    try { sourceRef.current?.stop(); } catch { /* already ended */ }
    sourceRef.current = null;
  }, []);

  const enqueue = useCallback((text: string, runId: string, runStartedAt: number, setSpeaking: (value: boolean) => void) => {
    queue.current.push(...splitSentences(text));
    if (running.current) return;
    running.current = true;
    void (async () => {
      setSpeaking(true);
      while (queue.current.length) {
        const sentence = queue.current.shift()!;
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const response = await authFetch('/api/tts', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: sentence })
          });
          if (!response.ok || !response.body) continue;
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let total = 0;
          let firstByte = false;
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!firstByte) { firstByte = true; void recordStage('first_tts_byte', runStartedAt, runId); }
            if (value) { chunks.push(value); total += value.length; }
          }
          const audio = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) { audio.set(chunk, offset); offset += chunk.length; }
          const context = new AudioContext();
          const decoded = await context.decodeAudioData(audio.buffer);
          const source = context.createBufferSource();
          source.buffer = decoded;
          source.connect(context.destination);
          sourceRef.current = source;
          const audioStarted = performance.now();
          source.start();
          await recordStage('audio_start', runStartedAt, runId);
          await new Promise<void>((resolve) => { source.onended = () => resolve(); });
          sourceRef.current = null;
          await context.close();
        } catch { /* interrupt or transient TTS failure */ }
        finally { abortRef.current = null; }
      }
      running.current = false;
      setSpeaking(false);
    })();
  }, []);

  return { enqueue, stop };
}

function OverlayApp() {
  const [status, setStatus] = useState<'idle'|'listening'|'thinking'|'pointing'|'speaking'>('idle');
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState('');
  const [ask, setAsk] = useState('');
  const [askOpen, setAskOpen] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [position, setPosition] = useState({ x: 140, y: 110 });



  const [displayId] = useState(() => Number(new URLSearchParams(window.location.search).get('displayId') ?? '0'));

  useEffect(() => {
    const unsubscribe = window.mimicDesktop?.onCursorPosition((next) => {
      if (next.displayId !== displayId || pointModeRef.current || status !== 'idle') {
        return;
      }

      targetRef.current = { x: next.x, y: next.y };
    });

    return () => unsubscribe?.();
  }, [displayId, status]);
  console.log('Mimic overlay:', {
    displayId,
    search: window.location.search,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunks = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const runAbortRef = useRef<AbortController | null>(null);
  const currentRef = useRef({ x: 140, y: 110 });
  const targetRef = useRef({ x: 140, y: 110 });
  const pointModeRef = useRef(false);
  const pointTimerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const { enqueue: enqueueSpeech, stop: stopSpeech } = useSpeechQueue();


  useEffect(() => {
    const tick = () => {
      if (!pointModeRef.current && status === 'idle') {
        const target = targetRef.current;
        currentRef.current = target;
        setPosition(target);
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [status]);

  useEffect(() => window.mimicDesktop?.onShortcut((event) => {
    if (event === 'ptt-down') void beginListening();
    else if (event === 'ptt-up') void finishListening();
    else if (event === 'ask-toggle') {
      setAskOpen((open) => {
        const next = !open;
        void window.mimicDesktop?.setOverlayInteractive(next);
        return next;
      });
    }
  }) ?? (() => {}), []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const analyser = analyserRef.current;
      if (!analyser) return setAudioLevel(0);
      const values = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(values);
      let sum = 0;
      for (const value of values) { const normalized = (value - 128) / 128; sum += normalized * normalized; }
      setAudioLevel(Math.min(1, Math.sqrt(sum / values.length) * 4));
    }, 70);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    runAbortRef.current?.abort();
    stopSpeech();
    pointModeRef.current = false;
  }, [stopSpeech]);

  async function beginListening() {
    runAbortRef.current?.abort();
    stopSpeech();
    pointModeRef.current = false;
    if (pointTimerRef.current) window.clearTimeout(pointTimerRef.current);
    setStatus('listening');
    setTranscript('');
    setAnswer('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorderChunks.current = [];
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      recorder.ondataavailable = (event) => { if (event.data.size) recorderChunks.current.push(event.data); };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      audioContextRef.current = context;
      analyserRef.current = analyser;
    } catch {
      setStatus('idle');
      setAnswer('Microphone access is needed to talk to Mimic.');
    }
  }

  async function finishListening() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    const runId = crypto.randomUUID();
    const runStartedAt = performance.now();
    setStatus('thinking');
    const audioBlobPromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(recorderChunks.current, { type: recorder.mimeType || 'audio/webm' }));
      recorder.stop();
    });
    mediaRecorderRef.current = null;
    const captureStart = performance.now();
    const capturePromise = window.mimicDesktop!.captureScreen();
    const audioBlob = await audioBlobPromise;
    recorder.stream.getTracks().forEach((track) => track.stop());
    analyserRef.current = null;
    await audioContextRef.current?.close();
    audioContextRef.current = null;
    const sttStart = performance.now();
    const transcriptionPromise = authFetch('/api/transcribe', { method: 'POST', headers: { 'content-type': audioBlob.type }, body: audioBlob });
    const [capture, transcriptionResponse] = await Promise.all([capturePromise, transcriptionPromise]);
    await recordStage('capture', captureStart, runId);
    if (!transcriptionResponse.ok) return setStatus('idle');
    const transcription = await transcriptionResponse.json() as { text?: string };
    await recordStage('stt', sttStart, runId);
    const text = transcription.text?.trim() ?? '';
    setTranscript(text);
    if (!text) return setStatus('idle');

    const controller = new AbortController();
    runAbortRef.current = controller;
    const aiResponse = await authFetch('/api/ai', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'question',
        system: `${MIMIC_PROTOCOL_SYSTEM}\nScreenshot width=${capture.width}, height=${capture.height}.`,
        messages: [{ role: 'user', content: [{ type: 'text', text }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: capture.dataUrl.split(',')[1] } }] }]
      })
    });
    if (!aiResponse.ok || !aiResponse.body) return setStatus('idle');

    const parser = new MimicStreamParser();
    const reader = aiResponse.body.getReader();
    const decoder = new TextDecoder();
    let firstTokenSeen = false;
    let pointSeen = false;
    let sentenceBuffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!firstTokenSeen) { firstTokenSeen = true; await recordStage('first_token', runStartedAt, runId); }
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        if (event.type === 'point') {
          if (!pointSeen) { pointSeen = true; await recordStage('point_parsed', runStartedAt, runId); }
          flyTo(event.x / capture.width * innerWidth, event.y / capture.height * innerHeight);
          setStatus('pointing');
        }
        if (event.type === 'say') {
          setAnswer((previous) => previous ? `${previous} ${event.text}` : event.text);
          sentenceBuffer += `${event.text} `;
          const sentences = splitSentences(sentenceBuffer);
          while (sentences.length) {
            const sentence = sentences.shift()!;
            enqueueSpeech(sentence, runId, runStartedAt, () => setStatus('speaking'));
            sentenceBuffer = sentenceBuffer.slice(sentence.length).trimStart();
            if (!/[.!?]$/.test(sentence)) break;
          }
        }
      }
    }
    for (const event of parser.flush()) {
      if (event.type === 'say') {
        setAnswer((previous) => previous ? `${previous} ${event.text}` : event.text);
        enqueueSpeech(event.text, runId, runStartedAt, () => setStatus('speaking'));
      }
    }
    if (!pointSeen) setStatus('idle');
  }

  function flyTo(targetX: number, targetY: number) {
    const start = { ...currentRef.current };
    const perpendicular = { x: -(targetY - start.y), y: targetX - start.x };
    const length = Math.max(1, Math.hypot(perpendicular.x, perpendicular.y));
    const distance = Math.hypot(targetX - start.x, targetY - start.y);
    const bend = Math.min(140, Math.max(30, distance * 0.18));
    const control = { x: (start.x + targetX) / 2 + perpendicular.x / length * bend, y: (start.y + targetY) / 2 + perpendicular.y / length * bend };
    const duration = pointingDurationMs(start, { x: targetX, y: targetY }, { width: innerWidth, height: innerHeight });
    pointModeRef.current = true;
    const begun = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - begun) / duration);
      const eased = easeInOutCubic(progress);
      const next = quadraticBezier(start, control, { x: targetX, y: targetY }, eased);
      currentRef.current = next;
      setPosition(next);
      if (progress < 1) requestAnimationFrame(animate);
      else {
        if (pointTimerRef.current) window.clearTimeout(pointTimerRef.current);
        pointTimerRef.current = window.setTimeout(() => { pointModeRef.current = false; setStatus('idle'); }, 12_000);
      }
    };
    requestAnimationFrame(animate);
  }

  async function submitAsk(event: FormEvent) {
    event.preventDefault();
    const text = ask.trim();
    if (!text) return;
    setAsk('');
    setAskOpen(false);
    await window.mimicDesktop?.setOverlayInteractive(false);
    await runTypedQuestion(text);
  }

  async function runTypedQuestion(text: string) {
    const runId = crypto.randomUUID();
    const runStartedAt = performance.now();
    setTranscript(text);
    setAnswer('');
    setStatus('thinking');
    const captureStart = performance.now();
    const capture = await window.mimicDesktop!.captureScreen();
    await recordStage('capture', captureStart, runId);
    const aiResponse = await authFetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'question', system: `${MIMIC_PROTOCOL_SYSTEM}\nScreenshot width=${capture.width}, height=${capture.height}.`, messages: [{ role: 'user', content: [{ type: 'text', text }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: capture.dataUrl.split(',')[1] } }] }] })
    });
    if (!aiResponse.ok || !aiResponse.body) return setStatus('idle');
    const reader = aiResponse.body.getReader();
    const decoder = new TextDecoder();
    const parser = new MimicStreamParser();
    let firstTokenSeen = false;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!firstTokenSeen) { firstTokenSeen = true; await recordStage('first_token', runStartedAt, runId); }
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        if (event.type === 'point') { await recordStage('point_parsed', runStartedAt, runId); flyTo(event.x / capture.width * innerWidth, event.y / capture.height * innerHeight); setStatus('pointing'); }
        if (event.type === 'say') { setAnswer((previous) => previous ? `${previous} ${event.text}` : event.text); enqueueSpeech(event.text, runId, runStartedAt, () => setStatus('speaking')); }
      }
    }
  }

  const cardLeft = Math.min(Math.max(position.x + 40, 16), innerWidth - 316);
  const cardTop = Math.min(Math.max(position.y + 52, 16), innerHeight - 160);

  return <div className="overlay-root">
    <div className="mimic-cursor" style={{ transform: `translate3d(${position.x}px,${position.y}px,0)` }}>
      <svg viewBox="0 0 32 40" width="32" height="40" aria-hidden="true"><path d="M3 2 L3 30 L11 23 L18 37 L23 34 L16 20 L28 20 Z" fill="#111113" stroke="#fff" strokeWidth="2" strokeLinejoin="round" /></svg>
      <span className="mimic-pill"><b>Mimic</b><i>•</i>{status === 'listening' && <span className="meter">{[0,1,2,3,4].map((index) => <em key={index} style={{ height: `${4 + audioLevel * 14 * (index + 1) / 5}px` }} />)}</span>}</span>
      {status === 'pointing' && <span className="tap-ring" />}
    </div>
    {(answer || transcript) && <div className="answer-card" style={{ left: cardLeft, top: cardTop }}><small>You: {transcript}</small><p>{answer}</p></div>}
    {askOpen && <form className="ask-box" onSubmit={submitAsk}><input autoFocus value={ask} onChange={(event) => setAsk(event.target.value)} placeholder="Ask Mimic…" /><button>Send</button></form>}
  </div>;
}

function MainApp() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    window
      .getUser?.()
      .then((user) => {
        console.log('[Mimic auth] getUser result:', user ? 'SIGNED_IN' : 'SIGNED_OUT');

        if (mounted) {
          setSignedIn(Boolean(user));
          if (user) {
            setMessage('');
          }
        }
      })
      .catch((error) => {
        if (mounted) {
          setSignedIn(false);
          setMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load authentication state.',
          );
        }
      });

    const unsubscribe = window.onAuthenticated?.(() => {
      if (mounted) {
        setSignedIn(true);
        setMessage('');
      }
    });

    const unsubscribeError = window.onAuthError?.((error: unknown) => {
      if (mounted) {
        const message =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Authentication failed.';
        setMessage(message);
        setSignedIn(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe?.();
      unsubscribeError?.();
    };
  }, []);

  async function google() {
    try {
      await window.requestAuth?.({
        provider: 'google',
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Google sign-in failed.',
      );
    }
  }

  async function magicLink() {
    if (!email.trim()) {
      setMessage('Enter your email.');
      return;
    }

    setMessage('Magic-link authentication will be connected next.');
  }

  return (
    <main className="main-shell">
      <section className="settings-card">
        <img src="/logo.svg" width="44" alt="Mimic" />
        <h1>Mimic</h1>
        <p>Learn it from the best.</p>

        {!signedIn ? (
          <div className="auth-stack">
            <button onClick={google}>Continue with Google</button>

            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
            />

            <button onClick={magicLink}>Email magic link</button>
          </div>
        ) : (
          <p>
            Session established. Hold Ctrl + Option on macOS or Ctrl + Alt on
            Windows to talk.
          </p>
        )}

        {message && <small>{message}</small>}
      </section>
    </main>
  );
}

export default function App() {
  const isOverlay = new URLSearchParams(window.location.search).get('overlay') === '1';
  return isOverlay ? <OverlayApp /> : <MainApp />;
}
