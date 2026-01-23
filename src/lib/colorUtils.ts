/**
 * Utility functions for color conversion and manipulation
 */

/**
 * Convert HEX color to HSL format
 * @param hex - HEX color string (e.g., "#FF5733")
 * @returns HSL string (e.g., "12 100% 60%")
 */
export function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace("#", "");

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  const hue = Math.round(h * 360);
  const saturation = Math.round(s * 100);
  const lightness = Math.round(l * 100);

  return `${hue} ${saturation}% ${lightness}%`;
}

/**
 * Convert HSL to HEX format for color pickers
 * @param hsl - HSL string (e.g., "12 100% 60%")
 * @returns HEX string (e.g., "#FF5733")
 */
export function hslToHex(hsl: string): string {
  const parts = hsl.split(" ");
  const h = parseInt(parts[0]) / 360;
  const s = parseInt(parts[1]) / 100;
  const l = parseInt(parts[2]) / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Validate if a color string is in valid HSL format
 * @param hsl - HSL string to validate
 * @returns true if valid HSL format
 */
export function isValidHSL(hsl: string): boolean {
  const hslRegex = /^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/;
  return hslRegex.test(hsl);
}

/**
 * Validate if a color string is in valid HEX format
 * @param hex - HEX string to validate
 * @returns true if valid HEX format
 */
export function isValidHex(hex: string): boolean {
  const hexRegex = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(hex);
}
