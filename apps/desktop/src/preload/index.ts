import { setupRenderer } from '@better-auth/electron/preload';
import { contextBridge, ipcRenderer } from 'electron';

setupRenderer();

contextBridge.exposeInMainWorld('mimicDesktop', {
  captureScreen: () => ipcRenderer.invoke('mimic://capture-screen'),

  getApiBase: () => ipcRenderer.invoke('mimic://api-base'),

  setOverlayInteractive: (interactive: boolean) =>
    ipcRenderer.invoke('mimic://set-overlay-interactive', interactive),

  onShortcut: (
    callback: (event: 'ptt-down' | 'ptt-up' | 'ask-toggle') => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      shortcut: 'ptt-down' | 'ptt-up' | 'ask-toggle',
    ) => callback(shortcut);

    ipcRenderer.on('mimic://shortcut', listener);

    return () => {
      ipcRenderer.removeListener('mimic://shortcut', listener);
    };
  },

  onCursorPosition: (
    callback: (position: {
      displayId: number;
      x: number;
      y: number;
    }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      position: { displayId: number; x: number; y: number },
    ) => callback(position);

    ipcRenderer.on('mimic://cursor', listener);

    return () => {
      ipcRenderer.removeListener('mimic://cursor', listener);
    };
  },
});
