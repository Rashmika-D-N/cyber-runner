// Operator coordinates run left to right in the mirrored, full camera view.
export const FULL_AREA = Object.freeze({left: 0, top: 0, right: 1, bottom: 1});
export const MIN_AREA_SIDE = 0.12;
export const AREA_KEY = 'cyber-runner-tracking-area-v1';

export function visibleInArea(p, area, confidence = .35) {
  return p?.visibility >= confidence && Number.isFinite(p.x) && Number.isFinite(p.y)
    && 1 - p.x >= area.left && 1 - p.x <= area.right && p.y >= area.top && p.y <= area.bottom;
}

export function validArea(area) {
  if (!area) return false;
  const edges = [area.left, area.top, area.right, area.bottom];
  return edges.every(n => Number.isFinite(n) && n >= 0 && n <= 1)
    && area.right - area.left >= MIN_AREA_SIDE - 1e-8
    && area.bottom - area.top >= MIN_AREA_SIDE - 1e-8;
}

export function readArea() {
  try {
    const area = JSON.parse(localStorage.getItem(AREA_KEY));
    if (validArea(area)) return area;
  } catch { /* A full frame also works when storage is unavailable. */ }
  return {...FULL_AREA};
}

// Work out the exact pixels sent to inference. The webcam pixels are unmirrored.
export function cameraCrop(area, width, height) {
  const x = Math.round((1 - area.right) * width);
  const y = Math.round(area.top * height);
  return {
    x, y, width: Math.max(1, Math.round((1 - area.left) * width) - x),
    height: Math.max(1, Math.round(area.bottom * height) - y),
    sourceWidth: width, sourceHeight: height,
  };
}

export function toFullFrame(points, crop) {
  return points.map(point => ({
    ...point, x: (crop.x + point.x * crop.width) / crop.sourceWidth,
    y: (crop.y + point.y * crop.height) / crop.sourceHeight,
    z: point.z * crop.width / crop.sourceWidth,
  }));
}
