// src/utils/fileUtils.ts

/**
 * Triggers a browser download for the given data URL.
 */
export function downloadDataURL(dataURL: string, filename: string): void {
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link);
  }
  
  /**
   * Exports a canvas content as a PNG file.
   */
  export async function exportCanvasAsPNG(canvas: HTMLCanvasElement, filename: string): Promise<void> {
    try {
      // Using canvas.toDataURL for simplicity as requested (no server)
      const dataURL = canvas.toDataURL('image/png');
      downloadDataURL(dataURL, filename);
  
      // Alternative using blob (potentially better for very large files, but async)
      // canvas.toBlob((blob) => {
      //   if (blob) {
      //     const url = URL.createObjectURL(blob);
      //     downloadDataURL(url, filename);
      //     URL.revokeObjectURL(url); // Clean up blob URL
      //   } else {
      //     console.error('Failed to create blob from canvas.');
      //     alert('Error exporting canvas: Could not create image blob.');
      //   }
      // }, 'image/png');
  
    } catch (error) {
      console.error('Error exporting canvas:', error);
      alert(`Error exporting canvas: ${error instanceof Error ? error.message : String(error)}`);
    }
  }