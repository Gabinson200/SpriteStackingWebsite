// src/utils/colorUtils.ts

export interface RgbaColor {
    r: number; // 0-255
    g: number; // 0-255
    b: number; // 0-255
    a: number; // 0-1
  }
  
  export interface HsvColor {
    h: number; // 0-360
    s: number; // 0-100
    v: number; // 0-100
  }
  
  /**
   * Parses a color string (hex3, hex4, hex6, hex8) into an RGBA object.
   * Returns null if parsing fails.
   * Does not currently support rgb() or rgba() strings.
   * @param colorString - The hex color string (e.g., #F03, #FF0033, #FF0033A0).
   * @returns An RGBA object {r, g, b, a} or null.
   */
  export function parseColor(colorString: string): RgbaColor | null {
    if (!colorString || typeof colorString !== 'string') {
      return null;
    }
  
    let hex = colorString.trim();
    if (hex.startsWith('#')) {
      hex = hex.slice(1);
    }
  
    let r: number, g: number, b: number, a: number = 1;
  
    try {
      if (hex.length === 3) { // #RGB format
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 4) { // #RGBA format
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
        a = parseInt(hex[3] + hex[3], 16) / 255;
      } else if (hex.length === 6) { // #RRGGBB format
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      } else if (hex.length === 8) { // #RRGGBBAA format
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
        a = parseInt(hex.substring(6, 8), 16) / 255;
      } else {
        return null; // Invalid hex length
      }
  
      // Validate parsed numbers
      if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) {
          return null;
      }
  
      return {
          r: Math.max(0, Math.min(255, r)),
          g: Math.max(0, Math.min(255, g)),
          b: Math.max(0, Math.min(255, b)),
          a: Math.max(0, Math.min(1, a)),
       };
  
    } catch (error) {
      console.error("Error parsing color string:", colorString, error);
      return null;
    }
  }
  
  /**
   * Converts RGBA values (0-255 for RGB, 0-1 for A) to a hex color string.
   * @param r - Red value (0-255).
   * @param g - Green value (0-255).
   * @param b - Blue value (0-255).
   * @param includeAlpha - Whether to include the alpha channel in the output (#RRGGBBAA). Defaults to false (#RRGGBB).
   * @param alpha - Alpha value (0-1). Only used if includeAlpha is true. Defaults to 1.
   * @returns The hex color string (e.g., #FF0033 or #FF0033A0).
   */
  export function rgbaToHex(r: number, g: number, b: number, includeAlpha: boolean = false, alpha: number = 1): string {
    const toHex = (value: number): string => {
      // Clamp value ensure it's an integer between 0 and 255
      const clamped = Math.max(0, Math.min(255, Math.round(value)));
      return clamped.toString(16).padStart(2, '0');
    };
  
    const hexR = toHex(r);
    const hexG = toHex(g);
    const hexB = toHex(b);
    let hexString = `#${hexR}${hexG}${hexB}`;
  
    if (includeAlpha) {
      const hexA = toHex(alpha * 255);
      hexString += hexA;
    }
  
    return hexString.toUpperCase(); // Standardize to uppercase
  }
  
  /**
   * Converts RGB color values (0-255) to HSV color values (H: 0-360, S: 0-100, V: 0-100).
   * Conversion formula adapted from https://stackoverflow.com/a/54070620
   * @param r - Red value (0-255).
   * @param g - Green value (0-255).
   * @param b - Blue value (0-255).
   * @returns An HSV object {h, s, v}.
   */
  export function rgbToHsv(r: number, g: number, b: number): HsvColor {
    r /= 255;
    g /= 255;
    b /= 255;
  
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
  
    let h = 0;
    let s = 0;
    let v = max; // Value is the max of r, g, b
  
    if (delta !== 0) {
      s = max === 0 ? 0 : (delta / max); // Saturation
  
      switch (max) {
        case r: h = (g - b) / delta + (g < b ? 6 : 0); break;
        case g: h = (b - r) / delta + 2; break;
        case b: h = (r - g) / delta + 4; break;
      }
      h *= 60; // Convert to degrees
    }
  
    return {
      h: Math.round(h),
      s: Math.round(s * 100),
      v: Math.round(v * 100),
    };
  }
  
  /**
   * Converts HSV color values (H: 0-360, S: 0-100, V: 0-100) to RGB color values (0-255).
   * Conversion formula adapted from https://stackoverflow.com/a/17243070
   * @param h - Hue value (0-360).
   * @param s - Saturation value (0-100).
   * @param v - Value (Brightness) value (0-100).
   * @returns An RGB object {r, g, b}.
   */
  export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
    s /= 100; // Normalize S and V to 0-1 range
    v /= 100;
  
    let r: number, g: number, b: number;
  
    const i = Math.floor(h / 60);
    const f = h / 60 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
  
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
      default: r = 0; g = 0; b = 0; // Should not happen
    }
  
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }