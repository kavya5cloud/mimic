import type {LatencyStage,StageTelemetry} from '@mimic/core';
export function stageTelemetry(runId:string,stage:LatencyStage,startedAt:number,metadata:Omit<StageTelemetry,'runId'|'stage'|'durationMs'|'timestamp'>={}):StageTelemetry{return{runId,stage,durationMs:Math.round(performance.now()-startedAt),timestamp:new Date().toISOString(),...metadata};}
