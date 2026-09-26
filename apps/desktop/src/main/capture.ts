import { desktopCapturer, screen } from 'electron';

export async function captureCurrentDisplay() {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: display.bounds.width, height: display.bounds.height } });
  const source = sources.find((item) => item.display_id === String(display.id)) ?? sources[0];
  if (!source) throw new Error('No screen capture source available');
  return {
    displayId: display.id,
    width: source.thumbnail.getSize().width,
    height: source.thumbnail.getSize().height,
    dataUrl: source.thumbnail.toDataURL()
  };
}
