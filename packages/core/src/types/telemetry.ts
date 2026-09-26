export type LatencyStage = 'capture'|'stt'|'first_token'|'point_parsed'|'first_tts_byte'|'audio_start';
export interface StageTelemetry { runId: string; stage: LatencyStage; durationMs: number; appVersion?: string; platform?: 'macos'|'windows'; model?: string; timestamp: string; }
