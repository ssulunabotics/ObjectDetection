self.onmessage = function (event) {
    const { pixels, width, height } = event.data;

    // Process only the red channel for the bottom 2/3 of the screen
    const startY = Math.floor(height / 3);
    const bottomHeight = height - startY;
    let redChannel = new Uint8Array(width * bottomHeight);

    for (let y = startY; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y - startY) * width + x;
            redChannel[index] = pixels[(y * width + x) * 4]; // Extract red channel
        }
    }

    // Compute gradients along x and y directions using a Sobel filter
    function computeGradients(channel, width, height) {
        const gradients = new Float32Array(width * height);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const index = y * width + x;
                
                // Compute gradient in x and y directions using Sobel filter
                const gx = (
                    -1 * channel[index - width - 1] + 1 * channel[index - width + 1] +
                    -2 * channel[index - 1] + 2 * channel[index + 1] +
                    -1 * channel[index + width - 1] + 1 * channel[index + width + 1]
                );

                const gy = (
                    -1 * channel[index - width - 1] + -2 * channel[index - width] + -1 * channel[index - width + 1] +
                    1 * channel[index + width - 1] + 2 * channel[index + width] + 1 * channel[index + width + 1]
                );

                gradients[index] = Math.sqrt(gx * gx + gy * gy);
            }
        }
        return gradients;
    }

    // Compute gradient magnitudes for the red channel
    const gradients = computeGradients(redChannel, width, bottomHeight);

    // Drivability score calculation based on gradients and intensity
    const numVerticalSlices = 27;  // Number of vertical slices
    const numHorizontalSlices = 5; // Number of horizontal slices within each vertical slice
    const sliceWidth = Math.floor(width / numVerticalSlices);
    const sliceHeight = Math.floor(bottomHeight / numHorizontalSlices);
    let drivabilityScores = new Array(numVerticalSlices).fill(0);

    for (let v = 0; v < numVerticalSlices; v++) {
        let verticalScore = 0;

        for (let h = 0; h < numHorizontalSlices; h++) {
            let gradientSum = 0;
            let intensitySum = 0;
            let highIntensityCount = 0;
            let pixelCount = 0;

            for (let y = h * sliceHeight; y < (h + 1) * sliceHeight; y++) {
                const rowWeight = 1 + ((bottomHeight - y) / bottomHeight) * 2; // Increase weight near the camera

                for (let x = v * sliceWidth; x < (v + 1) * sliceWidth; x++) {
                    const index = y * width + x;
                    const intensity = redChannel[index];
                    const gradient = gradients[index];

                    gradientSum += gradient * rowWeight;
                    intensitySum += intensity * rowWeight;
                    pixelCount++;

                    // Count high-intensity pixels to detect reflective objects
                    if (intensity > 160) { // Threshold for high intensity
                        highIntensityCount++;
                    }
                }
            }

            // Calculate intermediate scores for this horizontal slice within the vertical slice
            const avgGradient = gradientSum / pixelCount;
            const avgIntensity = intensitySum / pixelCount;
            const highIntensityRatio = highIntensityCount / pixelCount;

            // Apply penalty if high-intensity pixels exceed a threshold, suggesting a reflective object
            const highIntensityPenalty = highIntensityRatio > 0.1 ? 0.5 : 1;
            const normalizedIntensity = (avgIntensity / 255) * highIntensityPenalty;

            const horizontalScore = 0.4 * (1 - avgGradient / 255) + 0.6 * normalizedIntensity;
            verticalScore += horizontalScore; // Sum scores from each horizontal slice
        }

        // Average horizontal slice scores for the final vertical slice score
        drivabilityScores[v] = verticalScore / numHorizontalSlices;
    }

    // Apply flat penalties to the first and last vertical slice scores
    const penalty = 0.1;
    drivabilityScores[0] = Math.max(0, drivabilityScores[0] - penalty);
    drivabilityScores[drivabilityScores.length - 1] = Math.max(0, drivabilityScores[drivabilityScores.length - 1] - penalty);

    // Normalize combined scores
    const maxScore = Math.max(...drivabilityScores);
    const minScore = Math.min(...drivabilityScores);
    drivabilityScores = drivabilityScores.map(score => (score - minScore) / (maxScore - minScore));

    self.postMessage({ drivabilityScores });
};