// Pixel Worker
// Flip and Resize pixel data in a separate thead so we don't block the UI

// Optimized function to flip pixel data vertically
function flipPixelsVertically(pixels, width, height) {
    const bytesPerRow = width; // 1 byte per pixel
    const halfHeight = Math.floor(height / 2); // Process only half the rows
    const tempRow = new Uint8Array(bytesPerRow); // Temporary buffer for row swapping

    for (let row = 0; row < halfHeight; row++) {
        const topRow = row * bytesPerRow;
        const bottomRow = (height - row - 1) * bytesPerRow;

        // Use faster array copy operations
        tempRow.set(pixels.subarray(topRow, topRow + bytesPerRow)); // Copy top row to temp buffer
        pixels.copyWithin(topRow, bottomRow, bottomRow + bytesPerRow); // Copy bottom row to top
        pixels.set(tempRow, bottomRow); // Copy temp buffer to bottom row
    }
    return pixels; // Return modified pixels array
}

// Optimized function to resize grayscale pixel data using bilinear interpolation
function resizePixelsBilinear(sourcePixels, sourceWidth, sourceHeight, targetWidth, targetHeight) {
    const targetPixels = new Uint8Array(targetWidth * targetHeight); // Grayscale output array
    const xRatio = sourceWidth / targetWidth; // Scale factor for x
    const yRatio = sourceHeight / targetHeight; // Scale factor for y

    for (let ty = 0; ty < targetHeight; ty++) {
        const sy = ty * yRatio;
        const y0 = Math.floor(sy);
        const y1 = Math.min(y0 + 1, sourceHeight - 1);
        const dy = sy - y0;

        for (let tx = 0; tx < targetWidth; tx++) {
            const sx = tx * xRatio;
            const x0 = Math.floor(sx);
            const x1 = Math.min(x0 + 1, sourceWidth - 1);
            const dx = sx - x0;

            const targetIndex = ty * targetWidth + tx;

            // Perform bilinear interpolation for the single channel
            const c00 = sourcePixels[y0 * sourceWidth + x0];
            const c01 = sourcePixels[y0 * sourceWidth + x1];
            const c10 = sourcePixels[y1 * sourceWidth + x0];
            const c11 = sourcePixels[y1 * sourceWidth + x1];

            targetPixels[targetIndex] =
                c00 * (1 - dx) * (1 - dy) +
                c01 * dx * (1 - dy) +
                c10 * (1 - dx) * dy +
                c11 * dx * dy;
        }
    }
    return targetPixels; // Return resized pixel array
}

// Handle messages from the main thread
self.onmessage = function (event) {
    const { type, data } = event.data;

    if (type === 'flip') {
        const { pixels, width, height } = data;
        const flippedPixels = flipPixelsVertically(pixels, width, height);
        self.postMessage({ type: 'flipped', pixels: flippedPixels });
    }

    if (type === 'resize') {
        const { sourcePixels, sourceWidth, sourceHeight, targetWidth, targetHeight } = data;
        const resizedPixels = resizePixelsBilinear(sourcePixels, sourceWidth, sourceHeight, targetWidth, targetHeight);
        self.postMessage({ type: 'resized', pixels: resizedPixels });
    }
};