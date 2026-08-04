export const MIN_POINT_DIST = 2;
export function thinStrokePoints(points: string[], minDist = MIN_POINT_DIST): string[] {
  if (!points || points.length < 3) return points || [];
  const out: string[] = [points[0]];
  let [lx, ly] = points[0].split(',').map(Number);
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i].split(',').map(Number);
    const dx = x - lx, dy = y - ly;
    if (dx * dx + dy * dy >= minDist * minDist) { out.push(points[i]); lx = x; ly = y; }
  }
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
export function simplifyStroke(points: string[], epsilon = 1.2): string[] {
  if (!points || points.length < 3) return points ? points.slice() : [];
  const pts = points.map(p => p.split(',').map(Number));
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [sx, sy] = pts[s]; const [ex, ey] = pts[e];
    const dx = ex - sx, dy = ey - sy; const len = Math.hypot(dx, dy) || 1;
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = pts[i];
      const d = Math.abs(dx * (py - sy) - dy * (px - sx)) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > epsilon && idx > -1) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return points.filter((_, i) => keep[i]);
}
export const compactStroke = (points: string[], canvasW: number, canvasH: number): string[] =>
  simplifyStroke(thinStrokePoints(points, 1.5), 1.2)
    .map(p => { const [x, y] = p.split(',').map(Number); return `${(x / canvasW).toFixed(3)},${(y / canvasH).toFixed(3)}`; });
export const denormalizePoints = (points: string[], canvasW: number, canvasH: number): string[] =>
  points.map(p => { const [x, y] = p.split(',').map(Number); return `${Math.round(x * canvasW)},${Math.round(y * canvasH)}`; });
