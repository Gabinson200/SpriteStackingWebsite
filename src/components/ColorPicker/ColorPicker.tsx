// src/components/ColorPicker/ColorPicker.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../state/AppContext';
import { parseColor, rgbaToHex, rgbToHsv, hsvToRgb } from '../../utils/colorUtils';
import type { RgbaColor, HsvColor } from '../../utils/colorUtils'; // Import types

// Define some default swatches (remains the same)
const defaultSwatches: string[] = [
    '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
    '#FFFFFF', '#C0C0C0', '#808080', '#000000', '#800000', '#008000',
    '#000080', '#808000', '#800080', '#008080', '#FFA500', '#A52A2A',
];

export const ColorPicker: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { primaryColor, isColorPickerOpen } = state;

    // Internal state for inputs/sliders
    const [hex, setHex] = useState('#000000');
    const [alpha, setAlpha] = useState(1.0);
    const [rgb, setRgb] = useState<Omit<RgbaColor, 'a'>>({ r: 0, g: 0, b: 0 });
    const [hsv, setHsv] = useState<HsvColor>({ h: 0, s: 0, v: 0 });

    // --- Update internal state from global primaryColor ---
    useEffect(() => {
        if (!isColorPickerOpen) return;
        try {
            const parsed = parseColor(primaryColor);
            if (parsed) {
                const currentHex = rgbaToHex(parsed.r, parsed.g, parsed.b).toUpperCase();
                const currentHsv = rgbToHsv(parsed.r, parsed.g, parsed.b);

                if (currentHex !== hex) setHex(currentHex);
                if (Math.abs(parsed.a - alpha) > 0.01) setAlpha(parsed.a);
                if (parsed.r !== rgb.r || parsed.g !== rgb.g || parsed.b !== rgb.b) setRgb({ r: parsed.r, g: parsed.g, b: parsed.b });
                // Compare HSV with tolerance
                if (Math.abs(currentHsv.h - hsv.h) > 1 || Math.abs(currentHsv.s - hsv.s) > 0.5 || Math.abs(currentHsv.v - hsv.v) > 0.5) setHsv(currentHsv);
            }
        } catch (error) {
            console.error("Error parsing color in ColorPicker:", primaryColor, error);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [primaryColor, isColorPickerOpen]);

    // --- Dispatch updated color (centralized function) ---
    const dispatchColorUpdate = useCallback((r: number, g: number, b: number, a: number) => {
        const finalHex = rgbaToHex(r, g, b, true, a).toLowerCase();
        if (finalHex !== primaryColor.toLowerCase()) {
            dispatch({ type: 'SET_PRIMARY_COLOR', color: finalHex });
        }
    }, [dispatch, primaryColor]);

    // --- Input Handlers (remain the same) ---
    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let newHex = e.target.value;
        setHex(newHex);
        if (/^#[0-9A-F]{6}$/i.test(newHex)) {
            const parsed = parseColor(newHex);
            if (parsed) {
                dispatchColorUpdate(parsed.r, parsed.g, parsed.b, alpha);
            }
        }
    };

    const handleAlphaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newAlpha = parseFloat(e.target.value);
        setAlpha(newAlpha);
        dispatchColorUpdate(rgb.r, rgb.g, rgb.b, newAlpha);
    };

    const handleRgbChange = (channel: 'r' | 'g' | 'b', value: string) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) && value !== '') return;
        const clampedValue = Math.max(0, Math.min(255, numValue || 0));
        const newRgb = { ...rgb, [channel]: clampedValue };
        setRgb(newRgb);
        const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
        setHsv(newHsv);
        setHex(rgbaToHex(newRgb.r, newRgb.g, newRgb.b));
        dispatchColorUpdate(newRgb.r, newRgb.g, newRgb.b, alpha);
    };

    const handleHsvChange = (channel: 'h' | 's' | 'v', value: string) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;
        let newHsv = { ...hsv };
        if (channel === 'h') newHsv.h = Math.max(0, Math.min(360, numValue));
        else if (channel === 's') newHsv.s = Math.max(0, Math.min(100, numValue));
        else if (channel === 'v') newHsv.v = Math.max(0, Math.min(100, numValue));
        setHsv(newHsv);
        const newRgb = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
        setRgb(newRgb);
        setHex(rgbaToHex(newRgb.r, newRgb.g, newRgb.b));
        dispatchColorUpdate(newRgb.r, newRgb.g, newRgb.b, alpha);
    };

    const handleSwatchClick = (swatchHex: string) => {
        const parsed = parseColor(swatchHex);
        if (parsed) {
            dispatchColorUpdate(parsed.r, parsed.g, parsed.b, alpha);
        }
    };

    const handleClose = () => {
        dispatch({ type: 'TOGGLE_COLOR_PICKER', open: false });
    };

    // --- Dynamic Styles ---
    const hueBackground = 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)';
    const satBackground = `linear-gradient(to right, hsl(${hsv.h}, 0%, ${hsv.v/2 + 50}%), hsl(${hsv.h}, 100%, 50%))`; // Adjusted for better visibility
    const valBackground = `linear-gradient(to right, black, hsl(${hsv.h}, ${hsv.s}%, 50%))`;
    // --- Fix for Alpha Slider Style Warning ---
    const alphaGradient = `linear-gradient(to right, rgba(${rgb.r},${rgb.g},${rgb.b}, 0), rgba(${rgb.r},${rgb.g},${rgb.b}, 1))`;
    const checkerboardUrl = `url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill-opacity=".05"%3E%3Crect x="8" width="8" height="8" fill="%23000" /%3E%3Crect y="8" width="8" height="8" fill="%23000" /%3E%3C/svg%3E')`; // SVG checkerboard

    // --- Render ---
    if (!isColorPickerOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-40" onClick={handleClose}>
            <div
                className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl w-full max-w-xs text-gray-900 dark:text-gray-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header (remains the same) */}
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">Color Picker</h3>
                    <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white text-2xl leading-none">&times;</button>
                </div>

                {/* Color Preview (remains the same) */}
                 <div
                    className="w-full h-16 rounded mb-3 border border-gray-300 dark:border-gray-600 bg-checkerboard"
                    style={{ backgroundColor: rgbaToHex(rgb.r, rgb.g, rgb.b, true, alpha) }}
                ></div>

                {/* Sliders (HSV + Alpha) */}
                <div className="space-y-2 mb-3">
                    {/* Hue */}
                    <div>
                        <label htmlFor="hue" className="text-xs block">H ({hsv.h.toFixed(0)}°)</label>
                        <input type="range" id="hue" min="0" max="360" step="1" value={hsv.h}
                            onChange={(e) => handleHsvChange('h', e.target.value)}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                            style={{ background: hueBackground }} />
                    </div>
                    {/* Saturation */}
                    <div>
                        <label htmlFor="saturation" className="text-xs block">S ({hsv.s.toFixed(0)}%)</label>
                        <input type="range" id="saturation" min="0" max="100" step="1" value={hsv.s}
                            onChange={(e) => handleHsvChange('s', e.target.value)}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                            style={{ background: satBackground }} />
                    </div>
                    {/* Value */}
                    <div>
                        <label htmlFor="value" className="text-xs block">V ({hsv.v.toFixed(0)}%)</label>
                        <input type="range" id="value" min="0" max="100" step="1" value={hsv.v}
                            onChange={(e) => handleHsvChange('v', e.target.value)}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gradient-to-r from-black"
                            style={{ background: valBackground }}/>
                    </div>
                    {/* Alpha */}
                    <div>
                        <label htmlFor="alpha" className="text-xs block">A ({alpha.toFixed(2)})</label>
                        <input type="range" id="alpha" min="0" max="1" step="0.01" value={alpha}
                            onChange={handleAlphaChange}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                            // Apply gradient and checkerboard as separate background layers
                            style={{
                                backgroundImage: `${alphaGradient}, ${checkerboardUrl}`,
                                backgroundRepeat: 'no-repeat, repeat',
                                backgroundSize: '100% 100%, 10px 10px', // Size for gradient and checkerboard
                            }} />
                    </div>
                </div>

                {/* Inputs (Hex + RGB) (remain the same) */}
                 <div className="flex space-x-2 mb-3">
                    {/* Hex Input */}
                    <div className="flex-1">
                        <label htmlFor="hexColor" className="text-xs block">Hex</label>
                        <input type="text" id="hexColor" value={hex} onChange={handleHexChange} maxLength={7}
                            className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm font-mono" />
                    </div>
                    {/* RGB Inputs */}
                    {(['r', 'g', 'b'] as const).map((channel) => (
                        <div key={channel} className="w-12">
                            <label htmlFor={`rgb-${channel}`} className="text-xs block text-center uppercase">{channel}</label>
                            <input type="number" id={`rgb-${channel}`} min="0" max="255" step="1"
                                value={rgb[channel]}
                                onChange={(e) => handleRgbChange(channel, e.target.value)}
                                onFocus={(e) => e.target.select()}
                                className="w-full px-1 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                    ))}
                </div>

                {/* Swatch Grid (remains the same) */}
                 <div className="mb-2">
                    <label className="text-xs block mb-1">Swatches</label>
                    <div className="grid grid-cols-6 gap-1">
                        {defaultSwatches.map((swatch) => (
                            <button
                                key={swatch}
                                onClick={() => handleSwatchClick(swatch)}
                                className="w-full h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800"
                                style={{ backgroundColor: swatch }}
                                title={swatch}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
