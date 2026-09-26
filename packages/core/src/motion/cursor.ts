export type Point = { x: number; y: number };

export const cursorDefaults = {
  spring: { stiffness: 260, damping: 28 },
  idleOffset: { x: 22, y: 26 },
  pointDurationMs: { min: 380, max: 900 },
  maxTiltDeg: 18
} as const;

export function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function pointingDurationMs(a: Point, b: Point, viewport: { width: number; height: number }) {
  const diagonal = Math.hypot(viewport.width, viewport.height);
  const ratio = Math.min(1, distance(a, b) / Math.max(1, diagonal));
  return Math.round(cursorDefaults.pointDurationMs.min + ratio * (cursorDefaults.pointDurationMs.max - cursorDefaults.pointDurationMs.min));
}

export function quadraticBezier(a: Point, control: Point, b: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * a.x + 2 * mt * t * control.x + t * t * b.x,
    y: mt * mt * a.y + 2 * mt * t * control.y + t * t * b.y
  };
}

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
