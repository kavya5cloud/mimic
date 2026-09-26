export type CaptureTarget={displayId?:number;windowId?:number};
export interface CaptureFrame{capturedAt:number;width:number;height:number;source:CaptureTarget;data:unknown;}
export interface CaptureProvider{capture(target:CaptureTarget):Promise<CaptureFrame>;}
