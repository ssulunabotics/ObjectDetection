self.onmessage = function (event) {
    const { pixels, width, height } = event.data;

    // Process only the blue channel for the bottom 2/3 of the screen
    const startY = Math.floor(height / 3);
    const bottomHeight = height - startY;
    let blueChannel = new Uint8Array(width * bottomHeight);

    for (let y = startY; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            blueChannel[(y - startY) * width + x] = pixels[index + 2];
        }
    }

    // Compute gradients along x and y directions
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

    // Compute gradient magnitudes for the blue channel
    const gradients = computeGradients(blueChannel, width, bottomHeight);

    // Drivability score calculation based on gradients and intensity
    const numSlices = 10;
    const sliceWidth = Math.floor(width / numSlices);
    let drivabilityScores = [];

    for (let i = 0; i < numSlices; i++) {
        let gradientMagnitudes = [];
        let intensities = [];

        for (let y = 0; y < bottomHeight; y++) {
            for (let x = i * sliceWidth; x < (i + 1) * sliceWidth; x++) {
                const index = y * width + x;
                gradientMagnitudes.push(gradients[index]);
                intensities.push(blueChannel[index]);
            }
        }

        // Calculate gradient-based score
        const medianGradient = gradientMagnitudes.sort((a, b) => a - b)[Math.floor(gradientMagnitudes.length / 2)];
        const threshold = 10; // Adjust for sensitivity to sharp gradients
        const gradientInconsistencyCount = gradientMagnitudes.reduce(
            (count, gradient) => Math.abs(gradient - medianGradient) > threshold ? count + 1 : count,
            0
        );
        const gradientScore = 1 - gradientInconsistencyCount / gradientMagnitudes.length;

        // Calculate intensity-based score
        const averageIntensity = intensities.reduce((sum, val) => sum + val, 0) / intensities.length;
        const intensityScore = averageIntensity / 255; // Normalize to 0-1 range

        // Combine scores with weighted factors
        const combinedScore = 0.5 * gradientScore + 0.5 * intensityScore;
        drivabilityScores.push(combinedScore);
    }

    // Apply flat penalties to the first and last elements
    const penalty = 0.1; // Adjust this penalty value as needed
    drivabilityScores[0] = Math.max(0, drivabilityScores[0] - penalty);
    drivabilityScores[drivabilityScores.length - 1] = Math.max(0, drivabilityScores[drivabilityScores.length - 1] - penalty);

    // Normalize combined scores
    const maxScore = Math.max(...drivabilityScores);
    const minScore = Math.min(...drivabilityScores);
    drivabilityScores = drivabilityScores.map(score => (score - minScore) / (maxScore - minScore));

    self.postMessage({ drivabilityScores });
};