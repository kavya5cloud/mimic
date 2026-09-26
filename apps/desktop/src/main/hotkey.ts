import { uIOhook, UiohookKey } from 'uiohook-napi';
import type { BrowserWindow } from 'electron';

type KeyEvent = { ctrlKey: boolean; altKey: boolean; metaKey: boolean; shiftKey: boolean; keycode: number };
export type ShortcutEvent = 'ptt-down' | 'ptt-up' | 'ask-toggle';

export function startGlobalShortcuts(target: () => BrowserWindow | null) {
  let pttActive = false;
  const send = (event: ShortcutEvent) => target()?.webContents.send('mimic://shortcut', event);
  const onKeyDown = (event: KeyEvent) => {
    if (event.ctrlKey && event.altKey && !pttActive) { pttActive = true; send('ptt-down'); }
    if (event.keycode === UiohookKey.Space && event.shiftKey && (event.ctrlKey || event.metaKey)) send('ask-toggle');
  };
  const onKeyUp = (event: KeyEvent) => {
    if (pttActive && !event.ctrlKey && !event.altKey) { pttActive = false; send('ptt-up'); }
  };
  uIOhook.on('keydown', onKeyDown as never);
  uIOhook.on('keyup', onKeyUp as never);
  uIOhook.start();
  return () => { uIOhook.off('keydown', onKeyDown as never); uIOhook.off('keyup', onKeyUp as never); uIOhook.stop(); };
}
