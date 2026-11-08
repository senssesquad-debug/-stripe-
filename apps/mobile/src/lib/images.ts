/**
 * Pick a sensible size for remote images. Wikimedia serves thumbnails only in standard steps, so requests are
 * rounded up to the nearest one (a 1920px original for a 250px card wastes data and slows lists).
 */
const WIKIMEDIA_STEPS = [250, 330, 500, 960, 1280, 1920];

export function sizedImage(url: string, cssWidth: number, density = 2): string {
  const want = Math.ceil(cssWidth * density);
  const m = url.match(/^(https:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/)(\d+)px-([^/?]+)(\?.*)?$/);
  if (m) {
    const step = WIKIMEDIA_STEPS.find((s) => s >= want) ?? 1920;
    return `${m[1]}${step}px-${m[3]}`;
  }
  return url;
}
