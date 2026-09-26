declare global {
  interface Window {
    mimicDesktop?: {
      getAuthRedirect(): Promise<{ redirectTo: string }>;
      openExternal(url: string): Promise<void>;
      captureScreen(): Promise<{ displayId: number; width: number; height: number; dataUrl: string }>;
      setSession(accessToken: string | null): Promise<void>;
      getSession(): Promise<string | null>;
      getApiBase(): Promise<string>;
      setOverlayInteractive(interactive: boolean): Promise<void>;
      onAuthCallback(callback: (url: string) => void): () => void;
      onShortcut(callback: (event: 'ptt-down'|'ptt-up'|'ask-toggle') => void): () => void;
      onCursorPosition(callback: (position: {displayId: number; x: number; y: number}) => void): () => void;
    };
  }
}
export {};
