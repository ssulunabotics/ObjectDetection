// OpenCV worker to calculate drivability for a vertical slice
// Takes an average of intensities in an area
// Looks for high/low intensities as well
// Also looks for gradients

self.onmessage = function (event) {
    const { pixels, width, height } = event.data;

    // Process only the red channel for the bottom 2/3 of the screen
    const startY = Math.floor(height / 3);
    const bottomHeight = height - startY;
    const redChannel = new Uint8Array(width * bottomHeight);

    // Extract red channel in a single pass
    for (let y = startY; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const pixelIndex = y * width + x;
            redChannel[(y - startY) * width + x] = pixels[pixelIndex * 4];
        }
    }

    // Sobel filter implementation
    function computeGradients(channel, width, height) {
        const gradients = new Float32Array(width * height);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = y * width + x;

                // Sobel operator
                const gx =
                    -channel[i - width - 1] + channel[i - width + 1] -
                    2 * channel[i - 1] + 2 * channel[i + 1] -
                    channel[i + width - 1] + channel[i + width + 1];

                const gy =
                    -channel[i - width - 1] - 2 * channel[i - width] - channel[i - width + 1] +
                    channel[i + width - 1] + 2 * channel[i + width] + channel[i + width + 1];

                gradients[i] = Math.sqrt(gx * gx + gy * gy);
            }
        }
        return gradients;
    }

    // Compute gradients
    const gradients = computeGradients(redChannel, width, bottomHeight);

    // Precompute slice boundaries and weights
    const numVerticalSlices = 27;
    const numHorizontalSlices = 5;
    const sliceWidth = Math.floor(width / numVerticalSlices);
    const sliceHeight = Math.floor(bottomHeight / numHorizontalSlices);
    const drivabilityScores = new Array(numVerticalSlices).fill(0);
    const rowWeights = new Float32Array(bottomHeight).fill(1).map((_, y) => 1 + ((bottomHeight - y) / bottomHeight) * 2);

    // Drivability score calculation
    for (let v = 0; v < numVerticalSlices; v++) {
        let verticalScore = 0;

        for (let h = 0; h < numHorizontalSlices; h++) {
            let gradientSum = 0, intensitySum = 0, highIntensityCount = 0, pixelCount = 0;

            const yStart = h * sliceHeight;
            const yEnd = Math.min((h + 1) * sliceHeight, bottomHeight);
            const xStart = v * sliceWidth;
            const xEnd = Math.min((v + 1) * sliceWidth, width);

            for (let y = yStart; y < yEnd; y++) {
                const rowWeight = rowWeights[y];

                for (let x = xStart; x < xEnd; x++) {
                    const i = y * width + x;
                    const intensity = redChannel[i];
                    const gradient = gradients[i];

                    gradientSum += gradient * rowWeight;
                    intensitySum += intensity * rowWeight;
                    pixelCount++;

                    if (intensity > 160) highIntensityCount++;
                }
            }

            // Intermediate scores
            const avgGradient = gradientSum / pixelCount;
            const avgIntensity = intensitySum / pixelCount;
            const highIntensityRatio = highIntensityCount / pixelCount;
            const highIntensityPenalty = highIntensityRatio > 0.1 ? 0.5 : 1;

            const normalizedIntensity = (avgIntensity / 255) * highIntensityPenalty;
            verticalScore += 0.4 * (1 - avgGradient / 255) + 0.6 * normalizedIntensity;
        }

        // Average slice scores
        drivabilityScores[v] = verticalScore / numHorizontalSlices;
    }

    // Apply penalties to edge slices
    drivabilityScores[0] = Math.max(0, drivabilityScores[0] - 0.1);
    drivabilityScores[drivabilityScores.length - 1] = Math.max(0, drivabilityScores[drivabilityScores.length - 1] - 0.1);

    self.postMessage({ drivabilityScores });
};