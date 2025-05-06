// src/utils/canvasUtils.ts

/**
 * Creates an offscreen canvas with specified dimensions.
 */
export function createOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Ensure crisp pixels - VERY important for pixel art
      ctx.imageSmoothingEnabled = false;
    }
    return canvas;
  }
  
  /**
   * Composites layers onto a target canvas (main or preview).
   * Respects visibility, opacity, and order.
   */
  export function compositeLayers(
    targetCtx: CanvasRenderingContext2D,
    layers: import('../state/types').Layer[],
    width: number,
    height: number,
    zoom: number = 1,
    options?: { applyLayerOffset?: boolean; layerOffsetFactor?: number }
  ): void {
      targetCtx.imageSmoothingEnabled = false; // Ensure crisp rendering
      targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
  
      // Draw background checkerboard pattern for transparency indication
      drawCheckerboard(targetCtx, width * zoom, height * zoom);
  
      const applyOffset = options?.applyLayerOffset ?? false;
      const offsetFactor = options?.layerOffsetFactor ?? 1;
      const numLayers = layers.length;
  
      // Draw layers from bottom to top
      for (let i = 0; i < numLayers; i++) {
          const layer = layers[i];
          if (!layer.isVisible || !layer.offscreenCanvas) continue;
  
          targetCtx.globalAlpha = layer.opacity;
  
          let offsetX = 0;
          let offsetY = 0;
  
          if (applyOffset) {
              // Example offset logic: shift layers up and left slightly based on index
              const depth = numLayers - 1 - i; // Layer 0 is furthest back
              offsetX = -depth * offsetFactor;
              offsetY = -depth * offsetFactor;
          }
  
          // Apply zoom and potential offset when drawing
          targetCtx.drawImage(
              layer.offscreenCanvas,
              offsetX * zoom, // Apply zoom to offset as well
              offsetY * zoom,
              width * zoom,
              height * zoom
          );
      }
      targetCtx.globalAlpha = 1.0; // Reset global alpha
  }
  
  
  /**
   * Draws a checkerboard pattern on the canvas context.
   */
  export function drawCheckerboard(ctx: CanvasRenderingContext2D, width: number, height: number, squareSize: number = 8): void {
    ctx.save();
    ctx.fillStyle = '#ffffff'; // White background
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#cccccc'; // Light gray squares
    for (let i = 0; i < width; i += squareSize * 2) {
      for (let j = 0; j < height; j += squareSize * 2) {
        ctx.fillRect(i, j, squareSize, squareSize);
        ctx.fillRect(i + squareSize, j + squareSize, squareSize, squareSize);
      }
    }
    ctx.restore();
  }
  
  /**
   * Gets the RGBA color of a pixel on a specific canvas at logical coordinates.
   * Returns null if coordinates are out of bounds or pixel is transparent.
   */
  export function getPixelColor(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number
  ): string | null {
      if (x < 0 || x >= ctx.canvas.width || y < 0 || y >= ctx.canvas.height) {
          return null; // Out of bounds
      }
      const imageData = ctx.getImageData(x, y, 1, 1);
      const [r, g, b, a] = imageData.data;
  
      if (a === 0) {
          return null; // Transparent pixel
      }
  
      // Convert to hex #RRGGBBAA format
      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      return `#<span class="math-inline">\{toHex\(r\)\}</span>{toHex(g)}<span class="math-inline">\{toHex\(b\)\}</span>{toHex(a)}`;
  }
  
  /**
   * Draws a pixel (or rectangle for >1x1) onto a canvas context.
   */
  export function drawPixel(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      color: string,
      pixelSize: number = 1 // For drawing larger "pixels" if needed conceptually, usually 1
  ): void {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, pixelSize, pixelSize);
  }
  
  /**
   * Clears a pixel (or rectangle) on a canvas context.
   */
  export function clearPixel(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      pixelSize: number = 1
  ): void {
      ctx.clearRect(x, y, pixelSize, pixelSize);
  }
  
  /**
    * Draws a line between two points using Bresenham's algorithm (optional, good for smooth lines).
    * Simplified version: just plots points along the line.
    */
   export function drawLine(
     ctx: CanvasRenderingContext2D,
     x0: number, y0: number,
     x1: number, y1: number,
     color: string,
     drawFunc: (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => void
   ) {
     const dx = Math.abs(x1 - x0);
     const dy = Math.abs(y1 - y0);
     const sx = (x0 < x1) ? 1 : -1;
     const sy = (y0 < y1) ? 1 : -1;
     let err = dx - dy;
  
     while (true) {
       drawFunc(ctx, x0, y0, color); // Draw the current point
  
       if ((x0 === x1) && (y0 === y1)) break; // Reached the end
  
       const e2 = 2 * err;
       if (e2 > -dy) { err -= dy; x0 += sx; }
       if (e2 < dx) { err += dx; y0 += sy; }
     }
   }

   interface RgbaPixel {
    r: number;
    g: number;
    b: number;
    a: number;
}

/**
 * Gets the RGBA color of a single pixel from ImageData.
 * @param imageData - The ImageData object.
 * @param x - The x-coordinate of the pixel.
 * @param y - The y-coordinate of the pixel.
 * @returns An RgbaPixel object {r, g, b, a} or null if out of bounds.
 */
export function getPixelFromImageData(imageData: ImageData, x: number, y: number): RgbaPixel | null {
    if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) {
        return null; // Out of bounds
    }
    const index = (y * imageData.width + x) * 4;
    const data = imageData.data;
    return {
        r: data[index],
        g: data[index + 1],
        b: data[index + 2],
        a: data[index + 3],
    };
}

/**
 * Sets the RGBA color of a single pixel within ImageData.
 * @param imageData - The ImageData object to modify.
 * @param x - The x-coordinate of the pixel.
 * @param y - The y-coordinate of the pixel.
 * @param color - The RgbaPixel color {r, g, b, a} to set.
 */
export function setPixelInImageData(imageData: ImageData, x: number, y: number, color: RgbaPixel): void {
    if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) {
        return; // Out of bounds
    }
    const index = (y * imageData.width + x) * 4;
    imageData.data[index] = color.r;
    imageData.data[index + 1] = color.g;
    imageData.data[index + 2] = color.b;
    imageData.data[index + 3] = color.a;
}

/**
 * Compares two RGBA colors.
 * @param color1 - First RgbaPixel.
 * @param color2 - Second RgbaPixel.
 * @returns True if r, g, b, and a components are identical, false otherwise.
 */
export function areColorsEqual(color1: RgbaPixel | null, color2: RgbaPixel | null): boolean {
    if (!color1 || !color2) return color1 === color2; // True if both are null, false if one is null
    return (
        color1.r === color2.r &&
        color1.g === color2.g &&
        color1.b === color2.b &&
        color1.a === color2.a
    );
}

