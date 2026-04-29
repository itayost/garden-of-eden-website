export const BRAND = {
  forest: "#0A1F0A",
  cream: "#FFFDF5",
  earth: "#1C1917",
  gold: "#F59E0B",
  grass: "#22C55E",
} as const;

type Rgb = readonly [number, number, number];

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) {
    throw new Error(`Expected 6-digit hex, got "${hex}"`);
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: Rgb): number {
  const [R, G, B] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const [light, dark] = lA > lB ? [lA, lB] : [lB, lA];
  return (light + 0.05) / (dark + 0.05);
}

export function meetsAA(ratio: number, large = false): boolean {
  return large ? ratio >= 3 : ratio >= 4.5;
}

export function meetsAAA(ratio: number, large = false): boolean {
  return large ? ratio >= 4.5 : ratio >= 7;
}
