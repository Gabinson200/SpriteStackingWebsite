// src/utils/canvasUtils.ts

// --- Export RgbaPixel interface ---
export interface RgbaPixel { r: number; g: number; b: number; a: number; }
// ---

// Remove HsvColor if it's not used anywhere, or ensure it's also exported if needed.
// export interface HsvColor { h: number; s: number; v: number; }

export function createOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
  }
  return canvas;
}

export function drawCheckerboard(ctx: CanvasRenderingContext2D, width: number, height: number, squareSize: number = 8): void {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#cccccc';
  for (let i = 0; i < width; i += squareSize * 2) {
    for (let j = 0; j < height; j += squareSize * 2) {
      ctx.fillRect(i, j, squareSize, squareSize);
      ctx.fillRect(i + squareSize, j + squareSize, squareSize, squareSize);
    }
  }
  ctx.restore();
}

export function getPixelColor(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number
): string | null {
    if (x < 0 || x >= ctx.canvas.width || y < 0 || y >= ctx.canvas.height) {
        return null;
    }
    try {
        const imageData = ctx.getImageData(x, y, 1, 1);
        const [r, g, b, a] = imageData.data;
        if (a === 0) return null;
        const toHex = (n: number): string => n.toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`.toUpperCase();
    } catch (error) {
        console.error(`Error in getPixelColor at (${x}, ${y}):`, error);
        return null;
    }
}
export function drawPixel(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    color: string,
    brushSize: number = 1
): void {
    ctx.fillStyle = color;
    const offset = Math.floor(brushSize / 2);
    const topLeftX = centerX - offset;
    const topLeftY = centerY - offset;
    ctx.fillRect(topLeftX, topLeftY, brushSize, brushSize);
}

export function clearPixel(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    brushSize: number = 1
): void {
    const offset = Math.floor(brushSize / 2);
    const topLeftX = centerX - offset;
    const topLeftY = centerY - offset;
    ctx.clearRect(topLeftX, topLeftY, brushSize, brushSize);
}
export function drawLine(
   ctx: CanvasRenderingContext2D,
   x0: number, y0: number,
   x1: number, y1: number,
   color: string,
   drawFunc: (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, color: string, brushSize: number) => void,
   brushSize: number
 ) {
   const dx = Math.abs(x1 - x0);
   const dy = Math.abs(y1 - y0);
   const sx = (x0 < x1) ? 1 : -1;
   const sy = (y0 < y1) ? 1 : -1;
   let err = dx - dy;
   let currentX = x0;
   let currentY = y0;
   while (true) {
     drawFunc(ctx, currentX, currentY, color, brushSize);
     if ((currentX === x1) && (currentY === y1)) break;
     const e2 = 2 * err;
     if (e2 > -dy) { err -= dy; currentX += sx; }
     if (e2 < dx) { err += dx; currentY += sy; }
   }
 }
export function getPixelFromImageData(imageData: ImageData, x: number, y: number): RgbaPixel | null {
    if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) { return null; }
    const index = (y * imageData.width + x) * 4;
    const data = imageData.data;
    return { r: data[index], g: data[index + 1], b: data[index + 2], a: data[index + 3] };
}
export function setPixelInImageData(imageData: ImageData, x: number, y: number, color: RgbaPixel): void {
    if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) { return; }
    const index = (y * imageData.width + x) * 4;
    imageData.data[index] = color.r; imageData.data[index + 1] = color.g;
    imageData.data[index + 2] = color.b; imageData.data[index + 3] = color.a;
}
export function areColorsEqual(color1: RgbaPixel | null, color2: RgbaPixel | null): boolean {
    if (!color1 || !color2) return color1 === color2;
    return (color1.r === color2.r && color1.g === color2.g && color1.b === color2.b && color1.a === color2.a);
}
export function compositeLayers(
    targetCtx: CanvasRenderingContext2D,
    layers: import('../state/types').Layer[], // Keep import path for Layer
    width: number, height: number, zoom: number = 1,
    options?: { applyLayerOffset?: boolean; layerOffsetXFactor?: number; layerOffsetYFactor?: number; previewScale?: number; }
): void {
    targetCtx.imageSmoothingEnabled = false;
    targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
    drawCheckerboard(targetCtx, targetCtx.canvas.width, targetCtx.canvas.height);
    const applyOffset = options?.applyLayerOffset ?? false;
    const offsetXFactor = applyOffset ? (options?.layerOffsetXFactor ?? 0) : 0;
    const offsetYFactor = applyOffset ? (options?.layerOffsetYFactor ?? 0) : 0;
    const previewScale = options?.previewScale ?? zoom;
    const numLayers = layers.length;
    for (let i = numLayers - 1; i >= 0; i--) {
        const layer = layers[i];
        if (!layer.isVisible || !layer.offscreenCanvas) continue;
        targetCtx.globalAlpha = layer.opacity;
        const depth = i;
        const offsetX = depth * offsetXFactor * previewScale;
        const offsetY = depth * offsetYFactor * previewScale;
        targetCtx.drawImage( layer.offscreenCanvas, offsetX, offsetY, width * previewScale, height * previewScale );
    }
    targetCtx.globalAlpha = 1.0;
}
