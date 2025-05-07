// src/utils/lvglExporter.ts
import type { Layer } from '../state/types';
import { downloadTextFile } from './fileUtils'; // This function will be added to fileUtils.ts

/**
 * Converts a layer name to a valid C variable name.
 * Example: "Layer 1" -> "layer_1", "My Sprite!" -> "my_sprite_"
 * Ensures the name starts with a letter or underscore.
 * @param name The original layer name.
 * @returns A sanitized string suitable for C variable names.
 */
function sanitizeLayerNameForC(name: string): string {
    let sanitized = name
        .replace(/[^a-zA-Z0-9_]/g, '_') // Replace non-alphanumeric with underscore
        .replace(/_{2,}/g, '_')         // Replace multiple underscores with a single one
        .replace(/^_+|_+$/g, '');       // Trim leading/trailing underscores

    // Ensure it doesn't start with a number
    if (/^[0-9]/.test(sanitized)) {
        sanitized = '_' + sanitized;
    }

    // If after sanitization, the name is empty (e.g., was "!!!"), provide a default.
    return sanitized.toLowerCase() || 'image_data';
}

/**
 * Converts RGBA8888 pixel data to LVGL 16-bit True Color with Alpha format (RGB565 + A8).
 * Each pixel becomes 3 bytes: [ColorByte1, ColorByte2, AlphaByte].
 * @param r Red component (0-255)
 * @param g Green component (0-255)
 * @param b Blue component (0-255)
 * @param a Alpha component (0-255)
 * @param swapColorBytes If true, the two 16-bit color bytes are swapped (for LV_COLOR_16_SWAP).
 * @returns Array of 3 numbers (bytes) [C1, C2, A].
 */
function rgbaToLvglTrueColorAlpha16(
    r: number, g: number, b: number, a: number,
    swapColorBytes: boolean
): [number, number, number] {
    // Convert to RGB565: RRRRR GGGGGG BBBBB
    const r5 = (r >> 3) & 0x1F; // 5 bits for Red
    const g6 = (g >> 2) & 0x3F; // 6 bits for Green
    const b5 = (b >> 3) & 0x1F; // 5 bits for Blue
    const rgb565 = (r5 << 11) | (g6 << 5) | b5;

    let colorByte1 = (rgb565 >> 8) & 0xFF; // High byte of RGB565
    let colorByte2 = rgb565 & 0xFF;       // Low byte of RGB565

    if (swapColorBytes) {
        [colorByte1, colorByte2] = [colorByte2, colorByte1]; // Swap if LV_COLOR_16_SWAP is set
    }

    // LVGL format for LV_IMG_CF_TRUE_COLOR_ALPHA with 16-bit color
    // is typically [COLOR_HIGH_BYTE, COLOR_LOW_BYTE, ALPHA_BYTE]
    return [colorByte1, colorByte2, a];
}

/**
 * Formats an array of pixel byte values into a C array string.
 * @param pixelBytes Array of numbers representing bytes.
 * @param bytesPerLine How many byte values (e.g., "0xFF") to put on each line.
 * @returns A string formatted as a C byte array initializer.
 */
function formatPixelDataAsCArray(pixelBytes: number[], bytesPerLine: number = 12): string {
    let cArrayString = "  "; // Initial indent
    for (let i = 0; i < pixelBytes.length; i++) {
        if (i > 0) {
            cArrayString += ", ";
        }
        if (i % bytesPerLine === 0 && i > 0) {
            cArrayString += "\n  "; // New line with indent
        }
        cArrayString += `0x${pixelBytes[i].toString(16).padStart(2, '0').toUpperCase()}`;
    }
    return cArrayString;
}

/**
 * Generates an LVGL C header file string for the given layers.
 * Targets LV_IMG_CF_TRUE_COLOR_ALPHA with 16-bit color depth (RGB565 + A8).
 * @param layersToExport Array of Layer objects to export. Assumes these are visible and have canvas data.
 * @param canvasWidth The width of the layers.
 * @param canvasHeight The height of the layers.
 * @param lvColor16Swap Boolean indicating if LV_COLOR_16_SWAP is enabled in the target LVGL project.
 * @param baseOutputFilename The base name for the output .h file (without .h extension).
 */
