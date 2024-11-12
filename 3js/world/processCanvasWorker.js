// processCanvasWorker.js

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

    const numSlices = 10;
    const sliceWidth = Math.floor(width / numSlices);
    let drivabilityScores = [];

    for (let i = 0; i < numSlices; i++) {
        let intensities = [];
        for (let y = 0; y < bottomHeight; y++) {
            for (let x = i * sliceWidth; x < (i + 1) * sliceWidth; x++) {
                intensities.push(blueChannel[y * width + x]);
            }
        }

        intensities.sort((a, b) => a - b);
        const medianIntensity = intensities[Math.floor(intensities.length / 2)];

        const intensityThreshold = 20;
        let inconsistencyCount = intensities.reduce((count, intensity) => 
            Math.abs(intensity - medianIntensity) > intensityThreshold ? count + 1 : count, 0);

        const totalPixels = intensities.length;
        drivabilityScores.push(1 - inconsistencyCount / totalPixels);
    }

    // Normalize scores
    const maxScore = Math.max(...drivabilityScores);
    const minScore = Math.min(...drivabilityScores);
    drivabilityScores = drivabilityScores.map(score => (score - minScore) / (maxScore - minScore));

    self.postMessage({ drivabilityScores });
};