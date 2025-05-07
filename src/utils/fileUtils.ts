// src/utils/fileUtils.ts

/**
 * Triggers a browser download for the given data URL.
 * @param dataURL The data URL (e.g., from canvas.toDataURL() or URL.createObjectURL()).
 * @param filename The desired filename for the download.
 */
export function downloadDataURL(dataURL: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = filename;
  document.body.appendChild(link); // Required for Firefox to trigger download
  link.click();
  document.body.removeChild(link); // Clean up the temporary link
}

/**
 * Exports a canvas content as a PNG file.
 * @param canvas The HTMLCanvasElement to export.
 * @param filename The desired filename for the PNG file (e.g., "layer_1.png").
 */
export async function exportCanvasAsPNG(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  try {
    // Using canvas.toDataURL for simplicity as it's synchronous for PNG
    const dataURL = canvas.toDataURL('image/png');
    downloadDataURL(dataURL, filename);
  } catch (error) {
    console.error('Error exporting canvas as PNG:', error);
    // Provide user feedback
    alert(`Error exporting canvas as PNG: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Triggers a browser download for a text string.
 * This is used for downloading generated code files like .h or .c files.
 * @param textContent The string content to download.
 * @param filename The desired filename (e.g., "output.txt", "lvgl_assets.h").
 * @param mimeType The MIME type for the file (e.g., "text/plain", "text/x-c", "application/octet-stream").
 */
export function downloadTextFile(
    textContent: string,
    filename: string,
    mimeType: string = 'text/plain' // Default to plain text
): void {
  try {
    // Create a Blob from the text content
    const blob = new Blob([textContent], { type: mimeType });

    // Create an object URL for the Blob
    const url = URL.createObjectURL(blob);

    // Use the downloadDataURL helper to trigger the download
    downloadDataURL(url, filename);

    // Revoke the object URL to free up resources once the download is initiated
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error creating or downloading text file:', error);
    // Provide user feedback
    alert(`Error creating text file: ${error instanceof Error ? error.message : String(error)}`);
  }
}