export function exportLayersToLvglH(
    layersToExport: Layer[],
    canvasWidth: number,
    canvasHeight: number,
    lvColor16Swap: boolean,
    baseOutputFilename: string = "lvgl_images"
): void {
    if (!layersToExport || layersToExport.length === 0) {
        console.warn("No layers provided for LVGL export.");
        throw new Error("No layers to export.");
    }
    if (canvasWidth <= 0 || canvasHeight <= 0) {
        console.warn("Invalid canvas dimensions for LVGL export.");
        throw new Error("Invalid canvas dimensions.");
    }

    let headerFileContent = `/*\n * LVGL Image Asset Export from SpriteStacker\n */\n\n`;
    headerFileContent += `#ifdef __has_include\n`;
    headerFileContent += `  #if __has_include("lvgl.h")\n`;
    headerFileContent += `    #ifndef LV_LVGL_H_INCLUDE_SIMPLE\n`;
    headerFileContent += `      #define LV_LVGL_H_INCLUDE_SIMPLE\n`;
    headerFileContent += `    #endif\n`;
    headerFileContent += `  #endif\n`;
    headerFileContent += `#endif\n\n`;
    headerFileContent += `#if defined(LV_LVGL_H_INCLUDE_SIMPLE)\n`;
    headerFileContent += `  #include "lvgl.h"\n`;
    headerFileContent += `#else\n`;
    headerFileContent += `  #include "lvgl/lvgl.h"\n`;
    headerFileContent += `#endif\n\n`;

    headerFileContent += `#ifndef LV_ATTRIBUTE_MEM_ALIGN\n`;
    headerFileContent += `#define LV_ATTRIBUTE_MEM_ALIGN\n`;
    headerFileContent += `#endif\n\n`;

    layersToExport.forEach((layer, index) => {
        if (!layer.offscreenCanvas) {
            console.warn(`Layer "${layer.name}" (index ${index}) has no offscreenCanvas, skipping.`);
            return; // Skip this layer
        }

        const baseVarName = sanitizeLayerNameForC(layer.name) || `image_${index}`;
        const mapVarName = `${baseVarName}_map`;
        const dscVarName = baseVarName; // Descriptor often has same base name

        headerFileContent += `#ifndef LV_ATTRIBUTE_IMG_${dscVarName}\n`;
        headerFileContent += `#define LV_ATTRIBUTE_IMG_${dscVarName}\n`;
        headerFileContent += `#endif\n\n`;

        const ctx = layer.offscreenCanvas.getContext('2d');
        if (!ctx) {
            console.warn(`Could not get 2D context for layer "${layer.name}", skipping.`);
            return; // Skip this layer
        }

        const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const rawPixelData = imageData.data; // Uint8ClampedArray: [R,G,B,A, R,G,B,A, ...]
        const lvglPixelBytes: number[] = [];

        for (let i = 0; i < rawPixelData.length; i += 4) {
            const r = rawPixelData[i];
            const g = rawPixelData[i + 1];
            const b = rawPixelData[i + 2];
            const a = rawPixelData[i + 3];

            const [colorByte1, colorByte2, alphaByte] = rgbaToLvglTrueColorAlpha16(r, g, b, a, lvColor16Swap);
            lvglPixelBytes.push(colorByte1, colorByte2, alphaByte);
        }

        headerFileContent += `const LV_ATTRIBUTE_MEM_ALIGN LV_ATTRIBUTE_LARGE_CONST LV_ATTRIBUTE_IMG_${dscVarName} uint8_t ${mapVarName}[] = {\n`;
        headerFileContent += `  /*Pixel format: Alpha 8 bit, Red: 5 bit, Green: 6 bit, Blue: 5 bit*/\n`;
        if (lvColor16Swap) {
            headerFileContent += `  /*LV_COLOR_16_SWAP is TRUE - LSB first for color bytes*/\n`;
        } else {
            headerFileContent += `  /*LV_COLOR_16_SWAP is FALSE - MSB first for color bytes*/\n`;
        }
        headerFileContent += `${formatPixelDataAsCArray(lvglPixelBytes)}\n};\n\n`;

        // Data size for LV_IMG_CF_TRUE_COLOR_ALPHA is (width * height * LV_IMG_PX_SIZE_ALPHA_BYTE)
        // where LV_IMG_PX_SIZE_ALPHA_BYTE is 3 for 16-bit color + 8-bit alpha.
        const dataSizeInBytes = canvasWidth * canvasHeight * 3;

        headerFileContent += `const lv_img_dsc_t ${dscVarName} = {\n`;
        headerFileContent += `  .header = {\n`;
        headerFileContent += `    .cf = LV_IMG_CF_TRUE_COLOR_ALPHA,\n`;
        headerFileContent += `    .always_zero = 0,\n`;
        headerFileContent += `    .reserved = 0,\n`;
        headerFileContent += `    .w = ${canvasWidth},\n`;
        headerFileContent += `    .h = ${canvasHeight},\n`;
        headerFileContent += `  },\n`;
        headerFileContent += `  .data_size = ${dataSizeInBytes}, /* ${canvasWidth}*${canvasHeight}*3 bytes */\n`;
        headerFileContent += `  .data = ${mapVarName},\n`;
        headerFileContent += `};\n\n`;
    });

    // Trigger download
    const finalFilename = `${sanitizeLayerNameForC(baseOutputFilename)}.h`;
    downloadTextFile(headerFileContent, finalFilename, 'text/x-c');
}

